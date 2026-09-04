function normalizeEvent(event) {
  if (!event || typeof event.id !== "string" || typeof event.type !== "string") return null; const id = event.id.trim(); const type = event.type.trim().toLowerCase(); return id && type ? { id, type } : null;
}
