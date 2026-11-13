"""Tenant integration SDK routes: publishable/secret keys, flight views, actions, signed claim packets & webhooks."""
import hashlib
import os
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict

from . import ask, cases, view, webhooks
from .clock import VirtualClock
from .engine import Engine
from .events import AssertedBy, Event, EventType, Location, Proof, Raw, sign_adsb_coord
from .profiles import PROFILES
from .resolver import Policy
from .sessions import Reply, Sessions, Stale, seeded
from .shared import MemoryBackend
from .store.memory import MemoryEventStore

_DEFAULT_SEED = "airtruth-dev-seed-local"


def _dev_key(kind: str, tid: str) -> str:
    seed = os.environ.get("AIRTRUTH_DEV_SEED", _DEFAULT_SEED)
    return f"{kind}_test_{hashlib.sha256(f'{seed}:{kind}:{tid}'.encode()).hexdigest()[:24]}"


@dataclass(frozen=True)
class TenantSpec:
    id: str
    airline: str
    regime: str
    default_policy: Policy


TENANT_SPECS = [
    TenantSpec("indigo", "IndiGo", "dgca", Policy(auto_issue_packet_on_rebuttal=True, max_auto_payout_inr=10000)),
    TenantSpec("delta", "Delta", "us_dot", Policy(auto_issue_packet_on_rebuttal=True, max_auto_payout_inr=55000)),
    TenantSpec("ba", "British Airways", "eu261", Policy(auto_issue_packet_on_rebuttal=True, max_auto_payout_inr=60000)),
]

THEMES = ("neutral", "indigo", "delta", "ba")
APPEARANCE_VARIABLES = [
    "colorInk", "colorMuted", "colorSurface", "colorSurface2", "colorLine", "colorAction",
    "colorActionInk", "colorActionStrong", "colorOk", "colorOkSoft", "colorCheck", "colorCheckSoft",
    "colorAlert", "colorAlertSoft", "colorFocus", "fontBody", "radiusSurface", "radiusControl",
]


@dataclass(frozen=True)
class Tenant:
    id: str
    airline: str
    regime: str
    publishable_key: str
    secret_key: str
    webhook_secret: str
    default_policy: Policy


TENANTS: dict[str, Tenant] = {
    s.id: Tenant(
        id=s.id,
        airline=s.airline,
        regime=s.regime,
        publishable_key=_dev_key("pk", s.id),
        secret_key=_dev_key("sk", s.id),
        webhook_secret=webhooks.secret_from_seed(f"{os.environ.get('AIRTRUTH_DEV_SEED', _DEFAULT_SEED)}:wh:{s.id}"),
        default_policy=s.default_policy,
    )
    for s in TENANT_SPECS
}
KEYS = {k: t for t in TENANTS.values() for k in (t.publishable_key, t.secret_key)}


