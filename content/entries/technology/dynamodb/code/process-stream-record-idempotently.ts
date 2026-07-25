import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import type { DynamoDBStreamHandler } from 'aws-lambda';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler: DynamoDBStreamHandler = async (event) => {
  for (const record of event.Records) {
    if (!record.eventID) continue;

    try {
      await client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: 'ProcessedStreamRecords',
                Item: {
                  eventId: record.eventID,
                  expiresAt: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
                },
                ConditionExpression: 'attribute_not_exists(eventId)',
              },
            },
            {
              Put: {
                TableName: 'EffectOutbox',
                Item: {
                  effectId: `ORDER_PROJECTION#${record.eventID}`,
                  sourceEventId: record.eventID,
                  status: 'PENDING',
                },
                ConditionExpression: 'attribute_not_exists(effectId)',
              },
            },
          ],
        }),
      );
    } catch (error) {
      if ((error as { name?: string }).name === 'TransactionCanceledException') {
        const existing = await client.send(
          new GetCommand({
            TableName: 'ProcessedStreamRecords',
            Key: { eventId: record.eventID },
            ProjectionExpression: 'eventId',
          }),
        );
        if (existing.Item) continue;
      }

      throw error;
    }
  }
};
