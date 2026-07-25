"""Apply a replayed Kinesis event once when business state lives in DynamoDB."""

from __future__ import annotations

import os
from typing import Any

import boto3
from botocore.exceptions import ClientError

dynamodb = boto3.client("dynamodb")
DEDUPE_TABLE = os.environ["DEDUPE_TABLE"]
ACCOUNT_TABLE = os.environ["ACCOUNT_TABLE"]


def apply_credit(event: dict[str, Any]) -> bool:
    """Return True for a new effect and False for an already-claimed event."""
    try:
        dynamodb.transact_write_items(
            TransactItems=[
                {
                    "Put": {
                        "TableName": DEDUPE_TABLE,
                        "Item": {
                            "event_id": {"S": event["event_id"]},
                            "account_id": {"S": event["account_id"]},
                        },
                        "ConditionExpression": "attribute_not_exists(event_id)",
                    }
                },
                {
                    "Update": {
                        "TableName": ACCOUNT_TABLE,
                        "Key": {"account_id": {"S": event["account_id"]}},
                        "UpdateExpression": "ADD balance_cents :amount",
                        "ExpressionAttributeValues": {
                            ":amount": {"N": str(event["amount_cents"])}
                        },
                    }
                },
            ]
        )
        return True
    except ClientError as error:
        if error.response["Error"]["Code"] == "TransactionCanceledException":
            return False
        raise


# Checkpoint the Kinesis shard only after the transaction succeeds. If a worker
# restarts before checkpointing, replay reaches the same event_id and becomes a no-op.
