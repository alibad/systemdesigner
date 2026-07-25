"""A dependency-free cache-aside sketch with versioned keys and single-flight refill."""

from collections.abc import Callable
from dataclasses import dataclass, field
from threading import Lock
from typing import TypeVar


T = TypeVar("T")


@dataclass
class LocalMemcached:
    values: dict[str, object] = field(default_factory=dict)

    def get(self, key: str) -> object | None:
        return self.values.get(key)

    def set(self, key: str, value: object) -> None:
        self.values[key] = value


class CacheAside:
    def __init__(self, cache: LocalMemcached) -> None:
        self.cache = cache
        self._refill_locks: dict[str, Lock] = {}
        self._locks_guard = Lock()

    def _lock_for(self, key: str) -> Lock:
        with self._locks_guard:
            return self._refill_locks.setdefault(key, Lock())

    def get_or_load(self, entity: str, entity_id: str, version: int, load: Callable[[], T]) -> T:
        key = f"{entity}:v{version}:{entity_id}"
        cached = self.cache.get(key)
        if cached is not None:
            return cached  # type: ignore[return-value]

        with self._lock_for(key):
            cached = self.cache.get(key)
            if cached is not None:
                return cached  # type: ignore[return-value]
            value = load()
            self.cache.set(key, value)
            return value


if __name__ == "__main__":
    cache = LocalMemcached()
    client = CacheAside(cache)
    source_reads = 0

    def load_product() -> dict[str, object]:
        global source_reads
        source_reads += 1
        return {"id": "p-42", "price": 25}

    first = client.get_or_load("product", "p-42", version=3, load=load_product)
    second = client.get_or_load("product", "p-42", version=3, load=load_product)
    assert first == second
    assert source_reads == 1
    print(f"source reads: {source_reads}; cached key: product:v3:p-42")
