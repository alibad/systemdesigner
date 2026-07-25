"""A small, auditable decoding and grounding boundary.

The numbers below are synthetic evidence for a worked example. They are not
benchmark scores or calibrated probabilities of truth.
"""

from dataclasses import dataclass
from typing import Iterable, Literal

DecodeMode = Literal["greedy", "beam", "nucleus"]


@dataclass(frozen=True)
class Evidence:
    evidence_id: str
    confidence: float


@dataclass(frozen=True)
class Claim:
    phrase: str
    evidence_id: str


@dataclass(frozen=True)
class Candidate:
    caption: str
    decoder_confidence: float
    probability_mass: float
    claims: tuple[Claim, ...]


def choose_candidate(
    candidates: list[Candidate],
    mode: DecodeMode,
    *,
    beam_width: int = 1,
    top_p: float = 0.9,
    sample_index: int = 0,
) -> Candidate:
    """Choose wording using model-side signals only."""
    ranked = sorted(candidates, key=lambda item: item.decoder_confidence, reverse=True)

    if mode == "greedy":
        return ranked[0]

    if mode == "beam":
        beam = ranked[: max(1, beam_width)]
        # A real reranker can use task-specific features. It still does not
        # authorize factual claims; that happens in release_claims().
        return max(beam, key=lambda item: (len(item.claims), item.decoder_confidence))

    nucleus: list[Candidate] = []
    cumulative_mass = 0.0
    for candidate in sorted(candidates, key=lambda item: item.probability_mass, reverse=True):
        nucleus.append(candidate)
        cumulative_mass += candidate.probability_mass
        if cumulative_mass >= top_p:
            break
    return nucleus[sample_index % len(nucleus)]


def release_claims(
    candidate: Candidate,
    evidence: Iterable[Evidence],
    *,
    minimum_evidence: float,
) -> tuple[list[Claim], list[Claim]]:
    """Apply the factual release boundary after decoding."""
    evidence_by_id = {item.evidence_id: item for item in evidence}
    released: list[Claim] = []
    blocked: list[Claim] = []

    for claim in candidate.claims:
        record = evidence_by_id.get(claim.evidence_id)
        if record is not None and record.confidence >= minimum_evidence:
            released.append(claim)
        else:
            blocked.append(claim)

    return released, blocked


# A high decoder preference does not rescue a weak visual claim.
example = Candidate(
    caption="A cyclist rides a bicycle past a dog.",
    decoder_confidence=0.83,
    probability_mass=0.11,
    claims=(
        Claim("a cyclist", "cyclist"),
        Claim("a bicycle", "bicycle"),
        Claim("a dog", "dog"),
    ),
)
released, blocked = release_claims(
    example,
    [
        Evidence("cyclist", 0.96),
        Evidence("bicycle", 0.98),
        Evidence("dog", 0.18),
    ],
    minimum_evidence=0.70,
)
assert [claim.phrase for claim in blocked] == ["a dog"]
