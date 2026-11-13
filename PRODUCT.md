# Product Overview · AIRTRUTH

AIRTRUTH is an aviation delay verification engine and statutory passenger compensation resolver.

## Problem Statement

Airlines routinely classify avoidable operational disruptions—cascading inbound tail slippage, deferred airframe maintenance swaps, or expired cockpit crew FDTL duty hours—under "Bad Weather" or "Air Traffic Control" to avoid paying fixed statutory payouts (`€250–€600` EU261/UK261, `$400–$650` US DOT 14 CFR §260, `₹5,000–₹10,000` Indian DGCA CAR).

## How AIRTRUTH Works

1. **Append-Only Aviation Telemetry Ingestion (`airtruth_engine.events`)**: Ingests ICAO24 hex coordinates, 4-leg rotation records, NOAA/IMD METAR reports, runway departure movement logs, and crew FDTL logs.
2. **Real-Time Rebuttal Detectors (`airtruth_engine.detectors`)**:
   - `tail_number_chaining`: Confirms the aircraft accumulated `>= 30 min` upstream delay before the flight's scheduled window.
   - `selective_weather`: Proves other jets departed the identical runway cleanly (`>= 3` flights, typically `8+`) under flyable METAR ceilings (`>= 1500m`).
   - `crew_duty_expiry`: Detects crew duty hours exceeding FDTL / FAR 117 ceilings without standby replacement.
   - `atc_program_absent`: Verifies zero FAA Ground Delay Programs or DGCA slot closures during claimed ATC holds.
   - `tarmac_hold_excessive`: Flags prolonged cabin door-closed confinement exceeding statutory limits.
3. **Deterministic Statutory Charter Profiles (`airtruth_engine.profiles`, `airtruth_engine.resolver`)**: Computes exact payout eligibility and generates SHA-256 signed claim packets.
4. **Embeddable Passenger & Claims UI (`<airtruth-flight>`)**: Renders live tail rotation truth cards directly inside airline booking managers, OTA portals, and travel protection apps via Shadow DOM Web Components or headless JSON views.
