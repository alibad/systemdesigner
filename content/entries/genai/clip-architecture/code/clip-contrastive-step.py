"""A distributed, symmetric CLIP contrastive step.

The model must return unnormalized image and text embeddings for paired local
batches. Every worker must receive the same non-empty local batch size.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Protocol

import torch
import torch.distributed as dist
import torch.nn.functional as F
from torch import Tensor, nn
from torch.distributed.nn.functional import all_gather


class DualEncoder(Protocol):
    logit_scale: Tensor

    def encode_image(self, images: Tensor) -> Tensor: ...

    def encode_text(self, token_ids: Tensor) -> Tensor: ...


@dataclass(frozen=True)
class ContrastiveResult:
    loss: Tensor
    image_to_text_loss: Tensor
    text_to_image_loss: Tensor
    image_recall_at_1: Tensor
    text_recall_at_1: Tensor
    global_batch_size: int


def _gather_with_grad(local: Tensor) -> Tensor:
    if not dist.is_available() or not dist.is_initialized():
        return local
    return torch.cat(all_gather(local), dim=0)


def clip_contrastive_step(
    model: DualEncoder,
    images: Tensor,
    token_ids: Tensor,
    *,
    maximum_logit_scale: float = 100.0,
) -> ContrastiveResult:
    """Compute symmetric loss using all distributed batch members as negatives."""
    if images.shape[0] != token_ids.shape[0] or images.shape[0] == 0:
        raise ValueError("images and token_ids need the same non-zero batch size")
    if maximum_logit_scale <= 0:
        raise ValueError("maximum_logit_scale must be positive")

    local_images = F.normalize(model.encode_image(images).float(), dim=-1)
    local_texts = F.normalize(model.encode_text(token_ids).float(), dim=-1)
    global_images = _gather_with_grad(local_images)
    global_texts = _gather_with_grad(local_texts)

    rank = dist.get_rank() if dist.is_available() and dist.is_initialized() else 0
    local_batch = local_images.shape[0]
    targets = rank * local_batch + torch.arange(local_batch, device=images.device)

    logit_scale = model.logit_scale.float().clamp(
        max=math.log(maximum_logit_scale)
    ).exp()
    image_logits = logit_scale * local_images @ global_texts.T
    text_logits = logit_scale * local_texts @ global_images.T

    image_loss = F.cross_entropy(image_logits, targets)
    text_loss = F.cross_entropy(text_logits, targets)
    loss = (image_loss + text_loss) / 2

    return ContrastiveResult(
        loss=loss,
        image_to_text_loss=image_loss.detach(),
        text_to_image_loss=text_loss.detach(),
        image_recall_at_1=(image_logits.argmax(dim=1) == targets).float().mean(),
        text_recall_at_1=(text_logits.argmax(dim=1) == targets).float().mean(),
        global_batch_size=global_images.shape[0],
    )


def optimize_step(
    model: nn.Module,
    optimizer: torch.optim.Optimizer,
    images: Tensor,
    token_ids: Tensor,
) -> ContrastiveResult:
    optimizer.zero_grad(set_to_none=True)
    result = clip_contrastive_step(model, images, token_ids)
    result.loss.backward()
    torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
    optimizer.step()
    return result
