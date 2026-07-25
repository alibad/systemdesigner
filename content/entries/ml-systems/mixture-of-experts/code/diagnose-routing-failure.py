"""Select the best mitigation from the lesson's versioned incident model."""

import json
from pathlib import Path


DATA_FILE = Path(__file__).parents[1] / "data" / "routing-failure-scenarios.json"


def load_scenarios() -> dict:
    with DATA_FILE.open(encoding="utf-8") as handle:
        return json.load(handle)


def best_mitigation(incident: dict) -> tuple[str, dict]:
    mitigation_id, outcome = max(
        incident["outcomes"].items(),
        key=lambda item: item[1]["score"],
    )
    return mitigation_id, outcome


def main() -> None:
    data = load_scenarios()
    mitigation_labels = {
        item["id"]: item["label"] for item in data["mitigations"]
    }
    expected = {
        "router-collapse": "router-regularization",
        "network-saturation": "topology-aware-placement",
        "expert-host-loss": "redundant-experts",
    }

    for incident in data["incidents"]:
        mitigation_id, outcome = best_mitigation(incident)
        assert mitigation_id == expected[incident["id"]]
        assert outcome["score"] >= 90
        assert outcome["droppedTokensPct"] <= 0.1
        print(f"{incident['label']}: {mitigation_labels[mitigation_id]}")


if __name__ == "__main__":
    main()
