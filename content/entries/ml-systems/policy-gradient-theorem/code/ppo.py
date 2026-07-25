"""The clipped PPO objective for one optimization minibatch."""

import torch
import torch.nn.functional as F


def ppo_loss(
    new_policy_logits: torch.Tensor,
    actions: torch.Tensor,
    old_log_probabilities: torch.Tensor,
    advantages: torch.Tensor,
    returns: torch.Tensor,
    values: torch.Tensor,
    clip_ratio: float = 0.2,
    value_coefficient: float = 0.5,
    entropy_coefficient: float = 0.01,
) -> tuple[torch.Tensor, dict[str, torch.Tensor]]:
    distribution = torch.distributions.Categorical(logits=new_policy_logits)
    new_log_probabilities = distribution.log_prob(actions)

    probability_ratio = torch.exp(
        new_log_probabilities - old_log_probabilities.detach()
    )
    unclipped_objective = probability_ratio * advantages.detach()
    clipped_objective = torch.clamp(
        probability_ratio,
        1 - clip_ratio,
        1 + clip_ratio,
    ) * advantages.detach()

    actor_loss = -torch.minimum(unclipped_objective, clipped_objective).mean()
    critic_loss = F.mse_loss(values, returns.detach())
    entropy = distribution.entropy().mean()
    total_loss = (
        actor_loss
        + value_coefficient * critic_loss
        - entropy_coefficient * entropy
    )

    with torch.no_grad():
        approximate_kl = (old_log_probabilities - new_log_probabilities).mean()
        clip_fraction = (
            (probability_ratio - 1).abs() > clip_ratio
        ).float().mean()

    metrics = {
        "actor_loss": actor_loss.detach(),
        "critic_loss": critic_loss.detach(),
        "entropy": entropy.detach(),
        "approximate_kl": approximate_kl,
        "clip_fraction": clip_fraction,
    }
    return total_loss, metrics
