import torch
import torch.nn.functional as F


def pairwise_reward_loss(chosen_scores: torch.Tensor, rejected_scores: torch.Tensor) -> torch.Tensor:
    """Make the human-chosen response score higher than the rejected response."""
    margin = chosen_scores - rejected_scores
    return -F.logsigmoid(margin).mean()


def pairwise_accuracy(chosen_scores: torch.Tensor, rejected_scores: torch.Tensor) -> torch.Tensor:
    """Report the fraction of held-out comparisons ranked in the observed direction."""
    return (chosen_scores > rejected_scores).float().mean()
