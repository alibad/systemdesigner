from dataclasses import dataclass


@dataclass(frozen=True)
class ReleaseContract:
    minimum_evidence: int
    minimum_validator_level: int
    confidence_floor: int
    human_approval_required: bool


def decide_release(
    contract: ReleaseContract,
    *,
    evidence_score: int,
    validator_level: int,
    model_confidence: int,
    human_approved: bool,
) -> tuple[str, list[str]]:
    findings: list[str] = []
    if evidence_score < contract.minimum_evidence:
        findings.append("supporting evidence is below the task threshold")
    if validator_level < contract.minimum_validator_level:
        findings.append("the downstream validator is too weak")
    if model_confidence < contract.confidence_floor:
        findings.append("model confidence is below the review threshold")
    if contract.human_approval_required and not human_approved:
        findings.append("a human authority must approve the action")

    if any("evidence" in finding or "validator" in finding for finding in findings):
        return "block", findings
    if findings:
        return "review", findings
    return "release", []


if __name__ == "__main__":
    refund_policy = ReleaseContract(70, 2, 75, False)
    decision, reasons = decide_release(
        refund_policy,
        evidence_score=95,
        validator_level=2,
        model_confidence=91,
        human_approved=False,
    )
    print(decision, reasons)
    assert decision == "release"

    payment = ReleaseContract(90, 2, 75, True)
    decision, reasons = decide_release(
        payment,
        evidence_score=95,
        validator_level=2,
        model_confidence=96,
        human_approved=False,
    )
    print(decision, reasons)
    assert decision == "review"
