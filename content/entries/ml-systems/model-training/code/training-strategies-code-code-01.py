import torch
import torch.nn as nn
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP
from torch.utils.data.distributed import DistributedSampler
import os

class DistributedTrainer:
    def __init__(self, model, train_dataset, val_dataset, config):
        self.config = config
        self.setup_distributed()

        # Move model to GPU and wrap with DDP
        self.model = model.to(self.device)
        self.model = DDP(self.model, device_ids=[self.local_rank])

        # Setup distributed data loaders
        self.train_sampler = DistributedSampler(train_dataset)
        self.train_loader = torch.utils.data.DataLoader(
            train_dataset,
            batch_size=config.batch_size,
            sampler=self.train_sampler,
            num_workers=config.num_workers,
            pin_memory=True
        )

        # Optimizer with scaled learning rate
        self.optimizer = torch.optim.AdamW(
            self.model.parameters(),
            lr=config.learning_rate * self.world_size,  # Scale LR
            weight_decay=config.weight_decay
        )

        self.scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
            self.optimizer, T_max=config.num_epochs
        )

    def setup_distributed(self):
        """Initialize distributed training environment"""
        self.local_rank = int(os.environ.get('LOCAL_RANK', 0))
        self.world_size = int(os.environ.get('WORLD_SIZE', 1))
        self.rank = int(os.environ.get('RANK', 0))

        # Initialize process group
        dist.init_process_group(
            backend='nccl',  # Use NCCL for GPU communication
            init_method='env://',
            world_size=self.world_size,
            rank=self.rank
        )

        # Set device
        torch.cuda.set_device(self.local_rank)
        self.device = torch.device(f'cuda:{self.local_rank}')

    def train_epoch(self, epoch):
        """Train for one epoch with gradient synchronization"""
        self.model.train()
        self.train_sampler.set_epoch(epoch)  # Shuffle data differently each epoch

        total_loss = 0
        num_batches = 0

        for batch_idx, (data, target) in enumerate(self.train_loader):
            data, target = data.to(self.device), target.to(self.device)

            self.optimizer.zero_grad()

            # Forward pass
            output = self.model(data)
            loss = nn.CrossEntropyLoss()(output, target)

            # Backward pass - gradients automatically synchronized
            loss.backward()

            # Gradient clipping
            torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)

            self.optimizer.step()

            total_loss += loss.item()
            num_batches += 1

            if batch_idx % 100 == 0 and self.rank == 0:
                print(f'Epoch {epoch}, Batch {batch_idx}, Loss: {loss.item():.4f}')

        # Average loss across all processes
        avg_loss = total_loss / num_batches
        dist.all_reduce(torch.tensor(avg_loss).to(self.device), op=dist.ReduceOp.AVG)

        return avg_loss

# Launch distributed training
def launch_distributed_training():
    # torchrun --nproc_per_node=4 --nnodes=2 train_script.py
    trainer = DistributedTrainer(model, train_dataset, val_dataset, config)

    for epoch in range(config.num_epochs):
        train_loss = trainer.train_epoch(epoch)

        if trainer.rank == 0:  # Only log on main process
            print(f"Epoch {epoch}: Average Loss = {train_loss:.4f}")
