function prioritizeContext(documents, query, maxTokens) {
  const scored = documents.map((doc) => ({
    ...doc,
    relevanceScore: calculateRelevance(doc.content, query),
  }));
  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

  let totalTokens = 0;
  const selected = [];
  for (const doc of scored) {
    const tokens = estimateTokens(doc.content);
    if (totalTokens + tokens <= maxTokens) {
      selected.push(doc);
      totalTokens += tokens;
    }
  }
  return selected;
}
