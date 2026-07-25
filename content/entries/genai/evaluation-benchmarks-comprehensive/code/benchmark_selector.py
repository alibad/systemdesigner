"""Select evidence by release claim, not by a generic leaderboard ranking."""

from dataclasses import dataclass


@dataclass(frozen=True)
class EvidenceNeed:
    claim: str
    required_evidence: tuple[str, ...]
    critical: bool = False


PORTFOLIOS = {
    "grounded_assistant": (
        EvidenceNeed("answers are supported by retrieved sources", ("citation-set", "product-cases", "human-calibration"), True),
        EvidenceNeed("tool calls complete safely", ("executable-workflow-tests", "adversarial-tool-tests"), True),
        EvidenceNeed("responses are useful", ("pairwise-preference", "product-cases")),
    ),
    "code_assistant": (
        EvidenceNeed("generated changes preserve behavior", ("repository-tests", "sandboxed-execution"), True),
        EvidenceNeed("changes follow secure defaults", ("security-regression-set", "human-review"), True),
        EvidenceNeed("code is understandable", ("maintainability-rubric", "human-calibration")),
    ),
}


def build_portfolio(product: str, available: set[str]) -> list[EvidenceNeed]:
    """Reject a portfolio when a release-critical claim has no independent evidence."""
    needs = PORTFOLIOS[product]
    missing = [
        f"{need.claim}: {', '.join(item for item in need.required_evidence if item not in available)}"
        for need in needs
        if not set(need.required_evidence).issubset(available)
    ]
    if missing:
        raise ValueError("Missing evidence for release claims: " + "; ".join(missing))
    return list(needs)


if __name__ == "__main__":
    available = {"citation-set", "product-cases", "human-calibration", "executable-workflow-tests", "adversarial-tool-tests", "pairwise-preference"}
    for need in build_portfolio("grounded_assistant", available):
        print(f"{'CRITICAL' if need.critical else 'SUPPORTING'}: {need.claim}")
