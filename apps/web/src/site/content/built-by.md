---
title: About AIRTRUTH
summary: AIRTRUTH is a full-stack aviation delay verification website, live telemetry lookup engine, and deterministic statutory payout resolver.
---

AIRTRUTH combines live NOAA METAR weather, OpenSky ADS-B runway departures, FAA NAS status, tail-number rotation chaining, and crew FDTL telemetry with deterministic statutory charter rules (`EU261`, `US DOT 14 CFR §260`, `Indian DGCA CAR`) to debunk false airline "bad weather" exemptions and emit signed payout claim packets.

Everything in this repository runs locally or in production from a unified full-stack codebase:

- **Direct Flight & PNR Lookup (`/lookup`)**: Passengers enter any flight code, date, route, or raw airline delay SMS directly on the website to generate a contradictory radar dossier and claim demand letter.
- **Aviation Truth Engine (`airtruth_engine`)**: Append-only telemetry store with tail-number rotation chaining (last 4 legs), selective weather detection against parallel runway departures, and crew FDTL limit detectors.
- **Statutory Policy Resolver**: Deterministically rebuts fraudulent extraordinary-circumstance claims and seals downloadable claim packets containing SHA-256 signed ADS-B flight coordinates.
- **Interactive Carrier App Replicas (`/demos`)**: Concept passenger flight trackers for **IndiGo** (India · DGCA), **Delta** (US · DOT), and **British Airways** (UK/EU · EU261) powered cleanly by the underlying `<airtruth-flight>` Web Component and JSON API (`POST /v1/flights/lookup`).

## Scope & Simulation Notes

- All airline app skins (`IndiGo`, `Delta`, `British Airways`) are synthetic interactive demonstrations and carry no affiliation or live integration with third-party carrier reservation systems.
- Audit metrics reflect structured aviation delay scenarios replayed through deterministic detectors.

## Engineering & Architecture

- **Author & Architect**: [Anand Choubey](https://anandchoubey.is-a.dev/)
- **Portfolio**: [https://anandchoubey.is-a.dev/](https://anandchoubey.is-a.dev/)
- **GitHub**: [@isitanand](https://github.com/isitanand)
- **Open-Source Repository**: [https://github.com/isitanand/airtruth](https://github.com/isitanand/airtruth)
