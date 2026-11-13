"""AIRTRUTH CLI: replay flight telemetry scenarios or serve API + SDK + web app."""
import argparse
from datetime import timedelta
from pathlib import Path

from .scenario import Scenario, format_timeline


def _replay(args) -> None:
    from .events import EventType
    from .runner import run_scenario
    from .store.memory import MemoryEventStore

    scenario = Scenario.load(args.scenario)
    store = MemoryEventStore()
    last = scenario.arrivals()[-1][0]
    run = run_scenario(scenario, store, until=last + timedelta(hours=args.hours))
    stored = store.events_for_flight(scenario.tenant.id, scenario.flight_ref)
    projection = run.engine.projection(scenario.tenant.id, scenario.flight_ref)

    print(f"{scenario.id} ({scenario.flight_code} · tail {scenario.tail_number}): {scenario.title}")
    print(f"detector: {scenario.detector} · {scenario.notes}\n")
    print(format_timeline(
        [s.event.occurred_at for s in stored],
        [(s.event.asserted_by.value,
          f"▲ {s.event.data['rule']}: {s.event.data['message']}" if s.event.type is EventType.ENGINE_FINDING
          else s.event.type.value)
         for s in stored],
    ))
    print(f"\nnow: {run.engine.clock.now():%a %d %b %H:%M} · state: {projection.reconciled_state.value}"
          f" · excuse: {projection.excuse_state.value} · payout: {projection.payout.currency}{projection.payout.amount:,}")


def _load_env() -> None:
    import os

    env = Path(__file__).resolve().parents[2] / ".env"
    if not env.is_file():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"'))


def _serve(args) -> None:
    import json
    import os
    import subprocess

    import uvicorn

    from .waf import log_config

    _load_env()
    root = Path(__file__).resolve().parents[3]
    for app in (root / "packages" / "airtruth-js", root / "apps" / "web"):
        if not args.no_build and (args.build or not (app / "dist").is_dir()):
            if not (app / "node_modules").is_dir():
                subprocess.run("npm install --no-audit --no-fund", cwd=app, shell=True, check=True)
            subprocess.run("npm run build", cwd=app, shell=True, check=True)
    port = args.port or int(os.environ.get("PORT") or 8787)
    hops = int(os.environ.get("TRUSTED_PROXY_HOPS", "1") or 0)
    logging_config = log_config(os.environ.get("LOG_FORMAT"))
    host = "localhost" if args.host in ("127.0.0.1", "0.0.0.0") else args.host
    banner = f"AIRTRUTH on http://{host}:{port}  ·  SDK at /sdk/airtruth.js  ·  dev keys at /v1/dev/keys"
    print(json.dumps({"severity": "INFO", "message": banner}) if os.environ.get("LOG_FORMAT") == "json" else banner, flush=True)
    uvicorn.run(
        "airtruth_engine.api:app", host=args.host, port=port,
        proxy_headers=hops > 0, forwarded_allow_ips=os.environ.get("FORWARDED_ALLOW_IPS") or "127.0.0.1",
        timeout_graceful_shutdown=int(os.environ.get("GRACEFUL_SHUTDOWN_SECONDS", 8)),
        timeout_keep_alive=int(os.environ.get("KEEP_ALIVE_SECONDS", 75)),
        server_header=False, access_log=False,
        log_config=logging_config or uvicorn.config.LOGGING_CONFIG, log_level=None if logging_config else "warning",
    )


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="airtruth")
    sub = parser.add_subparsers(dest="cmd", required=True)
    rep = sub.add_parser("replay")
    rep.add_argument("scenario")
    rep.add_argument("--hours", type=int, default=4)
    rep.set_defaults(fn=_replay)

    srv = sub.add_parser("serve")
    srv.add_argument("--host", default="127.0.0.1")
    srv.add_argument("--port", type=int, default=None)
    srv.add_argument("--build", action="store_true")
    srv.add_argument("--no-build", action="store_true")
    srv.set_defaults(fn=_serve)

    args = parser.parse_args(argv)
    args.fn(args)


if __name__ == "__main__":
    main()

