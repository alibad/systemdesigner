from lxml import etree


NAMESPACES = {"o": "urn:orders"}
DOCUMENT = b"""\
<orders xmlns="urn:orders">
  <order id="A-100" region="eu"><amount>19.50</amount></order>
  <order id="A-101" region="us"><amount>42.00</amount></order>
  <order id="A-102" region="eu"><amount>80.25</amount></order>
</orders>
"""

parser = etree.XMLParser(
    no_network=True,
    resolve_entities=False,
    load_dtd=False,
    huge_tree=False,
)
root = etree.fromstring(DOCUMENT, parser)

matching_order_ids = etree.XPath(
    "//o:order[@region = $region and number(o:amount) >= $minimum]/@id",
    namespaces=NAMESPACES,
)

eu_ids = matching_order_ids(root, region="eu", minimum=20)
us_ids = matching_order_ids(root, region="us", minimum=40)

assert eu_ids == ["A-102"]
assert us_ids == ["A-101"]

print(f"eu={eu_ids} us={us_ids}")
