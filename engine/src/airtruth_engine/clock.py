"""Virtual scheduler clock for deterministic replay and timeline scrubbing."""
import heapq
import itertools
from collections.abc import Callable, Hashable
from datetime import datetime


class VirtualClock:
    def __init__(self, start: datetime):
        self._now = start
        self._heap: list[tuple[datetime, int, Hashable]] = []
        self._jobs: dict[Hashable, tuple[datetime, Callable[[], None]]] = {}
        self._tiebreak = itertools.count()

    def now(self) -> datetime:
        return self._now

    def schedule(self, key: Hashable, at: datetime, fn: Callable[[], None]) -> None:
        self._jobs[key] = (at, fn)
        heapq.heappush(self._heap, (at, next(self._tiebreak), key))

    def advance_to(self, until: datetime) -> None:
        while self._heap and self._heap[0][0] <= until:
            at, _, key = heapq.heappop(self._heap)
            job = self._jobs.get(key)
            if job is None or job[0] != at:
                continue
            del self._jobs[key]
            self._now = max(self._now, at)
            job[1]()
        self._now = max(self._now, until)

    @property
    def pending(self) -> int:
        return len(self._jobs)

