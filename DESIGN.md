# Design System & Editorial Architecture · AIRTRUTH

## Visual Palette & Typography

AIRTRUTH uses a high-contrast Swiss aviation telemetry editorial system:

- **Light Surface (`--paper`)**: `#f3f4f2` with crisp white inspection panels (`#ffffff`) and architectural hairline rules (`#d6d8df`).
- **Carbon Ink (`--ink`)**: `#0b0f17` for high-legibility headlines, rotation tables, and primary controls.
- **Radar Cobalt Accent (`--acc`)**: `#3a2bff` for interactive triggers, live ADS-B telemetry traces, radar rebuttal flashes, and primary focus borders.
- **Night Band (`--night`)**: `#0b0f17` dark telemetry sections paired with mint emerald (`#8fe3c0`) and lavender mono (`#b9b5ff`) for statutory rules, signed ADS-B coordinates, and carrier audit decks.
- **Typefaces**: `Archivo` display headings, `Inter Tight` UI copy, and `JetBrains Mono` for METAR raw strings, ICAO24 hex codes, UTC timestamps, and SHA-256 signatures.

## White-Label SDK Tokens

`<airtruth-flight>` renders inside an isolated Shadow DOM controlled by per-carrier token sheets (`apps/web/src/widget/themes/{neutral,indigo,delta,ba}.tokens.json`), letting host airline or OTA portals match native surfaces without CSS leakage.
