import torch
import torch.nn as nn
import torch.nn.functional as F

class Expert(nn.Module):
    def __init__(self, input_dim, hidden_dim):
        super().__init__()
        self.fc1 = nn.Linear(input_dim, hidden_dim)
        self.fc2 = nn.Linear(hidden_dim, input_dim)

    def forward(self, x):
        return self.fc2(F.relu(self.fc1(x)))

class MoELayer(nn.Module):
    def __init__(self, input_dim, num_experts, expert_hidden_dim, top_k=2):
        super().__init__()
        self.num_experts = num_experts
        self.top_k = top_k

        # Create experts
        self.experts = nn.ModuleList([
            Expert(input_dim, expert_hidden_dim)
            for _ in range(num_experts)
        ])

        # Gating network
        self.gate = nn.Linear(input_dim, num_experts)

    def forward(self, x):
        batch_size, seq_len, input_dim = x.shape
        x_flat = x.view(-1, input_dim)  # (batch_size * seq_len, input_dim)

        # Compute gating scores
        gate_scores = self.gate(x_flat)  # (batch_size * seq_len, num_experts)

        # Select top-k experts
        top_k_scores, top_k_indices = torch.topk(gate_scores, self.top_k, dim=-1)
        top_k_scores = F.softmax(top_k_scores, dim=-1)

        # Initialize output
        output = torch.zeros_like(x_flat)

        # Process through selected experts
        for i in range(self.top_k):
            expert_idx = top_k_indices[:, i]
            expert_weight = top_k_scores[:, i].unsqueeze(-1)

            for expert_id in range(self.num_experts):
                mask = (expert_idx == expert_id)
                if mask.any():
                    expert_input = x_flat[mask]
                    expert_output = self.experts[expert_id](expert_input)
                    output[mask] += expert_weight[mask] * expert_output

        return output.view(batch_size, seq_len, input_dim)

# Modern models like GPT-4 and PaLM use MoE for efficiency
