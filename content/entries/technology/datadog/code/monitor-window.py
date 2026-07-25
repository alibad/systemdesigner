"""Small monitor-window model for delayed and sparse metric streams."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Stream:
    report_interval_seconds: int
    ingestion_delay_seconds: int


def arrived_points(stream: Stream, window_seconds: int, evaluation_delay_seconds: int) -> int:
    """Count generated points that are both inside the query window and already arrived."""
    oldest_age = evaluation_delay_seconds + window_seconds
    points = 0
    for age in range(stream.report_interval_seconds, oldest_age + 1, stream.report_interval_seconds):
        inside_window = evaluation_delay_seconds < age <= oldest_age
        already_arrived = age >= stream.ingestion_delay_seconds
        if inside_window and already_arrived:
            points += 1
    return points


if __name__ == "__main__":
    cloud_metric = Stream(report_interval_seconds=300, ingestion_delay_seconds=600)
    no_delay = arrived_points(cloud_metric, window_seconds=300, evaluation_delay_seconds=0)
    delayed = arrived_points(cloud_metric, window_seconds=300, evaluation_delay_seconds=600)

    assert no_delay == 0
    assert delayed == 1
    print({"evaluate_now": no_delay, "delay_10_minutes": delayed})
