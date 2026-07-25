from dataclasses import asdict, dataclass
from random import Random


@dataclass(frozen=True)
class Passage:
    passage_id: str
    text: str
    is_oracle: bool = False


def build_raft_record(
    *,
    question: str,
    answer: str,
    oracle: Passage,
    distractors: list[Passage],
    include_oracle: bool,
    context_size: int = 5,
    seed: int = 0,
) -> dict:
    """Build one auditable RAFT supervised-fine-tuning record."""
    if not oracle.is_oracle:
        raise ValueError("oracle must be labeled as answer-bearing")
    if len(distractors) < context_size:
        raise ValueError("not enough distractors for the requested context")

    rng = Random(seed)
    context = rng.sample(distractors, context_size)
    if include_oracle:
        context[-1] = oracle
        rng.shuffle(context)

    evidence = (
        f'Evidence: "{oracle.text}"\nAnswer: {answer}'
        if include_oracle
        else f"Answer from learned domain knowledge: {answer}"
    )

    return {
        "question": question,
        "documents": [asdict(passage) for passage in context],
        "target": evidence,
        "metadata": {
            "oracle_passage_id": oracle.passage_id,
            "oracle_in_context": include_oracle,
            "context_size": context_size,
            "seed": seed,
        },
    }
