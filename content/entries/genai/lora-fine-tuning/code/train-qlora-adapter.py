"""Build an explicit QLoRA model with Transformers and PEFT."""

import os
import torch
from peft import LoraConfig, prepare_model_for_kbit_training, get_peft_model
from transformers import AutoModelForCausalLM, BitsAndBytesConfig


def build_qlora_model(model_id: str, revision: str):
    quantization = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=torch.bfloat16,
    )
    base = AutoModelForCausalLM.from_pretrained(
        model_id,
        revision=revision,
        quantization_config=quantization,
        torch_dtype=torch.bfloat16,
    )
    base = prepare_model_for_kbit_training(
        base,
        use_gradient_checkpointing=True,
    )

    recipe = LoraConfig(
        task_type="CAUSAL_LM",
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
        bias="none",
    )
    model = get_peft_model(base, recipe)
    model.print_trainable_parameters()
    return model


if __name__ == "__main__":
    # Supply an immutable commit hash through deployment configuration.
    model = build_qlora_model(
        model_id=os.environ["BASE_MODEL_ID"],
        revision=os.environ["BASE_MODEL_REVISION"],
    )
