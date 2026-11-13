"""Flight telemetry engine: ingest events, project state, run detectors, schedule SLA wakeups."""
from collections.abc import Callable
from datetime import datetime

from .clock import VirtualClock
from .commitments import derive, next_wakeups
from .detectors import Finding, evaluate
from .events import AssertedBy, Event, EventType
from .profiles import PROFILES, Profile
from .projection import FlightProjection, project
from .store.base import EventStore

FindingListener = Callable[[str, str, Finding, datetime], None]


class Engine:
    def __init__(self, store: EventStore, clock: VirtualClock, profile_for: Callable[[str], Profile]):
        self.store = store
        self.clock = clock
        self.profile_for = profile_for
        self.listeners: list[FindingListener] = []

    def ingest(self, event: Event) -> list[Finding]:
        self.store.append(event)
        return self.evaluate(event.tenant_id, event.flight_ref)

    def events(self, tenant_id: str, flight_ref: str) -> list[Event]:
        now = self.clock.now()
        return [s.event for s in self.store.events_for_flight(tenant_id, flight_ref) if s.event.occurred_at <= now]

    def profile(self, tenant_id: str, flight_ref: str, events: list[Event] | None = None) -> Profile:
        for e in events if events is not None else self.events(tenant_id, flight_ref):
            if e.type is EventType.FLIGHT_SCHEDULED and e.data.get("regime") in PROFILES:
                return PROFILES[e.data["regime"]]
        return self.profile_for(tenant_id)

    def projection(self, tenant_id: str, flight_ref: str) -> FlightProjection:
        events = self.events(tenant_id, flight_ref)
        return project(events, self.clock.now(), self.profile(tenant_id, flight_ref, events))

    def evaluate(self, tenant_id: str, flight_ref: str) -> list[Finding]:
        if not self.events(tenant_id, flight_ref):
            return []
        now = self.clock.now()
        profile = self.profile(tenant_id, flight_ref)
        p = self.projection(tenant_id, flight_ref)
        commitments = derive(p, profile, now)
        findings = evaluate(p, commitments, profile, now)
        for f in findings:
            self.store.append(Event(
                event_id=f"{flight_ref}:{f.rule}", tenant_id=tenant_id, flight_ref=flight_ref,
                tail_number=p.tail_number or None,
                type=EventType.ENGINE_FINDING, occurred_at=now, asserted_by=AssertedBy.ENGINE,
                source_adapter="airtruth.engine",
                data={"rule": f.rule, "kind": f.kind, "severity": f.severity, "holder": f.holder,
                      "message": f.message, "evidence": f.evidence},
            ))
            for listener in self.listeners:
                listener(tenant_id, flight_ref, f, now)
        if findings:
            p = self.projection(tenant_id, flight_ref)
            commitments = derive(p, profile, now)
        for at in next_wakeups(p, commitments, profile, now):
            self.clock.schedule((tenant_id, flight_ref, at), at, lambda t=tenant_id, r=flight_ref: self.evaluate(t, r))
        return findings

