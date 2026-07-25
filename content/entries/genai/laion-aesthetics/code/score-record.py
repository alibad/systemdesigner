from dataclasses import dataclass


@dataclass(frozen=True)
class ScoreRecord:
    content_sha256: str
    scorer_name: str
    scorer_version: str
    preprocessing_version: str
    raw_score: float
    calibrated_score: float | None
    scored_at: str


def write_score(record: ScoreRecord, score_store) -> None:
    key = (
        record.content_sha256,
        record.scorer_name,
        record.scorer_version,
        record.preprocessing_version,
    )
    score_store.put_if_absent(key=key, value=record)
