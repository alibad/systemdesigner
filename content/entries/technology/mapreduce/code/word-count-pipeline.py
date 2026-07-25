from collections import Counter, defaultdict


def map_records(lines: list[str]) -> list[tuple[str, int]]:
    return [(word.lower(), 1) for line in lines for word in line.split()]


def combine(records: list[tuple[str, int]]) -> list[tuple[str, int]]:
    return list(Counter(dict_key for dict_key, _ in records).items())


def shuffle(records: list[tuple[str, int]]) -> dict[str, list[int]]:
    grouped: dict[str, list[int]] = defaultdict(list)
    for key, value in records:
        grouped[key].append(value)
    return grouped


def reduce_groups(groups: dict[str, list[int]]) -> dict[str, int]:
    return {key: sum(values) for key, values in groups.items()}


if __name__ == "__main__":
    mapped = map_records(["hello world hello", "distributed world"])
    combined = combine(mapped)
    output = reduce_groups(shuffle(combined))
    assert output == {"hello": 2, "world": 2, "distributed": 1}
    print(output)
