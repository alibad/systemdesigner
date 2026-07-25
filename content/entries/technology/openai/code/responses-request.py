"""Build a bounded Responses API request; send it only with --live."""

from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.request
import uuid
from typing import Any


def build_payload(model: str) -> dict[str, Any]:
    return {
        "model": model,
        "store": False,
        "max_output_tokens": 300,
        "instructions": (
            "Extract the support ticket. Use only facts in the user input. "
            "Set needs_human_review when the request implies account access."
        ),
        "input": "Customer cannot sign in after changing their recovery email.",
        "text": {
            "format": {
                "type": "json_schema",
                "name": "support_ticket",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "category": {
                            "type": "string",
                            "enum": ["access", "billing", "product", "other"],
                        },
                        "summary": {"type": "string"},
                        "needs_human_review": {"type": "boolean"},
                    },
                    "required": ["category", "summary", "needs_human_review"],
                    "additionalProperties": False,
                },
            }
        },
        "metadata": {"route": "support-intake", "contract_version": "1"},
    }


def validate_payload(payload: dict[str, Any]) -> None:
    schema = payload["text"]["format"]["schema"]
    required = set(schema["required"])
    properties = set(schema["properties"])
    assert payload["store"] is False
    assert payload["max_output_tokens"] > 0
    assert schema["additionalProperties"] is False
    assert required == properties


def send(payload: dict[str, Any], api_key: str) -> dict[str, Any]:
    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "X-Client-Request-Id": str(uuid.uuid4()),
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenAI request failed with {error.code}: {detail}") from error


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true", help="Send the request to OpenAI")
    args = parser.parse_args()

    model = os.getenv("OPENAI_MODEL", "configured-model-id")
    payload = build_payload(model)
    validate_payload(payload)

    if not args.live:
        print(json.dumps(payload, indent=2, sort_keys=True))
        print("offline validation: PASS")
        return 0

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or model == "configured-model-id":
        parser.error("--live requires OPENAI_API_KEY and OPENAI_MODEL")

    response = send(payload, api_key)
    print(json.dumps(response, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
