"""Gate state operations by their declared Hazelcast failure contract."""

from dataclasses import dataclass
from enum import Enum


class StateModel(Enum):
    AP_MAP = "ap-map"
    CP_PRIMITIVE = "cp-primitive"


@dataclass(frozen=True)
class ClusterObservation:
    model: StateModel
    visible_members: int
    minimum_members: int
    has_cp_majority: bool


def may_mutate(observation: ClusterObservation) -> tuple[bool, str]:
    if observation.model is StateModel.CP_PRIMITIVE:
        return (
            observation.has_cp_majority,
            "CP majority is authoritative" if observation.has_cp_majority else "reject without CP majority",
        )

    protected = observation.visible_members >= observation.minimum_members
    return (
        protected,
        "AP minimum-size protection satisfied" if protected else "reject below protected cluster size",
    )


if __name__ == "__main__":
    majority = ClusterObservation(StateModel.CP_PRIMITIVE, 3, 3, True)
    minority = ClusterObservation(StateModel.CP_PRIMITIVE, 2, 3, False)
    protected_ap = ClusterObservation(StateModel.AP_MAP, 2, 3, False)

    assert may_mutate(majority)[0] is True
    assert may_mutate(minority)[0] is False
    assert may_mutate(protected_ap)[0] is False

    for name, observation in (("majority", majority), ("minority", minority), ("protected AP side", protected_ap)):
        allowed, reason = may_mutate(observation)
        print(f"{name}: {'ACCEPT' if allowed else 'REJECT'} - {reason}")
