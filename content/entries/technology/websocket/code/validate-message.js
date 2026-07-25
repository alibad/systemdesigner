const schemas = {
  'chat.message.v1': (payload) =>
    typeof payload.roomId === 'string' &&
    typeof payload.text === 'string' &&
    payload.text.length <= 4_000,
};

export function validateMessage(input) {
  if (!input || typeof input !== 'object') throw new Error('message must be an object');
  if (typeof input.id !== 'string' || input.id.length > 80) throw new Error('invalid id');
  if (!schemas[input.type]?.(input.payload)) throw new Error('unsupported or invalid payload');
  return { id: input.id, type: input.type, payload: input.payload };
}

const accepted = validateMessage({
  id: 'msg-018',
  type: 'chat.message.v1',
  payload: { roomId: 'room-7', text: 'bounded hello' },
});
console.assert(accepted.payload.text === 'bounded hello');
console.log(accepted);
