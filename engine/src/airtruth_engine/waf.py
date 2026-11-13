"""App-level WAF: request hygiene, rate limits, LLM budget, security headers, access logs."""
import asyncio
import hashlib
import json
import logging
import os
import re
import socket
import time
from contextvars import ContextVar
from dataclasses import dataclass, field
from datetime import datetime, timezone

from .shared import MemoryBackend

log = logging.getLogger("airtruth_engine.access")

CSP = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
       "font-src 'self' data:; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'self'; "
       "form-action 'self'; object-src 'none'")
SECURITY_HEADERS = [
    (b"x-content-type-options", b"nosniff"),
    (b"referrer-policy", b"strict-origin-when-cross-origin"),
    (b"permissions-policy", b"camera=(), microphone=(), geolocation=(), interest-cohort=()"),
    (b"cross-origin-opener-policy", b"same-origin"),
]
HSTS = (b"strict-transport-security", b"max-age=63072000; includeSubDomains")
METHODS = {"GET", "HEAD", "POST", "PUT", "OPTIONS"}
SCANNERS = re.compile(
    r"(/wp-|/wordpress|\.php\d?$|\.php/|\.aspx?$|\.jsp$|\.cgi$|/cgi-bin|/\.env|/\.git|/\.svn|/\.hg|/\.aws|/\.ssh|"
    r"/\.ds_store|/\.htaccess|/\.htpasswd|phpmyadmin|/pma/|/xmlrpc|/vendor/phpunit|/actuator|/boaform|/server-status|"
    r"/owa/|/ecp/|/hnap1|/solr/|/manager/html|\.(sql|bak|old|swp)$)", re.I)
ASK = re.compile(r"^/v1/(demo/sessions/[^/]+/flights/[^/]+|flights/[^/]+)/ask$")
QUIET = {"/healthz", "/readyz"}
STATIC = ("/assets/", "/site/", "/og/", "/sdk/", "/favicon", "/apple-touch-icon", "/icon-")
SERVED_BY = os.environ.get("SERVED_BY") or socket.gethostname()


def parse_rates(spec: str) -> list[tuple[int, int]]:
    out = []
    for part in filter(None, (p.strip() for p in spec.split(","))):
        count, _, per = part.partition("/")
        m = re.fullmatch(r"(\d*)\s*([smhd]?)", per.strip().lower())
        if not m:
            raise ValueError(f"bad rate {part!r}")
        out.append((int(count), int(m.group(1) or 1) * {"s": 1, "m": 60, "h": 3600, "d": 86400, "": 1}[m.group(2)]))
    return out


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


@dataclass
class WafConfig:
    rate_limits: bool = True
    general: list = field(default_factory=lambda: parse_rates("300/m"))
    ask: list = field(default_factory=lambda: parse_rates("20/m,200/d"))
    demo_create: list = field(default_factory=lambda: parse_rates("20/10m"))
    sdk_write_ip: list = field(default_factory=lambda: parse_rates("60/m"))
    sdk_write_key: list = field(default_factory=lambda: parse_rates("600/m"))
    max_body: int = 64 * 1024
    max_events_body: int = 1024 * 1024
    max_path: int = 2048
    max_query: int = 4096
    max_headers: int = 16 * 1024
    trusted_hops: int = 1

    @classmethod
    def from_env(cls) -> "WafConfig":
        e = os.environ.get
        return cls(
            rate_limits=e("WAF_RATE_LIMITS", "on").lower() not in ("0", "off", "false", "no"),
            general=parse_rates(e("RATE_LIMIT_GENERAL", "300/m")),
            ask=parse_rates(e("RATE_LIMIT_ASK", "20/m,200/d")),
            demo_create=parse_rates(e("RATE_LIMIT_DEMO_CREATE", "20/10m")),
            sdk_write_ip=parse_rates(e("RATE_LIMIT_SDK_WRITE", "60/m")),
            sdk_write_key=parse_rates(e("RATE_LIMIT_SDK_KEY", "600/m")),
            max_body=_env_int("MAX_BODY_BYTES", 64 * 1024),
            max_events_body=_env_int("MAX_EVENTS_BODY_BYTES", 1024 * 1024),
            trusted_hops=max(0, _env_int("TRUSTED_PROXY_HOPS", 1)),
        )


