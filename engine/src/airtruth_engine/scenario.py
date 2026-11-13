"""Flight replay scenarios: ADS-B rotation chains, METAR reports, runway departure logs, and crew FDTL timelines."""
import json
import re
from datetime import datetime, timedelta
from pathlib import Path

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from .events import Event
from .store.base import AppendResult, EventStore

_OFFSET = re.compile(r"^\+(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?$")


def parse_offset(text: str) -> timedelta:
    match = _OFFSET.match(text)
    if not match or text == "+":
        raise ValueError(f"bad offset {text!r}; expected e.g. +2h30m")
    days, hours, minutes = (int(g) if g else 0 for g in match.groups())
    return timedelta(days=days, hours=hours, minutes=minutes)


class Tenant(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    name: str
    regime: str


class Scenario(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    title: str
    airline: str
    flight_code: str
    tail_number: str
    route: str
    notes: str
    tenant: Tenant
    flight_ref: str
    start: AwareDatetime
    scheduled_dep: AwareDatetime
    end: AwareDatetime
    events: list[dict]
    detector: str | None = None
    beats: list[dict] = Field(default_factory=list)

    @classmethod
    def load(cls, path: str | Path) -> "Scenario":
        return cls.model_validate(json.loads(Path(path).read_text(encoding="utf-8")))

    def to_events(self) -> list[Event]:
        return [event for _, event in self.arrivals()]

    def arrivals(self) -> list[tuple[datetime, Event]]:
        out = []
        for i, spec in enumerate(self.events, start=1):
            spec = dict(spec)
            occurred_at = self.start + parse_offset(spec.pop("at"))
            arrives = spec.pop("arrives", None)
            arrival = self.start + parse_offset(arrives) if arrives else occurred_at
            out.append((arrival, Event.model_validate({
                "event_id": spec.pop("event_id", f"{self.flight_ref}-{i:03d}"),
                "tenant_id": self.tenant.id,
                "flight_ref": self.flight_ref,
                "tail_number": spec.pop("tail_number", self.tail_number),
                "occurred_at": occurred_at,
                "source_adapter": spec.pop("source_adapter", "replay"),
                **spec,
            })))
        return sorted(out, key=lambda pair: pair[0])


def replay(store: EventStore, scenario: Scenario) -> dict[AppendResult, int]:
    counts = {result: 0 for result in AppendResult}
    for event in scenario.to_events():
        counts[store.append(event)] += 1
    return counts


def format_timeline(times: list[datetime], items: list[tuple[str, str]]) -> str:
    if not times:
        return "(no events)"
    lines = []
    for t, (who, text) in zip(times, items):
        lines.append(f"  {t:%H:%M}  [{who:8s}]  {text}")
    return "\n".join(lines)

