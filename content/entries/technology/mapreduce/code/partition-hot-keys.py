from zlib import crc32


def partition(key: str, reducers: int) -> int:
    if reducers < 1:
        raise ValueError("reducers must be positive")
    return crc32(key.encode("utf-8")) % reducers


def salted_key(key: str, record_id: str, salts: int) -> str:
    if salts < 1:
        raise ValueError("salts must be positive")
    salt = crc32(record_id.encode("utf-8")) % salts
    return f"{key}#{salt}"


if __name__ == "__main__":
    hot_key = "unknown-category"
    salted = [salted_key(hot_key, f"event-{index}", 8) for index in range(1_000)]
    partitions = {partition(key, 32) for key in salted}
    assert len(partitions) > 1
    print(f"hot key spread across {len(partitions)} reducer partitions")
