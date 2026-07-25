export function assembleContext({ turns, memories, evidence, maxTokens }) {
  const selectedTurns = turns.slice(-6);
  const selectedMemories = memories
    .filter((item) => item.authorized && item.confidence >= 0.8)
    .slice(0, 4);
  const selectedEvidence = evidence
    .filter((item) => item.authorized && item.sourceId)
    .slice(0, 6);

  const prompt = {
    turns: selectedTurns,
    memories: selectedMemories,
    evidence: selectedEvidence,
  };
  const tokens = JSON.stringify(prompt).length / 4;
  if (tokens > maxTokens) throw new Error('context budget exceeded');
  return { prompt, tokens: Math.ceil(tokens) };
}

const result = assembleContext({
  turns: Array.from({ length: 12 }, (_, id) => ({ id, text: `turn ${id}` })),
  memories: [{ text: 'prefers concise answers', authorized: true, confidence: 0.95 }],
  evidence: [{ sourceId: 'policy-7', text: 'refunds require approval', authorized: true }],
  maxTokens: 500,
});
console.assert(result.prompt.turns.length === 6);
console.log(result);
