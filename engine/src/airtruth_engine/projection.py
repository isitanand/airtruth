"""Pure aviation flight projection built from append-only ADS-B, METAR, ATC, Crew & Airline events."""
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum

from .events import AssertedBy, Event, EventType, sign_adsb_coord
from .profiles import Profile, statutory_amount
from .taxonomy import Status


class ExcuseState(StrEnum):
    NONE = "none"              # airline has not invoked an extraordinary exemption
    CLAIMED = "claimed"        # airline claims Weather / ATC to waive compensation
    REBUTTED = "rebutted"      # telemetry / METAR / rotation logs disprove the airline claim
    VERIFIED = "verified"      # confirmed extraordinary circumstance (e.g. active GDP / CAT-III closure)


@dataclass(frozen=True)
class RotationLeg:
    at: datetime
    leg_index: int
    flight_code: str
    route: str
    sched_dep: str
    act_dep: str
    delay_min: int
    cause: str | None
    summary: str | None
    tail_number: str
    icao24: str
    lat: float | None
    lon: float | None
    coord_sig: str


@dataclass(frozen=True)
class MetarObs:
    at: datetime
    station: str
    raw_metar: str
    visibility_m: int
    ceiling_ft: int
    wind_kt: int
    flyable: bool


@dataclass(frozen=True)
class RunwayOps:
    at: datetime
    airport: str
    runway: str
    window: str
    other_departures_count: int
    sample_flights: tuple[str, ...]
    gdp_active: bool
    gdp_program: str | None


@dataclass(frozen=True)
class CrewDuty:
    at: datetime
    base: str
    duty_hours_logged: float
    max_fdtl_hours: float
    timeout_at: datetime | None
    reserve_available: bool
    summary: str


@dataclass(frozen=True)
class ExcuseClaim:
    at: datetime
    excuse: str                # weather | atc
    station: str
    claimed_window: str
    message: str


@dataclass(frozen=True)
class DelayNotice:
    at: datetime
    due_by: datetime
    shown: str
    stated_reason: str | None
    delay_minutes: int | None
    gate: str | None


@dataclass(frozen=True)
class AdsbPing:
    at: datetime
    tail: str
    icao24: str
    callsign: str
    lat: float
    lon: float
    alt_ft: int
    groundspeed_kts: int
    airport: str | None
    phase: str | None
    coord_sig: str


@dataclass
class PayoutRecord:
    stage: str | None = None          # eligible | packet_issued | submitted | paid
    packet_id: str | None = None
    issued_at: datetime | None = None
    submitted_at: datetime | None = None
    paid_at: datetime | None = None
    amount: int = 0
    currency: str = "€"
    currency_code: str = "EUR"
    signature_sha256: str | None = None


