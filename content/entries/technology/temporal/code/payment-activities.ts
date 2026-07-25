import { heartbeat } from '@temporalio/activity';

export type ChargeInput = {
  orderId: string;
  operationId: string;
  amountCents: number;
};

type ChargeResult = {
  providerChargeId: string;
};

export interface PaymentGateway {
  findByIdempotencyKey(key: string): Promise<ChargeResult | undefined>;
  charge(input: {
    idempotencyKey: string;
    amountCents: number;
    metadata: { orderId: string };
  }): Promise<ChargeResult>;
}

export function createPaymentActivities(gateway: PaymentGateway) {
  return {
    async chargePayment(input: ChargeInput): Promise<ChargeResult> {
      const existing = await gateway.findByIdempotencyKey(input.operationId);
      if (existing) return existing;

      return gateway.charge({
        idempotencyKey: input.operationId,
        amountCents: input.amountCents,
        metadata: { orderId: input.orderId },
      });
    },

    async exportInvoices(invoiceIds: string[]): Promise<number> {
      let exported = 0;
      for (const invoiceId of invoiceIds) {
        await exportOneInvoice(invoiceId);
        exported += 1;
        heartbeat({ exported, total: invoiceIds.length });
      }
      return exported;
    },
  };
}

export type PaymentActivities = ReturnType<typeof createPaymentActivities>;

async function exportOneInvoice(invoiceId: string): Promise<void> {
  void invoiceId;
}
