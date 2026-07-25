from dataclasses import dataclass


@dataclass
class TokenBucket:
    """A deterministic token bucket with caller-supplied monotonic time."""

    capacity: float
    refill_per_second: float
    tokens: float
    updated_at: float

    @classmethod
    def full(cls, capacity: float, refill_per_second: float) -> "TokenBucket":
        if capacity <= 0 or refill_per_second <= 0:
            raise ValueError("capacity and refill_per_second must be positive")
        return cls(capacity, refill_per_second, capacity, 0.0)

    def allow(self, now: float, cost: float = 1.0) -> bool:
        if now < self.updated_at:
            raise ValueError("now must be monotonic")
        if cost <= 0 or cost > self.capacity:
            raise ValueError("cost must be positive and no larger than capacity")

        elapsed = now - self.updated_at
        self.tokens = min(
            self.capacity,
            self.tokens + elapsed * self.refill_per_second,
        )
        self.updated_at = now

        if self.tokens < cost:
            return False

        self.tokens -= cost
        return True


if __name__ == "__main__":
    bucket = TokenBucket.full(capacity=3, refill_per_second=1)
    arrivals = [0.0, 0.0, 0.0, 0.0, 0.5, 1.0]
    decisions = [bucket.allow(now) for now in arrivals]

    assert decisions == [True, True, True, False, False, True]
    print(decisions)
    print(f"tokens remaining: {bucket.tokens:.1f}")
