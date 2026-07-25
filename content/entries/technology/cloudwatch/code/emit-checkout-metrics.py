"""Emit a bounded-dimension CloudWatch embedded metric format event."""

from __future__ import annotations

import json
import time


ALLOWED_ENVIRONMENTS = {"staging", "production"}


def emit_checkout_metrics(
    environment: str,
    latency_ms: float,
    *,
    failed: bool,
) -> None:
    if environment not in ALLOWED_ENVIRONMENTS:
        raise ValueError(f"unsupported environment: {environment}")
    if latency_ms < 0:
        raise ValueError("latency_ms must be non-negative")

    metric_definitions: list[dict[str, str]] = [
        {"Name": "Latency", "Unit": "Milliseconds"}
    ]
    event: dict[str, object] = {
        "_aws": {
            "Timestamp": int(time.time() * 1000),
            "CloudWatchMetrics": [
                {
                    "Namespace": "Example/Checkout",
                    "Dimensions": [["Service", "Environment"]],
                    "Metrics": metric_definitions,
                }
            ],
        },
        "Service": "checkout",
        "Environment": environment,
        "Latency": latency_ms,
        "message": "checkout completed",
    }

    if failed:
        metric_definitions.append({"Name": "Failures", "Unit": "Count"})
        event["Failures"] = 1
        event["message"] = "checkout failed"

    print(json.dumps(event, separators=(",", ":")))


if __name__ == "__main__":
    emit_checkout_metrics("production", 184.0, failed=False)
