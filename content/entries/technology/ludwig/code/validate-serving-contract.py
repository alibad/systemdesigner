from collections.abc import Mapping


REQUIRED_INPUTS = {
    "ticket_text": str,
    "product_area": str,
    "customer_tier": str,
}


def validate_request(payload: Mapping[str, object]) -> dict[str, object]:
    """Return only the feature contract accepted by the versioned model."""
    missing = [name for name in REQUIRED_INPUTS if name not in payload]
    wrong_types = [
        name
        for name, expected_type in REQUIRED_INPUTS.items()
        if name in payload and not isinstance(payload[name], expected_type)
    ]

    if missing or wrong_types:
        raise ValueError(
            f"invalid model input: missing={missing}, wrong_types={wrong_types}"
        )

    # Do not forward arbitrary request fields into the model.
    return {name: payload[name] for name in REQUIRED_INPUTS}


def log_prediction_metadata(
    *,
    model_version: str,
    request_id: str,
    predicted_queue: str,
    confidence: float,
) -> dict[str, object]:
    """Build observable metadata without logging raw support-ticket text."""
    return {
        "model_version": model_version,
        "request_id": request_id,
        "predicted_queue": predicted_queue,
        "confidence": round(confidence, 4),
    }
