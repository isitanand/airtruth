# ADR-001 · Unified Container & Serverless Runtime Platform

## Status

Accepted

## Context

AIRTRUTH serves three coupled artifacts:
1. Prerendered documentation, marketing pages, and airline concept replicas (`apps/web/dist`).
2. Embeddable `@airtruth/js` Shadow DOM Web Component (`packages/airtruth-js/dist`).
3. Stateful/replayable FastAPI telemetry engine (`airtruth_engine`) supporting live `/v1/demo/sessions` timeline scrubbing and signed claim packet generation.

## Decision

Package all three layers into one multi-stage Docker container running Uvicorn/FastAPI behind a proxy (Cloud Run or Caddy + Redis). For pure static CDN deployments (Vercel), `deploy/vercel/build-web.sh` builds static assets separately while routing `/v1/*` API calls to the backend service.

## Consequences

- Zero CORS friction between `/hosts/*.html` airline replicas, `/demos`, `/sdk/airtruth.js`, and `/v1/demo/*` API endpoints when served from one origin.
- Optional Redis (`REDIS_URL`) enables multi-instance horizontal scaling with shared demo session state and rate limiting.
