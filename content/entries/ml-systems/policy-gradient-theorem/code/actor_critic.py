"""One-step actor-critic losses for a batch of transitions."""

import torch
import torch.nn.functional as F


def actor_critic_loss(
    policy_logits: torch.Tensor,
    actions: torch.Tensor,
    rewards: torch.Tensor,
    values: torch.Tensor,
    next_values: torch.Tensor,
    terminated: torch.Tensor,
    gamma: float = 0.99,
    value_coefficient: float = 0.5,
    entropy_coefficient: float = 0.01,
) -> tuple[torch.Tensor, dict[str, torch.Tensor]]:
    distribution = torch.distributions.Categorical(logits=policy_logits)
    log_probabilities = distribution.log_prob(actions)

    # Bootstrap through a time-limit truncation, but not a true terminal state.
    bootstrap_mask = (~terminated).float()
    td_target = rewards + gamma * bootstrap_mask * next_values.detach()
    advantage = td_target - values

    actor_loss = -(log_probabilities * advantage.detach()).mean()
    critic_loss = F.mse_loss(values, td_target)
    entropy = distribution.entropy().mean()
    total_loss = (
        actor_loss
        + value_coefficient * critic_loss
        - entropy_coefficient * entropy
    )

    metrics = {
        "actor_loss": actor_loss.detach(),
        "critic_loss": critic_loss.detach(),
        "entropy": entropy.detach(),
        "mean_advantage": advantage.detach().mean(),
    }
    return total_loss, metrics
