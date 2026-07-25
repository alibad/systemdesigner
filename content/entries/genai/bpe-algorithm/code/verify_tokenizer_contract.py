"""Fail a release when a tokenizer bundle changes approved token IDs."""

from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from typing import Protocol


class Tokenizer(Protocol):
    def encode(self, text: str) -> list[int]:
        """Return the exact model-facing token IDs."""

    def decode(self, token_ids: list[int]) -> str:
        """Decode IDs with the same immutable tokenizer bundle."""


@dataclass(frozen=True)
class GoldenFixture:
    name: str
    text: str
    expected_ids: tuple[int, ...]


@dataclass(frozen=True)
class ContractResult:
    passed: bool
    fingerprint: str
    failures: tuple[str, ...]


def bundle_fingerprint(vocabulary: bytes, merges: bytes, normalizer: bytes) -> str:
    digest = sha256()
    for artifact in (vocabulary, merges, normalizer):
        digest.update(len(artifact).to_bytes(8, "big"))
        digest.update(artifact)
    return digest.hexdigest()


def verify_contract(
    tokenizer: Tokenizer,
    fixtures: list[GoldenFixture],
    fingerprint: str,
) -> ContractResult:
    failures: list[str] = []

    for fixture in fixtures:
        actual_ids = tuple(tokenizer.encode(fixture.text))
        if actual_ids != fixture.expected_ids:
            failures.append(
                f"{fixture.name}: expected {fixture.expected_ids}, got {actual_ids}"
            )
            continue

        decoded = tokenizer.decode(list(actual_ids))
        if decoded != fixture.text:
            failures.append(
                f"{fixture.name}: round trip changed {fixture.text!r} to {decoded!r}"
            )

    return ContractResult(
        passed=not failures,
        fingerprint=fingerprint,
        failures=tuple(failures),
    )


def require_compatible(result: ContractResult) -> None:
    if result.passed:
        return
    details = "\n".join(f"- {failure}" for failure in result.failures)
    raise RuntimeError(
        "Tokenizer bundle is incompatible with the approved model contract:\n"
        f"{details}"
    )
