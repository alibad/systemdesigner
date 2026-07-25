"""Validate an AutoGen checkpoint envelope before calling team.load_state()."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping


@dataclass(frozen=True)
class RestoreContext:
    tenant_id: str
    config_digest: str
    supported_schema_versions: frozenset[int]


def validate_checkpoint(
    envelope: Mapping[str, Any],
    context: RestoreContext,
) -> Mapping[str, Any]:
    """Return team state only when identity and compatibility checks pass."""
    if envelope.get("tenant_id") != context.tenant_id:
        raise ValueError("checkpoint tenant does not match the authenticated tenant")

    schema_version = envelope.get("schema_version")
    if schema_version not in context.supported_schema_versions:
        raise ValueError(f"unsupported checkpoint schema: {schema_version!r}")

    if envelope.get("config_digest") != context.config_digest:
        raise ValueError("checkpoint was created by a different team configuration")

    team_state = envelope.get("team_state")
    if not isinstance(team_state, Mapping):
        raise ValueError("checkpoint is missing a team_state mapping")

    return team_state


def _self_test() -> None:
    context = RestoreContext(
        tenant_id="tenant-a",
        config_digest="sha256:team-v3",
        supported_schema_versions=frozenset({2}),
    )
    envelope = {
        "schema_version": 2,
        "tenant_id": "tenant-a",
        "config_digest": "sha256:team-v3",
        "framework_version": "pinned-in-release-manifest",
        "team_state": {"agent_states": {"planner": {"type": "AgentState"}}},
    }

    assert validate_checkpoint(envelope, context) == envelope["team_state"]

    wrong_tenant = dict(envelope, tenant_id="tenant-b")
    try:
        validate_checkpoint(wrong_tenant, context)
    except ValueError as error:
        assert "tenant" in str(error)
    else:
        raise AssertionError("cross-tenant checkpoint should be rejected")


if __name__ == "__main__":
    _self_test()
    print("checkpoint envelope checks passed")
