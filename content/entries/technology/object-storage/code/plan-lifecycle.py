from dataclasses import dataclass


@dataclass(frozen=True)
class ObjectSample:
    key: str
    age_days: int
    reads_last_90_days: int
    retained_until_day: int


def classify(sample: ObjectSample, today: int) -> str:
    if sample.age_days < 30 or sample.reads_last_90_days >= 5:
        return "hot"
    if sample.age_days < 180 or sample.reads_last_90_days > 0:
        return "warm"
    if today < sample.retained_until_day:
        return "archive"
    return "delete-candidate"


if __name__ == "__main__":
    samples = [
        ObjectSample("events/2026/07/19", 1, 50, 900),
        ObjectSample("backups/2024/01/01", 900, 0, 1_200),
    ]
    assert [classify(item, 1_000) for item in samples] == ["hot", "archive"]
    print([classify(item, 1_000) for item in samples])
