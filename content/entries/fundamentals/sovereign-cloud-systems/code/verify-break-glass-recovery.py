from dataclasses import dataclass
from datetime import datetime, timezone
from typing import FrozenSet


@dataclass(frozen=True)
class RecoveryContract:
    workload_id: str
    maximum_restore_hours: int
    required_evidence: FrozenSet[str]
    requires_dual_approval: bool = True
    requires_clean_environment: bool = True


@dataclass(frozen=True)
class FailureScenario:
    unavailable_dependencies: FrozenSet[str]


@dataclass(frozen=True)
class RecoveryPlan:
    plan_id: str
    dependencies: FrozenSet[str]
    estimated_restore_hours: int
    local_emergency_credentials: bool
    dual_approval: bool
    clean_environment: bool
    offline_runbook: bool
    evidence_capabilities: FrozenSet[str]


@dataclass(frozen=True)
class RecoveryDecision:
    approved: bool
    blockers: tuple[str, ...]
    workload_id: str
    plan_id: str
    evaluated_at: str


def verify_recovery(
    contract: RecoveryContract,
    failure: FailureScenario,
    plan: RecoveryPlan,
) -> RecoveryDecision:
    blockers: list[str] = []
    failed_dependencies = plan.dependencies & failure.unavailable_dependencies

    if failed_dependencies:
        blockers.append(
            "Plan depends on unavailable services: "
            + ", ".join(sorted(failed_dependencies))
        )
    if not plan.local_emergency_credentials:
        blockers.append("No provider-independent emergency credential is available.")
    if contract.requires_dual_approval and not plan.dual_approval:
        blockers.append("The emergency action lacks a second approver.")
    if contract.requires_clean_environment and not plan.clean_environment:
        blockers.append("The restore target is not isolated from the incident.")
    if not plan.offline_runbook:
        blockers.append("The runbook is unreachable without the normal control plane.")
    if plan.estimated_restore_hours > contract.maximum_restore_hours:
        blockers.append(
            f"Estimated restore is {plan.estimated_restore_hours} hours; "
            f"the target is {contract.maximum_restore_hours}."
        )

    missing_evidence = contract.required_evidence - plan.evidence_capabilities
    if missing_evidence:
        blockers.append(
            "Recovery cannot produce required evidence: "
            + ", ".join(sorted(missing_evidence))
        )

    return RecoveryDecision(
        approved=not blockers,
        blockers=tuple(blockers),
        workload_id=contract.workload_id,
        plan_id=plan.plan_id,
        evaluated_at=datetime.now(timezone.utc).isoformat(),
    )


contract = RecoveryContract(
    workload_id="benefits-case-management",
    maximum_restore_hours=4,
    required_evidence=frozenset(
        {
            "approver-identities",
            "backup-manifest",
            "integrity-result",
            "credential-rotation",
        }
    ),
)
provider_isolation = FailureScenario(
    unavailable_dependencies=frozenset(
        {"provider-identity", "provider-control-plane", "provider-key-service"}
    )
)
independent_cell = RecoveryPlan(
    plan_id="independent-recovery-cell/v3",
    dependencies=frozenset({"local-identity", "local-hsm", "offline-backup-vault"}),
    estimated_restore_hours=3,
    local_emergency_credentials=True,
    dual_approval=True,
    clean_environment=True,
    offline_runbook=True,
    evidence_capabilities=frozenset(
        {
            "approver-identities",
            "backup-manifest",
            "integrity-result",
            "credential-rotation",
        }
    ),
)

print(verify_recovery(contract, provider_isolation, independent_cell))
