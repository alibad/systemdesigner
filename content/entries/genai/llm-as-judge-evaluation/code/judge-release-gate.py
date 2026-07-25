"""Apply predeclared gates to observed judge-evaluation evidence."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Count:
    numerator: int
    denominator: int

    @property
    def percent(self) -> float:
        if self.denominator <= 0:
            raise ValueError("A gate denominator must be positive")
        if not 0 <= self.numerator <= self.denominator:
            raise ValueError("A numerator must be between zero and its denominator")
        return 100 * self.numerator / self.denominator


@dataclass(frozen=True)
class JudgeEvidence:
    panel_matches: Count
    order_flips: Count
    verbosity_upsets: Count
    repeat_disagreements: Count
    worst_slice_matches: Count
    human_audit_coverage_pct: float


@dataclass(frozen=True)
class ReleasePolicy:
    minimum_panel_agreement_pct: float
    maximum_order_flip_pct: float
    maximum_verbosity_upset_pct: float
    maximum_repeat_disagreement_pct: float
    minimum_worst_slice_agreement_pct: float
    minimum_human_audit_coverage_pct: float


def evaluate_release(
    evidence: JudgeEvidence,
    policy: ReleasePolicy,
) -> dict[str, object]:
    checks = {
        "panel_agreement": (
            evidence.panel_matches.percent >= policy.minimum_panel_agreement_pct
        ),
        "position_bias": (
            evidence.order_flips.percent <= policy.maximum_order_flip_pct
        ),
        "verbosity_bias": (
            evidence.verbosity_upsets.percent
            <= policy.maximum_verbosity_upset_pct
        ),
        "repeat_stability": (
            evidence.repeat_disagreements.percent
            <= policy.maximum_repeat_disagreement_pct
        ),
        "critical_slice": (
            evidence.worst_slice_matches.percent
            >= policy.minimum_worst_slice_agreement_pct
        ),
        "human_audit": (
            evidence.human_audit_coverage_pct
            >= policy.minimum_human_audit_coverage_pct
        ),
    }
    failed = [name for name, passed in checks.items() if not passed]
    return {
        "decision": "proceed" if not failed else "hold",
        "checks": checks,
        "failed_checks": failed,
        "note": "Panel labels are reference evidence, not ground truth.",
    }
