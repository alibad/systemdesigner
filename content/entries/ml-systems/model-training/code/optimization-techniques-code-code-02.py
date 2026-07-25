import torch
import torch.nn as nn

class RegularizedModel(nn.Module):
    def __init__(self, input_size, hidden_size, num_classes, dropout_rate=0.3):
        super().__init__()

        self.layers = nn.Sequential(
            # First layer with batch norm and dropout
            nn.Linear(input_size, hidden_size),
            nn.BatchNorm1d(hidden_size),
            nn.ReLU(),
            nn.Dropout(dropout_rate),

            # Second layer
            nn.Linear(hidden_size, hidden_size // 2),
            nn.BatchNorm1d(hidden_size // 2),
            nn.ReLU(),
            nn.Dropout(dropout_rate),

            # Output layer
            nn.Linear(hidden_size // 2, num_classes)
        )

    def forward(self, x):
        return self.layers(x)

# Training with regularization
def train_with_regularization(model, train_loader, val_loader, config):
    # L2 regularization through weight decay
    optimizer = torch.optim.Adam(
        model.parameters(),
        lr=config.lr,
        weight_decay=config.l2_lambda  # L2 regularization
    )

    criterion = nn.CrossEntropyLoss()
    best_val_loss = float('inf')
    patience = config.early_stopping_patience
    patience_counter = 0

    for epoch in range(config.max_epochs):
        # Training
        model.train()
        train_loss = 0

        for batch_idx, (data, target) in enumerate(train_loader):
            optimizer.zero_grad()

            output = model(data)
            loss = criterion(output, target)

            # L1 regularization (optional)
            if config.l1_lambda > 0:
                l1_penalty = sum(param.abs().sum() for param in model.parameters())
                loss += config.l1_lambda * l1_penalty

            loss.backward()
            optimizer.step()
            train_loss += loss.item()

        # Validation
        model.eval()
        val_loss = 0
        with torch.no_grad():
            for data, target in val_loader:
                output = model(data)
                val_loss += criterion(output, target).item()

        val_loss /= len(val_loader)

        # Early stopping
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            patience_counter = 0
            # Save best model
            torch.save(model.state_dict(), 'best_model.pth')
        else:
            patience_counter += 1

        if patience_counter >= patience:
            print(f"Early stopping at epoch {epoch}")
            break

    # Load best model
    model.load_state_dict(torch.load('best_model.pth'))
    return model
