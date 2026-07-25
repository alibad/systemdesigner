from dataclasses import dataclass


@dataclass(frozen=True)
class Candidate:
    item_id: str
    source: str
    retrieval_score: float
    rank_score: float
    category: str
    eligible: bool = True


def build_slate(candidates: list[Candidate], size: int = 4) -> list[Candidate]:
    eligible = [candidate for candidate in candidates if candidate.eligible]
    ranked = sorted(eligible, key=lambda candidate: candidate.rank_score, reverse=True)

    slate: list[Candidate] = []
    category_counts: dict[str, int] = {}
    for candidate in ranked:
        if category_counts.get(candidate.category, 0) >= 2:
            continue
        slate.append(candidate)
        category_counts[candidate.category] = category_counts.get(candidate.category, 0) + 1
        if len(slate) == size:
            break
    return slate


if __name__ == "__main__":
    pool = [
        Candidate("v-101", "embedding", 0.88, 0.91, "science"),
        Candidate("v-102", "popular", 0.72, 0.89, "science"),
        Candidate("v-103", "fresh", 0.66, 0.85, "science"),
        Candidate("v-104", "subscriptions", 0.81, 0.87, "music"),
        Candidate("v-105", "explore", 0.55, 0.80, "history"),
        Candidate("v-106", "embedding", 0.90, 0.95, "news", eligible=False),
    ]
    slate = build_slate(pool)
    assert [item.item_id for item in slate] == ["v-101", "v-102", "v-104", "v-105"]
    print([(item.item_id, item.source, item.rank_score) for item in slate])
