"""Small, dependency-free model of operation-scoped web authorization."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Principal:
    user_id: str
    tenant_id: str
    permissions: frozenset[str]


@dataclass(frozen=True)
class Invoice:
    invoice_id: str
    tenant_id: str


def authorize_invoice_read(principal: Principal, invoice: Invoice) -> bool:
    """Authentication alone is never sufficient authority for an object."""
    if "invoice:read" not in principal.permissions:
        return False
    return principal.tenant_id == invoice.tenant_id


def build_region_query(region: str) -> tuple[str, tuple[str]]:
    """Keep the SQL program fixed and carry untrusted input as a value."""
    sql = "SELECT invoice_id, total FROM invoices WHERE region = %s"
    return sql, (region,)


alice = Principal("user_17", "tenant_blue", frozenset({"invoice:read"}))
own_invoice = Invoice("inv_100", "tenant_blue")
foreign_invoice = Invoice("inv_900", "tenant_red")

assert authorize_invoice_read(alice, own_invoice)
assert not authorize_invoice_read(alice, foreign_invoice)

query, parameters = build_region_query("' OR 1=1 --")
assert query.count("%s") == 1
assert parameters == ("' OR 1=1 --",)

print("own invoice: allowed")
print("foreign invoice: denied")
print("query shape:", query)
print("bound value:", parameters[0])
