import type {
  GetCommandInput,
  QueryCommandInput,
  TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';

const tableName = 'Commerce';

export const getOrder: GetCommandInput = {
  TableName: tableName,
  Key: {
    PK: 'ORDER#o-2048',
    SK: 'ORDER#o-2048',
  },
  ConsistentRead: true,
};

export const listCustomerOrders: QueryCommandInput = {
  TableName: tableName,
  KeyConditionExpression: 'PK = :customer AND begins_with(SK, :order)',
  ExpressionAttributeValues: {
    ':customer': 'CUSTOMER#c-42',
    ':order': 'ORDER#',
  },
  ScanIndexForward: false,
};

export const commitCheckout: TransactWriteCommandInput = {
  TransactItems: [
    {
      Put: {
        TableName: tableName,
        Item: {
          PK: 'ORDER#o-2048',
          SK: 'ORDER#o-2048',
          status: 'PAID',
          customerId: 'c-42',
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      },
    },
    {
      Put: {
        TableName: tableName,
        Item: {
          PK: 'ORDER#o-2048',
          SK: 'LEDGER#payment-91',
          amountMinor: 1299,
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      },
    },
  ],
  ClientRequestToken: 'checkout-o-2048-attempt-1',
};
