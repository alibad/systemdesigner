import json


PREDICTIONS = [
    {"id": "p1", "predicted": 1},
    {"id": "p2", "predicted": 0},
    {"id": "p3", "predicted": 1},
    {"id": "p4", "predicted": 1},
    {"id": "p5", "predicted": 0},
]
OUTCOMES = {"p1": 1, "p2": 1, "p3": 0, "p4": 1}


def evaluate_window(predictions, outcomes, minimum_coverage=0.8):
    joined = [row for row in predictions if row["id"] in outcomes]
    coverage = len(joined) / len(predictions) if predictions else 0.0

    if coverage < minimum_coverage:
        return {
            "status": "labels_pending",
            "label_coverage": coverage,
            "action": "wait_for_mature_outcomes",
        }

    correct = sum(
        row["predicted"] == outcomes[row["id"]]
        for row in joined
    )
    accuracy = correct / len(joined)
    false_negatives = sum(
        row["predicted"] == 0 and outcomes[row["id"]] == 1
        for row in joined
    )

    return {
        "status": "guardrail_breached" if false_negatives > 0 else "measured",
        "label_coverage": coverage,
        "accuracy_on_labeled_rows": accuracy,
        "false_negatives": false_negatives,
        "action": "reduce_exposure" if false_negatives > 0 else "continue_monitoring",
    }


result = evaluate_window(PREDICTIONS, OUTCOMES)
assert result["label_coverage"] == 0.8
assert result["accuracy_on_labeled_rows"] == 0.5
assert result["action"] == "reduce_exposure"
print(json.dumps(result, indent=2, sort_keys=True))
