"""A focused PyTorch training step with AMP and a dependency-free contract check."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class StepContract:
    accumulation_steps: int
    clip_grad_norm: float
    use_amp: bool

    def validate(self) -> None:
        assert self.accumulation_steps >= 1
        assert self.clip_grad_norm > 0


def train_step(model, optimizer, scaler, batch, contract: StepContract, micro_step: int):
    """Run one micro-step; return whether an optimizer update occurred."""
    import torch

    features, targets = batch
    with torch.autocast(
        device_type=features.device.type,
        dtype=torch.bfloat16,
        enabled=contract.use_amp,
    ):
        logits = model(features)
        loss = torch.nn.functional.cross_entropy(logits, targets)
        loss = loss / contract.accumulation_steps

    scaler.scale(loss).backward()
    should_step = (micro_step + 1) % contract.accumulation_steps == 0
    if should_step:
        scaler.unscale_(optimizer)
        torch.nn.utils.clip_grad_norm_(model.parameters(), contract.clip_grad_norm)
        scaler.step(optimizer)
        scaler.update()
        optimizer.zero_grad(set_to_none=True)

    return float(loss.detach()) * contract.accumulation_steps, should_step


if __name__ == "__main__":
    example = StepContract(accumulation_steps=8, clip_grad_norm=1.0, use_amp=True)
    example.validate()
    updates = sum((micro_step + 1) % example.accumulation_steps == 0 for micro_step in range(24))
    assert updates == 3
    print(f"contract valid: 24 micro-steps produce {updates} optimizer updates")
