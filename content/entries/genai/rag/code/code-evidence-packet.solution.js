function assemblePacket(passages, tenant, now, budgetTokens) {
  const seenSources = new Set();
  const packet = [];
  let usedTokens = 0;
  for (const passage of passages) {
    if (passage.tenant !== tenant) continue;
    if (passage.expiresAt <= now) continue;
    if (seenSources.has(passage.source)) continue;
    seenSources.add(passage.source);
    if (usedTokens + passage.tokens > budgetTokens) break;
    packet.push(passage.id);
    usedTokens += passage.tokens;
  }
  return { packet, usedTokens, refused: packet.length === 0 };
}
