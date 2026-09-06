function planChunks(documentTokens, chunkTokens, overlapTokens) {
  const stride = chunkTokens - overlapTokens;
  const chunks = [];
  for (let start = 0; start < documentTokens; start += stride) {
    const end = Math.min(start + chunkTokens, documentTokens);
    chunks.push({ start, end });
    if (end === documentTokens) break;
  }
  return chunks;
}
