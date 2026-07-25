"""Build ordered NLP batches under a token ceiling using only the standard library."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Request:
    request_id: str
    input_tokens: int
    output_budget: int = 0

    @property
    def scheduled_tokens(self) -> int:
        return self.input_tokens + self.output_budget


def build_batch(pending: list[Request], max_scheduled_tokens: int) -> tuple[list[Request], list[Request]]:
    """Admit an ordered prefix without exceeding the scheduler's token budget."""
    if max_scheduled_tokens <= 0:
        raise ValueError("max_scheduled_tokens must be positive")

    admitted: list[Request] = []
    used_tokens = 0

    for request in pending:
        if request.scheduled_tokens > max_scheduled_tokens:
            raise ValueError(f"{request.request_id} cannot fit in any batch")
        if used_tokens + request.scheduled_tokens > max_scheduled_tokens:
            break
        admitted.append(request)
        used_tokens += request.scheduled_tokens

    return admitted, pending[len(admitted) :]


def main() -> None:
    pending = [
        Request("short-classification", input_tokens=96),
        Request("support-summary", input_tokens=900, output_budget=180),
        Request("long-document", input_tokens=900, output_budget=300),
        Request("search-query", input_tokens=48),
    ]
    max_scheduled_tokens = 2_048

    first_batch, remaining = build_batch(pending, max_scheduled_tokens)
    scheduled = sum(request.scheduled_tokens for request in first_batch)

    assert [request.request_id for request in first_batch] == [
        "short-classification",
        "support-summary",
    ]
    assert scheduled <= max_scheduled_tokens
    assert remaining[0].request_id == "long-document"

    print(f"batch requests: {[request.request_id for request in first_batch]}")
    print(f"scheduled tokens: {scheduled}/{max_scheduled_tokens}")
    print(f"deferred requests: {[request.request_id for request in remaining]}")


if __name__ == "__main__":
    main()
