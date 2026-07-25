#!/usr/bin/env python3
"""Model an atomic checkpoint and prove resumed updates match an uninterrupted run."""

from __future__ import annotations

from dataclasses import dataclass, replace


@dataclass(frozen=True)
class TrainingState:
    next_sample: int
    global_step: int
    weight: float
    momentum: float


class AtomicCheckpointStore:
    def __init__(self) -> None:
        self._committed: TrainingState | None = None
        self._staged: TrainingState | None = None

    def stage(self, state: TrainingState) -> None:
        self._staged = replace(state)

    def commit(self) -> None:
        if self._staged is None:
            raise RuntimeError("cannot commit without staged checkpoint state")
        self._committed = self._staged
        self._staged = None

    def load_latest(self) -> TrainingState:
        if self._committed is None:
            raise RuntimeError("no committed checkpoint is available")
        return replace(self._committed)


def apply_sample(state: TrainingState, sample: int) -> TrainingState:
    momentum = 0.9 * state.momentum + sample
    return TrainingState(
        next_sample=state.next_sample + 1,
        global_step=state.global_step + 1,
        weight=state.weight - 0.001 * momentum,
        momentum=momentum,
    )


def train(state: TrainingState, samples: list[int], stop_at: int | None = None) -> TrainingState:
    while state.next_sample < len(samples):
        if stop_at is not None and state.next_sample == stop_at:
            break
        state = apply_sample(state, samples[state.next_sample])
    return state


def main() -> None:
    samples = [17, 4, 9, 12, 3, 20, 1, 8, 15, 6, 11, 5]
    initial = TrainingState(next_sample=0, global_step=0, weight=1.0, momentum=0.0)

    uninterrupted = train(initial, samples)

    store = AtomicCheckpointStore()
    before_failure = train(initial, samples, stop_at=5)
    store.stage(before_failure)
    store.commit()

    # Later work is lost with the failed rank group. An incomplete staged checkpoint
    # must not replace the last committed recovery point.
    uncommitted = train(before_failure, samples, stop_at=8)
    store.stage(uncommitted)

    resumed = train(store.load_latest(), samples)
    assert resumed == uninterrupted
    assert resumed.global_step == len(samples)
    assert resumed.next_sample == len(samples)

    print(f"committed resume step: {before_failure.global_step}")
    print(f"final step: {resumed.global_step}")
    print(f"final weight: {resumed.weight:.9f}")
    print("resumed state matches uninterrupted training")


if __name__ == "__main__":
    main()
