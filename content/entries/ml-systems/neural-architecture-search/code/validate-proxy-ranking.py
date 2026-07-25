from statistics import mean


def pairwise_rank_agreement(proxy: list[float], full: list[float]) -> float:
    if len(proxy) != len(full) or len(proxy) < 2:
        raise ValueError("proxy and full scores need the same length of at least two")
    agreements = []
    for left in range(len(proxy)):
        for right in range(left + 1, len(proxy)):
            proxy_order = proxy[left] > proxy[right]
            full_order = full[left] > full[right]
            agreements.append(proxy_order == full_order)
    return mean(agreements)


if __name__ == "__main__":
    proxy_scores = [0.82, 0.79, 0.84, 0.76, 0.81]
    full_scores = [0.85, 0.80, 0.83, 0.77, 0.82]
    agreement = pairwise_rank_agreement(proxy_scores, full_scores)
    assert agreement == 0.9
    print(f"pairwise proxy agreement: {agreement:.0%}")
