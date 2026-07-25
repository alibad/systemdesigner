# RLHF Training Pipeline
import torch
import torch.nn as nn
import torch.nn.functional as F

class RewardModel(nn.Module):
    """Model trained to predict human preferences"""
    def __init__(self, base_model):
        super().__init__()
        self.base_model = base_model
        self.reward_head = nn.Linear(base_model.config.hidden_size, 1)

    def forward(self, input_ids):
        outputs = self.base_model(input_ids)
        # Use last token's representation
        last_hidden = outputs.last_hidden_state[:, -1]
        reward = self.reward_head(last_hidden)
        return reward

def train_reward_model(model, preference_data):
    """Train reward model on human preference comparisons"""
    optimizer = torch.optim.Adam(model.parameters())

    for chosen_response, rejected_response in preference_data:
        # Get rewards for both responses
        reward_chosen = model(chosen_response)
        reward_rejected = model(rejected_response)

        # Bradley-Terry preference model
        loss = -F.logsigmoid(reward_chosen - reward_rejected)

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

class PPOTrainer:
    """Proximal Policy Optimization for RLHF"""
    def __init__(self, policy_model, reward_model, ref_model):
        self.policy = policy_model
        self.reward_model = reward_model
        self.ref_model = ref_model  # Reference model (frozen)
        self.kl_coeff = 0.1  # KL divergence penalty

    def compute_rewards(self, responses, prompts):
        """Compute rewards including KL penalty"""
        # Get reward from reward model
        reward_scores = self.reward_model(responses)

        # Compute KL divergence penalty
        with torch.no_grad():
            ref_logprobs = self.ref_model(responses).log_softmax(dim=-1)

        policy_logprobs = self.policy(responses).log_softmax(dim=-1)
        kl_penalty = F.kl_div(policy_logprobs, ref_logprobs, reduction='none').sum(dim=-1)

        # Final reward = reward_score - kl_penalty
        final_rewards = reward_scores - self.kl_coeff * kl_penalty
        return final_rewards

    def ppo_step(self, prompts, responses, advantages):
        """PPO optimization step"""
        # Compute current policy probabilities
        current_logprobs = self.policy(responses).log_softmax(dim=-1)

        # Compute probability ratios
        with torch.no_grad():
            old_logprobs = current_logprobs.detach()

        ratio = torch.exp(current_logprobs - old_logprobs)

        # PPO clipped objective
        clip_epsilon = 0.2
        clipped_ratio = torch.clamp(ratio, 1 - clip_epsilon, 1 + clip_epsilon)

        policy_loss = -torch.min(
            ratio * advantages,
            clipped_ratio * advantages
        ).mean()

        return policy_loss

# RLHF process:
# 1. Train reward model on human preferences
# 2. Use PPO to optimize policy against reward model
# 3. Iterate: collect more data, retrain models
