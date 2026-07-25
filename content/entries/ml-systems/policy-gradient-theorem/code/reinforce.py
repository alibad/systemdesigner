"""A compact REINFORCE loss for one completed trajectory."""

from typing import Optional

import torch


def discounted_returns(rewards: torch.Tensor, gamma: float) -> torch.Tensor:
    returns = torch.empty_like(rewards)
    running_return = torch.zeros((), dtype=rewards.dtype, device=rewards.device)

    for step in range(len(rewards) - 1, -1, -1):
        running_return = rewards[step] + gamma * running_return
        returns[step] = running_return

    return returns


def reinforce_loss(
    policy_logits: torch.Tensor,
    actions: torch.Tensor,
    rewards: torch.Tensor,
    gamma: float = 0.99,
    state_baseline: Optional[torch.Tensor] = None,
) -> torch.Tensor:
    """Return the actor loss; call backward() and optimizer.step() outside."""
    distribution = torch.distributions.Categorical(logits=policy_logits)
    log_probabilities = distribution.log_prob(actions)
    returns = discounted_returns(rewards, gamma)

    if state_baseline is None:
        advantages = returns
    else:
        # The actor must not optimize through its weighting signal.
        advantages = returns - state_baseline.detach()

    return -(log_probabilities * advantages.detach()).mean()
