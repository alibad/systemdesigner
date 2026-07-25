from dataclasses import dataclass


@dataclass(frozen=True)
class Update:
    source: str
    sequence: int
    value: str


def apply_latest(state: dict[str, Update], update: Update) -> bool:
    previous = state.get(update.source)
    if previous and update.sequence <= previous.sequence:
        return False
    state[update.source] = update
    return True


if __name__ == "__main__":
    state: dict[str, Update] = {}
    assert apply_latest(state, Update("player-7", 11, "x=4"))
    assert not apply_latest(state, Update("player-7", 10, "x=3"))
    assert not apply_latest(state, Update("player-7", 11, "x=4"))
    assert apply_latest(state, Update("player-7", 12, "x=5"))
    print(state["player-7"])
