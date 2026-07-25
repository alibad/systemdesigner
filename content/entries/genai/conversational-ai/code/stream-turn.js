export async function streamTurn({ generate, emit, signal, deadlineMs }) {
  const deadline = AbortSignal.timeout(deadlineMs);
  const combined = AbortSignal.any([signal, deadline]);
  let emitted = '';

  try {
    for await (const event of generate({ signal: combined })) {
      if (event.type === 'token') {
        emitted += event.text;
        await emit({ type: 'delta', text: event.text });
      }
    }
    await emit({ type: 'complete', text: emitted });
    return { status: 'complete', emitted };
  } catch (error) {
    const reason = combined.aborted ? 'cancelled-or-timeout' : 'generation-failed';
    await emit({ type: 'failed', reason, partialText: emitted });
    return { status: 'failed', reason, emitted };
  }
}

async function* generateFixture() {
  yield { type: 'token', text: 'Bounded ' };
  yield { type: 'token', text: 'answer' };
}

const events = [];
const result = await streamTurn({
  generate: generateFixture,
  emit: async (event) => events.push(event),
  signal: new AbortController().signal,
  deadlineMs: 1_000,
});
console.assert(result.status === 'complete');
console.assert(events.at(-1)?.type === 'complete');
console.log(result);
