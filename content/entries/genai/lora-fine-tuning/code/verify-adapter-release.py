"""Reject an adapter release when its runtime contract does not match."""

from dataclasses import dataclass


@dataclass(frozen=True)
class AdapterManifest:
    base_revision: str
    tokenizer_digest: str
    template_digest: str
    adapter_format: str
    evaluation_passed: bool
    signed: bool
    rollback_target: str | None


@dataclass(frozen=True)
class RuntimeManifest:
    base_revision: str
    tokenizer_digest: str
    template_digest: str
    supported_adapter_formats: frozenset[str]


def verify_dynamic_release(
    adapter: AdapterManifest,
    runtime: RuntimeManifest,
) -> None:
    mismatches = []
    if adapter.base_revision != runtime.base_revision:
        mismatches.append("base revision")
    if adapter.tokenizer_digest != runtime.tokenizer_digest:
        mismatches.append("tokenizer")
    if adapter.template_digest != runtime.template_digest:
        mismatches.append("chat template")
    if adapter.adapter_format not in runtime.supported_adapter_formats:
        mismatches.append("adapter format")
    if not adapter.evaluation_passed:
        mismatches.append("held-out evaluation")
    if not adapter.signed:
        mismatches.append("artifact signature")
    if adapter.rollback_target is None:
        mismatches.append("rollback target")

    if mismatches:
        raise ValueError(f"release blocked: {', '.join(mismatches)}")
