import torch


def kl_penalized_rewards(
    reward_model_score: torch.Tensor,
    policy_log_probs: torch.Tensor,
    reference_log_probs: torch.Tensor,
    kl_coefficient: float,
) -> tuple[torch.Tensor, torch.Tensor]:
    """Apply a sampled-token KL estimate before computing advantages."""
    sampled_kl = policy_log_probs - reference_log_probs
    sequence_kl = sampled_kl.sum(dim=-1)
    constrained_reward = reward_model_score - kl_coefficient * sequence_kl
    return constrained_reward, sequence_kl


def clipped_ppo_loss(
    new_log_probs: torch.Tensor,
    old_log_probs: torch.Tensor,
    advantages: torch.Tensor,
    clip_ratio: float = 0.2,
) -> torch.Tensor:
    ratio = torch.exp(new_log_probs - old_log_probs)
    clipped_ratio = ratio.clamp(1 - clip_ratio, 1 + clip_ratio)
    return -torch.minimum(ratio * advantages, clipped_ratio * advantages).mean()
