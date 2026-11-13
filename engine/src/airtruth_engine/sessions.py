"""Materialized append-only session logs with optimistic compare-and-set."""
import hashlib
import itertools
import json
import threading
from collections import OrderedDict
from collections.abc import Callable
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any


class Tape:
    def __init__(self, mode: str, entries: list | None = None, replaying: bool = False):
        self.mode, self.entries, self.deferred = mode, list(entries or []), []
        self.replaying = replaying or mode == "replay"
        self._played = 0

    def record(self, out: dict | None) -> None:
        self.entries.append(out)

    def play(self) -> dict | None:
        if self._played >= len(self.entries):
            return None
        self._played += 1
        return self.entries[self._played - 1]


_TAPE: ContextVar[Tape | None] = ContextVar("airtruth_tape", default=None)


@contextmanager
def tape(mode: str, entries: list | None = None):
    outer = _TAPE.get()
    t = Tape(mode, entries, replaying=outer is not None and outer.replaying)
    token = _TAPE.set(t)
    try:
        yield t
    finally:
        _TAPE.reset(token)


def current_tape() -> Tape | None:
    return _TAPE.get()


def after_commit(fn: Callable[[], Any]) -> None:
    t = _TAPE.get()
    if t is not None and t.replaying:
        return
    if t is None or t.mode == "off":
        fn()
    elif t.mode == "record":
        t.deferred.append(fn)


def seeded(seed: str) -> Callable[[str], str]:
    counter = itertools.count(1)
    return lambda prefix: prefix + hashlib.sha256(f"{seed}:{next(counter)}".encode()).hexdigest()[:24]


class Gone(LookupError):
    pass


class Exists(RuntimeError):
    pass


class Busy(RuntimeError):
    pass


class Stale(Exception):
    pass


@dataclass(frozen=True)
class Reply:
    value: Any


@dataclass(eq=False)
class Live:
    obj: Any = None
    version: int = 0
    dead: bool = False
    lock: threading.RLock = field(default_factory=threading.RLock)


Apply = Callable[[str, Any, dict], tuple[Any, Any]]


class Sessions:
    def __init__(self, backend, apply: Apply, ttl: int, cache_size: int = 128, pool: str | None = None,
                 cap: int = 0):
        self.backend, self.apply, self.ttl = backend, apply, ttl
        self.cache_size, self.pool, self.cap = cache_size, pool, cap
        self._cache: OrderedDict[str, Live] = OrderedDict()
        self._lock = threading.Lock()

    def _cached(self, name: str) -> Live | None:
        with self._lock:
            live = self._cache.get(name)
            if live is not None:
                self._cache.move_to_end(name)
            return live

    def _keep(self, name: str, live: Live) -> None:
        with self._lock:
            self._cache[name] = live
            self._cache.move_to_end(name)
            while len(self._cache) > self.cache_size:
                self._cache.popitem(last=False)

    def _kill(self, name: str, live: Live) -> None:
        live.dead = True
        with self._lock:
            if self._cache.get(name) is live:
                del self._cache[name]

    def version(self, name: str) -> int:
        live = self._cached(name)
        return live.version if live else 0

    def _open(self, name: str, create: Callable[[], dict] | None = None) -> Live:
        for _ in range(4):
            live = self._cached(name)
            if live is None or live.dead:
                live = Live()
            n, ops = self.backend.log_read(name, live.version, self.ttl, self.pool)
            if n and n < live.version:
                live = Live()
                n, ops = self.backend.log_read(name, 0, self.ttl, self.pool)
            if not n:
                self._kill(name, live)
                if create is None:
                    raise Gone(name)
                self.backend.log_create(name, json.dumps(create(), separators=(",", ":")), self.ttl, self.pool, self.cap)
                continue
            with live.lock:
                if live.dead:
                    continue
                first = n - len(ops) + 1
                try:
                    for i, raw in enumerate(ops, start=first):
                        if i == live.version + 1:
                            self._replay(name, live, json.loads(raw))
                except Stale:
                    self._kill(name, live)
                    continue
                except BaseException:
                    self._kill(name, live)
                    raise
                if live.version < n:
                    continue
            self._keep(name, live)
            return live
        raise Busy(name)

    def _replay(self, name: str, live: Live, op: dict) -> None:
        with tape("replay", op.get("llm")):
            live.obj, _ = self.apply(name, live.obj, op)
        live.version += 1

    def read(self, name: str, fn: Callable[[Any], Any], create: Callable[[], dict] | None = None) -> Any:
        for _ in range(4):
            live = self._open(name, create)
            with live.lock:
                if not live.dead:
                    return fn(live.obj)
        raise Busy(name)

    def _run(self, name: str, live: Live, op: dict) -> tuple[Any, dict, Tape]:
        with tape("record") as t:
            try:
                live.obj, result = self.apply(name, live.obj, op)
            except BaseException:
                self._kill(name, live)
                raise
        return result, ({**op, "llm": t.entries} if t.entries else op), t

    @staticmethod
    def _commit(t: Tape) -> None:
        for fn in t.deferred:
            fn()

    def create(self, name: str, op: dict, respond: Callable[[Any, Any], Any]) -> Any:
        live = Live()
        with live.lock:
            result, op, t = self._run(name, live, op)
            if not self.backend.log_create(name, json.dumps(op, separators=(",", ":")), self.ttl, self.pool, self.cap):
                raise Exists(name)
            live.version = 1
            self._keep(name, live)
            self._commit(t)
            return respond(live.obj, result)

    def write(self, name: str, plan: Callable[[Any], dict | Reply], respond: Callable[[Any, Any], Any],
              create: Callable[[], dict] | None = None) -> Any:
        for _ in range(5):
            live = self._open(name, create)
            with live.lock:
                if live.dead:
                    continue
                op = plan(live.obj)
                if isinstance(op, Reply):
                    return op.value
                result, op, t = self._run(name, live, op)
                try:
                    ok = self.backend.log_append(name, live.version, json.dumps(op, separators=(",", ":")), self.ttl)
                except BaseException:
                    self._kill(name, live)
                    raise
                if ok:
                    live.version += 1
                    self._commit(t)
                    return respond(live.obj, result)
                self._kill(name, live)
        raise Busy(name)

    def clear(self) -> None:
        with self._lock:
            for live in self._cache.values():
                live.dead = True
            self._cache.clear()

