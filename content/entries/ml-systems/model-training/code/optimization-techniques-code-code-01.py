import optuna
from sklearn.model_selection import cross_val_score

def bayesian_optimization_example():
    def objective(trial):
        # Define hyperparameter search space
        lr = trial.suggest_float('learning_rate', 1e-5, 1e-1, log=True)
        batch_size = trial.suggest_categorical('batch_size', [16, 32, 64, 128])
        dropout = trial.suggest_float('dropout', 0.1, 0.5)
        hidden_size = trial.suggest_int('hidden_size', 64, 512)

        # Build and train model with these hyperparameters
        model = create_model(hidden_size=hidden_size, dropout=dropout)

        # Train and evaluate
        train_model(model, lr=lr, batch_size=batch_size)
        val_accuracy = evaluate_model(model, val_loader)

        return val_accuracy

    # Create study and optimize
    study = optuna.create_study(direction='maximize')
    study.optimize(objective, n_trials=100)

    print(f"Best hyperparameters: {study.best_params}")
    print(f"Best accuracy: {study.best_value}")

    return study.best_params
