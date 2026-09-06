function fitEvidence(windowTokens, instructionTokens, reserveTokens, passages) {
  const budget = Math.max(0, windowTokens - instructionTokens - reserveTokens);
  const selected = [];
  let usedTokens = 0;
  for (const passage of passages) {
    if (usedTokens + passage.tokens > budget) break;
    selected.push(passage.id);
    usedTokens += passage.tokens;
  }
  return { selected, usedTokens, remaining: budget - usedTokens };
}
