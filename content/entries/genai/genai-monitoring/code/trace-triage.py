"""Rank production slices and select a representative trace for investigation."""

from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class SliceWindow:
    name: str
    requests: int
    baseline_success_pct: float
    current_success_pct: float
    trace_ids: tuple[str, ...]

    @property
    def delta_points(self) -> float:
        return self.current_success_pct - self.baseline_success_pct


@dataclass(frozen=True)
class TraceEvidence:
    trace_id: str
    slice_name: str
    model_version: str
    prompt_version: str
    corpus_version: str
    retrieval_hits: int
    grounded: bool
    latency_ms: int


def rank_slices(
    windows: Iterable[SliceWindow],
    minimum_requests: int = 50,
) -> list[SliceWindow]:
    """Return adequately sampled slices from largest to smallest regression."""
    eligible = [window for window in windows if window.requests >= minimum_requests]
    return sorted(eligible, key=lambda window: window.delta_points)


def choose_trace(
    affected_slice: SliceWindow,
    traces: Iterable[TraceEvidence],
) -> TraceEvidence:
    """Prefer an ungrounded trace from the affected slice for first inspection."""
    candidates = [
        trace
        for trace in traces
        if trace.slice_name == affected_slice.name
        and trace.trace_id in affected_slice.trace_ids
    ]
    if not candidates:
        raise ValueError(f"no trace evidence for {affected_slice.name}")
    return sorted(candidates, key=lambda trace: (trace.grounded, -trace.latency_ms))[0]


def attribution_hint(trace: TraceEvidence, healthy_peer: TraceEvidence) -> str:
    """Identify the first version boundary that differs from a healthy peer."""
    comparisons = (
        ("prompt", trace.prompt_version, healthy_peer.prompt_version),
        ("retrieval corpus", trace.corpus_version, healthy_peer.corpus_version),
        ("model", trace.model_version, healthy_peer.model_version),
    )
    changed = [name for name, failed, healthy in comparisons if failed != healthy]
    if not changed:
        return "No version boundary differs; inspect inputs, dependencies, and labels."
    return f"Investigate changed boundary: {', '.join(changed)}."


if __name__ == "__main__":
    slices = [
        SliceWindow("English support", 920, 93.0, 92.4, ("tr-101",)),
        SliceWindow("French billing", 84, 91.0, 68.0, ("tr-204", "tr-205")),
        SliceWindow("German returns", 37, 90.0, 60.0, ("tr-309",)),
    ]
    traces = [
        TraceEvidence("tr-101", "English support", "model-7", "prompt-18", "kb-42", 4, True, 1480),
        TraceEvidence("tr-204", "French billing", "model-7", "prompt-19", "kb-41", 0, False, 2210),
        TraceEvidence("tr-205", "French billing", "model-7", "prompt-19", "kb-41", 1, False, 1940),
    ]

    affected = rank_slices(slices)[0]
    representative = choose_trace(affected, traces)
    healthy = traces[0]
    print(f"affected_slice={affected.name!r} delta={affected.delta_points:.1f}pp")
    print(f"representative_trace={representative.trace_id}")
    print(attribution_hint(representative, healthy))
