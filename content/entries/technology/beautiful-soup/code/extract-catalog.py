"""Extract validated product records from local HTML with Beautiful Soup."""

from __future__ import annotations

import json

from bs4 import BeautifulSoup, Tag


HTML = """
<main data-page="catalog">
  <article class="product" data-sku="p-101">
    <h2>Desk Lamp</h2>
    <span class="price">$39</span>
  </article>
  <article class="product" data-sku="p-102" data-featured>
    <h2>Task Chair</h2>
    <span class="price">$189</span>
    <span class="rating">4.8</span>
  </article>
</main>
"""


def required_text(card: Tag, selector: str) -> str:
    """Return normalized text or fail when a required field disappears."""
    element = card.select_one(selector)
    if element is None:
        sku = card.get("data-sku", "unknown")
        raise ValueError(f"{sku} is missing required field {selector}")
    return element.get_text(" ", strip=True)


def extract_catalog(markup: str) -> list[dict[str, str | None]]:
    soup = BeautifulSoup(markup, "html.parser")
    products: list[dict[str, str | None]] = []

    for card in soup.select("article.product[data-sku]"):
        rating = card.select_one(".rating")
        products.append(
            {
                "sku": str(card["data-sku"]),
                "name": required_text(card, "h2"),
                "price": required_text(card, ".price"),
                "rating": rating.get_text(strip=True) if rating else None,
            }
        )

    return products


if __name__ == "__main__":
    result = extract_catalog(HTML)
    assert result[0]["rating"] is None
    assert result[1]["name"] == "Task Chair"
    print(json.dumps(result, indent=2))
