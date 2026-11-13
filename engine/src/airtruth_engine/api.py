"""FastAPI application: live flight timeline scrubber, airline demo replicas, signed packets, SDK & site serving."""
import hmac
import json
import os
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel, ConfigDict, Field

from . import ask, cases, lookup, sdk, view, webhooks
from .clock import VirtualClock
from .engine import Engine
from .profiles import PROFILES
from .resolver import ACTIONS, Policy, build_claim_packet
from .scenario import Scenario, parse_offset
from .sessions import Gone, Reply, Sessions, seeded
from .shared import MemoryBackend, open_backend
from .store.memory import MemoryEventStore
from .waf import Firewall
from .web import WebDist

ROOT = Path(__file__).resolve().parents[3]
try:
    import dotenv
    dotenv.load_dotenv(ROOT / ".env")
    dotenv.load_dotenv(ROOT / "engine" / ".env")
except Exception:
    pass
SCENARIOS_DIR = ROOT / "scenarios" / "demo"
WEB_DIST = ROOT / "apps" / "web" / "dist"
SDK_DIST = ROOT / "packages" / "airtruth-js" / "dist"

PRESETS = {
    "signature": {
        "title": "6 live flight scenarios across IndiGo, Delta, and British Airways",
        "scenarios": [
            "indigo-crew-timeout",
            "indigo-selective-weather",
            "delta-tail-chain",
            "delta-crew-reserve",
            "ba-selective-weather",
            "ba-tarmac-hold",
        ],
    },
}

DEFAULT_BEATS = [
    {"id": 0, "label": "Scheduled ETD", "offset": "+0h0m"},
    {"id": 1, "label": "4-Leg Tail Rotation", "offset": "+1h10m"},
    {"id": 2, "label": "Crew / Gate Hold", "offset": "+2h5m"},
    {"id": 3, "label": "METAR & 8 RWY Slots", "offset": "+2h40m"},
    {"id": 4, "label": "Airline Claims Weather", "offset": "+3h15m"},
    {"id": 5, "label": "Gate Pushback & Packet", "offset": "+3h55m"},
]


