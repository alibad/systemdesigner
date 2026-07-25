async function parallelRAG(query) {
  const [embedding, rewrittenQueries] = await Promise.all([
    getEmbedding(query),
    rewriteQuery(query),
  ]);

  const [vectorResults, keywordResults] = await Promise.all([
    vectorSearch(embedding),
    keywordSearch(rewrittenQueries),
  ]);

  const combinedResults = hybridRank(vectorResults, keywordResults);
  const generationPromise = generateAnswer(query, combinedResults);
  await processContext(combinedResults);
  return generationPromise;
}
