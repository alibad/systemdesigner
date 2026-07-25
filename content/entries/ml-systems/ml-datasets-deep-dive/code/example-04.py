# Deduplication approaches
from datasketch import MinHash

def deduplicate_dataset(documents):
    # 1. Exact deduplication
    seen_hashes = set()
    unique_docs = []

    for doc in documents:
        doc_hash = hashlib.sha256(doc.encode()).hexdigest()
        if doc_hash not in seen_hashes:
            seen_hashes.add(doc_hash)
            unique_docs.append(doc)

    # 2. Fuzzy deduplication with MinHash
    minhashes = {}
    threshold = 0.8  # Similarity threshold

    for doc in unique_docs:
        minhash = MinHash()
        for token in doc.split():
            minhash.update(token.encode())

        # Check similarity with existing documents
        is_duplicate = False
        for existing_hash in minhashes.values():
            if minhash.jaccard(existing_hash) > threshold:
                is_duplicate = True
                break

        if not is_duplicate:
            minhashes[doc] = minhash

    return list(minhashes.keys())
