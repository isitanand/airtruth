"""Statutory & operational commitments derived from FlightProjection."""
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum

from .profiles import Profile, add_working_days
from .projection import ExcuseState, FlightProjection


class State(StrEnum):
    OPEN = "open"
    MET = "met"
    BREACHED = "breached"
    VOID = "void"


@dataclass(frozen=True)
class Commitment:
    kind: str
    opened_at: datetime
    due_at: datetime
    state: State
    detail: str = ""
    check_at: datetime | None = None

    @property
    def decides_at(self) -> datetime:
        return self.check_at or self.due_at


def _state(met_at: datetime | None, due_at: datetime, now: datetime, grace: timedelta | None = None) -> State:
    if met_at is not None and met_at <= due_at:
        return State.MET
    return State.BREACHED if now >= due_at + (grace or timedelta(0)) else State.OPEN


def derive(p: FlightProjection, profile: Profile, now: datetime) -> list[Commitment]:
    out: list[Commitment] = []

    if p.scheduled_dep:
        actual = p.pushback_at or p.airborne_at
        out.append(Commitment(
            "departure_sla",
            p.scheduled_dep,
            p.scheduled_dep + timedelta(minutes=15),
            _state(actual, p.scheduled_dep + timedelta(minutes=15), now, profile.late_telemetry_grace),
            f"Scheduled gate departure {p.flight_code}",
            check_at=p.scheduled_dep + timedelta(minutes=15) + profile.late_telemetry_grace,
        ))
        stat_due = p.scheduled_dep + profile.delay_threshold
        met = p.pushback_at if (p.pushback_at and p.pushback_at < stat_due) else None
        out.append(Commitment(
            "statutory_trigger",
            p.scheduled_dep,
            stat_due,
            State.VOID if p.excuse_state is ExcuseState.VERIFIED else _state(met, stat_due, now),
            f"{profile.regime_label} statutory compensation threshold",
        ))

    if p.tarmac_started_at:
        due = p.tarmac_started_at + profile.tarmac_threshold
        cleared = p.airborne_at or p.pushback_at
        out.append(Commitment(
            "tarmac_limit",
            p.tarmac_started_at,
            due,
            _state(cleared, due, now),
            f"Max tarmac hold ({int(profile.tarmac_threshold.total_seconds() // 60)}m)",
        ))

    if p.passenger_challenged_at or p.payout.submitted_at:
        opened = p.payout.submitted_at or p.passenger_challenged_at
        assert opened is not None
        out.append(Commitment(
            "carrier_ack",
            opened,
            opened + profile.carrier_ack,
            _state(p.payout.paid_at, opened + profile.carrier_ack, now),
            "Carrier statutory claim acknowledgement",
        ))
        settle_due = add_working_days(opened, profile.settlement_working_days)
        out.append(Commitment(
            "payout_settlement",
            opened,
            settle_due,
            _state(p.payout.paid_at, settle_due, now),
            f"{profile.regime_label} payout settlement",
        ))
    return out


def next_wakeups(p: FlightProjection, commitments: list[Commitment], profile: Profile, now: datetime) -> list[datetime]:
    return sorted({c.decides_at for c in commitments if c.state is State.OPEN and c.decides_at > now})

