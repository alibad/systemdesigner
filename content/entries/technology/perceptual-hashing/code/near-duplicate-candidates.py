from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps


@dataclass(frozen=True)
class Signature:
    object_id: str
    algorithm: str
    bits: int
    value: int


def difference_hash(path: Path, hash_size: int = 8) -> Signature:
    with Image.open(path) as source:
        image = ImageOps.exif_transpose(source).convert("L")
        image = image.resize((hash_size + 1, hash_size), Image.Resampling.LANCZOS)
        pixels = list(image.getdata())

    value = 0
    width = hash_size + 1
    for row in range(hash_size):
        for column in range(hash_size):
            left = pixels[row * width + column]
            right = pixels[row * width + column + 1]
            value = (value << 1) | int(left > right)

    return Signature(path.name, "dhash-v1", hash_size * hash_size, value)


def hamming_distance(left: Signature, right: Signature) -> int:
    if (left.algorithm, left.bits) != (right.algorithm, right.bits):
        raise ValueError("compare only signatures with the same algorithm and width")
    return (left.value ^ right.value).bit_count()


def candidates(query: Signature, index: list[Signature], threshold: int):
    for stored in index:
        distance = hamming_distance(query, stored)
        if distance <= threshold:
            yield stored.object_id, distance
