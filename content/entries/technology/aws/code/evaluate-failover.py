from dataclasses import dataclass


@dataclass(frozen=True)
class RecoveryEvidence:
    healthy_targets: int
    replica_lag_seconds: int
    last_game_day_days: int
    restore_tested: bool


def can_fail_over(evidence: RecoveryEvidence, max_lag_seconds: int = 30) -> bool:
    return all((
        evidence.healthy_targets > 0,
        evidence.replica_lag_seconds <= max_lag_seconds,
        evidence.last_game_day_days <= 90,
        evidence.restore_tested,
    ))


if __name__ == "__main__":
    evidence = RecoveryEvidence(healthy_targets=4, replica_lag_seconds=12, last_game_day_days=21, restore_tested=True)
    assert can_fail_over(evidence)
    print("failover evidence accepted")
