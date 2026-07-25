"""Detect page regions while preserving model and coordinate evidence."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from PIL import Image
import layoutparser as lp


MODEL_URI = "lp://PubLayNet/faster_rcnn_R_50_FPN_3x/config"
LABEL_MAP = {
    0: "Text",
    1: "Title",
    2: "List",
    3: "Table",
    4: "Figure",
}


def build_model(score_floor: float = 0.7) -> Any:
    """Create the detector after its backend has been pinned and smoke-tested."""
    if not 0.0 <= score_floor <= 1.0:
        raise ValueError("score_floor must be between 0 and 1")

    return lp.Detectron2LayoutModel(
        MODEL_URI,
        extra_config=["MODEL.ROI_HEADS.SCORE_THRESH_TEST", score_floor],
        label_map=LABEL_MAP,
    )


def detect_regions(image_path: Path, score_floor: float = 0.7) -> list[dict[str, object]]:
    """Return an auditable, JSON-safe region contract for one rendered page."""
    image = Image.open(image_path).convert("RGB")
    model = build_model(score_floor)
    layout = model.detect(image)

    regions: list[dict[str, object]] = []
    for index, block in enumerate(layout):
        regions.append(
            {
                "region_id": f"region-{index:04d}",
                "type": block.type,
                "score": float(block.score),
                "bbox_xyxy": [
                    float(block.block.x_1),
                    float(block.block.y_1),
                    float(block.block.x_2),
                    float(block.block.y_2),
                ],
                "page_width": image.width,
                "page_height": image.height,
                "model_uri": MODEL_URI,
                "score_floor": score_floor,
            }
        )
    return regions


if __name__ == "__main__":
    page = Path("page-0001.png")
    for region in detect_regions(page):
        print(region)
