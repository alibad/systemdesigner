batch = []
memory_budget = worker.available_kv_memory()
batch_deadline = clock.now() + MAX_BATCH_WAIT

while len(batch) < MAX_BATCH_SIZE and clock.now() < batch_deadline:
    request = queue.pop_compatible(
        model_revision=worker.model_revision,
        tier=worker.tier,
        fairness_key="conversation_id",
    )
    if request is None:
        break

    required_memory = estimate_kv_memory(request)
    if required_memory > memory_budget:
        queue.defer(request)
        break

    batch.append(request)
    memory_budget -= required_memory

worker.decode_one_step(batch)
