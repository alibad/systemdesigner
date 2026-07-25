from dataclasses import dataclass
from typing import Literal


TaskFamily = Literal["regression", "classification", "ranking"]


@dataclass(frozen=True)
class PredictionContract:
    unit: str
    target: str
    task_family: TaskFamily
    prediction_time: str
    available_features: tuple[str, ...]
    action: str


def validate_contract(contract: PredictionContract) -> list[str]:
    problems: list[str] = []
    if not contract.unit.strip():
        problems.append("Define one prediction unit.")
    if not contract.target.strip():
        problems.append("Define an observable target.")
    if not contract.available_features:
        problems.append("List features available at prediction time.")
    if not contract.action.strip():
        problems.append("Connect the prediction to a product action.")
    return problems


delivery_contract = PredictionContract(
    unit="one accepted order",
    target="delivery time in minutes",
    task_family="regression",
    prediction_time="when checkout completes",
    available_features=("distance_km", "item_count", "courier_load"),
    action="show an ETA and flag orders that need dispatch attention",
)

problems = validate_contract(delivery_contract)
print("Contract is ready." if not problems else "\n".join(problems))
