# Pre-training objective: Predict next token
import torch
import torch.nn.functional as F

def pretraining_loss(model, input_ids):
    """
    Autoregressive language modeling loss
    """
    # Shift inputs: predict token at position i+1 given tokens 0..i
    inputs = input_ids[:, :-1]  # Remove last token
    targets = input_ids[:, 1:]  # Remove first token

    # Forward pass
    logits = model(inputs)  # (batch_size, seq_len, vocab_size)

    # Compute cross-entropy loss
    loss = F.cross_entropy(
        logits.reshape(-1, logits.size(-1)),
        targets.reshape(-1),
        ignore_index=-100  # Ignore padding tokens
    )

    return loss

# Training characteristics:
# - Self-supervised learning (no labels needed)
# - Massive scale (GPT-3: 300B tokens, PaLM: 780B tokens)
# - Emergent capabilities appear at scale
# - Foundation for all downstream tasks

class PreTrainingDataset:
    def __init__(self, tokenizer, block_size=1024):
        self.tokenizer = tokenizer
        self.block_size = block_size

    def tokenize_and_chunk(self, text):
        """Convert text to training examples"""
        tokens = self.tokenizer.encode(text)

        # Create overlapping chunks
        examples = []
        for i in range(0, len(tokens) - self.block_size, self.block_size):
            chunk = tokens[i:i + self.block_size + 1]  # +1 for target
            examples.append(torch.tensor(chunk))

        return examples
