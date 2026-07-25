"""Simulate cache-aside reads to expose the stale window created by a TTL."""

from dataclasses import dataclass


@dataclass
class Entry:
    value: str
    expires_at: int


class FakeRedis:
    def __init__(self):
        self.now = 0
        self.entries: dict[str, Entry] = {}

    def get(self, key: str):
        entry = self.entries.get(key)
        if entry is None or entry.expires_at <= self.now:
            self.entries.pop(key, None)
            return None
        return entry.value

    def setex(self, key: str, ttl_seconds: int, value: str):
        self.entries[key] = Entry(value=value, expires_at=self.now + ttl_seconds)

    def advance(self, seconds: int):
        self.now += seconds


DATABASE = {"product:42": "price=10;version=1"}


def read_product(cache: FakeRedis, product_id: str) -> tuple[str, str]:
    key = f"catalog:v1:product:{product_id}"
    cached = cache.get(key)
    if cached is not None:
        return "cache hit", cached

    authoritative = DATABASE[f"product:{product_id}"]
    ttl_with_stable_jitter = 30 + sum(key.encode("utf-8")) % 7
    cache.setex(key, ttl_with_stable_jitter, authoritative)
    return "source read", authoritative


def main():
    cache = FakeRedis()
    print("t=0 ", read_product(cache, "42"))
    cache.advance(5)
    print("t=5 ", read_product(cache, "42"))

    DATABASE["product:42"] = "price=12;version=2"
    cache.advance(5)
    print("t=10", read_product(cache, "42"), "<- old copy is still within TTL")

    cache.advance(30)
    print("t=40", read_product(cache, "42"), "<- expiration forces a source read")


if __name__ == "__main__":
    main()
