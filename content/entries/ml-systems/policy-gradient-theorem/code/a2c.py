"""Generalized Advantage Estimation for a synchronous actor-critic batch."""

import torch
import torch.nn.functional as F


def generalized_advantage_estimate(
    rewards: torch.Tensor,
    values: torch.Tensor,
    terminated: torch.Tensor,
    gamma: float = 0.99,
    gae_lambda: float = 0.95,
) -> tuple[torch.Tensor, torch.Tensor]:
    """Compute advantages; values has one extra bootstrap value at the end."""
    advantages = torch.zeros_like(rewards)
    running_advantage = torch.zeros((), dtype=rewards.dtype, device=rewards.device)

    for step in range(len(rewards) - 1, -1, -1):
        bootstrap_mask = (~terminated[step]).float()
        td_residual = (
            rewards[step]
            + gamma * bootstrap_mask * values[step + 1]
            - values[step]
        )
        running_advantage = (
            td_residual
            + gamma * gae_lambda * bootstrap_mask * running_advantage
        )
        advantages[step] = running_advantage

    returns = advantages + values[:-1]
    return advantages, returns


def a2c_loss(
    policy_logits: torch.Tensor,
    actions: torch.Tensor,
    values: torch.Tensor,
    advantages: torch.Tensor,
    returns: torch.Tensor,
    value_coefficient: float = 0.5,
    entropy_coefficient: float = 0.01,
) -> torch.Tensor:
    distribution = torch.distributions.Categorical(logits=policy_logits)
    actor_loss = -(
        distribution.log_prob(actions) * advantages.detach()
    ).mean()
    critic_loss = F.mse_loss(values, returns.detach())
    entropy = distribution.entropy().mean()
    return actor_loss + value_coefficient * critic_loss - entropy_coefficient * entropy