class DemoSession:
    """In-memory flight truth demo session with timeline scrubbing across all 3 airline presets."""

    def __init__(self, preset: str, sid: str):
        self.id = sid
        self.preset = preset
        spec = PRESETS.get(preset, PRESETS["signature"])
        loaded: dict[str, Scenario] = {}
        arrivals = []
        for key in spec["scenarios"]:
            path = SCENARIOS_DIR / f"{key}.json"
            if path.is_file():
                sc = Scenario.load(path)
                loaded[key] = sc
                arrivals.extend(sc.arrivals())

        arrivals.sort(key=lambda pair: pair[0])
        self.scenarios = loaded
        self.start = min(sc.start for sc in loaded.values())
        self.end = max(sc.end for sc in loaded.values())
        # Initialize clock partway through so the dashboard immediately shows rotation & hold, ready to scrub or click "Airline claims weather"
        first_at = arrivals[0][0] if arrivals else self.start
        self.clock = VirtualClock(first_at)
        self.store = MemoryEventStore(received_at=self.clock.now)
        self.engine = Engine(self.store, self.clock, lambda tid: PROFILES.get(tid, PROFILES["dgca"]))
        self.webhooks: dict[str, webhooks.WebhookLog] = {
            t.id: webhooks.WebhookLog(t.id, t.webhook_secret, ids=seeded(f"{sid}:wh:{t.id}"))
            for t in sdk.TENANTS.values()
        }
        self.desk = cases.CaseDesk(
            self.engine,
            brand_for=lambda tid: sdk.TENANTS[tid].airline if tid in sdk.TENANTS else tid.upper(),
            policy_for=lambda _tid: Policy(),
            emit=lambda tid, kind, obj: self.webhooks.get(tid, next(iter(self.webhooks.values()))).record(
                kind, obj, self.clock.now().isoformat(),
            ),
        )
        for at, ev in arrivals:
            self.clock.schedule(("arr", ev.event_id), at, lambda e=ev: self.desk.ingest(e, notify=True))
        # Default inspect clock at +2h45m after scenario start so tail chain + runway/METAR telemetry is visible
        default_at = self.start + timedelta(hours=2, minutes=45)
        self.clock.advance_to(min(default_at, self.end))
        self.radar_flashes: dict[str, bool] = {}

    def beats_for(self, key: str | None = None) -> list[dict]:
        sc = self.scenarios.get(key or next(iter(self.scenarios)))
        if sc and sc.beats:
            return sc.beats
        return DEFAULT_BEATS

    def advance_to(self, target: datetime) -> None:
        clamped = max(self.clock.now(), min(target, self.end))
        self.clock.advance_to(clamped)

    def scrub_to(self, target: datetime) -> None:
        """Allow forward OR backward scrubbing cleanly by clamping inside [start, end]."""
        if target >= self.clock.now():
            self.advance_to(target)
        else:
            # VirtualClock only advances monotonically; record scrubbed view cursor on projection/clock cleanly
            # by replaying session snapshot if user scrubs backward!
            self._replay_to(target)

    def _replay_to(self, target: datetime) -> None:
        fresh = DemoSession(self.preset, self.id)
        fresh.advance_to(max(fresh.start, target))
        self.clock = fresh.clock
        self.store = fresh.store
        self.engine = fresh.engine
        self.desk = fresh.desk
        self.webhooks = fresh.webhooks
        self.radar_flashes = fresh.radar_flashes

    def summary(self) -> dict:
        now = self.clock.now()
        total_sec = max(1.0, (self.end - self.start).total_seconds())
        progress = max(0.0, min(1.0, (now - self.start).total_seconds() / total_sec))
        flights = []
        for key, sc in self.scenarios.items():
            s = self.desk.situation(sc.tenant.id, sc.flight_ref)
            res = self.desk.state(sc.tenant.id, sc.flight_ref)
            flights.append({
                "key": key,
                "flight_ref": sc.flight_ref,
                "flight_code": sc.flight_code,
                "airline": sc.airline,
                "tenant_id": sc.tenant.id,
                "regime": sc.tenant.regime,
                "tail_number": sc.tail_number,
                "route": sc.route,
                "title": sc.title,
                "detector": sc.detector,
                "state": s.p.reconciled_state.value if s else "scheduled",
                "excuse_state": s.p.excuse_state.value if s else "none",
                "delay_minutes": s.p.delay_minutes if s else 0,
                "root_cause": s.root_cause_title if s else sc.title,
                "rebutted": bool(s and s.p.excuse_state.value == "rebutted"),
                "payout": (s.p.payout.amount if s else 0),
                "currency": PROFILES[sc.tenant.regime].currency,
                "decision": res.get("decision") if res else None,
            })
        return {
            "id": self.id,
            "preset": self.preset,
            "title": PRESETS[self.preset]["title"],
            "now": now.isoformat(),
            "start": self.start.isoformat(),
            "end": self.end.isoformat(),
            "progress": round(progress, 4),
            "beats": DEFAULT_BEATS,
            "flights": flights,
        }

    def flight_view(self, key: str) -> dict | None:
        sc = self.scenarios.get(key)
        if not sc:
            return None
        s = self.desk.situation(sc.tenant.id, sc.flight_ref)
        if not s:
            return None
        res = self.desk.state(sc.tenant.id, sc.flight_ref)
        flash = self.radar_flashes.get(key, False)
        v = view.build_view(s, sc.title, res, radar_flash=flash)
        v["key"] = key
        v["detector"] = sc.detector
        v["notes"] = sc.notes
        v["beats"] = sc.beats or DEFAULT_BEATS
        v["timeline_bounds"] = {"start": sc.start.isoformat(), "end": sc.end.isoformat()}
        return v


_BACKEND = open_backend()
_DEMO_SESSIONS: dict[str, DemoSession] = {}


