function fixedWindow(state, currentWindow, limit) {
  const count = state.window === currentWindow ? state.count : 0; const allowed = count < limit; return { allowed, state: { window: currentWindow, count: count + (allowed ? 1 : 0) } };
}
