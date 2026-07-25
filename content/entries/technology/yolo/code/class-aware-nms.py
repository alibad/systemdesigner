from dataclasses import dataclass


@dataclass(frozen=True)
class Detection:
    detection_id: str
    class_id: str
    score: float
    box: tuple[float, float, float, float]


def intersection_over_union(left: Detection, right: Detection) -> float:
    left_x1, left_y1, left_x2, left_y2 = left.box
    right_x1, right_y1, right_x2, right_y2 = right.box

    intersection_width = max(0.0, min(left_x2, right_x2) - max(left_x1, right_x1))
    intersection_height = max(0.0, min(left_y2, right_y2) - max(left_y1, right_y1))
    intersection = intersection_width * intersection_height

    left_area = (left_x2 - left_x1) * (left_y2 - left_y1)
    right_area = (right_x2 - right_x1) * (right_y2 - right_y1)
    union = left_area + right_area - intersection
    return intersection / union if union > 0 else 0.0


def class_aware_nms(
    candidates: list[Detection],
    confidence_threshold: float,
    iou_threshold: float,
) -> tuple[list[Detection], dict[str, str]]:
    decisions: dict[str, str] = {}
    passing = []

    for candidate in candidates:
        if candidate.score < confidence_threshold:
            decisions[candidate.detection_id] = (
                f"filtered: {candidate.score:.2f} < {confidence_threshold:.2f}"
            )
        else:
            passing.append(candidate)

    kept: list[Detection] = []
    for candidate in sorted(passing, key=lambda item: (-item.score, item.detection_id)):
        competing = [
            prior for prior in kept if prior.class_id == candidate.class_id
        ]
        overlaps = [
            (intersection_over_union(candidate, prior), prior) for prior in competing
        ]
        strongest = max(overlaps, default=None, key=lambda pair: pair[0])

        if strongest is not None and strongest[0] > iou_threshold:
            overlap, suppressor = strongest
            decisions[candidate.detection_id] = (
                f"suppressed by {suppressor.detection_id}: "
                f"IoU {overlap:.3f} > {iou_threshold:.2f}"
            )
            continue

        kept.append(candidate)
        decisions[candidate.detection_id] = "kept"

    return kept, decisions


if __name__ == "__main__":
    detections = [
        Detection("P1", "person", 0.92, (70, 45, 270, 410)),
        Detection("P2", "person", 0.78, (92, 68, 292, 420)),
        Detection("F1", "forklift", 0.83, (320, 130, 690, 420)),
        Detection("F2", "forklift", 0.61, (350, 155, 720, 430)),
        Detection("L1", "pallet", 0.48, (500, 255, 770, 430)),
    ]
    kept, trace = class_aware_nms(detections, 0.50, 0.50)

    assert [item.detection_id for item in kept] == ["P1", "F1"]
    assert trace["P2"].startswith("suppressed by P1")
    assert trace["F2"].startswith("suppressed by F1")
    assert trace["L1"] == "filtered: 0.48 < 0.50"

    for detection_id, decision in trace.items():
        print(f"{detection_id}: {decision}")
