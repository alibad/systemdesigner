# Continual Learning Objective
# Goal: Learn tasks T₁, T₂, ..., Tₖ sequentially

# Traditional ML: Minimize loss on current task only
L_traditional = E[L(f_θ(x), y)] for current task

# Continual Learning: Balance current and previous tasks
L_continual = L_current(θ) + λ * L_retention(θ)

where:
- L_current: Loss on current task
- L_retention: Regularization to prevent forgetting
- λ: Balance hyperparameter

# Knowledge Retention Constraint
# Ensure: |f_θ_new(x_old) - f_θ_old(x_old)| < ε

# Forward Transfer Metric
FWT = (1/T) * Σ(R_i,i - R_i,<i)

# Backward Transfer Metric
BWT = (1/T-1) * Σ(R_T,i - R_i,i)
