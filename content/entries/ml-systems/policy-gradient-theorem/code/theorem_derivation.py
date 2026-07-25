"""Verify the score-function identity by enumerating a finite action space."""

import torch
import torch.nn.functional as F


def compare_gradients(logits: torch.Tensor, outcomes: torch.Tensor) -> None:
    direct_logits = logits.detach().clone().requires_grad_(True)
    direct_probabilities = F.softmax(direct_logits, dim=0)
    direct_objective = torch.sum(direct_probabilities * outcomes)
    (direct_gradient,) = torch.autograd.grad(direct_objective, direct_logits)

    score_logits = logits.detach().clone().requires_grad_(True)
    score_probabilities = F.softmax(score_logits, dim=0)

    # Detaching the sampling weights makes autograd differentiate only log pi(a).
    score_objective = torch.sum(
        score_probabilities.detach()
        * outcomes
        * F.log_softmax(score_logits, dim=0)
    )
    (score_gradient,) = torch.autograd.grad(score_objective, score_logits)

    baseline = torch.tensor(3.5)
    baseline_objective = torch.sum(
        score_probabilities.detach()
        * (outcomes - baseline)
        * F.log_softmax(score_logits, dim=0)
    )
    (baseline_gradient,) = torch.autograd.grad(baseline_objective, score_logits)

    print("Direct gradient:         ", direct_gradient)
    print("Score-function gradient: ", score_gradient)
    print("With constant baseline:  ", baseline_gradient)
    print("Direct equals score:     ", torch.allclose(direct_gradient, score_gradient))
    print("Baseline is invariant:   ", torch.allclose(score_gradient, baseline_gradient))


if __name__ == "__main__":
    compare_gradients(
        logits=torch.tensor([0.2, -0.1, 0.4]),
        outcomes=torch.tensor([1.0, -2.0, 3.0]),
    )
