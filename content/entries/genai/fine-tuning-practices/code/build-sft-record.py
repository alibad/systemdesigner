"""Build one auditable chat-SFT record without embedding pipeline secrets."""

from dataclasses import dataclass
from hashlib import sha256
from typing import Literal


Split = Literal["train", "validation", "test"]


@dataclass(frozen=True)
class Source:
    source_id: str
    split_group: str
    license_id: str
    consent_basis: str


def build_record(
    instruction: str,
    answer: str,
    source: Source,
    split: Split,
) -> dict:
    if not instruction.strip() or not answer.strip():
        raise ValueError("instruction and answer are required")
    if split == "train" and not source.license_id:
        raise ValueError("training data needs a recorded license")

    normalized = f"{instruction.strip()}\n{answer.strip()}"
    return {
        "messages": [
            {"role": "user", "content": instruction.strip()},
            {"role": "assistant", "content": answer.strip()},
        ],
        "metadata": {
            "record_hash": sha256(normalized.encode()).hexdigest(),
            "source_id": source.source_id,
            "split_group": source.split_group,
            "split": split,
            "license_id": source.license_id,
            "consent_basis": source.consent_basis,
            "format_version": "support-routing-chat-v2",
        },
    }