def _get_session(sid: str) -> DemoSession:
    s = _DEMO_SESSIONS.get(sid)
    if s is None:
        raise HTTPException(404, f"unknown demo session {sid!r}")
    return s


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield


app = FastAPI(
    title="AIRTRUTH",
    description="Aviation Delay Verification & Statutory Payout Engine",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
)
app.include_router(sdk.build_router(_BACKEND))


class CreateSessionReq(BaseModel):
    model_config = ConfigDict(extra="forbid")
    preset: str = "signature"


class AdvanceReq(BaseModel):
    model_config = ConfigDict(extra="forbid")
    beat: int | None = None
    at: str | None = None
    progress: float | None = Field(default=None, ge=0.0, le=1.0)


class ActionReq(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["airline_claims_weather", "challenge_weather", "generate_packet", "submit_claim", "escalate_regulator"]
    locale: Literal["en-IN", "hi-Latn-IN"] = "en-IN"


class AskReq(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question: str = Field(min_length=1, max_length=600)
    locale: Literal["en-IN", "hi-Latn-IN"] = "en-IN"


class LookupReq(BaseModel):
    model_config = ConfigDict(extra="forbid")
    query: str = Field(min_length=2, max_length=1200)
    flight_date: str | None = None
    origin: str | None = Field(default=None, max_length=4)
    dest: str | None = Field(default=None, max_length=4)
    claimed_reason: Literal[
        "auto", "weather", "atc", "crew", "technical", "late_aircraft", "security", "overbooking", "none"
    ] = "auto"
    delay_status: Literal["unknown", "on_time", "under_2h", "2_to_3h", "over_3h", "cancelled"] = "unknown"


@app.post("/v1/flights/lookup")
def lookup_flight(req: LookupReq):
    return lookup.audit_flight(
        SCENARIOS_DIR,
        query=req.query,
        flight_date=req.flight_date,
        origin_hint=req.origin,
        dest_hint=req.dest,
        claimed_reason=req.claimed_reason,
        delay_status=req.delay_status,
    )


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "airtruth"}


@app.get("/readyz")
def readyz():
    return {"status": "ready" if _BACKEND.ping() else "degraded"}


@app.post("/v1/demo/sessions", status_code=201)
def create_demo_session(req: CreateSessionReq):
    if req.preset not in PRESETS:
        raise HTTPException(400, f"unknown preset {req.preset!r}")
    sid = secrets.token_urlsafe(8)
    s = DemoSession(req.preset, sid)
    _DEMO_SESSIONS[sid] = s
    if len(_DEMO_SESSIONS) > 100:
        oldest = next(iter(_DEMO_SESSIONS))
        _DEMO_SESSIONS.pop(oldest, None)
    return s.summary()


@app.get("/v1/demo/sessions/{sid}")
def get_demo_session(sid: str):
    return _get_session(sid).summary()


@app.post("/v1/demo/sessions/{sid}/advance")
def advance_demo_session(sid: str, req: AdvanceReq):
    s = _get_session(sid)
    if req.at:
        s.scrub_to(datetime.fromisoformat(req.at))
    elif req.progress is not None:
        span = (s.end - s.start).total_seconds()
        s.scrub_to(s.start + timedelta(seconds=span * req.progress))
    elif req.beat is not None:
        beats = DEFAULT_BEATS
        idx = max(0, min(len(beats) - 1, req.beat))
        s.scrub_to(s.start + parse_offset(beats[idx]["offset"]))
    else:
        s.advance_to(s.clock.now() + timedelta(minutes=30))
    return s.summary()


@app.get("/v1/demo/sessions/{sid}/flights/{key}")
def get_demo_flight(sid: str, key: str):
    s = _get_session(sid)
    v = s.flight_view(key)
    if not v:
        raise HTTPException(404, f"unknown flight {key!r}")
    return {"session": s.summary(), "view": v}


@app.post("/v1/demo/sessions/{sid}/flights/{key}/actions")
def act_demo_flight(sid: str, key: str, req: ActionReq):
    s = _get_session(sid)
    sc = s.scenarios.get(key)
    if not sc:
        raise HTTPException(404, f"unknown flight {key!r}")
    res = s.desk.act(sc.tenant.id, sc.flight_ref, req.action, locale=req.locale)
    s.radar_flashes[key] = bool(res.get("radar_flash"))
    return {"session": s.summary(), "view": s.flight_view(key), "resolution": res}


@app.get("/v1/demo/sessions/{sid}/flights/{key}/packet")
def get_demo_packet(sid: str, key: str):
    s = _get_session(sid)
    sc = s.scenarios.get(key)
    if not sc:
        raise HTTPException(404, f"unknown flight {key!r}")
    pkt = s.desk.packet(sc.tenant.id, sc.flight_ref)
    if not pkt:
        raise HTTPException(404, "no statutory claim packet available yet")
    return pkt


@app.post("/v1/demo/sessions/{sid}/flights/{key}/ask")
def ask_demo_flight(sid: str, key: str, req: AskReq):
    s = _get_session(sid)
    sc = s.scenarios.get(key)
    if not sc:
        raise HTTPException(404, f"unknown flight {key!r}")
    sit = s.desk.situation(sc.tenant.id, sc.flight_ref)
    if not sit:
        raise HTTPException(404, "flight not yet active on timeline")
    return ask.answer(sit, req.question, s.desk.state(sc.tenant.id, sc.flight_ref), locale=req.locale)


@app.get("/v1/demo/sessions/{sid}/flights/{key}/case")
def get_demo_case(sid: str, key: str):
    s = _get_session(sid)
    sc = s.scenarios.get(key)
    if not sc:
        raise HTTPException(404, f"unknown flight {key!r}")
    sit = s.desk.situation(sc.tenant.id, sc.flight_ref)
    return {
        "resolution": s.desk.state(sc.tenant.id, sc.flight_ref),
        "packet": build_claim_packet(sit) if sit else None,
        "findings": [f for f in (s.flight_view(key) or {}).get("timeline", []) if f["kind"] == "engine.finding"],
    }


@app.get("/v1/demo/sessions/{sid}/webhooks")
def list_demo_webhooks(sid: str):
    s = _get_session(sid)
    events = []
    for log in s.webhooks.values():
        events.extend(log.list())
    events.sort(key=lambda e: e["created"], reverse=True)
    return {"events": events[:50]}


@app.get("/docs/quickstart", include_in_schema=False)
@app.get("/docs/integrate-carrier-app", include_in_schema=False)
@app.get("/docs/integrate-ota-portal", include_in_schema=False)
def redirect_retired_sdk_docs():
    """Redirect retired carrier/OTA SDK tutorial paths to the passenger Flight Lookup workbench."""
    return RedirectResponse(url="/lookup", status_code=302)


@app.get("/sdk/{path:path}")
def serve_sdk(path: str):
    target = (SDK_DIST / path).resolve()
    if not target.is_file() or SDK_DIST.resolve() not in target.parents:
        raise HTTPException(404, "sdk asset not found")
    return FileResponse(target, media_type="text/javascript; charset=utf-8" if target.suffix in (".js", ".mjs") else "application/json")


if WEB_DIST.is_dir():
    web_dist = WebDist(
        WEB_DIST,
        site_url=os.environ.get("SITE_URL"),
        trust_forwarded_host=int(os.environ.get("TRUSTED_PROXY_HOPS", "1") or 0) > 0,
    )

    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    async def serve_web(request: Request):
        chunks = []

        async def send(msg):
            chunks.append(msg)

        await web_dist(request.scope, request.receive, send)
        start = next((c for c in chunks if c["type"] == "http.response.start"), {"status": 404, "headers": []})
        body = b"".join(c.get("body", b"") for c in chunks if c["type"] == "http.response.body")
        return Response(content=body, status_code=start["status"], headers={k.decode("latin-1"): v.decode("latin-1") for k, v in start["headers"]})

