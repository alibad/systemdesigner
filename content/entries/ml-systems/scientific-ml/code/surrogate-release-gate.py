"""Gate a scientific surrogate on regime evidence, uncertainty, and fallback."""

from dataclasses import dataclass
from enum import Enum


class Posture(str, Enum):
    HOLD = "hold"
    BOUNDED_PILOT = "bounded-pilot"
    RELEASE = "release"


@dataclass(frozen=True)
class GateInput:
    independent_evidence_percent: int
    empirical_coverage_percent: int
    interval_width_percent: int
    fallback_tested: bool


@dataclass(frozen=True)
class GatePolicy:
    minimum_evidence_percent: int
    target_coverage_percent: int
    maximum_useful_width_percent: int
    fallback_required: bool


def recommend_posture(observed: GateInput, policy: GatePolicy) -> Posture:
    """Return the most permissive posture supported by every gate."""
    calibrated = observed.empirical_coverage_percent >= policy.target_coverage_percent
    useful = observed.interval_width_percent <= policy.maximum_useful_width_percent
    contained = observed.fallback_tested or not policy.fallback_required

    if (
        observed.independent_evidence_percent >= policy.minimum_evidence_percent
        and calibrated
        and useful
        and contained
    ):
        return Posture.RELEASE

    if (
        observed.independent_evidence_percent >= policy.minimum_evidence_percent - 15
        and observed.empirical_coverage_percent >= policy.target_coverage_percent - 5
        and contained
    ):
        return Posture.BOUNDED_PILOT

    return Posture.HOLD


if __name__ == "__main__":
    regime_change = GatePolicy(
        minimum_evidence_percent=80,
        target_coverage_percent=90,
        maximum_useful_width_percent=14,
        fallback_required=True,
    )
    candidate = GateInput(
        independent_evidence_percent=72,
        empirical_coverage_percent=88,
        interval_width_percent=13,
        fallback_tested=True,
    )
    print(recommend_posture(candidate, regime_change).value)
