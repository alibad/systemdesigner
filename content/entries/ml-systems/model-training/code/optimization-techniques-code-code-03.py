import torch
import torchvision.transforms as transforms
import numpy as np

# Image Data Augmentation
def get_augmentation_pipeline():
    train_transform = transforms.Compose([
        # Geometric transformations
        transforms.RandomResizedCrop(224, scale=(0.8, 1.0)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomRotation(degrees=15),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.1),

        # Normalization
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    return train_transform

# Mixup Augmentation
def mixup_data(x, y, alpha=1.0):
    """Mixup augmentation for improved generalization"""
    if alpha > 0:
        lam = np.random.beta(alpha, alpha)
    else:
        lam = 1

    batch_size = x.size(0)
    index = torch.randperm(batch_size)

    mixed_x = lam * x + (1 - lam) * x[index, :]
    y_a, y_b = y, y[index]

    return mixed_x, y_a, y_b, lam

def mixup_criterion(criterion, pred, y_a, y_b, lam):
    """Loss function for mixup"""
    return lam * criterion(pred, y_a) + (1 - lam) * criterion(pred, y_b)

# Training with Mixup
def train_with_mixup(model, train_loader, config):
    model.train()
    criterion = nn.CrossEntropyLoss()

    for batch_idx, (data, target) in enumerate(train_loader):
        data, target = data.cuda(), target.cuda()

        # Apply mixup
        mixed_data, y_a, y_b, lam = mixup_data(data, target, alpha=config.mixup_alpha)

        optimizer.zero_grad()
        output = model(mixed_data)

        # Compute mixup loss
        loss = mixup_criterion(criterion, output, y_a, y_b, lam)

        loss.backward()
        optimizer.step()

# Text Augmentation
def text_augmentation_examples():
    import nlpaug.augmenter.word as naw

    # Synonym replacement
    aug_synonym = naw.SynonymAug(aug_src='wordnet')

    # Random word insertion
    aug_insert = naw.ContextualWordEmbsAug(
        model_path='bert-base-uncased',
        action="insert"
    )

    # Back translation
    aug_back_trans = naw.BackTranslationAug(
        from_model_name='facebook/wmt19-en-de',
        to_model_name='facebook/wmt19-de-en'
    )

    original_text = "The movie was fantastic and entertaining."

    augmented_texts = [
        aug_synonym.augment(original_text),
        aug_insert.augment(original_text),
        aug_back_trans.augment(original_text)
    ]

    return augmented_texts
