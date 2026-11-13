# Deployment Guide · AIRTRUTH

AIRTRUTH ships as a single container (`Dockerfile`) serving the FastAPI engine (`airtruth_engine`), compiled `@airtruth/js` browser SDK (`/sdk/airtruth.js`), and prerendered static web pages (`apps/web/dist`).

## Docker Compose (Multi-Replica + Caddy + Redis)

```bash
docker compose -f deploy/compose.yaml up --build
```

## Google Cloud Run

```bash
PROJECT_ID=your-gcp-project REGION=asia-south1 ./deploy/cloudrun/deploy.sh
```

## Vercel Static Web + External Engine API

`deploy/vercel/build-web.sh` builds `@airtruth/js`, prerenders `apps/web`, and places the SDK bundle under `dist/sdk/`.
