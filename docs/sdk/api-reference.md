# Passenger Rights & Public Audit API

Verify delayed flights via POST /v1/flights/lookup, audit EU261, US DOT, and DGCA statutory thresholds, and validate SHA-256 Mode-S claim packets.

## Live Flight Audit Endpoint

- `POST /v1/flights/lookup` — Accepts a flight code, date, origin/destination IATA pair, or pasted airline SMS/PNR (`query`, `flight_date`, `origin`, `dest`, `claimed_reason`).
- Cross-references live **NOAA AviationWeather METAR** (`visibility_m`, ceiling, wind, raw METAR), **OpenSky ADS-B** 3-hour departure count (`other_departures_count`), and **FAA NAS Airport Status** (`gdp_active`) against tail-number chaining and crew FDTL rules.
- Returns `excuse_vs_truth`, `compensation` (`EU261`, `US DOT`, `DGCA`), signed `claim_packet`, and a ready-to-send `claim_letter`.

```bash CURL
curl -s -X POST http://localhost:8787/v1/flights/lookup \
  -H "Content-Type: application/json" \
  -d '{"query":"AI-2772","origin":"CCU","dest":"BOM","flight_date":"2026-11-12","claimed_reason":"weather"}'
```

## SHA-256 Coordinate & Packet Verification

- Every statutory `claim_packet` canonicalizes its Mode-S transponder hex (`icao24`), tail registration, airport coordinates, rotation legs, and excuse rebuttal summary into sorted UTF-8 JSON and stamps `signature_sha256`.
- Each Mode-S fix in `signed_adsb_coordinates` carries a deterministic `coord_sig` digest derived from `tail`, `icao24`, UTC timestamp, latitude, longitude, and altitude.

## Interactive Sandbox & Radar Scrubbing

- `POST /v1/demo/sessions` — Spawn a stateful sandbox session (`{"preset":"signature"}`) across IndiGo (`dgca`), Delta (`us_dot`), and British Airways (`eu261`).
- `POST /v1/demo/sessions/{sid}/advance` — Advance by `beat` (`0..5`) or scrub continuously with `progress` (`0.0..1.0`) or `at` (`<ISO>`).
- `POST /v1/demo/sessions/{sid}/flights/{key}/actions` — Trigger `airline_claims_weather`, `challenge_weather`, `submit_claim`, or `escalate_regulator`.
- `GET /v1/demo/sessions/{sid}/flights/{key}/packet` — Download the signed statutory payout JSON docket with Mode-S coordinates and SHA-256 seal.
