"""Executable model of Flink checkpoint restore and replay boundaries.

The model assumes a durable baseline at t=0 and periodic checkpoint triggers.
It computes a replay span, not wall-clock recovery duration.
"""

from dataclasses import dataclass
from enum import Enum


class SinkMode(str, Enum):
    TRANSACTIONAL = "transactional"
    IDEMPOTENT = "idempotent"
    UNSAFE = "unsafe"


@dataclass(frozen=True)
class Checkpoint:
    number: int
    starts_at: int
    completes_at: int


@dataclass(frozen=True)
class RecoveryPlan:
    restore_point: int
    replay_span_seconds: int
    incomplete_checkpoint: int | None
    duplicate_effect_risk: bool


def plan_recovery(
    *,
    checkpoint_interval_seconds: int,
    checkpoint_duration_seconds: int,
    failure_at_seconds: int,
    sink_mode: SinkMode,
) -> RecoveryPlan:
    checkpoints = [
        Checkpoint(
            number=number,
            starts_at=starts_at,
            completes_at=starts_at + checkpoint_duration_seconds,
        )
        for number, starts_at in enumerate(
            range(
                checkpoint_interval_seconds,
                failure_at_seconds + checkpoint_interval_seconds,
                checkpoint_interval_seconds,
            ),
            start=1,
        )
    ]
    completed = [
        checkpoint
        for checkpoint in checkpoints
        if checkpoint.completes_at <= failure_at_seconds
    ]
    active = next(
        (
            checkpoint
            for checkpoint in checkpoints
            if checkpoint.starts_at <= failure_at_seconds < checkpoint.completes_at
        ),
        None,
    )

    restore_point = completed[-1].starts_at if completed else 0
    return RecoveryPlan(
        restore_point=restore_point,
        replay_span_seconds=failure_at_seconds - restore_point,
        incomplete_checkpoint=active.number if active else None,
        duplicate_effect_risk=sink_mode is SinkMode.UNSAFE,
    )


if __name__ == "__main__":
    plan = plan_recovery(
        checkpoint_interval_seconds=40,
        checkpoint_duration_seconds=25,
        failure_at_seconds=92,
        sink_mode=SinkMode.UNSAFE,
    )

    assert plan.restore_point == 40
    assert plan.replay_span_seconds == 52
    assert plan.incomplete_checkpoint == 2
    assert plan.duplicate_effect_risk is True

    print(f"restore from barrier: t={plan.restore_point}s")
    print(f"replay source span:   {plan.replay_span_seconds}s")
    print(f"incomplete checkpoint: {plan.incomplete_checkpoint}")
    print(f"duplicate effect risk: {plan.duplicate_effect_risk}")
