from dataclasses import dataclass
from datetime import UTC, datetime


@dataclass(frozen=True)
class Identity:
    principal: str
    issuer: str
    expires_at: datetime


@dataclass(frozen=True)
class Request:
    destination: str
    method: str
    resource: str
    context: str


@dataclass(frozen=True)
class AllowRule:
    principal: str
    destination: str
    method: str
    resource: str
    context: str


@dataclass(frozen=True)
class Decision:
    allowed: bool
    reason: str


TRUSTED_ISSUER = "spiffe://mesh.example"

PAYMENT_RULE = AllowRule(
    principal="spiffe://mesh.example/ns/shop-prod/sa/checkout",
    destination="payments",
    method="POST",
    resource="/v1/charges",
    context="production",
)


def authorize(
    identity: Identity,
    request: Request,
    rules: tuple[AllowRule, ...],
    now: datetime,
) -> Decision:
    if identity.issuer != TRUSTED_ISSUER:
        return Decision(False, "untrusted_issuer")

    if identity.expires_at <= now:
        return Decision(False, "expired_identity")

    request_tuple = (
        identity.principal,
        request.destination,
        request.method,
        request.resource,
        request.context,
    )

    for rule in rules:
        rule_tuple = (
            rule.principal,
            rule.destination,
            rule.method,
            rule.resource,
            rule.context,
        )
        if request_tuple == rule_tuple:
            return Decision(True, "explicit_allow")

    return Decision(False, "default_deny")


decision = authorize(
    identity=Identity(
        principal="spiffe://mesh.example/ns/shop-prod/sa/checkout",
        issuer=TRUSTED_ISSUER,
        expires_at=datetime(2030, 1, 1, tzinfo=UTC),
    ),
    request=Request(
        destination="payments",
        method="POST",
        resource="/v1/charges",
        context="production",
    ),
    rules=(PAYMENT_RULE,),
    now=datetime(2029, 12, 31, tzinfo=UTC),
)

assert decision == Decision(True, "explicit_allow")
