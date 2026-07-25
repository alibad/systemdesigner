"""Build a repeatable LlamaIndex ingestion pipeline.

Install the integrations used by your deployment and provide documents from a
real reader. Stable document IDs and metadata are part of the application
contract, not defaults a framework can infer for you.
"""

from llama_index.core import Document
from llama_index.core.ingestion import IngestionPipeline
from llama_index.core.node_parser import SentenceSplitter
from llama_index.embeddings.openai import OpenAIEmbedding


documents = [
    Document(
        id_="policy/refunds/eu/2026-07",
        text="EU orders may be refunded within the applicable policy window...",
        metadata={
            "region": "eu",
            "policy_version": "2026-07",
            "effective_date": "2026-07-01",
            "access_tier": "internal",
        },
    )
]

pipeline = IngestionPipeline(
    transformations=[
        SentenceSplitter(chunk_size=512, chunk_overlap=64),
        OpenAIEmbedding(model="text-embedding-3-small"),
    ]
)

nodes = pipeline.run(documents=documents)
for node in nodes:
    print(node.node_id, node.ref_doc_id, node.metadata["policy_version"])
