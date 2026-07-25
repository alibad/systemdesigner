import torch
import pandas as pd
from torch.utils.data import Dataset, DataLoader
from typing import Iterator, List, Dict
import numpy as np
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

class BatchDataset(Dataset):
    def __init__(self, data_path: str, transform=None):
        """Dataset for batch inference"""
        self.data = pd.read_parquet(data_path)
        self.transform = transform

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        row = self.data.iloc[idx]

        # Convert to tensor
        features = torch.tensor(row.values[:-1], dtype=torch.float32)

        if self.transform:
            features = self.transform(features)

        return {
            'features': features,
            'id': row.name,  # Use index as ID
            'metadata': row.to_dict()
        }

class BatchInferenceEngine:
    def __init__(self, model_path: str, batch_size: int = 256, num_workers: int = 4):
        self.model = torch.jit.load(model_path)
        self.model.eval()
        self.batch_size = batch_size
        self.num_workers = num_workers

        # Move to GPU if available
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model.to(self.device)

        # Enable optimizations
        if torch.cuda.is_available():
            torch.backends.cudnn.benchmark = True

    def process_batch_file(self, input_path: str, output_path: str) -> Dict:
        """Process a single batch file"""

        # Create dataset and dataloader
        dataset = BatchDataset(input_path)
        dataloader = DataLoader(
            dataset,
            batch_size=self.batch_size,
            shuffle=False,
            num_workers=self.num_workers,
            pin_memory=True
        )

        results = []
        total_processed = 0

        with torch.no_grad():
            for batch in dataloader:
                features = batch['features'].to(self.device)
                ids = batch['id']

                # Inference
                logits = self.model(features)
                probabilities = torch.softmax(logits, dim=1)
                predictions = torch.argmax(probabilities, dim=1)

                # Collect results
                batch_results = []
                for i in range(len(ids)):
                    result = {
                        'id': ids[i].item(),
                        'prediction': predictions[i].item(),
                        'confidence': torch.max(probabilities[i]).item(),
                        'all_probabilities': probabilities[i].cpu().numpy().tolist()
                    }
                    batch_results.append(result)

                results.extend(batch_results)
                total_processed += len(batch_results)

        # Save results
        results_df = pd.DataFrame(results)
        results_df.to_parquet(output_path, index=False)

        return {
            'total_processed': total_processed,
            'output_path': output_path,
            'avg_confidence': results_df['confidence'].mean()
        }

    def process_directory(self, input_dir: str, output_dir: str,
                         max_workers: int = 8) -> List[Dict]:
        """Process multiple files in parallel"""

        input_path = Path(input_dir)
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)

        # Find all parquet files
        input_files = list(input_path.glob("*.parquet"))

        def process_file(input_file):
            output_file = output_path / f"predictions_{input_file.name}"
            return self.process_batch_file(str(input_file), str(output_file))

        # Process files in parallel
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            results = list(executor.map(process_file, input_files))

        # Aggregate results
        total_processed = sum(r['total_processed'] for r in results)
        avg_confidence = np.mean([r['avg_confidence'] for r in results])

        summary = {
            'files_processed': len(input_files),
            'total_samples': total_processed,
            'average_confidence': avg_confidence,
            'individual_results': results
        }

        return summary

# Distributed batch processing with Ray
import ray

@ray.remote
class DistributedBatchProcessor:
    def __init__(self, model_path: str):
        self.engine = BatchInferenceEngine(model_path)

    def process_partition(self, file_path: str, output_path: str):
        return self.engine.process_batch_file(file_path, output_path)

def distributed_batch_inference(input_files: List[str], output_dir: str,
                               model_path: str, num_workers: int = 4):
    """Scale batch inference across multiple nodes"""

    ray.init()

    # Create remote workers
    workers = [
        DistributedBatchProcessor.remote(model_path)
        for _ in range(num_workers)
    ]

    # Distribute work
    futures = []
    for i, input_file in enumerate(input_files):
        worker = workers[i % num_workers]
        output_file = f"{output_dir}/predictions_{i}.parquet"
        future = worker.process_partition.remote(input_file, output_file)
        futures.append(future)

    # Collect results
    results = ray.get(futures)

    ray.shutdown()
    return results
