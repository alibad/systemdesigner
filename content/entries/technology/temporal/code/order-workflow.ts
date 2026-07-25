import {
  condition,
  defineQuery,
  defineSignal,
  defineUpdate,
  executeChild,
  proxyActivities,
  setHandler,
} from '@temporalio/workflow';

import type { PaymentActivities } from './payment-activities';

export type OrderState = {
  orderId: string;
  status: 'awaiting-approval' | 'paid' | 'fulfilled' | 'cancelled';
  shippingAddress: string;
  approvalId?: string;
};

export const approveOrder = defineSignal<[approvalId: string]>('approveOrder');
export const readOrder = defineQuery<OrderState>('readOrder');
export const changeAddress =
  defineUpdate<OrderState, [shippingAddress: string]>('changeAddress');

const { chargePayment } = proxyActivities<PaymentActivities>({
  startToCloseTimeout: '30 seconds',
  scheduleToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1 second',
    backoffCoefficient: 2,
    maximumInterval: '30 seconds',
    maximumAttempts: 5,
    nonRetryableErrorTypes: ['InvalidPayment'],
  },
});

export async function orderWorkflow(input: OrderState): Promise<OrderState> {
  const state = { ...input };

  setHandler(readOrder, () => ({ ...state }));
  setHandler(approveOrder, (approvalId) => {
    state.approvalId = approvalId;
  });
  setHandler(changeAddress, (shippingAddress) => {
    if (state.status === 'awaiting-approval') {
      state.shippingAddress = shippingAddress;
    }
    return { ...state };
  });

  await condition(() => state.approvalId !== undefined);

  await chargePayment({
    orderId: state.orderId,
    operationId: `${state.orderId}:charge:v1`,
    amountCents: 12_500,
  });
  state.status = 'paid';

  await executeChild(fulfillmentWorkflow, {
    workflowId: `${state.orderId}:fulfillment`,
    args: [{ orderId: state.orderId, address: state.shippingAddress }],
  });
  state.status = 'fulfilled';

  return state;
}

export async function fulfillmentWorkflow(
  input: { orderId: string; address: string },
): Promise<void> {
  // A real child Workflow would orchestrate fulfillment Activities here.
  void input;
}