def _seed_sample_flights(tenant: Tenant, anchor: datetime) -> list[tuple[datetime, Event]]:
    base = anchor - timedelta(hours=4)
    tail = {"indigo": "VT-IFU", "delta": "N842DN", "ba": "G-XWBA"}[tenant.id]
    fcode = {"indigo": "6E-214", "delta": "DL-418", "ba": "BA-117"}[tenant.id]
    route = {"indigo": "DEL -> BLR", "delta": "JFK -> LAX", "ba": "LHR -> JFK"}[tenant.id]
    station = {"indigo": "VIDP", "delta": "KJFK", "ba": "EGLL"}[tenant.id]
    dist = {"indigo": 1740, "delta": 3980, "ba": 5540}[tenant.id]
    lat, lon = {"indigo": (28.5562, 77.1000), "delta": (40.6413, -73.7781), "ba": (51.4700, -0.4543)}[tenant.id]
    flight_ref = f"flt_{tenant.id}_live"
    return [
        (base, Event(
            event_id=f"{flight_ref}-1", tenant_id=tenant.id, flight_ref=flight_ref, tail_number=tail,
            type=EventType.FLIGHT_SCHEDULED, occurred_at=base, asserted_by=AssertedBy.AIRLINE,
            source_adapter="dcs.schedule",
            data={"flight_code": fcode, "airline": tenant.airline, "tail_number": tail, "route": route,
                  "origin_icao": station, "distance_km": dist, "regime": tenant.regime,
                  "scheduled_dep": (base + timedelta(hours=1)).isoformat()},
        )),
        (base + timedelta(minutes=20), Event(
            event_id=f"{flight_ref}-2", tenant_id=tenant.id, flight_ref=flight_ref, tail_number=tail,
            type=EventType.ROTATION_LEG, occurred_at=base + timedelta(minutes=20), asserted_by=AssertedBy.ADSB,
            source_adapter="adsb.rotation",
            data={"leg_index": 1, "flight_code": fcode, "route": "BOM -> DEL", "delay_min": 145,
                  "summary": f"Aircraft {tail} had a crew FDTL timeout on prior turnaround before weather was claimed",
                  "lat": lat, "lon": lon},
        )),
        (base + timedelta(minutes=45), Event(
            event_id=f"{flight_ref}-3", tenant_id=tenant.id, flight_ref=flight_ref, tail_number=tail,
            type=EventType.RUNWAY_LOG, occurred_at=base + timedelta(minutes=45), asserted_by=AssertedBy.ATC,
            source_adapter="atc.slots",
            data={"airport": station, "runway": "RWY 27", "window": "17:30-18:30", "other_departures_count": 8,
                  "sample_flights": ["AI-502", "UK-811", "QP-1102", "6E-631"], "gdp_active": False},
        )),
        (base + timedelta(minutes=50), Event(
            event_id=f"{flight_ref}-4", tenant_id=tenant.id, flight_ref=flight_ref, tail_number=tail,
            type=EventType.METAR_REPORT, occurred_at=base + timedelta(minutes=50), asserted_by=AssertedBy.METAR,
            source_adapter="noaa.metar",
            data={"station": station, "raw_metar": f"{station} 28006KT 6000 FEW025 22/14 Q1015",
                  "visibility_m": 6000, "ceiling_ft": 2500, "wind_kt": 6, "flyable": True},
        )),
        (base + timedelta(hours=1), Event(
            event_id=f"{flight_ref}-5", tenant_id=tenant.id, flight_ref=flight_ref, tail_number=tail,
            type=EventType.ADSB_POSITION, occurred_at=base + timedelta(hours=1), asserted_by=AssertedBy.ADSB,
            source_adapter="adsb.exchange",
            location=Location(lat=lat, lon=lon, alt_ft=0, airport=station, icao24="800F12", tail=tail),
            proof=Proof(adsb_signed=True, signature_sha256=sign_adsb_coord(tail, "800F12", (base + timedelta(hours=1)).isoformat(), lat, lon, 0)),
            data={"callsign": fcode, "groundspeed_kts": 0, "phase": "gate_hold"},
        )),
    ]


class Sandbox:
    def __init__(self, state: "TenantState", anchor: datetime):
        tenant = state.tenant
        arrivals = _seed_sample_flights(tenant, anchor)
        self.clock = VirtualClock(arrivals[0][0])
        self.store = MemoryEventStore(received_at=self.clock.now)
        self.engine = Engine(self.store, self.clock, lambda _t: PROFILES[tenant.regime])
        self.desk = cases.CaseDesk(self.engine, lambda _t: tenant.airline, lambda _t: state.policy,
                                   emit=lambda _t, kind, obj: state.webhooks.record(kind, obj, self.clock.now().isoformat()))
        self.flights = [f"flt_{tenant.id}_live"]
        for at, ev in arrivals:
            self.clock.schedule(("arr", ev.event_id), at, lambda e=ev: self.desk.ingest(e, notify=False))
        self.clock.advance_to(anchor)


