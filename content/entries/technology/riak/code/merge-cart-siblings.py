from dataclasses import dataclass
from typing import Sequence


@dataclass(frozen=True)
class CartSibling:
    item_ids: frozenset[str]
    delivery: str


@dataclass(frozen=True)
class ResolvedCart:
    item_ids: tuple[str, ...]
    delivery: str
    causal_context: str


class DeliveryConflict(ValueError):
    """Raised when concurrent siblings disagree on a single-choice field."""


def merge_cart_siblings(
    siblings: Sequence[CartSibling],
    response_context: str,
) -> ResolvedCart:
    """Merge add-only item IDs, but refuse to invent a delivery choice."""
    if not siblings:
        raise ValueError("at least one sibling is required")
    if not response_context:
        raise ValueError("the Riak response context is required for write-back")

    deliveries = {sibling.delivery for sibling in siblings}
    if len(deliveries) != 1:
        raise DeliveryConflict(
            "delivery changed concurrently; ask the domain workflow to choose"
        )

    merged_items = sorted(
        item_id
        for sibling in siblings
        for item_id in sibling.item_ids
    )

    return ResolvedCart(
        item_ids=tuple(dict.fromkeys(merged_items)),
        delivery=deliveries.pop(),
        causal_context=response_context,
    )


# The client must store this resolved value with the causal context returned by
# the sibling read. Returning a merge without writing it back leaves siblings.
example = merge_cart_siblings(
    siblings=[
        CartSibling(frozenset({"camera", "battery"}), "standard"),
        CartSibling(frozenset({"camera", "tripod"}), "standard"),
    ],
    response_context="opaque-context-from-riak",
)
