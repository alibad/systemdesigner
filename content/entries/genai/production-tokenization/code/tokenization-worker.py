from __future__ import annotations

import asyncio
import hashlib
from dataclasses import dataclass
from typing import Annotated

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field
from transformers import AutoTokenizer, PreTrainedTokenizerFast


MAX_TEXTS = 32
MAX_UTF8_BYTES = 256_000
MAX_TOKENS = 8_192


@dataclass(frozen=True)
class Bundle:
    model_id: str
    revision: str
    fingerprint: str
    tokenizer: PreTrainedTokenizerFast


def load_bundle(model_id: str, revision: str, expected_fingerprint: str) -> Bundle:
    tokenizer = AutoTokenizer.from_pretrained(
        model_id,
        revision=revision,
        use_fast=True,
        trust_remote_code=False,
        local_files_only=True,
    )
    if not isinstance(tokenizer, PreTrainedTokenizerFast):
        raise RuntimeError("The approved production bundle requires a fast tokenizer")

    payload = tokenizer.backend_tokenizer.to_str().encode("utf-8")
    observed = hashlib.sha256(payload).hexdigest()
    if observed != expected_fingerprint:
        raise RuntimeError(f"Tokenizer fingerprint mismatch: {observed}")

    return Bundle(model_id, revision, observed, tokenizer)


class TokenizeRequest(BaseModel):
    bundle_id: str
    texts: Annotated[list[str], Field(min_length=1, max_length=MAX_TEXTS)]
    max_length: Annotated[int, Field(ge=1, le=MAX_TOKENS)] = 2_048
    include_offsets: bool = False


class TokenizeResponse(BaseModel):
    bundle_id: str
    fingerprint: str
    input_ids: list[list[int]]
    attention_mask: list[list[int]]
    offsets: list[list[tuple[int, int]]] | None
    token_counts: list[int]


APPROVED: dict[str, Bundle] = {
    # Load from a read-only artifact volume during process startup.
    # "chat-v4": load_bundle("org/chat-v4", "sha-revision", "sha256-tokenizer"),
}
CPU_SLOTS = asyncio.Semaphore(8)
app = FastAPI(title="Bounded tokenization worker")


def encode(bundle: Bundle, request: TokenizeRequest) -> TokenizeResponse:
    encoded = bundle.tokenizer(
        request.texts,
        add_special_tokens=True,
        padding=False,
        truncation=False,
        return_attention_mask=True,
        return_offsets_mapping=request.include_offsets,
    )
    token_counts = [len(ids) for ids in encoded["input_ids"]]
    if max(token_counts) > request.max_length:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"Sequence exceeds {request.max_length} tokens",
        )

    return TokenizeResponse(
        bundle_id=request.bundle_id,
        fingerprint=bundle.fingerprint,
        input_ids=encoded["input_ids"],
        attention_mask=encoded["attention_mask"],
        offsets=encoded.get("offset_mapping"),
        token_counts=token_counts,
    )


@app.post("/v1/tokenize", response_model=TokenizeResponse)
async def tokenize(request: TokenizeRequest) -> TokenizeResponse:
    bundle = APPROVED.get(request.bundle_id)
    if bundle is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown bundle")

    payload_bytes = sum(len(text.encode("utf-8")) for text in request.texts)
    if payload_bytes > MAX_UTF8_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Input too large")

    async with CPU_SLOTS:
        return await asyncio.to_thread(encode, bundle, request)
