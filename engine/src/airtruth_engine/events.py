"""Append-only aviation event model with source provenance and signed ADS-B hashes."""
import hashlib
import json
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

from .taxonomy import Status, substatus


class AssertedBy(StrEnum):
    AIRLINE = "airline"
    ADSB = "adsb"
    METAR = "metar"
    ATC = "atc"
    CREW = "crew"
    PASSENGER = "passenger"
    ENGINE = "engine"


class EventType(StrEnum):
    FLIGHT_SCHEDULED = "flight.scheduled"
    ROTATION_LEG = "rotation.leg"
    ADSB_POSITION = "adsb.position"
    METAR_REPORT = "metar.report"
    RUNWAY_LOG = "atc.runway_log"
    CREW_DUTY = "crew.duty"
    DELAY_POSTED = "airline.delay_posted"
    EXCUSE_CLAIMED = "airline.excuse_claimed"
    FLIGHT_STATUS = "flight.status"
    PASSENGER_CHALLENGE = "passenger.weather_challenged"
    PASSENGER_CLAIM = "passenger.claim_submitted"
    ENGINE_FINDING = "engine.finding"
    ENGINE_RESOLUTION = "engine.resolution"
    PAYOUT_PACKET = "payout.packet"
    REMEDY_EXECUTED = "remedy.executed"


class Raw(BaseModel):
    model_config = ConfigDict(extra="allow")
    code: str | None = None
    message: str | None = None
    carrier: str | None = None


class Proof(BaseModel):
    model_config = ConfigDict(extra="forbid")
    metar_flyable: bool | None = None
    gdp_active: bool | None = None
    fdtl_breached: bool | None = None
    adsb_signed: bool | None = None
    signature_sha256: str | None = None


class Location(BaseModel):
    model_config = ConfigDict(extra="forbid")
    lat: float
    lon: float
    alt_ft: int | None = None
    airport: str | None = None
    icao24: str | None = None
    tail: str | None = None


def sign_adsb_coord(tail: str, icao24: str, at: str, lat: float, lon: float, alt_ft: int | None = 0) -> str:
    """Deterministic SHA-256 coordinate seal for verifiable ADS-B audit trails."""
    raw = f"{tail}|{icao24}|{at}|{lat:.5f}|{lon:.5f}|{alt_ft or 0}"
    return "adsb-sha256:" + hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


class Event(BaseModel):
    model_config = ConfigDict(extra="forbid")
    event_id: str
    tenant_id: str
    flight_ref: str
    tail_number: str | None = None
    type: EventType
    status: Status | None = None
    substatus: str | None = None
    occurred_at: AwareDatetime
    asserted_by: AssertedBy
    source_adapter: str
    raw: Raw | None = None
    proof: Proof | None = None
    location: Location | None = None
    data: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _validate_status_pair(self) -> "Event":
        if self.substatus is not None:
            info = substatus(self.substatus)
            if self.status is not None and self.status is not info.status:
                raise ValueError(f"substatus {self.substatus!r} maps to {info.status}, got {self.status}")
            self.status = info.status
        return self

    def payload_hash(self) -> str:
        body = json.dumps(self.model_dump(mode="json"), sort_keys=True, ensure_ascii=False, separators=(",", ":"))
        return hashlib.sha256(body.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class StoredEvent:
    seq: int
    received_at: AwareDatetime
    event: Event

