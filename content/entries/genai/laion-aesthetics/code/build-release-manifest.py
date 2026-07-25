def build_release_manifest(candidates, policy, release_id):
    rows = []
    for item in candidates:
        decision = policy.evaluate(item)
        rows.append(
            {
                "release_id": release_id,
                "content_sha256": item.content_sha256,
                "source_url_hash": item.source_url_hash,
                "caption_hash": item.caption_hash,
                "score_versions": item.score_versions,
                "included": decision.included,
                "reason_codes": sorted(decision.reason_codes),
                "review_state": decision.review_state,
                "shard_id": decision.shard_id,
            }
        )
    return sorted(rows, key=lambda row: row["content_sha256"])
