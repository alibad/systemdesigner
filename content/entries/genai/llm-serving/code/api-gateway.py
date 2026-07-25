"""Illustrative serving gateway: preserve one request identity and deadline."""

from dataclasses import dataclass
from time import monotonic
from uuid import uuid4

from fastapi import FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field

app = FastAPI()


class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=1)
    model_tier: str = "fast"
    max_output_tokens: int = Field(default=256, ge=1, le=2048)
    response_schema: dict | None = None


@dataclass(frozen=True)
class RequestContext:
    request_id: str
    tenant_id: str
    deadline_at: float
    model_tier: str
    max_output_tokens: int

    def remaining_ms(self) -> int:
        return max(0, int((self.deadline_at - monotonic()) * 1000))


def admit(body: GenerateRequest, tenant_id: str, deadline_ms: int) -> RequestContext:
    if len(body.prompt.split()) > 8_000:
        raise HTTPException(413, "Prompt exceeds this route's admission budget")
    if deadline_ms < 250:
        raise HTTPException(408, "No usable deadline remains before admission")

    return RequestContext(
        request_id=str(uuid4()),
        tenant_id=tenant_id,
        deadline_at=monotonic() + deadline_ms / 1000,
        model_tier=body.model_tier,
        max_output_tokens=body.max_output_tokens,
    )


@app.post("/v1/generate")
async def generate(
    body: GenerateRequest,
    request: Request,
    x_tenant_id: str = Header(),
    x_deadline_ms: int = Header(default=8_000),
):
    ctx = admit(body, x_tenant_id, x_deadline_ms)
    route = await choose_healthy_route(ctx)

    # The scheduler receives this same context to reserve KV cache and enforce fairness.
    stream = route.schedule(prompt=body.prompt, context=ctx)
    tokens: list[str] = []
    async for token in stream:
        if await request.is_disconnected() or ctx.remaining_ms() == 0:
            await route.cancel(ctx.request_id, reason="client_disconnect_or_deadline")
            break
        tokens.append(token)

    result = "".join(tokens)
    validate_schema(result, body.response_schema, ctx)
    emit_outcome(ctx, route.name, result)
    return {"request_id": ctx.request_id, "model_route": route.name, "output": result}
