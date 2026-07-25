"""Suppress duplicate boxes without mixing detections from different classes."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Detection:
    label: str
    score: float
    box: tuple[float, float, float, float]  # left, top, right, bottom


def intersection_over_union(first: Detection, second: Detection) -> float:
    left = max(first.box[0], second.box[0])
    top = max(first.box[1], second.box[1])
    right = min(first.box[2], second.box[2])
    bottom = min(first.box[3], second.box[3])
    intersection = max(0.0, right - left) * max(0.0, bottom - top)

    def area(detection: Detection) -> float:
        return max(0.0, detection.box[2] - detection.box[0]) * max(
            0.0, detection.box[3] - detection.box[1]
        )

    union = area(first) + area(second) - intersection
    return intersection / union if union else 0.0


def class_aware_nms(detections: list[Detection], iou_threshold: float) -> list[Detection]:
    kept: list[Detection] = []
    for candidate in sorted(detections, key=lambda item: item.score, reverse=True):
        duplicate = any(
            candidate.label == accepted.label
            and intersection_over_union(candidate, accepted) >= iou_threshold
            for accepted in kept
        )
        if not duplicate:
            kept.append(candidate)
    return kept


candidates = [
    Detection("person", 0.95, (10, 10, 50, 90)),
    Detection("person", 0.82, (12, 12, 49, 88)),
    Detection("forklift", 0.79, (12, 12, 49, 88)),
    Detection("person", 0.73, (70, 10, 105, 88)),
]

result = class_aware_nms(candidates, iou_threshold=0.5)
print([(item.label, item.score) for item in result])

assert len(result) == 3
assert sum(item.label == "person" for item in result) == 2
