# Text generation with different strategies
import torch
import torch.nn.functional as F

def greedy_decode(model, input_ids, max_length=100):
    """Generate text using greedy decoding"""
    generated = input_ids.clone()

    for _ in range(max_length):
        with torch.no_grad():
            outputs = model(generated)
            logits = outputs[:, -1, :]  # Last token logits
            next_token = torch.argmax(logits, dim=-1, keepdim=True)
            generated = torch.cat([generated, next_token], dim=1)

            # Stop if EOS token
            if next_token.item() == tokenizer.eos_token_id:
                break

    return generated

def nucleus_sampling(model, input_ids, max_length=100, top_p=0.9, temperature=1.0):
    """Generate text using nucleus (top-p) sampling"""
    generated = input_ids.clone()

    for _ in range(max_length):
        with torch.no_grad():
            outputs = model(generated)
            logits = outputs[:, -1, :] / temperature

            # Apply nucleus sampling
            sorted_logits, sorted_indices = torch.sort(logits, descending=True)
            cumulative_probs = torch.cumsum(F.softmax(sorted_logits, dim=-1), dim=-1)

            # Remove tokens with cumulative probability above threshold
            sorted_indices_to_remove = cumulative_probs > top_p
            sorted_indices_to_remove[..., 1:] = sorted_indices_to_remove[..., :-1].clone()
            sorted_indices_to_remove[..., 0] = 0

            indices_to_remove = sorted_indices_to_remove.scatter(1, sorted_indices, sorted_indices_to_remove)
            logits[indices_to_remove] = -float('inf')

            # Sample from the filtered distribution
            probs = F.softmax(logits, dim=-1)
            next_token = torch.multinomial(probs, num_samples=1)
            generated = torch.cat([generated, next_token], dim=1)

    return generated

# Advanced generation techniques:
# - Beam search: Maintain multiple hypotheses
# - Contrastive search: Balance coherence and diversity
# - Typical sampling: Sample from "typical" probability mass
