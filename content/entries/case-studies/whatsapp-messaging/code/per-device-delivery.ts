type DeviceEnvelope = {
  messageId: string;
  recipientDeviceId: string;
  sessionVersion: number;
  ciphertext: Uint8Array;
  expiresAt: Date;
};

type DeviceAck = {
  messageId: string;
  recipientDeviceId: string;
  persistedAt: Date;
};

// The service stores ciphertext and delivery state, never content keys or plaintext.
async function enqueueForDevice(envelope: DeviceEnvelope) {
  await deliveryQueue.insertIfAbsent({
    key: [envelope.recipientDeviceId, envelope.messageId],
    value: envelope,
  });
}

async function retryPendingDelivery(envelope: DeviceEnvelope) {
  if (envelope.expiresAt <= new Date()) {
    await deliveryQueue.expire(envelope.recipientDeviceId, envelope.messageId);
    return;
  }

  const session = await sessions.current(envelope.recipientDeviceId);
  if (!session || session.version !== envelope.sessionVersion) {
    await deliveryQueue.markSessionRepairRequired(
      envelope.recipientDeviceId,
      envelope.messageId,
    );
    await notifySenderToRefreshSession(envelope.messageId, envelope.recipientDeviceId);
    return;
  }

  // An uncertain network result schedules the same envelope identity again.
  await gateway.push(envelope.recipientDeviceId, envelope);
  await deliveryQueue.scheduleRetry(
    envelope.recipientDeviceId,
    envelope.messageId,
    boundedBackoff(),
  );
}

async function recordDeviceAck(ack: DeviceAck) {
  // A tablet ACK must not remove the phone's independent queue item.
  await deliveryQueue.complete(ack.recipientDeviceId, ack.messageId, ack.persistedAt);
}

async function receiveOnDevice(envelope: DeviceEnvelope): Promise<DeviceAck> {
  if (await localSeenMessages.has(envelope.messageId)) {
    return acknowledgeExisting(envelope);
  }

  const plaintext = await deviceCrypto.authenticateAndDecrypt(
    envelope.sessionVersion,
    envelope.ciphertext,
  );

  await localDatabase.transaction(async (transaction) => {
    await transaction.messages.insert(envelope.messageId, plaintext);
    await transaction.seenMessages.insert(envelope.messageId);
  });

  return {
    messageId: envelope.messageId,
    recipientDeviceId: envelope.recipientDeviceId,
    persistedAt: new Date(),
  };
}
