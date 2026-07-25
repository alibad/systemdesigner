from __future__ import annotations

import warnings

import torch
import torch.nn.functional as F
from torch.nn.attention import SDPBackend, sdpa_kernel


def attention_with_fallback(
    query: torch.Tensor,
    key: torch.Tensor,
    value: torch.Tensor,
    *,
    training: bool,
    dropout_p: float = 0.0,
    is_causal: bool = True,
) -> torch.Tensor:
    """Probe the fused path, then preserve a broad exact fallback."""
    effective_dropout = dropout_p if training else 0.0

    try:
        with sdpa_kernel(SDPBackend.FLASH_ATTENTION):
            return F.scaled_dot_product_attention(
                query,
                key,
                value,
                dropout_p=effective_dropout,
                is_causal=is_causal,
            )
    except RuntimeError as error:
        warnings.warn(
            f"Flash backend unavailable for shape={tuple(query.shape)}, "
            f"dtype={query.dtype}, device={query.device}: {error}",
            stacklevel=2,
        )

    # With no context manager, PyTorch may choose another enabled fused
    # implementation or its math backend for the same exact attention contract.
    return F.scaled_dot_product_attention(
        query,
        key,
        value,
        dropout_p=effective_dropout,
        is_causal=is_causal,
    )
