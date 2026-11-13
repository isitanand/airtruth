# Architecture · AIRTRUTH

## Stack

```
packages/airtruth-js (@airtruth/js Web Component + React wrapper)
   │
   ▼ HTTP / JSON / Webhooks
engine/src/airtruth_engine/
   ├── api.py          (FastAPI REST + timeline scrub + static site & SDK server)
   ├── sessions.py     (Tape / VirtualClock scenario runner & session isolation)
   ├── projection.py   (Pure fold: FlightEvent[] -> FlightSituation)
   ├── detectors.py    (tail_number_chaining, selective_weather, crew_duty_expiry, ...)
   ├── resolver.py     (Deterministic DGCA / US DOT / EU261 packet & rebuttal builder)
   └── events.py       (sign_adsb_coord cryptographic seal helpers)
   │
   ▼ Prerendered static bundle
apps/web/dist/ (Home, Demos, Case Studies, Docs, /hosts/{indigo,delta,ba}.html)
```

## Timeline Scrubbing Model

Every demo session replays a curated `Scenario` along a `VirtualClock`:
- `POST /v1/demo/sessions/{sid}/advance` accepts either `{ "beat": <int> }` or `{ "progress": 0.0..1.0 }`.
- Rebuilding projection state via pure left-fold guarantees scrubbing forward **and backward** yields identical, deterministic detector states and timestamps.
- `POST /v1/demo/sessions/{sid}/flights/{key}/actions` (`action: "airline_claims_weather"`) injects an `excuse_weather` claim on demand, runs rebuttal detectors immediately, sets `radar_flash: true`, and seals the downloadable statutory claim packet.
