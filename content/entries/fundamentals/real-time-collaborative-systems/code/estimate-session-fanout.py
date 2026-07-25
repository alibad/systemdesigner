from dataclasses import dataclass


@dataclass(frozen=True)
class RoomWorkload:
    active_editors: int
    edits_per_editor_minute: float
    operation_bytes: int
    presence_updates_second: float
    presence_bytes: int


def estimate_room(workload: RoomWorkload, offline_minutes: float) -> dict[str, float]:
    """Return an application-payload envelope, excluding protocol overhead and retries."""
    if workload.active_editors < 2:
        raise ValueError("A collaborative room needs at least two active editors")

    recipients = workload.active_editors - 1
    durable_changes_second = (
        workload.active_editors * workload.edits_per_editor_minute / 60
    )
    durable_egress_second = (
        durable_changes_second * recipients * workload.operation_bytes
    )

    presence_messages_second = (
        workload.active_editors * workload.presence_updates_second
    )
    presence_egress_second = (
        presence_messages_second * recipients * workload.presence_bytes
    )

    # One returning editor missed only the other editors' durable changes.
    catchup_changes = (
        recipients * workload.edits_per_editor_minute * offline_minutes
    )
    raw_catchup_bytes = catchup_changes * workload.operation_bytes

    return {
        "durable_changes_second": durable_changes_second,
        "durable_egress_second": durable_egress_second,
        "presence_egress_second": presence_egress_second,
        "total_egress_second": durable_egress_second + presence_egress_second,
        "catchup_changes": catchup_changes,
        "raw_catchup_bytes": raw_catchup_bytes,
    }


if __name__ == "__main__":
    workload = RoomWorkload(
        active_editors=18,
        edits_per_editor_minute=16,
        operation_bytes=420,
        presence_updates_second=4,
        presence_bytes=128,
    )
    print(estimate_room(workload, offline_minutes=5))
