# `airtruth-engine`

Python FastAPI backend and deterministic aviation delay truth engine for **AIRTRUTH**.

## Modules

- `taxonomy.py` — Aviation event types (`flight.adsb_ping`, `flight.prior_leg_delayed`, `flight.crew_fdtl_limit`, `flight.metar_report`, `flight.runway_ops`, `flight.excuse_weather`, `flight.claim_rebutted`, `flight.packet_signed`) and reason codes.
- `events.py` — Append-only event validation and `sign_adsb_coord` deterministic coordinate signing.
- `profiles.py` — Statutory profiles for **DGCA CAR §3**, **US DOT 14 CFR §260**, and **EU Regulation 261/2004**.
- `projection.py` — Pure left-fold builder turning telemetry streams into `FlightSituation`.
- `detectors.py` — `tail_number_chaining`, `selective_weather`, `crew_duty_expiry`, `atc_program_absent`, `false_extraordinary_claim`, `tarmac_hold_excessive`, `statutory_payout_eligible`.
- `resolver.py` — Deterministic statutory compensation packets (`build_claim_packet`), `airline_claims_weather` rebuttal handler (`radar_flash`), and optional grounded prose synthesis.
- `api.py` — REST endpoints for live timeline scrubbing (`progress`), `/actions`, `/ask`, `/packet`, `/webhooks`, `/sdk/*`, and static site serving.

## CLI

```bash
python -m airtruth_engine replay ../scenarios/demo/indigo-crew-timeout.json --hours 2
python -m airtruth_engine serve --no-build --port 8787
```
