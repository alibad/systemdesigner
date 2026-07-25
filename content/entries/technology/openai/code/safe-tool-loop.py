"""Validate, authorize, and deduplicate a simulated Responses API tool call."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any


REFUND_TOOL = {
    "type": "function",
    "name": "request_refund",
    "description": "Request a refund for the authenticated user's active order.",
    "strict": True,
    "parameters": {
        "type": "object",
        "properties": {
            "amount_cents": {"type": "integer", "minimum": 1, "maximum": 5000},
            "reason": {"type": "string", "enum": ["duplicate", "damaged", "late"]},
        },
        "required": ["amount_cents", "reason"],
        "additionalProperties": False,
    },
}


@dataclass(frozen=True)
class Session:
    user_id: str
    active_order_id: str
    refundable_cents: int


class RefundExecutor:
    def __init__(self) -> None:
        self.results_by_operation: dict[str, dict[str, Any]] = {}

    def execute(
        self,
        *,
        operation_id: str,
        session: Session,
        amount_cents: int,
        reason: str,
    ) -> dict[str, Any]:
        if operation_id in self.results_by_operation:
            return self.results_by_operation[operation_id]
        if amount_cents > session.refundable_cents:
            raise ValueError("refund exceeds the trusted refundable balance")

        result = {
            "status": "accepted",
            "order_id": session.active_order_id,
            "amount_cents": amount_cents,
            "reason": reason,
        }
        self.results_by_operation[operation_id] = result
        return result


def validate_arguments(raw_arguments: str) -> dict[str, Any]:
    arguments = json.loads(raw_arguments)
    if set(arguments) != {"amount_cents", "reason"}:
        raise ValueError("tool arguments do not match the strict contract")
    if not isinstance(arguments["amount_cents"], int):
        raise ValueError("amount_cents must be an integer")
    if not 1 <= arguments["amount_cents"] <= 5000:
        raise ValueError("amount_cents is outside the tool limit")
    if arguments["reason"] not in {"duplicate", "damaged", "late"}:
        raise ValueError("reason is not allowed")
    return arguments


def handle_tool_call(
    item: dict[str, Any],
    session: Session,
    executor: RefundExecutor,
) -> dict[str, Any]:
    if item.get("type") != "function_call" or item.get("name") != "request_refund":
        raise ValueError("tool is not allowed on this route")

    arguments = validate_arguments(item["arguments"])
    result = executor.execute(
        operation_id=item["call_id"],
        session=session,
        amount_cents=arguments["amount_cents"],
        reason=arguments["reason"],
    )
    return {
        "type": "function_call_output",
        "call_id": item["call_id"],
        "output": json.dumps(result, sort_keys=True),
    }


def main() -> int:
    session = Session(
        user_id="user-42",
        active_order_id="order-from-trusted-session",
        refundable_cents=2400,
    )
    simulated_item = {
        "type": "function_call",
        "name": "request_refund",
        "call_id": "call-stable-operation-id",
        "arguments": json.dumps({"amount_cents": 1800, "reason": "damaged"}),
    }
    executor = RefundExecutor()

    first = handle_tool_call(simulated_item, session, executor)
    replay = handle_tool_call(simulated_item, session, executor)

    assert first == replay
    assert len(executor.results_by_operation) == 1
    assert "user_id" not in json.loads(simulated_item["arguments"])
    print(json.dumps(first, indent=2, sort_keys=True))
    print("idempotent replay: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
