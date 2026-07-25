"""A current AgentChat team with application-scoped tools.

Install autogen-agentchat and an appropriate model extension before running.
The authenticated tenant is captured by the tool closure, so the model cannot
claim a different tenant through model-visible arguments.
"""

import asyncio
import os
from dataclasses import dataclass

from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.conditions import MaxMessageTermination, TextMentionTermination
from autogen_agentchat.teams import RoundRobinGroupChat
from autogen_agentchat.ui import Console
from autogen_ext.models.openai import OpenAIChatCompletionClient


@dataclass(frozen=True)
class AuthContext:
    tenant_id: str
    user_id: str
    can_read_support_tickets: bool


def build_ticket_reader(auth: AuthContext):
    async def read_ticket(ticket_id: str) -> str:
        """Read one support ticket visible to the authenticated tenant."""
        if not auth.can_read_support_tickets:
            return "DENIED: caller lacks support-ticket read permission"

        # Replace this fixture with a tenant-filtered repository query.
        tickets = {
            ("tenant-a", "T-1042"): "Checkout returns a timeout after submit.",
        }
        return tickets.get((auth.tenant_id, ticket_id), "NOT_FOUND")

    return read_ticket


async def main() -> None:
    auth = AuthContext(
        tenant_id=os.environ.get("TENANT_ID", "tenant-a"),
        user_id=os.environ.get("USER_ID", "learner"),
        can_read_support_tickets=True,
    )
    model_client = OpenAIChatCompletionClient(
        model=os.environ.get("AUTOGEN_MODEL", "gpt-4.1-mini"),
    )

    analyst = AssistantAgent(
        "analyst",
        model_client=model_client,
        tools=[build_ticket_reader(auth)],
        system_message=(
            "Inspect only the requested ticket. Summarize evidence and propose a "
            "diagnosis. Never invent ticket data."
        ),
    )
    reviewer = AssistantAgent(
        "reviewer",
        model_client=model_client,
        system_message=(
            "Review the diagnosis for evidence and scope. End with APPROVE only "
            "when every claim is supported by the shared thread."
        ),
    )

    termination = TextMentionTermination("APPROVE") | MaxMessageTermination(8)
    team = RoundRobinGroupChat(
        [analyst, reviewer],
        termination_condition=termination,
    )

    try:
        await Console(team.run_stream(task="Diagnose support ticket T-1042."))
    finally:
        await model_client.close()


if __name__ == "__main__":
    asyncio.run(main())
