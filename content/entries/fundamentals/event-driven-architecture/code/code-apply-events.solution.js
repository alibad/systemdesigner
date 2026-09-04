function applyEvents(state, events) {
  const seen = new Set(state.seen); let total = state.total; for (const event of events) { if (!seen.has(event.id)) { seen.add(event.id); total += event.delta; } } return { total, seen: [...seen] };
}
