from dataclasses import dataclass


@dataclass(frozen=True)
class RequestContract:
    payload_mb: float
    processing_seconds: int
    synchronous: bool
    finite_dataset: bool


def eligible_modes(contract: RequestContract) -> list[str]:
    modes: list[str] = []
    if contract.finite_dataset:
        modes.append("batch-transform")
    if contract.synchronous and contract.payload_mb <= 25 and contract.processing_seconds <= 60:
        modes.append("real-time")
    if contract.synchronous and contract.payload_mb <= 4 and contract.processing_seconds <= 60:
        modes.append("serverless")
    if not contract.synchronous and contract.payload_mb <= 1024 and contract.processing_seconds <= 3600:
        modes.append("asynchronous")
    return modes


document = RequestContract(
    payload_mb=250,
    processing_seconds=15 * 60,
    synchronous=False,
    finite_dataset=False,
)
assert eligible_modes(document) == ["asynchronous"]