def client_ip(scope, trusted_hops: int) -> str:
    peer = (scope.get("client") or ("0.0.0.0", 0))[0]
    if trusted_hops <= 0:
        return peer
    xff = next((v.decode("latin-1") for k, v in scope["headers"] if k == b"x-forwarded-for"), "")
    parts = [p.strip() for p in xff.split(",") if p.strip()]
    return parts[-trusted_hops] if len(parts) >= trusted_hops else peer


def _header(scope, name: bytes) -> str:
    return next((v.decode("latin-1") for k, v in scope["headers"] if k == name), "")


class BodyTooLarge(Exception):
    pass


class Limiter:
    def __init__(self, backend=None):
        self.backend = backend or MemoryBackend()

    def allow(self, scope: str, key: str, rules: list[tuple[int, int]]) -> int | None:
        if not rules:
            return None
        now = int(time.time())
        counts = self.backend.hit([(f"rl:{scope}:{key}:{per}:{now // per}", per) for _, per in rules])
        waits = [per - (now % per) for (limit, per), n in zip(rules, counts) if n > limit]
        return max(waits) if waits else None


_CURRENT_LIMITER: ContextVar[Limiter | None] = ContextVar("airtruth_llm_limiter", default=None)


def current_llm_limiter() -> Limiter | None:
    return _CURRENT_LIMITER.get()


