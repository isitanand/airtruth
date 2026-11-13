"""Deterministic statutory policy resolver and signed ADS-B claim packet generator."""
import hashlib
import json
import os
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from pydantic import BaseModel, ConfigDict, Field

from .commitments import derive
from .detectors import RULES
from .engine import Engine
from .events import Event, EventType
from .profiles import Profile, add_working_days, statutory_amount
from .projection import ExcuseState, FlightProjection, project
from .sessions import current_tape
from .taxonomy import Status
from .waf import llm_allowed

IST = timezone(timedelta(hours=5, minutes=30))
LLM_MODEL = os.environ.get("AIRTRUTH_LLM_MODEL", "claude-haiku-4-5-20251001")

DECISIONS = ("claim_packet_ready", "excuse_rebutted", "claim_submitted", "escalate_regulator", "verified_weather", "monitor_delay")
ACTIONS = ("airline_claims_weather", "challenge_weather", "generate_packet", "submit_claim", "escalate_regulator")
LOCALES = ("en-IN", "hi-Latn-IN")


class Policy(BaseModel):
    model_config = ConfigDict(extra="forbid")
    auto_issue_packet_on_rebuttal: bool = True
    instant_rebuttal_min_departures: int = Field(default=3, ge=1, le=20)
    min_prior_leg_delay_minutes: int = Field(default=30, ge=5, le=300)
    auto_escalate_overdue_days: int = Field(default=7, ge=1, le=30)
    max_auto_payout_inr: int = Field(default=10000, ge=0)


def packet_id_for(flight_ref: str, tail: str) -> str:
    clean_tail = (tail or "TAIL").replace("-", "")
    digest = hashlib.sha256(f"{flight_ref}:{clean_tail}".encode()).hexdigest()[:6].upper()
    return f"AT-{clean_tail}-{digest}"


def fmt_time(dt: datetime, tz: timezone = IST) -> str:
    return dt.astimezone(tz).strftime("%H:%M")


def fmt_day(dt: datetime, tz: timezone = IST) -> str:
    return dt.astimezone(tz).strftime("%d %b, %H:%M")


@dataclass(frozen=True)
class Situation:
    tenant_id: str
    flight_ref: str
    brand: str
    now: datetime
    profile: Profile
    p: FlightProjection
    live: frozenset[str]
    events: list[Event]
    root_cause_title: str
    root_cause_detail: str


def detect_root_cause(p: FlightProjection, live: frozenset[str], profile: Profile) -> tuple[str, str]:
    """Identify the strongest proven operational root cause behind a delay."""
    if p.crew_duty and (p.crew_duty.duty_hours_logged >= p.crew_duty.max_fdtl_hours or not p.crew_duty.reserve_available):
        return (
            "Crew Duty Hour Expiry (FDTL)",
            p.crew_duty.summary
            or f"Airframe {p.tail_number} cockpit crew timed out at {p.crew_duty.base} ({p.crew_duty.duty_hours_logged:.1f}h/{p.crew_duty.max_fdtl_hours:.1f}h FDTL) with no standby crew.",
        )
    delayed_legs = [l for l in p.rotation_legs if l.delay_min >= 20]
    if delayed_legs:
        first = min(delayed_legs, key=lambda l: l.leg_index)
        return (
            "Tail-Number Chaining",
            first.summary
            or f"Aircraft {p.tail_number} ran {first.delay_min}m late on prior leg {first.flight_code} ({first.route}) across a {len(p.rotation_legs)}-leg rotation before weather was cited.",
        )
    if p.latest_runway and p.latest_runway.other_departures_count >= 3 and p.excuse_claim:
        rw = p.latest_runway
        return (
            "Selective Weather Contradicted",
            f"{rw.other_departures_count} aircraft departed {rw.airport} {rw.runway} cleanly during the airline's claimed weather hold.",
        )
    if p.tarmac_started_at and "tarmac_hold_excessive" in live:
        return (
            "Excessive Gate / Tarmac Hold",
            f"Aircraft held {p.tarmac_minutes}m on apron in breach of {profile.regime_label} limits.",
        )
    if p.excuse_state is ExcuseState.VERIFIED and p.excuse_claim:
        return (
            "Verified Weather Closure",
            f"METAR confirms below-minimum visibility at {p.excuse_claim.station}.",
        )
    return ("Scheduled Rotation Under Telemetry Audit", "ADS-B, METAR, and ATC logs are actively synchronized.")


