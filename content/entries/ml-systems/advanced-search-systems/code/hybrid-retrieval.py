"""Minimal hybrid retrieval with reciprocal rank fusion.

Run with: python3 hybrid-retrieval.py
"""

from collections import Counter
from math import log, sqrt
import re


DOCUMENTS = [
    {"id": "p1", "text": "red trail running shoe", "vector": (0.98, 0.08, 0.05)},
    {"id": "p2", "text": "waterproof hiking boot", "vector": (0.78, 0.18, 0.08)},
    {"id": "p3", "text": "crimson marathon trainer", "vector": (0.95, 0.05, 0.10)},
    {"id": "p4", "text": "red cotton shirt", "vector": (0.10, 0.96, 0.04)},
]


def tokens(text):
    return re.findall(r"[a-z0-9]+", text.lower())


def lexical_ranking(query, documents):
    query_terms = tokens(query)
    document_terms = [Counter(tokens(document["text"])) for document in documents]
    document_frequency = {
        term: sum(term in terms for terms in document_terms) for term in set(query_terms)
    }

    scored = []
    for document, term_counts in zip(documents, document_terms):
        score = sum(
            (1 + log(term_counts[term]))
            * log((len(documents) + 1) / (document_frequency[term] + 0.5))
            for term in query_terms
            if term_counts[term]
        )
        if score:
            scored.append((document["id"], score))
    return sorted(scored, key=lambda item: (-item[1], item[0]))


def cosine(left, right):
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = sqrt(sum(value * value for value in left))
    right_norm = sqrt(sum(value * value for value in right))
    return dot / (left_norm * right_norm)


def semantic_ranking(query_vector, documents):
    scored = [
        (document["id"], cosine(query_vector, document["vector"]))
        for document in documents
    ]
    return sorted(scored, key=lambda item: (-item[1], item[0]))


def reciprocal_rank_fusion(rankings, rank_constant=60):
    fused = Counter()
    evidence = {}
    for source, ranking in rankings.items():
        for rank, (document_id, _score) in enumerate(ranking, start=1):
            fused[document_id] += 1 / (rank_constant + rank)
            evidence.setdefault(document_id, {})[source] = rank

    return [
        {"id": document_id, "rrf": score, "source_ranks": evidence[document_id]}
        for document_id, score in sorted(fused.items(), key=lambda item: (-item[1], item[0]))
    ]


def main():
    lexical = lexical_ranking("red running shoes", DOCUMENTS)
    semantic = semantic_ranking((1.0, 0.0, 0.0), DOCUMENTS)
    fused = reciprocal_rank_fusion({"lexical": lexical[:3], "semantic": semantic[:3]})

    assert fused[0]["id"] == "p1"
    assert any(result["id"] == "p3" for result in fused[:3])
    for position, result in enumerate(fused[:3], start=1):
        print(position, result)


if __name__ == "__main__":
    main()
