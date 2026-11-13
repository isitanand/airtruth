# syntax=docker/dockerfile:1.7
# AIRTRUTH: unified image serving the API, browser SDK bundle (@airtruth/js), and prerendered site on $PORT.
#
#   docker build -t airtruth .
#   docker run --rm -p 8080:8080 -e GEMINI_API_KEY airtruth
#
# Stage 1 builds @airtruth/js and apps/web with Node; stage 2 runs the Python FastAPI server.

# ---- web: packages/airtruth-js, then apps/web -------------------------------------------------
FROM node:22-bookworm-slim AS web
ENV CI=1 NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false
WORKDIR /src
COPY packages/airtruth-js/package.json packages/airtruth-js/package-lock.json packages/airtruth-js/
COPY apps/web/package.json apps/web/package-lock.json apps/web/
RUN npm ci --prefix packages/airtruth-js && npm ci --prefix apps/web
COPY packages/airtruth-js packages/airtruth-js
RUN npm run build --prefix packages/airtruth-js
COPY docs docs
COPY apps/web apps/web
RUN npm run build --prefix apps/web && test -f apps/web/dist/index.html && test -f apps/web/dist/404.html

# ---- runtime -----------------------------------------------------------------------------------
FROM python:3.11-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8080 \
    TRUSTED_PROXY_HOPS=1 \
    FORWARDED_ALLOW_IPS=* \
    LOG_FORMAT=json \
    AIRTRUTH_ENV=dev
WORKDIR /app
RUN groupadd --system --gid 10001 airtruth && useradd --system --uid 10001 --gid airtruth --home-dir /app airtruth

COPY engine/pyproject.toml engine/pyproject.toml
RUN python -c "import tomllib; p = tomllib.load(open('engine/pyproject.toml', 'rb'))['project']; \
print('\n'.join(p['dependencies'] + p['optional-dependencies']['redis']))" > /tmp/requirements.txt \
 && pip install -r /tmp/requirements.txt && rm /tmp/requirements.txt

COPY engine/src engine/src
RUN pip install --no-deps -e ./engine && python -m compileall -q engine/src
COPY scenarios scenarios
COPY --from=web /src/packages/airtruth-js/dist packages/airtruth-js/dist
COPY --from=web /src/apps/web/dist apps/web/dist

USER airtruth
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/healthz' % os.environ.get('PORT', '8080'), timeout=2)"]
CMD ["python", "-m", "airtruth_engine", "serve", "--no-build", "--host", "0.0.0.0"]
