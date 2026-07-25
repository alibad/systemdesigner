"""Claim-level gate that answers only when the evidence packet is sufficient."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Evidence:
    source_id: str
    supports: frozenset[str]
    conflicts: frozenset[str] = frozenset()
    injection_risk: bool = False


def decide(required_claims: set[str], packet: list[Evidence]) -> dict[str, object]:
    safe_packet = [item for item in packet if not item.injection_risk]
    supported = set().union(*(item.supports for item in safe_packet)) if safe_packet else set()
    conflicts = set().union(*(item.conflicts for item in safe_packet)) if safe_packet else set()
    missing = required_claims - supported

    if conflicts:
        decision = "escalate"
    elif missing:
        decision = "abstain"
    else:
        decision = "answer"

    return {
        "decision": decision,
        "missing_claims": sorted(missing),
        "conflicts": sorted(conflicts),
        "citations": [item.source_id for item in safe_packet if item.supports],
    }


if __name__ == "__main__":
    required = {"refund_window", "receipt_required"}
    evidence = [
        Evidence("policy-v7:12-18", frozenset({"refund_window"})),
        Evidence("policy-v7:19-22", frozenset({"receipt_required"})),
        Evidence("upload-44", frozenset(required), injection_risk=True),
    ]
    result = decide(required, evidence)
    assert result["decision"] == "answer"
    assert "upload-44" not in result["citations"]
    print(result)
