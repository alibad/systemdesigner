"""Reproduce the ECS rolling-deployment circuit-breaker threshold."""

from math import ceil
from sys import argv


def failure_threshold(desired_task_count: int) -> int:
    """Return ceil(50% of desired count), clamped to the AWS range."""
    if desired_task_count < 1:
        raise ValueError("desired_task_count must be positive")
    return min(200, max(3, ceil(desired_task_count * 0.5)))


if __name__ == "__main__":
    desired = int(argv[1]) if len(argv) > 1 else 25
    print(f"desired={desired} threshold={failure_threshold(desired)}")

    assert failure_threshold(1) == 3
    assert failure_threshold(25) == 13
    assert failure_threshold(400) == 200
    assert failure_threshold(800) == 200
