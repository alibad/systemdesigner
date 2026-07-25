"""Estimate a policy gradient for a two-action softmax policy."""

import torch
import torch.nn.functional as F


def exact_policy_gradient(logits: torch.Tensor, rewards: torch.Tensor) -> torch.Tensor:
    """Differentiate J(theta) = sum_a pi(a) * reward(a) exactly."""
    parameters = logits.detach().clone().requires_grad_(True)
    probabilities = F.softmax(parameters, dim=0)
    objective = torch.sum(probabilities * rewards)
    (gradient,) = torch.autograd.grad(objective, parameters)
    return gradient


def sampled_policy_gradient(
    logits: torch.Tensor,
    rewards: torch.Tensor,
    sample_count: int = 50_000,
) -> torch.Tensor:
    """Average reward(a) * grad(log pi(a)) over sampled actions."""
    probabilities = F.softmax(logits.detach(), dim=0)
    actions = torch.distributions.Categorical(probs=probabilities).sample(
        (sample_count,)
    )

    # For softmax logits, grad(log pi(a)) = one_hot(a) - pi.
    scores = F.one_hot(actions, num_classes=2).float() - probabilities
    estimates = rewards[actions].unsqueeze(1) * scores
    return estimates.mean(dim=0)


if __name__ == "__main__":
    torch.manual_seed(7)
    policy_logits = torch.tensor([-0.4, 0.4])
    action_rewards = torch.tensor([-1.0, 2.0])

    exact = exact_policy_gradient(policy_logits, action_rewards)
    sampled = sampled_policy_gradient(policy_logits, action_rewards)

    print("Exact gradient:  ", exact)
    print("Sample estimate: ", sampled)
    print("Absolute error:  ", (exact - sampled).abs())