class TenantState:
    def __init__(self, tenant: Tenant, log: str, base: dict, backend):
        self.tenant, self.log = tenant, log
        carry = base.get("carry") or {}
        self.policy = Policy.model_validate(carry["policy"]) if carry.get("policy") else tenant.default_policy.model_copy()
        self.appearance = carry.get("appearance") or {"theme": tenant.id, "variables": {}}
        self.sessions: dict[str, dict] = dict(carry.get("sessions") or {})
        self.webhooks = webhooks.WebhookLog(tenant.id, tenant.webhook_secret, ids=seeded(f"{log}:wh"))
        self.webhooks.url = carry.get("webhook_url")
        self.sandbox = Sandbox(self, datetime.fromisoformat(base["at"]))


def _apply_tenant(log: str, st: TenantState | None, op: dict, backend=None):
    if op["op"] == "base":
        return TenantState(TENANTS[op["tenant"]], log, op, backend), None
    if op["op"] == "session":
        st.sessions[op["cs"]] = {"flight_id": op["flight_id"], "expires_ts": op["expires_ts"]}
        return st, (200, {"object": "passenger_session", "client_secret": op["cs"], "flight_id": op["flight_id"]})
    if op["op"] == "events":
        accepted = 0
        for item in op["items"]:
            ev = Event.model_validate({"tenant_id": st.tenant.id, **item})
            st.sandbox.desk.ingest(ev, notify=True)
            accepted += 1
        return st, (200, {"accepted": accepted})
    if op["op"] == "action":
        res = st.sandbox.desk.act(st.tenant.id, op["flight_id"], op["action"], op.get("locale", "en-IN"))
        s = st.sandbox.desk.situation(st.tenant.id, op["flight_id"])
        return st, (200, {"view": view.build_view(s, f"{st.tenant.airline} live flight", res, radar_flash=bool(res.get("radar_flash"))),
                          "resolution": res})
    if op["op"] == "config":
        if "policy" in op["body"]:
            st.policy = Policy.model_validate(op["body"]["policy"])
        if "appearance" in op["body"]:
            st.appearance = op["body"]["appearance"]
        if "webhook_url" in op["body"]:
            st.webhooks.url = op["body"]["webhook_url"]
        return st, (200, {"object": "config", "tenant": st.tenant.id, "policy": st.policy.model_dump(),
                          "appearance": st.appearance, "webhook_url": st.webhooks.url})
    raise ValueError(op["op"])


