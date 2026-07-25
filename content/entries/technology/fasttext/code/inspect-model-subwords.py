"""Inspect the exact subwords used by a trained fastText artifact."""

from pathlib import Path

import fasttext


MODEL_FILE = Path("artifacts/word-vectors.bin")
model = fasttext.load_model(str(MODEL_FILE))

for token in ("payment", "repayments", "paymant", "qzxv9"):
    subwords, indices = model.get_subwords(token)
    vocabulary_state = "seen" if token in model else "out-of-vocabulary"
    vector = model.get_word_vector(token)

    print(f"\n{token} ({vocabulary_state})")
    print(f"dimension={vector.shape[0]} subword_count={len(subwords)}")
    for fragment, bucket_id in zip(subwords[:12], indices[:12], strict=True):
        print(f"  {fragment!r} -> input row {bucket_id}")
