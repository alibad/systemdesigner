# Dataset mixing with sampling weights
from torch.utils.data import DataLoader, WeightedRandomSampler

def create_mixed_dataloader(datasets, weights, batch_size):
    """
    Create a dataloader that samples from multiple datasets
    according to specified weights
    """
    # Normalize weights
    weights = np.array(weights) / np.sum(weights)

    # Create sampling probabilities for each example
    dataset_sizes = [len(d) for d in datasets]
    total_size = sum(dataset_sizes)

    # Calculate per-example sampling weight
    example_weights = []
    for dataset_idx, (size, weight) in enumerate(zip(dataset_sizes, weights)):
        # Weight for each example in this dataset
        example_weight = weight * total_size / size
        example_weights.extend([example_weight] * size)

    # Create weighted sampler
    sampler = WeightedRandomSampler(
        weights=example_weights,
        num_samples=total_size,
        replacement=True
    )

    # Concatenate datasets
    combined_dataset = ConcatDataset(datasets)

    return DataLoader(
        combined_dataset,
        batch_size=batch_size,
        sampler=sampler
    )
