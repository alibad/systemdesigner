import { CosmosClient } from '@azure/cosmos';

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT!,
  key: process.env.COSMOS_KEY!,
});

const container = client.database('commerce').container('orders');

export async function readOrder(customerId: string, orderId: string) {
  const response = await container.item(orderId, customerId).read();

  console.info('cosmos point read', {
    customerId,
    orderId,
    requestCharge: response.requestCharge,
    activityId: response.activityId,
  });

  return response.resource;
}
