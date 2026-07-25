"""Minimal, deterministic BPE trainer for studying merge mechanics."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass

END_OF_WORD = "</w>"


@dataclass(frozen=True)
class CorpusItem:
    text: str
    count: int


def initial_symbols(text: str) -> tuple[str, ...]:
    return (*text, END_OF_WORD)


def pair_counts(
    vocabulary: dict[tuple[str, ...], int],
) -> Counter[tuple[str, str]]:
    counts: Counter[tuple[str, str]] = Counter()
    for symbols, frequency in vocabulary.items():
        for pair in zip(symbols, symbols[1:]):
            counts[pair] += frequency
    return counts


def merge_pair(
    symbols: tuple[str, ...],
    pair: tuple[str, str],
) -> tuple[str, ...]:
    merged: list[str] = []
    index = 0
    while index < len(symbols):
        if index + 1 < len(symbols) and symbols[index:index + 2] == pair:
            merged.append(pair[0] + pair[1])
            index += 2
        else:
            merged.append(symbols[index])
            index += 1
    return tuple(merged)


def train_bpe(
    corpus: list[CorpusItem],
    merge_budget: int,
    minimum_frequency: int = 2,
) -> tuple[list[tuple[str, str]], dict[tuple[str, ...], int]]:
    vocabulary = {
        initial_symbols(item.text): item.count
        for item in corpus
    }
    learned_merges: list[tuple[str, str]] = []

    for _ in range(merge_budget):
        counts = pair_counts(vocabulary)
        ranked = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
        if not ranked or ranked[0][1] < minimum_frequency:
            break

        selected_pair, _ = ranked[0]
        vocabulary = {
            merge_pair(symbols, selected_pair): frequency
            for symbols, frequency in vocabulary.items()
        }
        learned_merges.append(selected_pair)

    return learned_merges, vocabulary


if __name__ == "__main__":
    training_slice = [
        CorpusItem("low", 5),
        CorpusItem("lower", 3),
        CorpusItem("lowest", 2),
        CorpusItem("newer", 2),
        CorpusItem("wider", 2),
    ]
    merges, tokenized = train_bpe(training_slice, merge_budget=8)
    print("learned merges:", merges)
    for symbols, frequency in tokenized.items():
        print(f"{frequency:>2}x", " | ".join(symbols))
