from dataclasses import dataclass, replace
from enum import Enum
from typing import Protocol


class Phase(str, Enum):
    COPY = "copy"
    CATCH_UP = "catch-up"
    CUTOVER = "cutover"
    VERIFY = "verify"
    COMPLETE = "complete"


@dataclass(frozen=True)
class Move:
    shard_id: str
    source: str
    destination: str
    ownership_epoch: int
    phase: Phase = Phase.COPY
    snapshot_position: int | None = None


class Store(Protocol):
    def load_move(self, shard_id: str) -> Move: ...
    def save_move(self, move: Move) -> None: ...
    def copy_snapshot(self, move: Move) -> int: ...
    def replay_after(self, move: Move, position: int) -> int: ...
    def destination_lag(self, move: Move) -> int: ...
    def compare_copies(self, move: Move) -> bool: ...
    def publish_owner_idempotently(self, move: Move, expected_epoch: int) -> int: ...
    def schedule_source_cleanup_idempotently(self, move: Move) -> None: ...


def advance_move(store: Store, shard_id: str, max_cutover_lag: int = 100) -> Move:
    """Advance one idempotent step; a worker can safely resume after a crash."""
    move = store.load_move(shard_id)

    if move.phase is Phase.COPY:
        position = store.copy_snapshot(move)
        move = replace(move, phase=Phase.CATCH_UP, snapshot_position=position)

    elif move.phase is Phase.CATCH_UP:
        assert move.snapshot_position is not None
        store.replay_after(move, move.snapshot_position)
        if store.destination_lag(move) <= max_cutover_lag:
            move = replace(move, phase=Phase.CUTOVER)

    elif move.phase is Phase.CUTOVER:
        new_epoch = store.publish_owner_idempotently(
            move,
            expected_epoch=move.ownership_epoch,
        )
        move = replace(
            move,
            phase=Phase.VERIFY,
            ownership_epoch=new_epoch,
        )

    elif move.phase is Phase.VERIFY:
        if not store.compare_copies(move):
            raise RuntimeError("destination verification failed; keep source copy")
        store.schedule_source_cleanup_idempotently(move)
        move = replace(move, phase=Phase.COMPLETE)

    store.save_move(move)
    return move
