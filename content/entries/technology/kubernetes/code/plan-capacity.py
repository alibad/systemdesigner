from dataclasses import dataclass


@dataclass(frozen=True)
class NodePool:
    nodes: int
    cores_per_node: int
    reserve_percent: int


def can_survive_one_node(pool: NodePool, replicas: int, request_millicpu: int) -> bool:
    allocatable_per_node = pool.cores_per_node * 1_000 * (1 - pool.reserve_percent / 100)
    requested = replicas * request_millicpu
    capacity_after_failure = allocatable_per_node * (pool.nodes - 1)
    return requested <= capacity_after_failure


if __name__ == "__main__":
    pool = NodePool(nodes=5, cores_per_node=8, reserve_percent=20)
    assert can_survive_one_node(pool, replicas=12, request_millicpu=500)
    print({"survives_one_node": True})
