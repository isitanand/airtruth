"""Aviation flight and telemetry status taxonomy."""
from dataclasses import dataclass
from enum import StrEnum


class Status(StrEnum):
    SCHEDULED = "scheduled"
    INBOUND_DELAYED = "inbound_delayed"
    CREW_HOLD = "crew_hold"
    GATE_HOLD = "gate_hold"
    TARMAC_HOLD = "tarmac_hold"
    BOARDING = "boarding"
    PUSHBACK = "pushback"
    AIRBORNE = "airborne"
    LANDED = "landed"
    CANCELLED = "cancelled"
    EXCUSE_DISPUTED = "excuse_disputed"


@dataclass(frozen=True)
class Substatus:
    code: str
    status: Status
    statute_tag: str | None
    description: str


_SUBSTATUSES = [
    Substatus("flight.scheduled", Status.SCHEDULED, None, "Flight scheduled; airframe assigned"),
    Substatus("rotation.leg_delayed", Status.INBOUND_DELAYED, "ART-5", "Prior tail-number leg arrived late"),
    Substatus("crew.fdtl_expired", Status.CREW_HOLD, "FDTL", "Flight deck crew reached duty-time ceiling"),
    Substatus("airline.delay_posted", Status.GATE_HOLD, None, "Airline posted departure revision"),
    Substatus("airline.excuse_weather", Status.EXCUSE_DISPUTED, "EXTRAORDINARY", "Airline invoked adverse weather exemption"),
    Substatus("airline.excuse_atc", Status.EXCUSE_DISPUTED, "EXTRAORDINARY", "Airline invoked air traffic control exemption"),
    Substatus("metar.verified_flyable", Status.GATE_HOLD, "CAT-I", "METAR station visibility/ceiling above minimums"),
    Substatus("atc.runway_active", Status.GATE_HOLD, "RWY-LOG", "Other carriers departing same runway"),
    Substatus("flight.tarmac_hold", Status.TARMAC_HOLD, "TARMAC", "Doors closed; aircraft held on apron"),
    Substatus("flight.boarding", Status.BOARDING, None, "Boarding commenced at departure gate"),
    Substatus("flight.pushback", Status.PUSHBACK, None, "Beacon on; pushed back from gate"),
    Substatus("flight.airborne", Status.AIRBORNE, None, "Wheels up via ADS-B Mode-S telemetry"),
    Substatus("flight.landed", Status.LANDED, None, "Touchdown confirmed via ADS-B coordinates"),
    Substatus("flight.cancelled", Status.CANCELLED, "STATUTORY", "Flight segment cancelled"),
    Substatus("payout.packet_issued", Status.EXCUSE_DISPUTED, "CLAIM", "Signed statutory payout packet issued"),
]

SUBSTATUSES: dict[str, Substatus] = {s.code: s for s in _SUBSTATUSES}


def substatus(code: str) -> Substatus:
    try:
        return SUBSTATUSES[code]
    except KeyError:
        raise ValueError(f"unknown substatus {code!r}") from None

