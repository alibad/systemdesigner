"""Build only the link subtrees needed by this local extraction job."""

from bs4 import BeautifulSoup, SoupStrainer


HTML = """
<main>
  <article><a href="/guides/parsers">Parser guide</a></article>
  <article><a href="/guides/selectors">Selector guide</a></article>
  <aside><p>Several unrelated navigation nodes...</p></aside>
</main>
"""

only_links = SoupStrainer("a", href=True)
soup = BeautifulSoup(HTML, "html.parser", parse_only=only_links)

links = [
    {"label": link.get_text(" ", strip=True), "href": str(link["href"])}
    for link in soup.find_all("a", href=True)
]

assert soup.find("main") is None
assert links == [
    {"label": "Parser guide", "href": "/guides/parsers"},
    {"label": "Selector guide", "href": "/guides/selectors"},
]

for link in links:
    print(f"{link['label']}: {link['href']}")
