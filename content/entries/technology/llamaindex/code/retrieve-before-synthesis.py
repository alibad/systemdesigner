"""Keep retrieval observable before asking an LLM to synthesize an answer."""

from llama_index.core import QueryBundle, VectorStoreIndex
from llama_index.core.postprocessor import SimilarityPostprocessor
from llama_index.core.vector_stores import ExactMatchFilter, MetadataFilters


def retrieve_current_eu_policy(index: VectorStoreIndex, question: str):
    filters = MetadataFilters(
        filters=[
            ExactMatchFilter(key="region", value="eu"),
            ExactMatchFilter(key="policy_version", value="2026-07"),
        ]
    )
    retriever = index.as_retriever(similarity_top_k=8, filters=filters)
    candidates = retriever.retrieve(question)

    # A postprocessor can reject weak candidates before response synthesis.
    threshold = SimilarityPostprocessor(similarity_cutoff=0.72)
    evidence = threshold.postprocess_nodes(
        candidates,
        query_bundle=QueryBundle(question),
    )

    for item in evidence:
        print(item.node.node_id, item.score, item.node.metadata)
    return evidence
