import { NativeConnection, Worker } from '@temporalio/worker';

import { paymentGateway } from '@app/payments/payment-gateway';

import { createPaymentActivities } from './payment-activities';

async function main(): Promise<void> {
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233',
  });

  const worker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE ?? 'orders-production',
    taskQueue: 'orders-v1',
    workflowsPath: require.resolve('./order-workflow'),
    activities: createPaymentActivities(paymentGateway),
    identity: process.env.WORKER_IDENTITY ?? `order-worker-${process.pid}`,
    maxConcurrentActivityTaskExecutions: 100,
    shutdownGraceTime: '30 seconds',
  });

  await worker.run();
}

void main();