@dataclass
class FlightProjection:
    tenant_id: str
    flight_ref: str
    flight_code: str = ""
    airline_name: str = ""
    tail_number: str = ""
    icao24: str = "800A14"
    aircraft_type: str = "A320neo"
    route: str = ""
    origin_icao: str = ""
    dest_icao: str = ""
    distance_km: int = 1200
    regime: str = "dgca"
    ticket_fare: float | None = None
    scheduled_dep: datetime | None = None
    scheduled_arr: datetime | None = None
    pushback_at: datetime | None = None
    airborne_at: datetime | None = None
    landed_at: datetime | None = None
    cancelled_at: datetime | None = None
    tarmac_started_at: datetime | None = None
    reconciled_state: Status = Status.SCHEDULED
    delay_minutes: int = 0
    delay_notices: list[DelayNotice] = field(default_factory=list)
    rotation_legs: list[RotationLeg] = field(default_factory=list)
    metar_reports: list[MetarObs] = field(default_factory=list)
    runway_logs: list[RunwayOps] = field(default_factory=list)
    adsb_pings: list[AdsbPing] = field(default_factory=list)
    crew_duty: CrewDuty | None = None
    excuse_claim: ExcuseClaim | None = None
    passenger_challenged_at: datetime | None = None
    payout: PayoutRecord = field(default_factory=PayoutRecord)
    findings: set[str] = field(default_factory=set)
    excuse_state: ExcuseState = ExcuseState.NONE
    verified_by: str | None = None
    conflicts: list[str] = field(default_factory=list)
    status_history: list[tuple[datetime, Status, AssertedBy]] = field(default_factory=list)

    @property
    def latest_eta(self) -> DelayNotice | None:
        return self.delay_notices[-1] if self.delay_notices else None

    @property
    def latest_metar(self) -> MetarObs | None:
        return self.metar_reports[-1] if self.metar_reports else None

    @property
    def latest_runway(self) -> RunwayOps | None:
        return self.runway_logs[-1] if self.runway_logs else None

    @property
    def tarmac_minutes(self) -> int:
        if not self.tarmac_started_at:
            return 0
        end = self.airborne_at or self.pushback_at
        if not end:
            return 0
        return max(0, int((end - self.tarmac_started_at).total_seconds() // 60))


def _apply_status(p: FlightProjection, e: Event) -> None:
    if e.status is None:
        return
    p.status_history.append((e.occurred_at, e.status, e.asserted_by))
    if e.status is Status.PUSHBACK and p.pushback_at is None:
        p.pushback_at = e.occurred_at
    elif e.status is Status.AIRBORNE and p.airborne_at is None:
        p.airborne_at = e.occurred_at
    elif e.status is Status.LANDED and p.landed_at is None:
        p.landed_at = e.occurred_at
    elif e.status is Status.CANCELLED and p.cancelled_at is None:
        p.cancelled_at = e.occurred_at
    elif e.status is Status.TARMAC_HOLD and p.tarmac_started_at is None:
        p.tarmac_started_at = e.occurred_at


def project(events: list[Event], now: datetime, profile: Profile) -> FlightProjection:
    ordered = sorted(events, key=lambda e: e.occurred_at)
    first = ordered[0]
    p = FlightProjection(
        tenant_id=first.tenant_id,
        flight_ref=first.flight_ref,
        tail_number=first.tail_number or "",
        regime=profile.name,
        payout=PayoutRecord(currency=profile.currency, currency_code=profile.currency_code),
    )

    for e in ordered:
        _apply_status(p, e)
        d = e.data
        if e.tail_number:
            p.tail_number = e.tail_number

        if e.type is EventType.FLIGHT_SCHEDULED:
            p.flight_code = d.get("flight_code", p.flight_ref)
            p.airline_name = d.get("airline", "")
            p.tail_number = d.get("tail_number", p.tail_number)
            p.icao24 = d.get("icao24", p.icao24)
            p.aircraft_type = d.get("aircraft_type", p.aircraft_type)
            p.route = d.get("route", "")
            p.origin_icao = d.get("origin_icao", "")
            p.dest_icao = d.get("dest_icao", "")
            p.distance_km = int(d.get("distance_km", 1200))
            p.ticket_fare = d.get("ticket_fare")
            if d.get("scheduled_dep"):
                p.scheduled_dep = datetime.fromisoformat(d["scheduled_dep"])
            if d.get("scheduled_arr"):
                p.scheduled_arr = datetime.fromisoformat(d["scheduled_arr"])
            if not p.delay_notices and p.scheduled_dep:
                p.delay_notices.append(DelayNotice(
                    at=e.occurred_at, due_by=p.scheduled_dep,
                    shown=d.get("gate_etd_text", "On schedule"),
                    stated_reason=None, delay_minutes=0, gate=d.get("gate"),
                ))

        elif e.type is EventType.ROTATION_LEG:
            lat = d.get("lat") or (e.location.lat if e.location else None)
            lon = d.get("lon") or (e.location.lon if e.location else None)
            tail = d.get("tail_number", p.tail_number)
            icao24 = d.get("icao24", p.icao24)
            sig = d.get("coord_sig") or sign_adsb_coord(
                tail, icao24, e.occurred_at.isoformat(), lat or 19.0896, lon or 72.8656, 0,
            )
            p.rotation_legs.append(RotationLeg(
                at=e.occurred_at,
                leg_index=int(d.get("leg_index", len(p.rotation_legs) + 1)),
                flight_code=d.get("flight_code", ""),
                route=d.get("route", ""),
                sched_dep=d.get("sched_dep", ""),
                act_dep=d.get("act_dep", ""),
                delay_min=int(d.get("delay_min", 0)),
                cause=d.get("cause"),
                summary=d.get("summary"),
                tail_number=tail,
                icao24=icao24,
                lat=lat,
                lon=lon,
                coord_sig=sig,
            ))

        elif e.type is EventType.ADSB_POSITION and e.location:
            tail = e.location.tail or p.tail_number
            icao24 = e.location.icao24 or p.icao24
            sig = (e.proof.signature_sha256 if e.proof and e.proof.signature_sha256 else None) or sign_adsb_coord(
                tail, icao24, e.occurred_at.isoformat(), e.location.lat, e.location.lon, e.location.alt_ft,
            )
            p.adsb_pings.append(AdsbPing(
                at=e.occurred_at,
                tail=tail,
                icao24=icao24,
                callsign=d.get("callsign", p.flight_code or p.flight_ref),
                lat=e.location.lat,
                lon=e.location.lon,
                alt_ft=int(e.location.alt_ft or 0),
                groundspeed_kts=int(d.get("groundspeed_kts", 0)),
                airport=e.location.airport,
                phase=d.get("phase"),
                coord_sig=sig,
            ))

        elif e.type is EventType.METAR_REPORT:
            p.metar_reports.append(MetarObs(
                at=e.occurred_at,
                station=d.get("station", p.origin_icao),
                raw_metar=d.get("raw_metar", ""),
                visibility_m=int(d.get("visibility_m", 6000)),
                ceiling_ft=int(d.get("ceiling_ft", 4000)),
                wind_kt=int(d.get("wind_kt", 8)),
                flyable=bool(d.get("flyable", True)),
            ))

        elif e.type is EventType.RUNWAY_LOG:
            p.runway_logs.append(RunwayOps(
                at=e.occurred_at,
                airport=d.get("airport", p.origin_icao),
                runway=d.get("runway", "RWY 27"),
                window=d.get("window", ""),
                other_departures_count=int(d.get("other_departures_count", 0)),
                sample_flights=tuple(d.get("sample_flights") or ()),
                gdp_active=bool(d.get("gdp_active", False)),
                gdp_program=d.get("gdp_program"),
            ))

        elif e.type is EventType.CREW_DUTY:
            timeout_at = datetime.fromisoformat(d["timeout_at"]) if d.get("timeout_at") else None
            p.crew_duty = CrewDuty(
                at=e.occurred_at,
                base=d.get("base", ""),
                duty_hours_logged=float(d.get("duty_hours_logged", 0.0)),
                max_fdtl_hours=float(d.get("max_fdtl_hours", 12.0)),
                timeout_at=timeout_at,
                reserve_available=bool(d.get("reserve_available", False)),
                summary=d.get("summary", ""),
            )

        elif e.type is EventType.DELAY_POSTED:
            due = datetime.fromisoformat(d["due_by"]) if d.get("due_by") else (p.scheduled_dep or e.occurred_at)
            p.delay_notices.append(DelayNotice(
                at=e.occurred_at,
                due_by=due,
                shown=d.get("shown", "Revised departure"),
                stated_reason=d.get("stated_reason"),
                delay_minutes=d.get("delay_minutes"),
                gate=d.get("gate"),
            ))

        elif e.type is EventType.EXCUSE_CLAIMED:
            p.excuse_claim = ExcuseClaim(
                at=e.occurred_at,
                excuse=d.get("excuse", "weather"),
                station=d.get("station", p.origin_icao),
                claimed_window=d.get("claimed_window", ""),
                message=d.get("message", (e.raw.message if e.raw and e.raw.message else "Extraordinary circumstance claimed")),
            )

        elif e.type is EventType.PASSENGER_CHALLENGE:
            p.passenger_challenged_at = e.occurred_at

        elif e.type is EventType.PAYOUT_PACKET:
            p.payout.stage = d.get("stage", "packet_issued")
            p.payout.packet_id = d.get("packet_id", p.payout.packet_id)
            p.payout.signature_sha256 = d.get("signature_sha256", p.payout.signature_sha256)
            p.payout.amount = int(d.get("amount", p.payout.amount))
            if p.payout.stage == "packet_issued":
                p.payout.issued_at = e.occurred_at
            elif p.payout.stage == "submitted":
                p.payout.submitted_at = e.occurred_at
            elif p.payout.stage == "paid":
                p.payout.paid_at = e.occurred_at

        elif e.type is EventType.ENGINE_FINDING:
            if d.get("rule"):
                p.findings.add(d["rule"])

    # Compute current delay from scheduled_dep -> pushback / landed / latest ETA / now
    if p.scheduled_dep:
        ref = p.pushback_at or (p.latest_eta.due_by if p.latest_eta else p.scheduled_dep)
        delta_min = int((ref - p.scheduled_dep).total_seconds() // 60)
        elapsed_min = int((now - p.scheduled_dep).total_seconds() // 60) if now > p.scheduled_dep and not p.pushback_at else 0
        p.delay_minutes = max(0, delta_min, elapsed_min)

    # Calculate deterministic statutory amount
    p.payout.amount = statutory_amount(profile, p.distance_km, p.delay_minutes, cancelled=p.cancelled_at is not None)

    # Reconcile state & excuse validity
    if p.cancelled_at:
        p.reconciled_state = Status.CANCELLED
    elif p.landed_at:
        p.reconciled_state = Status.LANDED
    elif p.airborne_at:
        p.reconciled_state = Status.AIRBORNE
    elif p.pushback_at:
        p.reconciled_state = Status.PUSHBACK
    elif p.excuse_claim:
        p.reconciled_state = Status.EXCUSE_DISPUTED
    elif p.crew_duty and (p.crew_duty.duty_hours_logged >= p.crew_duty.max_fdtl_hours or not p.crew_duty.reserve_available):
        p.reconciled_state = Status.CREW_HOLD
    elif p.tarmac_started_at:
        p.reconciled_state = Status.TARMAC_HOLD
    elif any(l.delay_min >= 20 for l in p.rotation_legs):
        p.reconciled_state = Status.INBOUND_DELAYED
    elif p.status_history:
        p.reconciled_state = p.status_history[-1][1]

    # Excuse classification
    has_rebuttal = bool(
        p.findings & {"tail_number_chaining", "selective_weather", "crew_duty_expiry", "atc_program_absent", "false_extraordinary_claim"}
    ) or _inline_contradiction(p)
    if p.excuse_claim:
        if has_rebuttal:
            p.excuse_state = ExcuseState.REBUTTED
            p.verified_by = "adsb_metar_rotation"
            p.conflicts.append(f"Airline claimed {p.excuse_claim.excuse} while ADS-B/METAR proved airline-attributable root cause")
        elif p.latest_metar and not p.latest_metar.flyable and (not p.latest_runway or p.latest_runway.other_departures_count < 2):
            p.excuse_state = ExcuseState.VERIFIED
            p.verified_by = "metar_imc_closure"
        else:
            p.excuse_state = ExcuseState.CLAIMED
    return p


def _inline_contradiction(p: FlightProjection) -> bool:
    if any(l.delay_min >= 45 for l in p.rotation_legs):
        return True
    if p.crew_duty and (p.crew_duty.duty_hours_logged >= p.crew_duty.max_fdtl_hours or not p.crew_duty.reserve_available):
        return True
    if p.latest_runway and p.latest_runway.other_departures_count >= 4:
        return True
    if p.latest_metar and p.latest_metar.flyable:
        return True
    return False

