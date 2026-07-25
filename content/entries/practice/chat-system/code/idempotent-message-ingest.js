import assert from 'node:assert/strict';

class ConversationLog {
  constructor() {
    this.messagesByConversation = new Map();
    this.messageByIdempotencyKey = new Map();
    this.nextMessageId = 1;
  }

  accept(command) {
    const idempotencyKey = `${command.senderId}:${command.clientMessageId}`;
    const existing = this.messageByIdempotencyKey.get(idempotencyKey);

    if (existing) {
      return { ...existing, duplicate: true };
    }

    const messages = this.messagesByConversation.get(command.conversationId) ?? [];
    const message = Object.freeze({
      messageId: `m-${String(this.nextMessageId).padStart(6, '0')}`,
      conversationId: command.conversationId,
      senderId: command.senderId,
      clientMessageId: command.clientMessageId,
      sequence: messages.length + 1,
      body: command.body,
    });

    // Treat both writes as one storage transaction in a production implementation.
    this.messagesByConversation.set(command.conversationId, [...messages, message]);
    this.messageByIdempotencyKey.set(idempotencyKey, message);
    this.nextMessageId += 1;

    // Returning from this method models the accepted acknowledgement after commit.
    return { ...message, duplicate: false };
  }

  history(conversationId) {
    return this.messagesByConversation.get(conversationId) ?? [];
  }
}

const log = new ConversationLog();
const command = {
  conversationId: 'conversation-7',
  senderId: 'user-42',
  clientMessageId: 'device-a-0009',
  body: 'Hello',
};

const accepted = log.accept(command);
const retryAfterLostAck = log.accept(command);
const nextMessage = log.accept({
  ...command,
  clientMessageId: 'device-a-0010',
  body: 'Are you there?',
});

assert.equal(accepted.messageId, retryAfterLostAck.messageId);
assert.equal(accepted.sequence, retryAfterLostAck.sequence);
assert.equal(retryAfterLostAck.duplicate, true);
assert.equal(nextMessage.sequence, 2);
assert.equal(log.history(command.conversationId).length, 2);

console.log({
  firstSequence: accepted.sequence,
  retrySequence: retryAfterLostAck.sequence,
  retryWasDeduplicated: retryAfterLostAck.duplicate,
  nextSequence: nextMessage.sequence,
  durableRows: log.history(command.conversationId).length,
});
