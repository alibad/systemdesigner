import {
  BatchWriteCommand,
  type BatchWriteCommandInput,
  DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function writeAll(
  client: DynamoDBDocumentClient,
  request: BatchWriteCommandInput,
  maxAttempts = 8,
) {
  let pending = request.RequestItems ?? {};

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await client.send(
      new BatchWriteCommand({ RequestItems: pending }),
    );

    pending = response.UnprocessedItems ?? {};
    if (Object.keys(pending).length === 0) return;

    const capMs = Math.min(5000, 100 * 2 ** attempt);
    await sleep(Math.random() * capMs);
  }

  throw new Error('Unprocessed DynamoDB writes remain after bounded retries');
}
