"""Built web app static server with ETag, compression, and origin templating."""
import gzip
import hashlib
import os
import re
import threading
from collections import OrderedDict
from pathlib import Path

TYPES = {
    ".html": "text/html; charset=utf-8", ".xml": "application/xml; charset=utf-8",
    ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8",
    ".webmanifest": "application/manifest+json", ".json": "application/json",
    ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".map": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".gif": "image/gif", ".ico": "image/x-icon",
    ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf", ".mp4": "video/mp4",
    ".webm": "video/webm", ".pdf": "application/pdf", ".wasm": "application/wasm",
}
TEMPLATED = {".html", ".xml", ".txt", ".md", ".webmanifest", ".json"}
COMPRESSIBLE = TEMPLATED | {".js", ".mjs", ".css", ".map", ".svg", ".ico"}
IMAGES = {".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".ico", ".svg"}
TOKEN = b"__SITE_URL__"
MIN_GZIP = 256
_HOST = re.compile(r"^(\[[0-9a-fA-F:.]+\]|[A-Za-z0-9.-]{1,253})(:\d{1,5})?$")


def cache_control(rel: str, ext: str) -> str:
    if rel.startswith("assets/"):
        return "public, max-age=31536000, immutable"
    if ext in TEMPLATED or rel.startswith(("favicon", "icon-", "apple-touch-icon")):
        return "no-cache, must-revalidate"
    if rel.startswith(("site/photo/", "og/")) or ("/" not in rel and ext in IMAGES):
        return "public, max-age=604800"
    return "public, max-age=3600"


def _codings(scope) -> set[str]:
    raw = next((v.decode("latin-1") for k, v in scope["headers"] if k == b"accept-encoding"), "")
    out = set()
    for part in raw.split(","):
        name, _, params = part.strip().partition(";")
        q = params.strip()
        if name and not (q.startswith("q=") and q[2:].strip() in ("0", "0.0", "0.00", "0.000")):
            out.add(name.strip().lower())
    return out


def _etag_matches(scope, etag: str) -> bool:
    raw = next((v.decode("latin-1") for k, v in scope["headers"] if k == b"if-none-match"), None)
    if raw is None:
        return False
    want = etag.removeprefix("W/")
    return any(t.strip() == "*" or t.strip().removeprefix("W/") == want for t in raw.split(","))


class WebDist:
    def __init__(self, directory: Path, site_url: str | None = None, trust_forwarded_host: bool = False,
                 cache_bytes: int = 32 * 1024 * 1024):
        self.root = Path(directory)
        self.site_url = (site_url or "").rstrip("/") or None
        self.trust_forwarded_host = trust_forwarded_host
        self.cache_bytes = cache_bytes
        self._cache: OrderedDict[tuple, tuple[bytes, str]] = OrderedDict()
        self._size = 0
        self._lock = threading.Lock()

    def _file(self, rel: str) -> Path | None:
        base = self.root / rel if rel else self.root
        for f in (base, base / "index.html") if rel else (base / "index.html",):
            if f.is_file():
                real = f.resolve()
                if real == self.root.resolve() or self.root.resolve() in real.parents:
                    return f
        return None

    def resolve(self, path: str) -> tuple[str, object]:
        clean = "/" + path.lstrip("/")
        if len(clean) > 1 and clean.endswith("/"):
            return "redirect", clean.rstrip("/")
        rel = clean.lstrip("/")
        if rel == "index.html":
            return "redirect", "/"
        if rel.endswith("/index.html"):
            return "redirect", "/" + rel.removesuffix("/index.html")
        f = self._file(rel)
        if f is None:
            return "missing", self.root / "404.html"
        return "file", f

    def _origin(self, scope) -> str:
        if self.site_url:
            return self.site_url
        scheme = scope.get("scheme") or "http"
        host = next((v.decode("latin-1") for k, v in scope["headers"] if k == b"host"), "localhost")
        if self.trust_forwarded_host:
            fh = next((v.decode("latin-1") for k, v in scope["headers"] if k == b"x-forwarded-host"), "")
            if fh and _HOST.match(fh.split(",")[0].strip()):
                host = fh.split(",")[0].strip()
        return f"{scheme}://{host}"

    def _body(self, f: Path, rel: str, origin: str, enc: str | None) -> tuple[bytes, str]:
        key = (rel, origin if f.suffix in TEMPLATED else "", enc or "")
        with self._lock:
            hit = self._cache.get(key)
            if hit is not None:
                self._cache.move_to_end(key)
                return hit
        raw = f.read_bytes()
        if f.suffix in TEMPLATED:
            raw = raw.replace(TOKEN, origin.encode("utf-8"))
        out = gzip.compress(raw, compresslevel=6) if enc == "gzip" else raw
        etag = f'"airtruth-{hashlib.sha256(out).hexdigest()[:16]}"'
        with self._lock:
            self._cache[key] = (out, etag)
            self._size += len(out)
            while self._size > self.cache_bytes and self._cache:
                _, (old, _) = self._cache.popitem(last=False)
                self._size -= len(old)
        return out, etag

    async def __call__(self, scope, receive, send):
        method = scope["method"]
        if method not in ("GET", "HEAD"):
            await send({"type": "http.response.start", "status": 405, "headers": [(b"allow", b"GET, HEAD")]})
            await send({"type": "http.response.body", "body": b""})
            return

        kind, target = self.resolve(scope["path"])
        if kind == "redirect":
            qs = scope.get("query_string", b"")
            loc = str(target) + (f"?{qs.decode('latin-1')}" if qs else "")
            await send({"type": "http.response.start", "status": 301, "headers": [(b"location", loc.encode("latin-1"))]})
            await send({"type": "http.response.body", "body": b""})
            return

        f = Path(target)
        status = 404 if kind == "missing" else 200
        if not f.is_file():
            await send({"type": "http.response.start", "status": 404, "headers": [(b"content-type", b"text/plain")]})
            await send({"type": "http.response.body", "body": b"Not found"})
            return

        rel = f.relative_to(self.root).as_posix()
        ext = f.suffix.lower()
        ct = TYPES.get(ext, "application/octet-stream")
        origin = self._origin(scope)
        codings = _codings(scope)

        pre_enc = None
        if f.suffix not in TEMPLATED:
            if "br" in codings and f.with_name(f.name + ".br").is_file():
                f, pre_enc = f.with_name(f.name + ".br"), "br"
            elif "gzip" in codings and f.with_name(f.name + ".gz").is_file():
                f, pre_enc = f.with_name(f.name + ".gz"), "gzip"

        if pre_enc:
            body = f.read_bytes()
            etag = f'"airtruth-{hashlib.sha256(body).hexdigest()[:16]}"'
            enc = pre_enc
        else:
            enc = "gzip" if ("gzip" in codings and ext in COMPRESSIBLE and f.stat().st_size >= MIN_GZIP) else None
            body, etag = self._body(f, rel, origin, enc)

        hdrs = [
            (b"content-type", ct.encode("latin-1")),
            (b"cache-control", cache_control(rel, ext).encode("latin-1") if status == 200 else b"no-cache"),
            (b"etag", etag.encode("latin-1")),
            (b"vary", b"Accept-Encoding"),
        ]
        if enc:
            hdrs.append((b"content-encoding", enc.encode("latin-1")))
        if status == 200 and _etag_matches(scope, etag):
            await send({"type": "http.response.start", "status": 304, "headers": hdrs})
            await send({"type": "http.response.body", "body": b""})
            return

        await send({"type": "http.response.start", "status": status, "headers": hdrs})
        await send({"type": "http.response.body", "body": b"" if method == "HEAD" else body})

