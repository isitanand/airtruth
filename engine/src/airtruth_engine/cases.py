"""Flight case coordinator: handles passenger actions, airline weather-excuse injection, radar flash, and claim packets."""
from datetime import datetime
from hashlib import sha256

from .engine import Engine
from .events import AssertedBy, Event, EventType, Location, Proof, Raw, sign_adsb_coord
from .profiles import statutory_amount
from .projection import ExcuseState
from .resolver import Policy, build_claim_packet, detect_root_cause, phrase, resolve, situation


class CaseDesk:
    def __init__(self, engine: Engine, brand_for, policy_for, emit=None):
        self.engine = engine
        self.brand_for = brand_for
        self.policy_for = policy_for
        self.emit = emit or (lambda *a: None)
        self.states: dict[tuple[str, str], dict] = {}
        self.cases: dict[tuple[str, str], str] = {}
        self.remedies: dict[tuple[str, str], str] = {}

    def state(self, tenant_id: str, flight_ref: str) -> dict | None:
        return self.states.get((tenant_id, flight_ref))

    def situation(self, tenant_id: str, flight_ref: str):
        return situation(self.engine, tenant_id, flight_ref, self.brand_for(tenant_id))

    def packet(self, tenant_id: str, flight_ref: str) -> dict | None:
        s = self.situation(tenant_id, flight_ref)
        return build_claim_packet(s) if s else None

    def ingest(self, event: Event, notify: bool = True) -> list:
        findings = self.engine.ingest(event)
        if event.type in (EventType.EXCUSE_CLAIMED, EventType.CREW_DUTY, EventType.RUNWAY_LOG) or findings:
            s = self.situation(event.tenant_id, event.flight_ref)
            if s and (s.p.excuse_claim or s.live):
                action = "airline_claims_weather" if event.type is EventType.EXCUSE_CLAIMED else "generate_packet"
                self._decide(event.tenant_id, event.flight_ref, action, notify=notify)
        return findings

    def act(self, tenant_id: str, flight_ref: str, action: str, locale: str = "en-IN") -> dict:
        s = self.situation(tenant_id, flight_ref)
        if s is None:
            raise KeyError(flight_ref)
        p = s.p
        now = self.engine.clock.now()
        suffix = f"act:{len(s.events) + 1}:{action}"

        if action == "airline_claims_weather":
            # Airline officially posts "Bad Weather" excuse — ensure all contradicting telemetry is also surfaced for audit!
            station = p.origin_icao or "VIDP"
            if not p.excuse_claim:
                self._append(
                    tenant_id, flight_ref, EventType.EXCUSE_CLAIMED, AssertedBy.AIRLINE, f"{suffix}:excuse",
                    {
                        "excuse": "weather",
                        "station": station,
                        "claimed_window": f"{now:%H:%M}–{(now):%H:%M} local",
                        "message": f"Flight delayed due to adverse weather at {station} — extraordinary exemption invoked",
                        "waives_payout": True,
                    },
                    source="airline.ops_dcs",
                    raw=Raw(code="WX_HOLD", message=f"Adverse weather at {station}", carrier=s.brand),
                )
            # Ensure a signed ADS-B coordinate ping is anchored at this challenge timestamp
            if not p.adsb_pings:
                lat, lon = (28.5562, 77.1000) if "VIDP" in station or "DEL" in (p.route or "") else (40.6413, -73.7781) if "JFK" in (p.route or "") else (51.4700, -0.4543)
                sig = sign_adsb_coord(p.tail_number or p.flight_ref, p.icao24, now.isoformat(), lat, lon, 0)
                self._append(
                    tenant_id, flight_ref, EventType.ADSB_POSITION, AssertedBy.ADSB, f"{suffix}:adsb",
                    {"callsign": p.flight_code or p.flight_ref, "groundspeed_kts": 0, "phase": "gate_hold"},
                    source="adsb.exchange",
                    location=Location(lat=lat, lon=lon, alt_ft=0, airport=station, icao24=p.icao24, tail=p.tail_number),
                    proof=Proof(adsb_signed=True, signature_sha256=sig),
                )
            s = self.situation(tenant_id, flight_ref)
            assert s is not None
            pkt = build_claim_packet(s)
            if pkt and not s.p.payout.packet_id:
                self._append(
                    tenant_id, flight_ref, EventType.PAYOUT_PACKET, AssertedBy.ENGINE, f"{suffix}:pkt",
                    {"stage": "packet_issued", "packet_id": pkt["packet_id"], "amount": pkt["amount"],
                     "currency": pkt["currency"], "signature_sha256": pkt["signature_sha256"]},
                    source="airtruth.packet_sealer",
                )
        elif action == "challenge_weather":
            self._append(
                tenant_id, flight_ref, EventType.PASSENGER_CHALLENGE, AssertedBy.PASSENGER, suffix,
                {"challenged_excuse": p.excuse_claim.excuse if p.excuse_claim else "weather"},
                source="passenger.app",
            )
        elif action == "generate_packet":
            pkt = build_claim_packet(s)
            if pkt:
                self._append(
                    tenant_id, flight_ref, EventType.PAYOUT_PACKET, AssertedBy.ENGINE, suffix,
                    {"stage": "packet_issued", "packet_id": pkt["packet_id"], "amount": pkt["amount"],
                     "currency": pkt["currency"], "signature_sha256": pkt["signature_sha256"]},
                    source="airtruth.packet_sealer",
                )
        elif action == "submit_claim":
            pkt = build_claim_packet(s)
            self._append(
                tenant_id, flight_ref, EventType.PAYOUT_PACKET, AssertedBy.PASSENGER, suffix,
                {"stage": "submitted", "packet_id": pkt["packet_id"] if pkt else None,
                 "amount": pkt["amount"] if pkt else p.payout.amount,
                 "currency": s.profile.currency, "signature_sha256": pkt["signature_sha256"] if pkt else None},
                source="airtruth.statutory_portal",
            )
        elif action == "escalate_regulator":
            self._append(
                tenant_id, flight_ref, EventType.PASSENGER_CLAIM, AssertedBy.PASSENGER, suffix,
                {"regulator": s.profile.regulator_name, "escalated": True},
                source="airtruth.regulator_bridge",
            )
        else:
            raise ValueError(f"unknown action {action!r}")

        return self._decide(tenant_id, flight_ref, action, locale=locale, notify=True)

    def _decide(self, tenant_id: str, flight_ref: str, action: str, locale: str = "en-IN", notify: bool = True) -> dict:
        s = self.situation(tenant_id, flight_ref)
        if s is None:
            raise KeyError(flight_ref)
        prior = self.states.get((tenant_id, flight_ref))
        version = (prior["version"] + 1) if prior else 1
        case_id = prior["case_id"] if prior else f"AT-{sha256(f'{tenant_id}:{flight_ref}'.encode()).hexdigest()[:6].upper()}"
        opened_at = datetime.fromisoformat(prior["case"]["opened_at"]) if prior and prior.get("case") else self.engine.clock.now()
        policy: Policy = self.policy_for(tenant_id)
        res = resolve(s, action, policy, case_id, opened_at, version)
        msg, summary, rephrased = phrase(res, s, locale)
        res.passenger_message[locale] = msg
        res.agent_summary = summary
        data = res.data()
        data["llm"] = {"rephrased": rephrased, "locale": locale}
        self.states[(tenant_id, flight_ref)] = data
        self.cases[(tenant_id, case_id)] = flight_ref
        if res.remedy.get("id"):
            self.remedies[(tenant_id, res.remedy["id"])] = flight_ref
        if notify:
            kind = "excuse.rebutted" if s.p.excuse_state is ExcuseState.REBUTTED else "flight.audit.updated"
            self.emit(tenant_id, kind, {
                "object": "flight_resolution",
                "flight_id": flight_ref,
                "case_id": case_id,
                "decision": data["decision"],
                "radar_flash": data["radar_flash"],
                "remedy": data["remedy"],
                "root_cause": data["facts"]["root_cause_detail"],
            })
        return data

    def _append(self, tenant_id: str, flight_ref: str, kind: EventType, by: AssertedBy, suffix: str, data: dict,
                source: str, raw=None, location=None, proof=None) -> None:
        p = self.engine.projection(tenant_id, flight_ref)
        self.engine.store.append(Event(
            event_id=f"{flight_ref}:{suffix}",
            tenant_id=tenant_id,
            flight_ref=flight_ref,
            tail_number=p.tail_number or None,
            type=kind,
            occurred_at=self.engine.clock.now(),
            asserted_by=by,
            source_adapter=source,
            raw=raw,
            location=location,
            proof=proof,
            data=data,
        ))
        self.engine.evaluate(tenant_id, flight_ref)

