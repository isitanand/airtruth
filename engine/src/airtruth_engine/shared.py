"""Shared op-log and counter store: MemoryBackend (default) or RedisBackend (REDIS_URL)."""
import os
import threading
import time
from collections import OrderedDict


class StoreUnavailable(RuntimeError):
    """Shared Redis backend unreachable."""


class MemoryBackend:
    kind = "memory"

    def __init__(self, max_counters: int = 200_000):
        self._lock = threading.Lock()
        self._logs: OrderedDict[str, list] = OrderedDict()
        self._kv: dict[str, tuple[object, float]] = {}
        self._max_counters = max_counters

    def _live(self, key: str) -> list | None:
        entry = self._logs.get(key)
        if entry is not None and entry[1] < time.monotonic():
            del self._logs[key]
            return None
        return entry

    def log_create(self, key: str, op: str, ttl: int, pool: str | None = None, cap: int = 0) -> bool:
        with self._lock:
            if self._live(key) is not None:
                return False
            if pool and cap:
                self._evict(pool, cap - 1)
            self._logs[key] = [[op], time.monotonic() + ttl, pool]
            return True

    def _evict(self, pool: str, keep: int) -> None:
        mine = [k for k, e in self._logs.items() if e[2] == pool]
        now = time.monotonic()
        for k in [k for k in mine if self._logs[k][1] < now]:
            del self._logs[k]
        mine = [k for k in mine if k in self._logs]
        for k in mine[:max(0, len(mine) - keep)]:
            del self._logs[k]

    def log_append(self, key: str, version: int, op: str, ttl: int) -> bool:
        with self._lock:
            entry = self._live(key)
            if entry is None or len(entry[0]) != version:
                return False
            entry[0].append(op)
            entry[1] = time.monotonic() + ttl
            self._logs.move_to_end(key)
            return True

    def log_read(self, key: str, start: int, ttl: int, pool: str | None = None) -> tuple[int, list[str]]:
        with self._lock:
            entry = self._live(key)
            if entry is None:
                return 0, []
            entry[1] = time.monotonic() + ttl
            self._logs.move_to_end(key)
            return len(entry[0]), list(entry[0][start:])

    def log_drop(self, key: str) -> None:
        with self._lock:
            self._logs.pop(key, None)

    def hit(self, keys: list[tuple[str, int]]) -> list[int]:
        now, out = time.monotonic(), []
        with self._lock:
            if len(self._kv) > self._max_counters:
                self._kv = {k: v for k, v in self._kv.items() if v[1] > now}
                if len(self._kv) > self._max_counters:
                    self._kv.clear()
            for key, ttl in keys:
                value, exp = self._kv.get(key, (0, 0.0))
                if exp < now:
                    value, exp = 0, now + ttl
                self._kv[key] = (int(value) + 1, exp)
                out.append(int(value) + 1)
        return out

    def claim(self, key: str, ttl: int) -> bool:
        now = time.monotonic()
        with self._lock:
            _, exp = self._kv.get(key, (None, 0.0))
            if exp > now:
                return False
            self._kv[key] = (True, now + ttl)
            return True

    def get(self, key: str) -> str | None:
        now = time.monotonic()
        with self._lock:
            val, exp = self._kv.get(key, (None, 0.0))
            return str(val) if exp > now and val is not None else None

    def set(self, key: str, value: str, ttl: int) -> None:
        with self._lock:
            self._kv[key] = (value, time.monotonic() + ttl)

    def ping(self) -> bool:
        return True


class RedisBackend:
    kind = "redis"

    def __init__(self, url: str, pool_max: int = 200):
        import redis
        self._r = redis.from_url(
            url, decode_responses=True, max_connections=pool_max,
            socket_connect_timeout=float(os.environ.get("REDIS_TIMEOUT_SECONDS", 2)),
            socket_timeout=float(os.environ.get("REDIS_TIMEOUT_SECONDS", 2)),
            health_check_interval=30,
        )

    def _call(self, fn):
        try:
            return fn()
        except Exception as exc:
            raise StoreUnavailable(str(exc)) from exc

    def log_create(self, key: str, op: str, ttl: int, pool: str | None = None, cap: int = 0) -> bool:
        def go():
            if not self._r.hsetnx(key, "1", op):
                return False
            self._r.expire(key, ttl)
            if pool and cap:
                self._r.zadd(pool, {key: time.time()})
                n = self._r.zcard(pool)
                if n > cap:
                    victims = self._r.zrange(pool, 0, n - cap - 1)
                    if victims:
                        self._r.delete(*victims)
                        self._r.zrem(pool, *victims)
            return True
        return self._call(go)

    def log_append(self, key: str, version: int, op: str, ttl: int) -> bool:
        def go():
            if not version or not self._r.exists(key):
                return False
            if not self._r.hsetnx(key, str(version + 1), op):
                return False
            self._r.expire(key, ttl)
            return True
        return self._call(go)

    def log_read(self, key: str, start: int, ttl: int, pool: str | None = None) -> tuple[int, list[str]]:
        def go():
            n = self._r.hlen(key)
            if not n:
                return 0, []
            ops = self._r.hmget(key, [str(i) for i in range(start + 1, n + 1)]) if start < n else []
            self._r.expire(key, ttl)
            if pool:
                self._r.zadd(pool, {key: time.time()})
            return n, [o for o in ops if o is not None]
        return self._call(go)

    def log_drop(self, key: str) -> None:
        self._call(lambda: self._r.delete(key))

    def hit(self, keys: list[tuple[str, int]]) -> list[int]:
        def go():
            pipe = self._r.pipeline(transaction=False)
            for key, ttl in keys:
                pipe.set(key, 0, ex=ttl, nx=True)
                pipe.incr(key)
            res = pipe.execute()
            return [int(res[i]) for i in range(1, len(res), 2)]
        return self._call(go)

    def claim(self, key: str, ttl: int) -> bool:
        return bool(self._call(lambda: self._r.set(key, "1", ex=ttl, nx=True)))

    def get(self, key: str) -> str | None:
        return self._call(lambda: self._r.get(key))

    def set(self, key: str, value: str, ttl: int) -> None:
        self._call(lambda: self._r.set(key, value, ex=ttl))

    def ping(self) -> bool:
        try:
            return bool(self._r.ping())
        except Exception:
            return False


def open_backend(redis_url: str | None = None):
    url = redis_url if redis_url is not None else os.environ.get("REDIS_URL")
    return RedisBackend(url) if url else MemoryBackend()

