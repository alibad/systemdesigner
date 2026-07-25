from io import BytesIO

from lxml import etree


ORDER_NAMESPACE = "urn:orders"
ORDER_TAG = f"{{{ORDER_NAMESPACE}}}order"
AMOUNT_TAG = f"{{{ORDER_NAMESPACE}}}amount"

DOCUMENT = b"""\
<orders xmlns="urn:orders">
  <order id="A-100"><amount currency="USD">19.50</amount></order>
  <order id="A-101"><amount currency="USD">42.00</amount></order>
  <order id="A-102"><amount currency="USD">8.25</amount></order>
</orders>
"""


def stream_orders(source):
    context = etree.iterparse(
        source,
        events=("end",),
        tag=ORDER_TAG,
        no_network=True,
        resolve_entities=False,
        load_dtd=False,
        huge_tree=False,
    )

    for _, element in context:
        amount = element.find(AMOUNT_TAG)
        if amount is None or amount.text is None:
            raise ValueError(f"order {element.get('id')} has no amount")

        yield {
            "id": element.get("id"),
            "amount": float(amount.text),
            "currency": amount.get("currency"),
        }

        element.clear()
        parent = element.getparent()
        while parent is not None and element.getprevious() is not None:
            del parent[0]


orders = list(stream_orders(BytesIO(DOCUMENT)))

assert [order["id"] for order in orders] == ["A-100", "A-101", "A-102"]
assert sum(order["amount"] for order in orders) == 69.75
assert {order["currency"] for order in orders} == {"USD"}

print(f"processed={len(orders)} total={sum(order['amount'] for order in orders):.2f}")
