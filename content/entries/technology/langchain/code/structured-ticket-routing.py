"""Extract a typed routing decision with a standalone LangChain model call."""

import os
from typing import Literal

from langchain.chat_models import init_chat_model
from pydantic import BaseModel, Field


class TicketRoute(BaseModel):
    """A contract that downstream application code can validate and route."""

    queue: Literal["billing", "technical", "security"]
    urgency: Literal["low", "normal", "high"]
    summary: str = Field(min_length=1, max_length=160)
    needs_human: bool


model = init_chat_model(os.environ["MODEL_ID"], temperature=0)
router = model.with_structured_output(TicketRoute)

decision = router.invoke(
    "A customer says an unfamiliar device changed the payout account. "
    "Route the ticket and summarize the concern."
)

print(decision.model_dump_json(indent=2))
