type Message = {
  id: string;
  accountId: string;
  amountCents: number;
};

export async function handleDebit(message: Message) {
  await database.transaction(async (tx) => {
    const seen = await tx.processedMessages.findUnique({
      where: { consumer_messageId: { consumer: 'ledger', messageId: message.id } },
    });

    if (seen) return; // A redelivery has the same observable business result.

    await tx.ledgerEntries.create({
      data: { accountId: message.accountId, amountCents: -message.amountCents, messageId: message.id },
    });
    await tx.processedMessages.create({
      data: { consumer: 'ledger', messageId: message.id },
    });
  });

  await broker.ack(message.id); // Acknowledge only after the durable effect commits.
}
