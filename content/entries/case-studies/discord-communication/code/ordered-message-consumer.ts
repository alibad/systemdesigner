type SendMessageCommand = {
  clientMessageId: string;
  channelId: string;
  authorId: string;
  body: string;
};

type AcceptedMessage = SendMessageCommand & {
  channelSequence: number;
  acceptedAt: string;
};

export async function acceptMessage(
  command: SendMessageCommand,
): Promise<AcceptedMessage> {
  return channelSequencer.serial(command.channelId, async () => {
    await permissions.requireChannelSend(command.channelId, command.authorId);
    return messageStore.transaction(command.channelId, async (transaction) => {
      const duplicate = await transaction.findByClientMessageId(
        command.clientMessageId,
      );
      if (duplicate) return duplicate;

      const accepted: AcceptedMessage = {
        ...command,
        channelSequence: transaction.nextChannelSequence(),
        acceptedAt: new Date().toISOString(),
      };

      await transaction.appendMessageAndOutboxEvent(accepted);
      return accepted;
    });
  });
}

export async function deliverInOrder(
  sessionId: string,
  message: AcceptedMessage,
): Promise<void> {
  const cursor = await sessionCursors.get(sessionId, message.channelId);

  if (message.channelSequence <= cursor) return;
  if (message.channelSequence !== cursor + 1) {
    await replayRequests.enqueue({
      sessionId,
      channelId: message.channelId,
      fromSequence: cursor + 1,
      toSequence: message.channelSequence,
    });
    return;
  }

  await gateways.send(sessionId, message);
  await sessionCursors.advance(
    sessionId,
    message.channelId,
    message.channelSequence,
  );
}
