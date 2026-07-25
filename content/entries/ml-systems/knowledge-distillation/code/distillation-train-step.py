from dataclasses import dataclass

import torch
import torch.nn.functional as F
from torch import Tensor, nn


@dataclass(frozen=True)
class DistillationConfig:
    temperature: float = 3.0
    teacher_weight: float = 0.55

    def validate(self) -> None:
        if self.temperature <= 0:
            raise ValueError("temperature must be greater than zero")
        if not 0 <= self.teacher_weight <= 1:
            raise ValueError("teacher_weight must be between zero and one")


def distillation_loss(
    teacher: nn.Module,
    student: nn.Module,
    inputs: Tensor,
    labels: Tensor,
    config: DistillationConfig,
) -> tuple[Tensor, dict[str, Tensor]]:
    """Return a trainable student loss and detached metrics for one batch."""
    config.validate()
    teacher.eval()
    student.train()

    with torch.no_grad():
        teacher_logits = teacher(inputs)
    student_logits = student(inputs)

    if teacher_logits.shape != student_logits.shape:
        raise ValueError("teacher and student logits must have the same shape")

    temperature = config.temperature
    teacher_probabilities = F.softmax(teacher_logits / temperature, dim=-1)
    student_log_probabilities = F.log_softmax(
        student_logits / temperature,
        dim=-1,
    )

    soft_loss = F.kl_div(
        student_log_probabilities,
        teacher_probabilities,
        reduction="batchmean",
    ) * (temperature**2)
    label_loss = F.cross_entropy(student_logits, labels)
    total_loss = (
        config.teacher_weight * soft_loss
        + (1 - config.teacher_weight) * label_loss
    )

    metrics = {
        "soft_loss": soft_loss.detach(),
        "label_loss": label_loss.detach(),
        "total_loss": total_loss.detach(),
    }
    return total_loss, metrics
