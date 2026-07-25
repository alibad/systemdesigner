from __future__ import annotations

import torch
import torch.nn.functional as F
from torch.nn.attention import SDPBackend, sdpa_kernel


def output_and_grads(
    backend: SDPBackend,
    query: torch.Tensor,
    key: torch.Tensor,
    value: torch.Tensor,
) -> tuple[torch.Tensor, tuple[torch.Tensor, ...]]:
    inputs = tuple(tensor.detach().clone().requires_grad_(True) for tensor in (query, key, value))
    with sdpa_kernel(backend):
        output = F.scaled_dot_product_attention(*inputs, is_causal=True, dropout_p=0.0)
    loss = output.float().square().mean()
    gradients = torch.autograd.grad(loss, inputs)
    return output.detach(), tuple(gradient.detach() for gradient in gradients)


torch.manual_seed(7)
device = torch.device("cuda")
shape = (2, 16, 2048, 64)  # B, H, N, d
q, k, v = (
    torch.randn(shape, device=device, dtype=torch.bfloat16)
    for _ in range(3)
)

reference_output, reference_grads = output_and_grads(SDPBackend.MATH, q, k, v)
candidate_output, candidate_grads = output_and_grads(
    SDPBackend.FLASH_ATTENTION, q, k, v
)

# Floating-point evaluation order differs, so use a reviewed dtype/shape tolerance.
torch.testing.assert_close(candidate_output, reference_output, rtol=2e-2, atol=2e-2)
for candidate, reference in zip(candidate_grads, reference_grads, strict=True):
    torch.testing.assert_close(candidate, reference, rtol=3e-2, atol=3e-2)

print("Flash output and Q/K/V gradients match the math reference within tolerance.")
