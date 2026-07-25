"""Inspect one pinned tokenizer contract without assuming vendor-equivalent output."""

import os
from transformers import AutoTokenizer

MODEL_ID = "bert-base-multilingual-cased"
REVISION = os.environ["TOKENIZER_REVISION"]

tokenizer = AutoTokenizer.from_pretrained(
    MODEL_ID,
    revision=REVISION,
    use_fast=True,
)

text = "Cafe\u0301 costs \u20ac5"
encoded = tokenizer(
    text,
    add_special_tokens=True,
    return_offsets_mapping=True,
    return_special_tokens_mask=True,
    truncation=False,
)

for token_id, offset, is_special in zip(
    encoded["input_ids"],
    encoded["offset_mapping"],
    encoded["special_tokens_mask"],
    strict=True,
):
    print(
        {
            "id": token_id,
            "piece": tokenizer.convert_ids_to_tokens(token_id),
            "offset": offset,
            "special": bool(is_special),
        }
    )

print("special_tokens", tokenizer.special_tokens_map)
print("model_inputs", tokenizer.model_input_names)
