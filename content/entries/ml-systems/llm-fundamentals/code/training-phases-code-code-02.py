# Fine-tuning for specific tasks
import torch
import torch.nn as nn

class TaskHead(nn.Module):
    """Task-specific head added to pre-trained model"""
    def __init__(self, hidden_size, num_classes):
        super().__init__()
        self.classifier = nn.Linear(hidden_size, num_classes)
        self.dropout = nn.Dropout(0.1)

    def forward(self, hidden_states):
        pooled_output = hidden_states[:, 0]  # Use [CLS] token
        pooled_output = self.dropout(pooled_output)
        logits = self.classifier(pooled_output)
        return logits

def fine_tune_for_classification(pretrained_model, num_classes):
    """Fine-tune for text classification"""

    # Add task-specific head
    task_head = TaskHead(pretrained_model.config.hidden_size, num_classes)

    # Combine base model + task head
    class FineTunedModel(nn.Module):
        def __init__(self, base_model, head):
            super().__init__()
            self.base_model = base_model
            self.head = head

        def forward(self, input_ids, labels=None):
            outputs = self.base_model(input_ids)
            hidden_states = outputs.last_hidden_state
            logits = self.head(hidden_states)

            if labels is not None:
                loss = F.cross_entropy(logits, labels)
                return loss, logits
            return logits

    return FineTunedModel(pretrained_model, task_head)

# Fine-tuning strategies:
# 1. Full fine-tuning: Update all parameters
# 2. Parameter-efficient: LoRA, adapters, prompt tuning
# 3. In-context learning: No parameter updates

# Example: Fine-tuning with LoRA (Low-Rank Adaptation)
class LoRALayer(nn.Module):
    def __init__(self, in_features, out_features, rank=16, alpha=32):
        super().__init__()
        self.rank = rank
        self.alpha = alpha

        # Low-rank matrices
        self.lora_A = nn.Parameter(torch.randn(in_features, rank) * 0.01)
        self.lora_B = nn.Parameter(torch.zeros(rank, out_features))

    def forward(self, x):
        # LoRA: W + (alpha/rank) * A @ B
        lora_output = (self.alpha / self.rank) * (x @ self.lora_A @ self.lora_B)
        return lora_output
