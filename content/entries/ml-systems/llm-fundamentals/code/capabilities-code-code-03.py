# In-context learning examples
def few_shot_classification(examples, query):
    """Classify using examples in the prompt"""

    prompt = "Classify the sentiment of these movie reviews:\n\n"

    # Add examples
    for text, label in examples:
        prompt += f"Review: {text}\nSentiment: {label}\n\n"

    # Add query
    prompt += f"Review: {query}\nSentiment:"

    return prompt

# Example usage
examples = [
    ("This movie was amazing! Great acting and plot.", "positive"),
    ("Terrible film, waste of time.", "negative"),
    ("It was okay, nothing special.", "neutral")
]

query = "I loved every minute of this incredible movie!"
prompt = few_shot_classification(examples, query)

def instruction_following():
    """Learn to follow instructions from examples"""

    prompt = """
Follow the pattern in these examples:

Input: "apple"
Instruction: "make it plural"
Output: "apples"

Input: "running"
Instruction: "make it past tense"
Output: "ran"

Input: "happy"
Instruction: "make it opposite"
Output: "sad"

Input: "dog"
Instruction: "make it plural"
Output:
"""
    return prompt

# Emergent abilities in large models
class ICLCapabilities:
    """In-context learning capabilities that emerge at scale"""

    def __init__(self, model_size):
        self.model_size = model_size

        # Capabilities emerge at different scales
        self.capabilities = {
            "few_shot_learning": model_size > 1e9,      # 1B+ parameters
            "chain_of_thought": model_size > 10e9,      # 10B+ parameters
            "code_generation": model_size > 10e9,       # 10B+ parameters
            "mathematical_reasoning": model_size > 100e9, # 100B+ parameters
            "complex_instruction_following": model_size > 100e9
        }

    def can_perform(self, task):
        return self.capabilities.get(task, False)

# Prompt engineering for better ICL
def optimized_prompt_structure(task_description, examples, query):
    """Structure prompts for optimal in-context learning"""

    prompt = f"""
Task: {task_description}

Examples:
"""

    # Add examples with clear formatting
    for i, (input_text, output_text) in enumerate(examples, 1):
        prompt += f"Example {i}:\nInput: {input_text}\nOutput: {output_text}\n\n"

    # Clear separation before query
    prompt += f"Now solve:\nInput: {query}\nOutput:"

    return prompt
