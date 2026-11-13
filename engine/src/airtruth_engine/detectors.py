"""Aviation telemetry lie detectors: Tail-Number Chaining, Selective Weather, Crew Duty Expiry, ATC GDP & Statutory Checks."""
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from .commitments import Commitment, State
from .profiles import Profile
from .projection import ExcuseState, FlightProjection


@dataclass(frozen=True)
class Finding:
    rule: str
    kind: str         # fraud_excuse | ops_root_cause | statutory
    severity: str     # critical | alert | info
    holder: str       # airline | crew | atc | airframe
    message: str
    evidence: dict[str, Any]


Rule = Callable[[FlightProjection, list[Commitment], Profile, datetime], Finding | None]
RULES: list[Rule] = []


def rule(fn: Rule) -> Rule:
    RULES.append(fn)
    return fn


@rule
def tail_number_chaining(p: FlightProjection, _cs: list[Commitment], _prof: Profile, _now: datetime) -> Finding | None:
    """Detect cascading prior delays across the tail number's previous legs before claimed weather began."""
    if not p.rotation_legs:
        return None
    delayed = [leg for leg in p.rotation_legs if leg.delay_min >= 20]
    if not delayed:
        return None
    excuse_at = p.excuse_claim.at if p.excuse_claim else None
    prior = [leg for leg in delayed if excuse_at is None or leg.at < excuse_at]
    if not prior:
        return None
    first_leg = min(prior, key=lambda leg: leg.leg_index)
    max_delay = max(leg.delay_min for leg in prior)
    if max_delay < 35 and len(prior) < 2:
        return None
    custom_note = next((leg.summary for leg in prior if leg.summary), None)
    msg = (
        f"Tail-Number Chaining: {p.tail_number or first_leg.tail_number} accumulated delays across "
        f"{len(p.rotation_legs)} prior legs ({first_leg.route} {first_leg.delay_min}m late)"
    )
    if custom_note:
        msg = custom_note
    return Finding(
        rule="tail_number_chaining",
        kind="ops_root_cause",
        severity="critical",
        holder="airline",
        message=msg,
        evidence={
            "tail_number": p.tail_number or first_leg.tail_number,
            "legs_traced": len(p.rotation_legs),
            "delayed_legs": len(prior),
            "first_delay_route": first_leg.route,
            "first_delay_min": first_leg.delay_min,
            "peak_prior_delay_min": max_delay,
            "root_summary": custom_note or msg,
            "before_weather_claim": excuse_at is not None,
        },
    )


@rule
def selective_weather(p: FlightProjection, _cs: list[Commitment], _prof: Profile, _now: datetime) -> Finding | None:
    """Prove multiple flights operated normally on the same runway during claimed 'unflyable' weather."""
    weather_invoked = (
        (p.excuse_claim and p.excuse_claim.excuse == "weather")
        or any(n.stated_reason == "weather" for n in p.delay_notices)
    )
    if not weather_invoked:
        return None
    rw = p.latest_runway
    metar = p.latest_metar
    departures = rw.other_departures_count if rw else 0
    if departures < 3:
        return None
    runway = rw.runway if rw else "active runway"
    station = (rw.airport if rw else None) or (metar.station if metar else p.origin_icao)
    msg = f"Selective Weather: {departures} other flights departed {station} {runway} during the alleged 'unflyable' window"
    if metar:
        msg += f" · METAR {metar.raw_metar}"
    return Finding(
        rule="selective_weather",
        kind="fraud_excuse",
        severity="critical",
        holder="airline",
        message=msg,
        evidence={
            "station": station,
            "runway": runway,
            "other_departures_count": departures,
            "sample_flights": list(rw.sample_flights) if rw else [],
            "metar": metar.raw_metar if metar else None,
            "visibility_m": metar.visibility_m if metar else None,
            "flyable": metar.flyable if metar else True,
        },
    )


@rule
def crew_duty_expiry(p: FlightProjection, _cs: list[Commitment], _prof: Profile, now: datetime) -> Finding | None:
    """Detect cockpit crew FDTL exhaustion or missing standby crew masked behind ops/weather claims."""
    cd = p.crew_duty
    if not cd:
        return None
    breached = cd.duty_hours_logged >= cd.max_fdtl_hours or (cd.timeout_at is not None and cd.timeout_at <= now)
    if not breached and cd.reserve_available:
        return None
    return Finding(
        rule="crew_duty_expiry",
        kind="ops_root_cause",
        severity="critical",
        holder="crew",
        message=cd.summary or f"Crew Duty Hour Expiry: {cd.duty_hours_logged:.1f}h/{cd.max_fdtl_hours:.1f}h FDTL reached at {cd.base} with no standby crew",
        evidence={
            "base": cd.base,
            "duty_hours_logged": cd.duty_hours_logged,
            "max_fdtl_hours": cd.max_fdtl_hours,
            "reserve_available": cd.reserve_available,
            "timeout_at": cd.timeout_at.isoformat() if cd.timeout_at else None,
        },
    )


