from io import BytesIO

from lxml import etree


SCHEMA_BYTES = b"""\
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
           targetNamespace="urn:inventory"
           xmlns="urn:inventory"
           elementFormDefault="qualified">
  <xs:element name="inventory">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="item" maxOccurs="unbounded">
          <xs:complexType>
            <xs:attribute name="sku" type="xs:string" use="required" />
            <xs:attribute name="quantity" type="xs:nonNegativeInteger" use="required" />
          </xs:complexType>
        </xs:element>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>
"""

VALID_FEED = b"""\
<inventory xmlns="urn:inventory">
  <item sku="SKU-100" quantity="8" />
</inventory>
"""

INVALID_FEED = b"""\
<inventory xmlns="urn:inventory">
  <item sku="SKU-100" quantity="unknown" />
</inventory>
"""

schema_tree = etree.parse(BytesIO(SCHEMA_BYTES))
schema = etree.XMLSchema(schema_tree)
parser = etree.XMLParser(
    schema=schema,
    no_network=True,
    resolve_entities=False,
    load_dtd=False,
    recover=False,
)

valid_tree = etree.parse(BytesIO(VALID_FEED), parser)
assert valid_tree.getroot().tag == "{urn:inventory}inventory"

try:
    etree.parse(BytesIO(INVALID_FEED), parser)
except etree.XMLSyntaxError as error:
    assert "nonNegativeInteger" in str(error)
    print("invalid feed rejected")
else:
    raise AssertionError("schema-invalid feed was accepted")