def build_router(backend=None) -> APIRouter:
    backend = backend or MemoryBackend()
    logs = Sessions(backend, lambda log, st, op: _apply_tenant(log, st, op, backend), ttl=7200, pool="sdk_tenants", cap=50)
    router = APIRouter(prefix="/v1", tags=["sdk"])

    def _auth_secret(request: Request) -> Tenant | JSONResponse:
        auth = request.headers.get("authorization", "")
        token = auth[7:].strip() if auth.lower().startswith("bearer ") else ""
        t = KEYS.get(token)
        if not t or t.secret_key != token:
            return JSONResponse({"error": {"code": "unauthorized", "message": "Provide secret key Bearer sk_test_..."}}, status_code=401)
        return t

    def _auth_any(request: Request) -> tuple[Tenant | None, str]:
        auth = request.headers.get("authorization", "")
        token = auth[7:].strip() if auth.lower().startswith("bearer ") else ""
        t = KEYS.get(token)
        if not t:
            return None, ""
        return t, request.headers.get("x-airtruth-client-secret", "")

    def _base_op(tid: str) -> dict:
        return {"op": "base", "tenant": tid, "at": datetime.now(timezone.utc).isoformat(), "carry": {}}

    @router.get("/dev/keys")
    def dev_keys():
        return {
            "tenants": [
                {
                    "id": t.id, "airline": t.airline, "regime": t.regime,
                    "publishable_key": t.publishable_key, "secret_key": t.secret_key,
                    "sample_flight_id": f"flt_{t.id}_live",
                }
                for t in TENANTS.values()
            ]
        }

    class SessionReq(BaseModel):
        model_config = ConfigDict(extra="forbid")
        flight_id: str

    @router.post("/passenger_sessions")
    def create_passenger_session(req: SessionReq, request: Request):
        t = _auth_secret(request)
        if isinstance(t, JSONResponse):
            return t
        cs = f"atcs_{secrets.token_hex(12)}"
        expires = time.time() + 3600
        code, body = logs.write(f"sdk:{t.id}", lambda _st: {"op": "session", "cs": cs, "flight_id": req.flight_id, "expires_ts": expires},
                                lambda _st, res: res, create=lambda: _base_op(t.id))
        return JSONResponse(body, status_code=code)

    @router.post("/events")
    def ingest_events(body: dict, request: Request):
        t = _auth_secret(request)
        if isinstance(t, JSONResponse):
            return t
        items = body.get("events") or ([body] if "type" in body else [])
        code, res = logs.write(f"sdk:{t.id}", lambda _st: {"op": "events", "items": items},
                               lambda _st, res: res, create=lambda: _base_op(t.id))
        return JSONResponse(res, status_code=code)

    @router.get("/flights/{flight_id}")
    def get_flight(flight_id: str, request: Request):
        t, _cs = _auth_any(request)
        if not t:
            return JSONResponse({"error": {"code": "unauthorized"}}, status_code=401)
        data = logs.read(f"sdk:{t.id}", lambda st: (
            {"view": view.build_view(s, f"{t.airline} live flight", st.sandbox.desk.state(t.id, flight_id)),
             "appearance": st.appearance}
            if (s := st.sandbox.desk.situation(t.id, flight_id)) else None
        ), create=lambda: _base_op(t.id))
        if not data:
            return JSONResponse({"error": {"code": "not_found"}}, status_code=404)
        return data

    class ActReq(BaseModel):
        action: str
        locale: str = "en-IN"

    @router.post("/flights/{flight_id}/actions")
    def act_flight(flight_id: str, req: ActReq, request: Request):
        t, _cs = _auth_any(request)
        if not t:
            return JSONResponse({"error": {"code": "unauthorized"}}, status_code=401)
        code, body = logs.write(f"sdk:{t.id}", lambda _st: {"op": "action", "flight_id": flight_id, "action": req.action, "locale": req.locale},
                                lambda _st, res: res, create=lambda: _base_op(t.id))
        return JSONResponse(body, status_code=code)

    class AskReq(BaseModel):
        question: str
        locale: str = "en-IN"

    @router.post("/flights/{flight_id}/ask")
    def ask_flight(flight_id: str, req: AskReq, request: Request):
        t, _cs = _auth_any(request)
        if not t:
            return JSONResponse({"error": {"code": "unauthorized"}}, status_code=401)
        out = logs.read(f"sdk:{t.id}", lambda st: (
            ask.answer(s, req.question, st.sandbox.desk.state(t.id, flight_id), req.locale)
            if (s := st.sandbox.desk.situation(t.id, flight_id)) else None
        ), create=lambda: _base_op(t.id))
        return out or JSONResponse({"error": {"code": "not_found"}}, status_code=404)

    @router.get("/config")
    def get_config(request: Request):
        t = _auth_secret(request)
        if isinstance(t, JSONResponse):
            return t
        return logs.read(f"sdk:{t.id}", lambda st: {
            "object": "config", "tenant": t.id, "policy": st.policy.model_dump(),
            "appearance": st.appearance, "webhook_url": st.webhooks.url,
        }, create=lambda: _base_op(t.id))

    @router.put("/config")
    def put_config(body: dict, request: Request):
        t = _auth_secret(request)
        if isinstance(t, JSONResponse):
            return t
        code, res = logs.write(f"sdk:{t.id}", lambda _st: {"op": "config", "body": body},
                               lambda _st, res: res, create=lambda: _base_op(t.id))
        return JSONResponse(res, status_code=code)

    @router.get("/webhooks")
    def list_webhooks(request: Request):
        t = _auth_secret(request)
        if isinstance(t, JSONResponse):
            return t
        return {"events": logs.read(f"sdk:{t.id}", lambda st: st.webhooks.list(), create=lambda: _base_op(t.id))}

    return router

