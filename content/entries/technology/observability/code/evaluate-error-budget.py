"""Evaluate a two-window error-budget burn alert with no external packages."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Window:
    name: str
    requests: int
    failures: int
    threshold: float

    def burn_rate(self, allowed_error_fraction: float) -> float:
        observed_error_fraction = self.failures / self.requests
        return observed_error_fraction / allowed_error_fraction


def evaluate(slo_target: float, windows: list[Window]) -> None:
    allowed_error_fraction = 1 - slo_target
    decisions: list[bool] = []

    print(f"SLO target: {slo_target:.3%}")
    print(f"Allowed error fraction: {allowed_error_fraction:.3%}")

    for window in windows:
        burn = window.burn_rate(allowed_error_fraction)
        firing = burn >= window.threshold
        decisions.append(firing)
        print(
            f"{window.name}: {window.failures}/{window.requests} failures, "
            f"burn={burn:.1f}x, threshold={window.threshold:.1f}x, "
            f"firing={firing}"
        )

    page = all(decisions)
    print(f"Page on-call: {page}")


if __name__ == "__main__":
    evaluate(
        slo_target=0.999,
        windows=[
            Window(name="5 minute", requests=120_000, failures=2_100, threshold=14.4),
            Window(name="1 hour", requests=1_400_000, failures=11_200, threshold=6.0),
        ],
    )
