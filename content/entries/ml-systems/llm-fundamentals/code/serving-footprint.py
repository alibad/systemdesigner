def estimated_kv_cache_gb(
    concurrent_sequences: int,
    sequence_length: int,
    layers: int,
    hidden_size: int,
    bytes_per_cache_value: int,
) -> float:
    # Keys and values are cached for every retained token in every active sequence.
    cache_bytes = (
        concurrent_sequences
        * sequence_length
        * layers
        * hidden_size
        * 2
        * bytes_per_cache_value
    )
    return cache_bytes / 1_000_000_000


def planning_snapshot(
    stored_parameters_billions: float,
    active_parameters_billions: float,
    weight_bytes: int,
    kv_cache_gb: float,
) -> dict[str, float]:
    weight_memory_gb = stored_parameters_billions * weight_bytes
    active_compute_index = active_parameters_billions
    return {
        "weight_memory_gb": weight_memory_gb,
        "kv_cache_gb": kv_cache_gb,
        "active_compute_index": active_compute_index,
    }


# A sparse MoE path can lower active_parameters_billions, but the server still needs
# enough memory and placement bandwidth for all stored experts and their router.
