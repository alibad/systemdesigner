from datasets import load_dataset

# Load any dataset easily
dataset = load_dataset("c4", "en", streaming=True)
for example in dataset['train'].take(5):
    print(example['text'][:100])
