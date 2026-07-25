import amqp from 'amqplib';

type OrderCreated = {
  eventId: string;
  orderId: string;
  region: string;
};

export async function publishOrderCreated(event: OrderCreated): Promise<void> {
  const connection = await amqp.connect(process.env.RABBITMQ_URL!);
  const channel = await connection.createConfirmChannel();
  const exchange = 'orders.v1';
  const routingKey = `order.created.${event.region}`;

  await channel.assertExchange(exchange, 'topic', { durable: true });

  const accepted = channel.publish(
    exchange,
    routingKey,
    Buffer.from(JSON.stringify(event)),
    {
      appId: 'checkout',
      contentType: 'application/json',
      deliveryMode: 2,
      messageId: event.eventId,
      timestamp: Date.now(),
      mandatory: true,
    },
  );

  if (!accepted) {
    await new Promise<void>((resolve) => channel.once('drain', resolve));
  }

  await channel.waitForConfirms();
  await channel.close();
  await connection.close();
}
