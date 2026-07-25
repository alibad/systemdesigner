"""Publish independent events and retry only failed PutRecords entries."""

from __future__ import annotations

import json
import random
import time
from collections.abc import Iterable
from typing import Any

import boto3

kinesis = boto3.client("kinesis")


def encode_event(event: dict[str, Any]) -> dict[str, bytes | str]:
    """Keep a stable event ID in the payload and route by the ordered entity."""
    return {
        "Data": json.dumps(event, separators=(",", ":")).encode("utf-8"),
        "PartitionKey": str(event["account_id"]),
    }


def put_independent_events(
    stream_name: str,
    events: Iterable[dict[str, Any]],
    max_attempts: int = 6,
) -> None:
    pending = [encode_event(event) for event in events]

    for attempt in range(max_attempts):
        response = kinesis.put_records(StreamName=stream_name, Records=pending)
        failed = [
            request
            for request, result in zip(pending, response["Records"], strict=True)
            if "ErrorCode" in result
        ]
        if not failed:
            return

        pending = failed
        delay = min(2**attempt * 0.1, 3.0)
        time.sleep(random.uniform(0, delay))

    raise RuntimeError(f"{len(pending)} records still failed after {max_attempts} attempts")


# PutRecords can partially succeed, so retrying its failed entries can change order.
# Use PutRecord and serialize writes per partition key when strict submission order is
# part of the application contract.
