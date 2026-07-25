from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class Principal:
    subject: str
    tenant_id: str
    plan: str


@dataclass(frozen=True)
class GatewayRequest:
    task: str
    input_text: str
    required_capabilities: tuple[str, ...]
    data_class: str
    max_output_tokens: int
    deadline_ms: int


@dataclass(frozen=True)
class Route:
    route_id: str
    adapter_id: str
    secret_ref: str


@dataclass(frozen=True)
class ProviderResult:
    text: str
    native_model: str
    finish_reason: str
    input_tokens: int
    cached_input_tokens: int
    output_tokens: int
    provider_request_id: str


class ProviderAdapter(Protocol):
    """Preserves one provider API's native semantics."""

    async def generate(
        self,
        request: GatewayRequest,
        *,
        credential: str,
        request_id: str,
        deadline_ms: int,
    ) -> ProviderResult: ...


class Gateway:
    def __init__(
        self,
        authenticator,
        policy,
        router,
        budgets,
        credentials,
        adapters: dict[str, ProviderAdapter],
    ):
        self.authenticator = authenticator
        self.policy = policy
        self.router = router
        self.budgets = budgets
        self.credentials = credentials
        self.adapters = adapters

    async def handle(self, raw_request: dict, bearer_token: str) -> ProviderResult:
        principal: Principal = await self.authenticator.verify(bearer_token)

        # Tenant and plan come from trusted identity, never raw_request.
        request = GatewayRequest(
            task=str(raw_request["task"]),
            input_text=str(raw_request["input"]),
            required_capabilities=tuple(raw_request.get("capabilities", ("text",))),
            data_class=str(raw_request.get("dataClass", "standard")),
            max_output_tokens=min(int(raw_request.get("maxOutputTokens", 512)), 2048),
            deadline_ms=min(int(raw_request.get("deadlineMs", 5000)), 10_000),
        )

        self.policy.authorize(principal, request)
        reservation = await self.budgets.reserve(principal.tenant_id, request)
        routes: list[Route] = self.router.eligible(principal, request)
        route = self.router.rank(routes, request)[0]

        request_id = reservation.request_id
        credential = await self.credentials.resolve(route.secret_ref)
        adapter = self.adapters[route.adapter_id]

        try:
            result = await adapter.generate(
                request,
                credential=credential,
                request_id=request_id,
                deadline_ms=request.deadline_ms,
            )
        except Exception:
            await self.budgets.mark_attempt_unknown(reservation, route.route_id)
            raise

        await self.budgets.reconcile(
            reservation,
            route_id=route.route_id,
            input_tokens=result.input_tokens,
            cached_input_tokens=result.cached_input_tokens,
            output_tokens=result.output_tokens,
        )
        return result
