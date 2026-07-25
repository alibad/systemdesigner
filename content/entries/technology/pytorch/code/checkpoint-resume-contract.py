"""Validate the state required to resume a PyTorch training run coherently."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


REQUIRED_KEYS = {
    "model",
    "optimizer",
    "scheduler",
    "scaler",
    "global_step",
    "epoch",
    "sampler_epoch",
    "rng_state",
}


@dataclass(frozen=True)
class ResumeDecision:
    valid: bool
    missing: tuple[str, ...]
    message: str


def validate_checkpoint(payload: dict[str, Any]) -> ResumeDecision:
    missing = tuple(sorted(REQUIRED_KEYS - payload.keys()))
    if missing:
        return ResumeDecision(False, missing, "checkpoint is partial; do not publish it")
    if payload["global_step"] < 0 or payload["epoch"] < 0:
        return ResumeDecision(False, (), "progress counters must be non-negative")
    if payload["sampler_epoch"] != payload["epoch"]:
        return ResumeDecision(False, (), "sampler and training epoch disagree")
    return ResumeDecision(True, (), "checkpoint can enter restore testing")


def build_checkpoint(model, optimizer, scheduler, scaler, progress, rng_state):
    """Collect state before rank zero writes an atomic temporary file and manifest."""
    return {
        "model": model.state_dict(),
        "optimizer": optimizer.state_dict(),
        "scheduler": scheduler.state_dict(),
        "scaler": scaler.state_dict(),
        "global_step": progress["global_step"],
        "epoch": progress["epoch"],
        "sampler_epoch": progress["sampler_epoch"],
        "rng_state": rng_state,
    }


if __name__ == "__main__":
    complete = {key: {} for key in REQUIRED_KEYS}
    complete.update(global_step=2400, epoch=3, sampler_epoch=3)
    good = validate_checkpoint(complete)
    assert good.valid

    partial = dict(complete)
    partial.pop("optimizer")
    bad = validate_checkpoint(partial)
    assert not bad.valid and bad.missing == ("optimizer",)
    print(f"complete: {good.message}; partial: missing {', '.join(bad.missing)}")
