"""Dependency-free Trie with safe deletion and bounded autocomplete."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class TrieNode:
    children: dict[str, "TrieNode"] = field(default_factory=dict)
    terminal: bool = False


class Trie:
    def __init__(self) -> None:
        self.root = TrieNode()

    def insert(self, word: str) -> None:
        node = self.root
        for character in word:
            node = node.children.setdefault(character, TrieNode())
        node.terminal = True

    def contains(self, word: str) -> bool:
        node = self._find_node(word)
        return node is not None and node.terminal

    def has_prefix(self, prefix: str) -> bool:
        return self._find_node(prefix) is not None

    def autocomplete(self, prefix: str, limit: int = 5) -> list[str]:
        if limit <= 0:
            return []

        start = self._find_node(prefix)
        if start is None:
            return []

        results: list[str] = []
        stack: list[tuple[TrieNode, str]] = [(start, prefix)]

        while stack and len(results) < limit:
            node, word = stack.pop()
            if node.terminal:
                results.append(word)

            # Reverse insertion makes the stack produce lexicographic output.
            for character in sorted(node.children, reverse=True):
                stack.append((node.children[character], word + character))

        return results

    def delete(self, word: str) -> bool:
        """Delete one key and return whether it existed."""

        deleted = False

        def remove(node: TrieNode, index: int) -> bool:
            nonlocal deleted

            if index == len(word):
                if not node.terminal:
                    return False
                node.terminal = False
                deleted = True
                return not node.children

            character = word[index]
            child = node.children.get(character)
            if child is None:
                return False

            if remove(child, index + 1):
                del node.children[character]

            return not node.terminal and not node.children

        remove(self.root, 0)
        return deleted

    def _find_node(self, text: str) -> TrieNode | None:
        node = self.root
        for character in text:
            node = node.children.get(character)
            if node is None:
                return None
        return node


if __name__ == "__main__":
    trie = Trie()
    for key in ("car", "card", "care", "cat", "dog"):
        trie.insert(key)

    assert trie.contains("car")
    assert trie.has_prefix("ca")
    assert not trie.contains("ca")
    assert trie.autocomplete("car", limit=3) == ["car", "card", "care"]

    assert trie.delete("car")
    assert not trie.contains("car")
    assert trie.contains("card") and trie.contains("care")
    assert not trie.delete("missing")

    print("safe deletion preserved shared descendants")
    print("ca suggestions:", trie.autocomplete("ca", limit=4))
