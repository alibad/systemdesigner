from dataclasses import dataclass


@dataclass(frozen=True)
class RequestBudget:
    request_id: str
    deadline_ms: float
    network_ms: float
    context_ms: float
    queue_ms: float
    inference_ms: float
    gate_ms: float

    @property
    def total_ms(self) -> float:
        return (
            self.network_ms
            + self.context_ms
            + self.queue_ms
            + self.inference_ms
            + self.gate_ms
        )


def serve_or_abstain(request: RequestBudget, active_request_id: str) -> str:
    if request.request_id != active_request_id:
        return "discard: the user typed again and this request is stale"
    if request.total_ms > request.deadline_ms:
        return f"discard: {request.total_ms:.1f} ms exceeded the deadline"
    return f"eligible: {request.total_ms:.1f} ms left the client time to render"


if __name__ == "__main__":
    request = RequestBudget(
        request_id="compose-1842-v7",
        deadline_ms=60,
        network_ms=11,
        context_ms=7,
        queue_ms=4,
        inference_ms=25,
        gate_ms=5,
    )

    print(serve_or_abstain(request, active_request_id="compose-1842-v7"))
    print(serve_or_abstain(request, active_request_id="compose-1842-v8"))
