# Roadmap · AIRTRUTH

## Delivered in v1

- Append-only aviation telemetry model (`airtruth_engine.taxonomy`, `events`, `projection`).
- Core lie detectors: `tail_number_chaining` (4-leg lookback), `selective_weather` (peer runway departures + METAR), `crew_duty_expiry` (FDTL / FAR 117), `atc_program_absent`, `tarmac_hold_excessive`, `false_extraordinary_claim`.
- Three statutory charter profiles: EU Regulation 261/2004 (UK261), US DOT 14 CFR §260, India DGCA CAR §3.
- Signed Claim Packet generator with SHA-256 Mode-S ADS-B coordinate seals.
- Embeddable Shadow DOM SDK `@airtruth/js` + interactive `/demos` stage with IndiGo, Delta, and British Airways concept replicas.

## Planned Enhancements

- **Direct AirSewa / UK CAA / DOT Form PDF Renderers**: Formal regulator-specific PDF generation alongside signed JSON dockets.
- **Live OpenSky / ADS-B Exchange Webhook Adapters**: Real-time ingestion bridges for continuous fleet rotation monitoring.
- **Native Mobile SDKs**: SwiftUI and Jetpack Compose wrappers mirroring `<airtruth-flight>`.
