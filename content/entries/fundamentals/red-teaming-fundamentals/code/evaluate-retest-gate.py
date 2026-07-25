from dataclasses import dataclass
from enum import Enum


class RetestResult(Enum):
    NOT_RUN = "not_run"
    FAILED = "failed"
    PASSED = "passed"


@dataclass(frozen=True)
class FindingEvidence:
    execution_record: bool
    control_record: bool
    response_record: bool
    remediation_deployed: bool
    deployment_artifact: bool
    retest_result: RetestResult
    same_hypothesis: bool


def closure_decision(evidence: FindingEvidence) -> tuple[str, str]:
    if not evidence.execution_record or not evidence.control_record:
        return "insufficient_evidence", "Preserve execution and control records."

    if not evidence.response_record:
        return "report_gap", "Document the owner and defensive response."

    if not evidence.remediation_deployed or not evidence.deployment_artifact:
        return "remediate", "Deploy an owned change and retain its artifact."

    if evidence.retest_result is RetestResult.NOT_RUN:
        return "retest_required", "Replay the bounded hypothesis."

    if evidence.retest_result is RetestResult.FAILED:
        return "reopen", "The changed control did not produce the expected outcome."

    if not evidence.same_hypothesis:
        return "retest_required", "The passing test did not reproduce the original claim."

    return "close_validated", "Link the passed retest to the finding and control version."