@rule
def atc_program_absent(p: FlightProjection, _cs: list[Commitment], _prof: Profile, _now: datetime) -> Finding | None:
    """Catch false ATC slot/ground-delay excuses when zero FAA/DGCA/Eurocontrol GDP exists."""
    atc_invoked = (
        (p.excuse_claim and p.excuse_claim.excuse == "atc")
        or any(n.stated_reason == "atc" for n in p.delay_notices)
    )
    rw = p.latest_runway
    if not atc_invoked or not rw or rw.gdp_active:
        return None
    return Finding(
        rule="atc_program_absent",
        kind="fraud_excuse",
        severity="alert",
        holder="airline",
        message=f"ATC Excuse Contradicted: zero active Ground Delay Program at {rw.airport} ({rw.other_departures_count} departures normal)",
        evidence={"airport": rw.airport, "gdp_active": False, "other_departures_count": rw.other_departures_count},
    )


@rule
def false_extraordinary_claim(p: FlightProjection, cs: list[Commitment], prof: Profile, now: datetime) -> Finding | None:
    """Fires when the airline claims extraordinary circumstances that contradict radar, METAR, crew, or rotation proof."""
    if not p.excuse_claim:
        return None
    if p.excuse_state is not ExcuseState.REBUTTED:
        # Check dynamically if any root-cause rule also matches right now
        causes = [
            f for fn in (tail_number_chaining, selective_weather, crew_duty_expiry, atc_program_absent)
            if (f := fn(p, cs, prof, now)) is not None
        ]
        if not causes:
            return None
        evidence_rules = [c.rule for c in causes]
        root = causes[0].message
    else:
        evidence_rules = sorted(p.findings & {"tail_number_chaining", "selective_weather", "crew_duty_expiry", "atc_program_absent"})
        root = (p.crew_duty.summary if p.crew_duty and p.crew_duty.summary else None) or "Airline operational chain"
    return Finding(
        rule="false_extraordinary_claim",
        kind="fraud_excuse",
        severity="critical",
        holder="airline",
        message=f"Airline {p.excuse_claim.excuse!r} exemption REBUTTED · True cause: {root}",
        evidence={
            "claimed_excuse": p.excuse_claim.excuse,
            "station": p.excuse_claim.station,
            "rebutted_by": evidence_rules,
            "root_cause": root,
        },
    )


@rule
def tarmac_hold_excessive(p: FlightProjection, cs: list[Commitment], prof: Profile, _now: datetime) -> Finding | None:
    breached = next((c for c in cs if c.kind == "tarmac_limit" and c.state is State.BREACHED), None)
    if not breached:
        return None
    return Finding(
        rule="tarmac_hold_excessive",
        kind="ops_root_cause",
        severity="alert",
        holder="airline",
        message=f"Tarmac hold exceeded {int(prof.tarmac_threshold.total_seconds() // 60)}m regulatory cap",
        evidence={"tarmac_minutes": p.tarmac_minutes},
    )


@rule
def statutory_payout_eligible(p: FlightProjection, cs: list[Commitment], prof: Profile, _now: datetime) -> Finding | None:
    if p.excuse_state is ExcuseState.VERIFIED:
        return None
    stat_met = next((c for c in cs if c.kind == "statutory_trigger" and c.state is State.BREACHED), None)
    cancelled = p.cancelled_at is not None
    if not stat_met and not cancelled:
        return None
    if p.payout.amount <= 0:
        return None
    return Finding(
        rule="statutory_payout_eligible",
        kind="statutory",
        severity="alert",
        holder="airline",
        message=f"{prof.regime_label} payout unlocked: {prof.currency}{p.payout.amount:,} (delay {p.delay_minutes}m)",
        evidence={"regime": prof.name, "amount": p.payout.amount, "currency": prof.currency_code, "delay_minutes": p.delay_minutes},
    )


@rule
def statutory_payout_overdue(p: FlightProjection, cs: list[Commitment], prof: Profile, _now: datetime) -> Finding | None:
    breached = next((c for c in cs if c.kind == "payout_settlement" and c.state is State.BREACHED), None)
    if not breached:
        return None
    return Finding(
        rule="statutory_payout_overdue",
        kind="statutory",
        severity="critical",
        holder="airline",
        message=f"Statutory payout overdue under {prof.statute}; escalate to {prof.regulator_name}",
        evidence={"due_at": breached.due_at.isoformat(), "regulator": prof.regulator_name},
    )


def evaluate(p: FlightProjection, commitments: list[Commitment], profile: Profile, now: datetime) -> list[Finding]:
    """Run all aviation detectors; emit each finding once per flight."""
    return [f for fn in RULES if (f := fn(p, commitments, profile, now)) and f.rule not in p.findings]
