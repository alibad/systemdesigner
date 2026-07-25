from dataclasses import dataclass
from datetime import datetime, timedelta, timezone


@dataclass(frozen=True)
class Modality:
    uri: str
    media_type: str
    captured_at: datetime
    sha256: str
    trust_zone: str


@dataclass(frozen=True)
class RequestEnvelope:
    text: str
    image: Modality | None
    request_id: str


def validate_request(
    request: RequestEnvelope,
    *,
    now: datetime,
    maximum_image_age: timedelta,
) -> list[str]:
    errors: list[str] = []

    if not request.text.strip():
        errors.append("text is required")

    image = request.image
    if image is None:
        return errors

    if image.media_type not in {"image/jpeg", "image/png", "image/webp"}:
        errors.append("unsupported image media type")
    if image.captured_at.tzinfo is None:
        errors.append("image timestamp must include a timezone")
    elif now - image.captured_at > maximum_image_age:
        errors.append("image is outside the alignment window")
    if image.trust_zone != "user-upload":
        errors.append("unexpected image trust boundary")
    if len(image.sha256) != 64:
        errors.append("image digest is missing or malformed")

    return errors


if __name__ == "__main__":
    envelope = RequestEnvelope(
        text="Which connector is damaged?",
        image=None,
        request_id="req-1042",
    )
    validation_errors = validate_request(
        envelope,
        now=datetime.now(timezone.utc),
        maximum_image_age=timedelta(minutes=5),
    )
    print({"valid": not validation_errors, "errors": validation_errors})
