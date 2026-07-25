from __future__ import annotations

import torch
import torch.nn.functional as F
import torch.utils.benchmark as benchmark
from torch.nn.attention import SDPBackend, sdpa_kernel


torch.manual_seed(11)
device = torch.device("cuda")
shape = (2, 32, 4096, 128)  # B, H, N, d
q, k, v = (
    torch.randn(shape, device=device, dtype=torch.bfloat16)
    for _ in range(3)
)


def measure(backend: SDPBackend) -> tuple[float, float]:
    def operation() -> torch.Tensor:
        with sdpa_kernel(backend):
            return F.scaled_dot_product_attention(q, k, v, is_causal=True)

    operation()  # Fail unsupported configurations before recording a result.
    torch.cuda.synchronize()
    timing = benchmark.Timer(
        stmt="operation()",
        globals={"operation": operation},
        label="causal SDPA",
        description=backend.name,
    ).blocked_autorange(min_run_time=1.0)

    torch.cuda.reset_peak_memory_stats()
    output = operation()
    torch.cuda.synchronize()
    peak_mib = torch.cuda.max_memory_allocated() / 1024**2
    del output
    return timing.median * 1_000, peak_mib


for candidate in (SDPBackend.MATH, SDPBackend.FLASH_ATTENTION):
    try:
        median_ms, peak_mib = measure(candidate)
        print(f"{candidate.name:20s} median={median_ms:8.3f} ms peak={peak_mib:8.1f} MiB")
    except RuntimeError as error:
        print(f"{candidate.name:20s} unsupported: {error}")
