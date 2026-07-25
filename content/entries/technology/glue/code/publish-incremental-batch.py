"""Create stable identities for replay-safe incremental output."""

from dataclasses import dataclass
from hashlib import sha256


@dataclass(frozen=True)
class Batch:
    source: str
    start_position: str
    end_position: str
    schema_version: str
    code_version: str

    @property
    def batch_id(self) -> str:
        material = "|".join(
            (self.source, self.start_position, self.end_position, self.schema_version, self.code_version)
        )
        return sha256(material.encode("utf-8")).hexdigest()[:16]

    def output_prefix(self) -> str:
        return f"staging/events/batch_id={self.batch_id}/"


if __name__ == "__main__":
    first_attempt = Batch("orders", "000120", "000180", "v4", "git-a41c")
    retry = Batch("orders", "000120", "000180", "v4", "git-a41c")
    next_batch = Batch("orders", "000181", "000240", "v4", "git-a41c")

    assert first_attempt.batch_id == retry.batch_id
    assert first_attempt.batch_id != next_batch.batch_id
    print(f"stable batch ID: {first_attempt.batch_id}")
    print(f"idempotent target: {first_attempt.output_prefix()}")
    print("advance bookmark only after publish commit: YES")
