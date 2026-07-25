"""An auditable response gate for distribution-shift incidents."""

from dataclasses import dataclass
from enum import Enum


class Action(str, Enum):
    OBSERVE = "observe and collect labels"
    REPAIR = "repair the data source"
    CONTAIN = "contain or roll back"
    RECALIBRATE = "recalibrate the decision policy"
    RETRAIN = "train and canary a candidate"


@dataclass(frozen=True)
class Evidence:
    pipeline_healthy: bool
    conditional_relation: str  # "stable", "changed", or "unknown"
    prevalence_shift: bool
    confirmed_harm: int  # 0-100 operational severity score
    labeled_evidence: int  # 0-100 coverage and confidence score


def choose_response(evidence: Evidence) -> Action:
    """Choose the smallest reversible action supported by current evidence."""
    if not evidence.pipeline_healthy:
        return Action.REPAIR
    if evidence.confirmed_harm >= 80 and evidence.labeled_evidence < 60:
        return Action.CONTAIN
    if evidence.conditional_relation == "changed" and evidence.labeled_evidence >= 65:
        return Action.RETRAIN
    if (
        evidence.prevalence_shift
        and evidence.conditional_relation == "stable"
        and evidence.labeled_evidence >= 40
    ):
        return Action.RECALIBRATE
    return Action.OBSERVE


INCIDENTS = {
    "unit regression": Evidence(False, "unknown", False, 92, 15),
    "seasonal prevalence": Evidence(True, "stable", True, 55, 72),
    "changed approval policy": Evidence(True, "changed", False, 74, 83),
    "unlabeled safety spike": Evidence(True, "unknown", False, 91, 28),
}

for name, incident in INCIDENTS.items():
    print(f"{name}: {choose_response(incident).value}")

assert choose_response(INCIDENTS["unit regression"]) is Action.REPAIR
assert choose_response(INCIDENTS["seasonal prevalence"]) is Action.RECALIBRATE
assert choose_response(INCIDENTS["changed approval policy"]) is Action.RETRAIN
assert choose_response(INCIDENTS["unlabeled safety spike"]) is Action.CONTAIN