def situation(engine: Engine, tenant_id: str, flight_ref: str, brand: str) -> Situation | None:
    events = engine.events(tenant_id, flight_ref)
    if not events:
        return None
    now = engine.clock.now()
    profile = engine.profile(tenant_id, flight_ref, events)
    p = project(events, now, profile)
    cs = derive(p, profile, now)
    live = frozenset(f.rule for rule in RULES if (f := rule(p, cs, profile, now)))
    title, detail = detect_root_cause(p, live, profile)
    return Situation(tenant_id, flight_ref, brand, now, profile, p, live, events, title, detail)


def build_claim_packet(s: Situation) -> dict | None:
    """Assemble a cryptographically sealed statutory payout claim packet with signed ADS-B coordinates."""
    p = s.p
    if p.excuse_state is ExcuseState.VERIFIED:
        return None
    amount = max(
        p.payout.amount,
        statutory_amount(s.profile, p.distance_km, max(p.delay_minutes, int(s.profile.delay_threshold.total_seconds() // 60)), cancelled=p.cancelled_at is not None)
        if p.excuse_state is ExcuseState.REBUTTED else 0,
    )
    if amount <= 0 and not p.excuse_claim and p.delay_minutes < 90:
        return None

    pid = p.payout.packet_id or packet_id_for(p.flight_ref, p.tail_number)
    excuse_label = (
        f"Claimed {p.excuse_claim.excuse.title()} at {p.excuse_claim.station}: {p.excuse_claim.message}"
        if p.excuse_claim
        else "No extraordinary excuse accepted"
    )
    contradictions: list[str] = []
    if p.rotation_legs:
        first_late = next((l for l in sorted(p.rotation_legs, key=lambda x: x.leg_index) if l.delay_min >= 20), None)
        if first_late:
            contradictions.append(
                f"Tail-Number Chain ({len(p.rotation_legs)} legs on {p.tail_number}): "
                + (first_late.summary or f"{first_late.flight_code} {first_late.route} arrived {first_late.delay_min}m late prior to departure")
            )
    if p.latest_runway and p.latest_runway.other_departures_count > 0:
        rw = p.latest_runway
        samples = ", ".join(rw.sample_flights[:4])
        contradictions.append(
            f"Selective Weather Proof: {rw.other_departures_count} flights departed {rw.airport} {rw.runway} ({rw.window})"
            + (f" [{samples}]" if samples else "")
        )
    if p.latest_metar and p.latest_metar.flyable:
        m = p.latest_metar
        contradictions.append(f"METAR {m.station}: {m.raw_metar} (vis {m.visibility_m}m, ceiling {m.ceiling_ft}ft — VMC/flyable)")
    if p.crew_duty:
        cd = p.crew_duty
        contradictions.append(
            f"Crew FDTL Audit ({cd.base}): {cd.duty_hours_logged:.1f}h/{cd.max_fdtl_hours:.1f}h logged"
            + (" · standby pilot unavailable" if not cd.reserve_available else "")
        )
    if p.latest_runway and not p.latest_runway.gdp_active:
        contradictions.append(f"ATC Audit: zero Ground Delay Program active at {p.latest_runway.airport}")

    coords = [
        {
            "at": ping.at.isoformat(),
            "icao24": ping.icao24,
            "tail": ping.tail,
            "callsign": ping.callsign,
            "airport": ping.airport,
            "phase": ping.phase,
            "lat": round(ping.lat, 5),
            "lon": round(ping.lon, 5),
            "alt_ft": ping.alt_ft,
            "coord_sig": ping.coord_sig,
        }
        for ping in p.adsb_pings[-6:]
    ]
    for leg in p.rotation_legs[-4:]:
        if leg.lat is not None and leg.lon is not None:
            coords.append({
                "at": leg.at.isoformat(),
                "icao24": leg.icao24,
                "tail": leg.tail_number,
                "callsign": leg.flight_code,
                "airport": leg.route,
                "phase": f"leg_{leg.leg_index}",
                "lat": round(leg.lat, 5),
                "lon": round(leg.lon, 5),
                "alt_ft": 0,
                "coord_sig": leg.coord_sig,
            })

    core = {
        "packet_id": pid,
        "flight_ref": p.flight_ref,
        "flight_code": p.flight_code or p.flight_ref,
        "airline": s.brand,
        "tail_number": p.tail_number,
        "route": p.route,
        "regime": s.profile.name,
        "statute": s.profile.statute,
        "regulator": s.profile.regulator_name,
        "regulator_url": s.profile.regulator_url,
        "amount": amount,
        "currency": s.profile.currency,
        "currency_code": s.profile.currency_code,
        "amount_display": f"{s.profile.currency}{amount:,}" if amount else f"{s.profile.currency}0 (Pending threshold)",
        "excuse_status": p.excuse_state.value.upper(),
        "airline_excuse": excuse_label,
        "true_root_cause_title": s.root_cause_title,
        "true_root_cause": s.root_cause_detail,
        "contradictions": contradictions,
        "signed_adsb_coordinates": coords,
        "issued_at": (p.payout.issued_at or s.now).isoformat(),
    }
    canonical = json.dumps(core, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    core["signature_sha256"] = p.payout.signature_sha256 or ("sha256:" + hashlib.sha256(canonical.encode()).hexdigest())
    return core


@dataclass
class Resolution:
    action: str
    decision: str
    remedy: dict
    status: str
    needs_approval: bool
    approval_reason: str | None
    steps: list[dict]
    passenger_message: dict[str, str]
    agent_summary: str
    case_id: str | None
    case: dict | None
    follow_up: dict | None
    policy: dict
    decided_at: str
    version: int
    resolution_id: str
    radar_flash: bool = False
    facts: dict = field(default_factory=dict)

    def data(self) -> dict:
        return {
            "resolution_id": self.resolution_id,
            "version": self.version,
            "action": self.action,
            "decision": self.decision,
            "remedy": dict(self.remedy),
            "status": self.status,
            "needs_approval": self.needs_approval,
            "approval_reason": self.approval_reason,
            "steps": [dict(s) for s in self.steps],
            "passenger_message": dict(self.passenger_message),
            "agent_summary": self.agent_summary,
            "case_id": self.case_id,
            "case": self.case,
            "follow_up": self.follow_up,
            "policy": self.policy,
            "decided_at": self.decided_at,
            "radar_flash": self.radar_flash,
            "facts": self.facts,
        }


def resolve(s: Situation, action: str, policy: Policy, case_id: str, opened_at: datetime, version: int) -> Resolution:
    p = s.p
    packet = build_claim_packet(s)
    amount = packet["amount"] if packet else p.payout.amount
    cur = s.profile.currency
    now_iso = s.now.isoformat()
    res_id = f"res_{p.flight_ref}_{version}"
    case = {
        "opened_at": opened_at.isoformat(),
        "ack_by": (opened_at + s.profile.carrier_ack).isoformat(),
        "resolve_by": add_working_days(opened_at, s.profile.settlement_working_days).isoformat(),
    }

    steps: list[dict] = []
    if p.excuse_claim:
        steps.append({"at": p.excuse_claim.at.isoformat(), "who": "Airline",
                      "text": f"Claimed {p.excuse_claim.excuse} exemption at {p.excuse_claim.station}: {p.excuse_claim.message}"})
    if "tail_number_chaining" in s.live or p.rotation_legs:
        steps.append({"at": now_iso, "who": "AirTruth ADS-B",
                      "text": f"Traced tail {p.tail_number} across {len(p.rotation_legs)} prior legs: {s.root_cause_detail}"})
    if p.latest_runway and p.latest_runway.other_departures_count >= 3:
        rw = p.latest_runway
        steps.append({"at": now_iso, "who": "AirTruth Runway Audit",
                      "text": f"{rw.other_departures_count} flights departed {rw.airport} {rw.runway} normally ({', '.join(rw.sample_flights[:3])})"})
    if p.latest_metar:
        steps.append({"at": p.latest_metar.at.isoformat(), "who": "NOAA/METAR",
                      "text": f"{p.latest_metar.station}: {p.latest_metar.raw_metar} ({'flyable VMC' if p.latest_metar.flyable else 'below minimums'})"})

    if p.excuse_state is ExcuseState.VERIFIED:
        decision = "verified_weather"
        status = "executed"
        remedy = {"id": None, "kind": "none", "amount": 0, "currency": cur, "eta": "Extraordinary verified", "reference": None}
        msg_en = f"Weather closure at {p.origin_icao} is corroborated by METAR and zero runway departures. No cash claim packet generated; duty of care applies."
        msg_hi = f"{p.origin_icao} par weather genuine hai — METAR aur runway logs confirm karte hain. Cash payout lagu nahi, meals/hotel duty of care active hai."
        summary = f"{p.flight_code} ({p.tail_number}): genuine weather closure confirmed."
        radar_flash = False
    elif action == "escalate_regulator":
        decision = "escalate_regulator"
        status = "executed"
        remedy = {"id": packet["packet_id"] if packet else None, "kind": "regulator_filing", "amount": amount,
                  "currency": cur, "eta": f"Filed to {s.profile.regulator_name}", "reference": packet["signature_sha256"][:22] if packet else None}
        steps.append({"at": now_iso, "who": s.profile.regulator_name, "text": f"Submitted signed telemetry docket {packet['packet_id'] if packet else ''}"})
        msg_en = f"Signed telemetry packet {packet['packet_id'] if packet else ''} escalated to {s.profile.regulator_name} for {cur}{amount:,} statutory enforcement."
        msg_hi = f"Signed radar packet {packet['packet_id'] if packet else ''} {s.profile.regulator_name} ko bhej diya gaya hai ({cur}{amount:,} claim)."
        summary = f"Escalated to {s.profile.regulator_name}: {s.root_cause_title}."
        radar_flash = True
    elif action == "submit_claim":
        decision = "claim_submitted"
        status = "executed"
        remedy = {"id": packet["packet_id"] if packet else None, "kind": "statutory_payout", "amount": amount,
                  "currency": cur, "eta": f"Settlement within {s.profile.settlement_working_days} working days",
                  "reference": packet["signature_sha256"][:22] if packet else None}
        steps.append({"at": now_iso, "who": "AirTruth Statutory Desk",
                      "text": f"Submitted {s.profile.regime_label} claim {packet['packet_id'] if packet else ''} for {cur}{amount:,}"})
        msg_en = f"Claim packet {packet['packet_id'] if packet else ''} filed under {s.profile.statute} for {cur}{amount:,}. Airline rebuttal blocked by signed ADS-B coordinates."
        msg_hi = f"{s.profile.regime_label} claim ({cur}{amount:,}) file ho gaya. Signed ADS-B radar proof ke saath."
        summary = f"Claim {cur}{amount:,} filed · {s.root_cause_title}."
        radar_flash = True
    else:
        decision = "claim_packet_ready" if packet else "excuse_rebutted"
        status = "approved"
        remedy = {
            "id": packet["packet_id"] if packet else None,
            "kind": "statutory_payout",
            "amount": amount,
            "currency": cur,
            "eta": f"Packet signed · {cur}{amount:,} claimable" if amount else "Monitoring statutory delay clock",
            "reference": packet["signature_sha256"][:22] if packet else None,
        }
        steps.append({
            "at": now_iso,
            "who": "AirTruth Truth Engine",
            "text": f"EXCUSE REBUTTED: {s.root_cause_detail} · Signed {packet['packet_id'] if packet else 'audit'} ready",
        })
        msg_en = (
            f"Airline weather claim REBUTTED. True cause: {s.root_cause_detail} "
            + (f"Signed {s.profile.regime_label} packet ready for {cur}{amount:,}." if amount else "Monitoring statutory delay threshold.")
        )
        msg_hi = (
            f"Airline ka weather excuse jhootha saabit hua: {s.root_cause_detail} "
            + (f"{cur}{amount:,} ka signed statutory claim packet taiyar hai." if amount else "Delay timer chal raha hai.")
        )
        summary = f"Rebutted {p.excuse_claim.excuse if p.excuse_claim else 'delay'} claim -> {s.root_cause_title} ({cur}{amount:,})."
        radar_flash = action in ("airline_claims_weather", "challenge_weather", "generate_packet")

    return Resolution(
        action=action,
        decision=decision,
        remedy=remedy,
        status=status,
        needs_approval=False,
        approval_reason=None,
        steps=steps,
        passenger_message={"en-IN": msg_en, "hi-Latn-IN": msg_hi},
        agent_summary=summary,
        case_id=case_id,
        case=case,
        follow_up={"kind": "monitor", "at": now_iso},
        policy=policy.model_dump(),
        decided_at=now_iso,
        version=version,
        resolution_id=res_id,
        radar_flash=radar_flash,
        facts={
            "flight_code": p.flight_code,
            "tail_number": p.tail_number,
            "root_cause_title": s.root_cause_title,
            "root_cause_detail": s.root_cause_detail,
            "amount": amount,
            "currency": cur,
            "packet_id": packet["packet_id"] if packet else None,
            "signature_sha256": packet["signature_sha256"] if packet else None,
        },
    )


def llm_enabled() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("GEMINI_API_KEY"))


def _llm_call(prompt: str, max_tokens: int = 220) -> str | None:
    if not llm_allowed():
        return None
    if os.environ.get("ANTHROPIC_API_KEY"):
        try:
            import anthropic
            c = anthropic.Anthropic()
            r = c.messages.create(model=LLM_MODEL, max_tokens=max_tokens, messages=[{"role": "user", "content": prompt}])
            return r.content[0].text.strip()
        except Exception:
            return None
    return None


def phrase(res: Resolution, s: Situation, locale: str) -> tuple[str, str, bool]:
    base_msg = res.passenger_message.get(locale) or res.passenger_message["en-IN"]
    t = current_tape()
    if t and t.mode == "replay":
        replayed = t.play()
        if replayed and replayed.get("msg"):
            return replayed["msg"], res.agent_summary, True
    return base_msg, res.agent_summary, False
