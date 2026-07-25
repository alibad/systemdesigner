from dataclasses import dataclass


@dataclass(frozen=True)
class SceneVersion:
    map_id: str
    anchor_id: str
    entity_revision: int
    captured_at_ms: int


@dataclass(frozen=True)
class RemoteLabel:
    value: str
    confidence: float
    scene: SceneVersion
    model_version: str


def accept_label(
    label: RemoteLabel,
    current: SceneVersion,
    now_ms: int,
    allowed_models: set[str],
) -> bool:
    return (
        label.confidence >= 0.85
        and label.model_version in allowed_models
        and label.scene.map_id == current.map_id
        and label.scene.anchor_id == current.anchor_id
        and label.scene.entity_revision == current.entity_revision
        and now_ms - label.scene.captured_at_ms <= 250
    )
