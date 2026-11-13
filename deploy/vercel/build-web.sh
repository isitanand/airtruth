#!/usr/bin/env bash
# Vercel "web" service build (runs in apps/web): builds @airtruth/js SDK, builds & prerenders site, copies SDK to /sdk.
set -euo pipefail
npm --prefix ../../packages/airtruth-js ci --no-audit --no-fund
npm --prefix ../../packages/airtruth-js run build
npm run build
mkdir -p dist/sdk
cp ../../packages/airtruth-js/dist/*.js ../../packages/airtruth-js/dist/*.mjs dist/sdk/
