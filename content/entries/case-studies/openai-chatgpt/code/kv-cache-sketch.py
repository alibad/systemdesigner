cache_key = (
    request.conversation_id,
    worker.model_revision,
    hash(request.tokenized_prefix),
)

cached_prefix = kv_cache.get(cache_key)

if cached_prefix is None:
    cached_prefix = worker.prefill(request.tokenized_prefix)
    kv_cache.put(
        cache_key,
        cached_prefix,
        owner_id=request.user_id,
        expires_at=request.cache_deadline,
    )

for token in worker.decode(cached_prefix, max_tokens=request.output_limit):
    if request.is_cancelled():
        break
    request.stream(token)
