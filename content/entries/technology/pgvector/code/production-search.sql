CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE search_chunks (
    tenant_id bigint NOT NULL,
    chunk_id bigint GENERATED ALWAYS AS IDENTITY,
    source_version text NOT NULL,
    embedding_version text NOT NULL,
    content text NOT NULL,
    embedding vector(768) NOT NULL,
    published_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, chunk_id)
);

CREATE INDEX CONCURRENTLY search_chunks_embedding_v4_hnsw
ON search_chunks
USING hnsw (embedding vector_cosine_ops)
WHERE embedding_version = 'embed-v4';

CREATE INDEX search_chunks_tenant_version_idx
ON search_chunks (tenant_id, embedding_version, published_at DESC);

BEGIN;
SET LOCAL hnsw.ef_search = 100;
SET LOCAL hnsw.iterative_scan = strict_order;
SET LOCAL hnsw.max_scan_tuples = 20000;
SET LOCAL statement_timeout = '250ms';

SELECT chunk_id, source_version, content,
       embedding <=> :query_embedding AS distance
FROM search_chunks
WHERE tenant_id = :tenant_id
  AND embedding_version = 'embed-v4'
ORDER BY embedding <=> :query_embedding
LIMIT 10;
COMMIT;
