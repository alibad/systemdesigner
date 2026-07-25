"""Create an agent whose read and write tools have different control boundaries."""

import os

from langchain.agents import create_agent
from langchain.agents.middleware import (
    HumanInTheLoopMiddleware,
    ToolCallLimitMiddleware,
)
from langgraph.checkpoint.memory import InMemorySaver


def read_order(order_id: str) -> str:
    """Return a minimal order summary for an authorized support case."""
    return f"Order {order_id}: delivered, refund eligible, amount USD 48.00"


def issue_refund(order_id: str, reason: str) -> str:
    """Issue one refund after application policy and human approval succeed."""
    return f"Refund requested for {order_id}: {reason}"


agent = create_agent(
    model=os.environ["MODEL_ID"],
    tools=[read_order, issue_refund],
    system_prompt=(
        "Help support operators investigate orders. Never invent an order ID, "
        "and explain the evidence before requesting a refund."
    ),
    checkpointer=InMemorySaver(),
    middleware=[
        ToolCallLimitMiddleware(run_limit=6, exit_behavior="error"),
        HumanInTheLoopMiddleware(
            interrupt_on={
                "read_order": False,
                "issue_refund": {
                    "allowed_decisions": ["approve", "edit", "reject"]
                },
            }
        ),
    ],
)

config = {"configurable": {"thread_id": "support-case-1842"}}
result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "Check order ORD-1842 and refund it if policy allows.",
            }
        ]
    },
    config,
)

print(result)
