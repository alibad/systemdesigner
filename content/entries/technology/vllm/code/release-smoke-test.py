#!/usr/bin/env python3
"""Run API and metrics contract checks against a vLLM canary."""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from typing import Any, Iterable


REQUIRED_METRICS = (
    "vllm:num_requests_running",
    "vllm:num_requests_waiting",
    "vllm:kv_cache_usage_perc",
    "vllm:time_to_first_token_seconds",
    "vllm:inter_token_latency_seconds",
    "vllm:e2e_request_latency_seconds",
)


def request(
    url: str,
    api_key: str,
    timeout: float,
    payload: dict[str, Any] | None = None,
) -> urllib.response.addinfourl:
    headers = {"Authorization": f"Bearer {api_key}"}
    body = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(payload).encode("utf-8")
    return urllib.request.urlopen(
        urllib.request.Request(url, data=body, headers=headers),
        timeout=timeout,
    )


def load_json(response: urllib.response.addinfourl) -> dict[str, Any]:
    payload = json.load(response)
    if not isinstance(payload, dict):
        raise AssertionError("response must be a JSON object")
    return payload


def check_models(base_url: str, model: str, api_key: str, timeout: float) -> None:
    payload = load_json(request(f"{base_url}/v1/models", api_key, timeout))
    model_ids = {
        item.get("id")
        for item in payload.get("data", [])
        if isinstance(item, dict)
    }
    if model not in model_ids:
        raise AssertionError(f"served model {model!r} not advertised: {sorted(model_ids)}")


def completion_payload(model: str, stream: bool) -> dict[str, Any]:
    return {
        "model": model,
        "messages": [{"role": "user", "content": "Reply with the word ready."}],
        "temperature": 0,
        "max_tokens": 8,
        "stream": stream,
    }


def check_non_streaming(base_url: str, model: str, api_key: str, timeout: float) -> None:
    response = request(
        f"{base_url}/v1/chat/completions",
        api_key,
        timeout,
        completion_payload(model, stream=False),
    )
    validate_non_streaming(load_json(response))


def validate_non_streaming(payload: dict[str, Any]) -> None:
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise AssertionError("chat response has no choices")
    message = choices[0].get("message") if isinstance(choices[0], dict) else None
    if not isinstance(message, dict) or not isinstance(message.get("content"), str):
        raise AssertionError("chat response has no text content")


def iter_sse(lines: Iterable[bytes]) -> Iterable[dict[str, Any]]:
    for raw_line in lines:
        line = raw_line.decode("utf-8").strip()
        if not line.startswith("data:"):
            continue
        value = line.removeprefix("data:").strip()
        if value == "[DONE]":
            return
        payload = json.loads(value)
        if isinstance(payload, dict):
            yield payload


def check_streaming(base_url: str, model: str, api_key: str, timeout: float) -> None:
    response = request(
        f"{base_url}/v1/chat/completions",
        api_key,
        timeout,
        completion_payload(model, stream=True),
    )
    chunks = list(iter_sse(response))
    if not chunks:
        raise AssertionError("stream returned no JSON chunks")
    if not any(isinstance(chunk.get("choices"), list) for chunk in chunks):
        raise AssertionError("stream chunks have no choices")


def check_metrics(base_url: str, api_key: str, timeout: float) -> None:
    body = request(f"{base_url}/metrics", api_key, timeout).read().decode("utf-8")
    missing = [metric for metric in REQUIRED_METRICS if metric not in body]
    if missing:
        raise AssertionError(f"metrics contract is missing: {', '.join(missing)}")


def run_self_test() -> None:
    validate_non_streaming({"choices": [{"message": {"content": "ready"}}]})
    chunks = list(
        iter_sse(
            [
                b'data: {"choices": [{"delta": {"content": "ready"}}]}\n',
                b"data: [DONE]\n",
            ]
        )
    )
    assert len(chunks) == 1
    assert all(metric.startswith("vllm:") for metric in REQUIRED_METRICS)
    print("self-test: ok")


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--base-url", default="http://127.0.0.1:8000")
    result.add_argument("--model", default="assistant-production")
    result.add_argument("--api-key", default="local-release-test")
    result.add_argument("--timeout", type=float, default=30.0)
    result.add_argument("--self-test", action="store_true")
    return result


def main() -> None:
    args = parser().parse_args()
    if args.self_test:
        run_self_test()
        return

    base_url = args.base_url.rstrip("/")
    checks = (
        ("model discovery", lambda: check_models(base_url, args.model, args.api_key, args.timeout)),
        ("non-streaming chat", lambda: check_non_streaming(base_url, args.model, args.api_key, args.timeout)),
        ("streaming chat", lambda: check_streaming(base_url, args.model, args.api_key, args.timeout)),
        ("metrics contract", lambda: check_metrics(base_url, args.api_key, args.timeout)),
    )

    for label, check in checks:
        check()
        print(f"PASS: {label}")


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, json.JSONDecodeError, urllib.error.URLError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        raise SystemExit(1) from error
