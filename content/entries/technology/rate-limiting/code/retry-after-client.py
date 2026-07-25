from datetime import datetime, timezone
from email.utils import parsedate_to_datetime


def retry_after_seconds(value: str, received_at: datetime) -> int:
    """Parse the two Retry-After forms defined by HTTP Semantics."""

    value = value.strip()
    if value.isdigit():
        return int(value)

    retry_at = parsedate_to_datetime(value)
    if retry_at.tzinfo is None:
        retry_at = retry_at.replace(tzinfo=timezone.utc)
    return max(0, int((retry_at - received_at).total_seconds()))


def retry_schedule(
    retry_after: str | None,
    received_at: datetime,
    max_attempts: int = 4,
) -> list[int]:
    """Return cumulative wait times; use bounded backoff without a header."""

    if max_attempts < 1:
        return []
    if retry_after is not None:
        return [retry_after_seconds(retry_after, received_at)]

    elapsed = 0
    schedule = []
    for attempt in range(max_attempts):
        elapsed += min(8, 2**attempt)
        schedule.append(elapsed)
    return schedule


if __name__ == "__main__":
    received = datetime(2026, 7, 22, 12, 0, tzinfo=timezone.utc)

    assert retry_schedule("6", received) == [6]
    assert retry_schedule(None, received) == [1, 3, 7, 15]
    assert retry_after_seconds("Wed, 22 Jul 2026 12:00:09 GMT", received) == 9

    print("with Retry-After:", retry_schedule("6", received))
    print("fallback backoff:", retry_schedule(None, received))
