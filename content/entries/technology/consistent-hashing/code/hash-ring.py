from bisect import bisect_left, insort
from hashlib import sha256


def hash64(value: str) -> int:
    """Return one stable unsigned position in a 64-bit hash space."""
    return int.from_bytes(sha256(value.encode()).digest()[:8], "big")


class HashRing:
    def __init__(self, virtual_nodes: int = 32) -> None:
        self.virtual_nodes = virtual_nodes
        self.tokens: list[int] = []
        self.owner_by_token: dict[int, str] = {}

    def add(self, node_id: str) -> None:
        for index in range(self.virtual_nodes):
            token = hash64(f"{node_id}#{index}")
            if token in self.owner_by_token:
                raise ValueError("token collision; choose a wider placement scheme")
            insort(self.tokens, token)
            self.owner_by_token[token] = node_id

    def remove(self, node_id: str) -> None:
        removed = {
            token for token, owner in self.owner_by_token.items() if owner == node_id
        }
        self.tokens = [token for token in self.tokens if token not in removed]
        for token in removed:
            del self.owner_by_token[token]

    def owner(self, key: str) -> str:
        if not self.tokens:
            raise LookupError("the ring has no owners")
        index = bisect_left(self.tokens, hash64(key))
        token = self.tokens[index % len(self.tokens)]
        return self.owner_by_token[token]


ring = HashRing(virtual_nodes=32)
for node in ("cache-a", "cache-b", "cache-c"):
    ring.add(node)

print(ring.owner("tenant:184"))
