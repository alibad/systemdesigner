from dataclasses import dataclass, field


@dataclass
class WorkflowLedger:
    claims: dict[str, str] = field(default_factory=dict)

    def claim(self, event_id: str, workflow_id: str) -> tuple[str, bool]:
        existing = self.claims.get(event_id)
        if existing:
            return existing, False
        self.claims[event_id] = workflow_id
        return workflow_id, True


if __name__ == "__main__":
    ledger = WorkflowLedger()
    print(ledger.claim("dataset:v42", "training:018"))
    print(ledger.claim("dataset:v42", "training:duplicate"))