class Firewall:
    def __init__(self, app, config: WafConfig | None = None, limiter: Limiter | None = None):
        self.app = app
        self.cfg = config or WafConfig.from_env()
        self.limiter = limiter or Limiter()
        self._daily = parse_rates(os.environ.get("LLM_DAILY_LIMIT", "500/d"))

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        start = time.monotonic()
        method = scope["method"]
        path = scope["path"]
        ip = client_ip(scope, self.cfg.trusted_hops)
        status = 500
        blocked_by = None

        async def respond(code: int, body: bytes = b"", headers: list[tuple[bytes, bytes]] | None = None):
            nonlocal status
            status = code
            hdrs = [(b"content-type", b"application/json"), *(headers or []), *SECURITY_HEADERS]
            await send({"type": "http.response.start", "status": code, "headers": hdrs})
            await send({"type": "http.response.body", "body": body})

        try:
            if method not in METHODS:
                blocked_by = "method"
                return await respond(405, b'{"detail":"method not allowed"}', [(b"allow", b"GET, HEAD, POST, PUT, OPTIONS")])
            if len(path) > self.cfg.max_path:
                blocked_by = "path_len"
                return await respond(414, b'{"detail":"URI too long"}')
            if len(scope.get("query_string", b"")) > self.cfg.max_query or sum(len(k) + len(v) for k, v in scope["headers"]) > self.cfg.max_headers:
                blocked_by = "hdr_len"
                return await respond(431, b'{"detail":"request header fields too large"}')
            if SCANNERS.search(path):
                blocked_by = "scanner"
                return await respond(404, b'{"detail":"not found"}')

            if method in ("POST", "PUT") and path not in QUIET:
                if not _header(scope, b"user-agent").strip():
                    blocked_by = "empty_ua"
                    return await respond(403, b'{"detail":"User-Agent header required"}')
                limit = self.cfg.max_events_body if path == "/v1/events" else self.cfg.max_body
                cl = _header(scope, b"content-length")
                if cl:
                    try:
                        if int(cl) > limit:
                            blocked_by = "content_length"
                            return await respond(413, b'{"detail":"payload too large"}')
                    except ValueError:
                        return await respond(400, b'{"detail":"invalid content-length"}')
                total = 0

                async def guarded_receive():
                    nonlocal total
                    msg = await receive()
                    total += len(msg.get("body", b""))
                    if total > limit:
                        raise BodyTooLarge()
                    return msg

                recv = guarded_receive
            else:
                recv = receive

            if self.cfg.rate_limits and path not in QUIET and not path.startswith(STATIC):
                wait = None
                if method == "POST" and path == "/v1/demo/sessions":
                    wait = self.limiter.allow("demo_create", ip, self.cfg.demo_create)
                    if wait:
                        blocked_by = "rate_demo"
                elif method == "POST" and ASK.match(path):
                    wait = self.limiter.allow("ask", ip, self.cfg.ask)
                    if wait:
                        blocked_by = "rate_ask"
                elif method in ("POST", "PUT") and path.startswith("/v1/") and not path.startswith("/v1/demo/"):
                    wait = self.limiter.allow("sdk_ip", ip, self.cfg.sdk_write_ip)
                    if wait:
                        blocked_by = "rate_sdk_ip"
                    auth = _header(scope, b"authorization")
                    if not wait and auth.lower().startswith("bearer "):
                        key_hash = hashlib.sha256(auth[7:].strip().encode()).hexdigest()[:16]
                        wait = self.limiter.allow("sdk_key", key_hash, self.cfg.sdk_write_key)
                        if wait:
                            blocked_by = "rate_sdk_key"
                if not wait:
                    wait = self.limiter.allow("gen", ip, self.cfg.general)
                    if wait:
                        blocked_by = "rate_general"
                if wait is not None:
                    return await respond(429, b'{"detail":"rate limit exceeded"}', [(b"retry-after", str(wait).encode())])

            proto = _header(scope, b"x-forwarded-proto").lower()
            host = _header(scope, b"host")

            async def wrapped_send(msg):
                nonlocal status
                if msg["type"] == "http.response.start":
                    status = msg["status"]
                    hdrs = list(msg.get("headers", []))
                    names = {k.lower() for k, _ in hdrs}
                    for k, v in SECURITY_HEADERS:
                        if k not in names:
                            hdrs.append((k, v))
                    if b"content-security-policy" not in names:
                        ct = next((v.decode("latin-1") for k, v in hdrs if k.lower() == b"content-type"), "")
                        if "text/html" in ct:
                            hdrs.append((b"content-security-policy", CSP.encode()))
                    if proto == "https" or (host and not host.startswith(("localhost", "127.0.0.1"))):
                        if HSTS[0] not in names:
                            hdrs.append(HSTS)
                    hdrs.append((b"x-airtruth-node", SERVED_BY.encode()))
                    msg = {**msg, "headers": hdrs}
                await send(msg)

            token = _CURRENT_LIMITER.set(self.limiter)
            try:
                await self.app(scope, recv, wrapped_send)
            except BodyTooLarge:
                blocked_by = "body_stream"
                await respond(413, b'{"detail":"payload too large"}')
            finally:
                _CURRENT_LIMITER.reset(token)
        finally:
            if path not in QUIET and not path.startswith(STATIC):
                ms = round((time.monotonic() - start) * 1000, 1)
                log.info("%s %s -> %s (%.1fms)%s", method, path, status, ms, f" [{blocked_by}]" if blocked_by else "")


def llm_allowed() -> bool:
    limiter = current_llm_limiter()
    if limiter is None:
        return True
    rules = parse_rates(os.environ.get("LLM_DAILY_LIMIT", "500/d"))
    return limiter.allow("llm", "global", rules) is None


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return json.dumps({
            "timestamp": datetime.fromtimestamp(record.created, timezone.utc).isoformat(),
            "severity": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        })


def log_config(fmt: str | None) -> dict | None:
    if fmt != "json":
        return None
    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {"json": {"()": "airtruth_engine.waf.JsonFormatter"}},
        "handlers": {"default": {"class": "logging.StreamHandler", "formatter": "json"}},
        "root": {"handlers": ["default"], "level": "INFO"},
    }

