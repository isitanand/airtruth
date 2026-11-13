"""EventStore port for aviation telemetry events."""
from enum import StrEnum
from typing import Protocol

from ..events import Event, StoredEvent


class AppendResult(StrEnum):
    INSERTED = "inserted"
    DUPLICATE = "duplicate"


class IdempotencyConflict(Exception):
    """Same event_id reused with different payload."""


class EventStore(Protocol):
    def append(self, event: Event) -> AppendResult: ...

    def events_for_flight(self, tenant_id: str, flight_ref: str) -> list[StoredEvent]:
        """Events for one flight ordered chronologically by occurred_at."""
        ...

