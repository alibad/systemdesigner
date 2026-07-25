type WebhookJob = {
  deliveryId: string;
  endpoint: string;
  eventType: string;
  payload: unknown;
  attempt: number;
};

type DeliveryDependencies = {
  alreadyDelivered(deliveryId: string): Promise<boolean>;
  post(
    endpoint: string,
    payload: unknown,
    headers: Record<string, string>
  ): Promise<{ ok: boolean; status: number }>;
  markDelivered(deliveryId: string): Promise<void>;
  retry(job: WebhookJob, delaySeconds: number): Promise<void>;
  deadLetter(job: WebhookJob, reason: string): Promise<void>;
};

const maxAttempts = 8;

export async function deliverWebhook(
  job: WebhookJob,
  dependencies: DeliveryDependencies
) {
  if (await dependencies.alreadyDelivered(job.deliveryId)) return;

  try {
    const response = await dependencies.post(job.endpoint, job.payload, {
      'content-type': 'application/json',
      'x-delivery-id': job.deliveryId,
      'x-event-type': job.eventType,
    });

    if (response.ok) {
      await dependencies.markDelivered(job.deliveryId);
      return;
    }

    await scheduleFailure(job, dependencies, `HTTP ${response.status}`);
  } catch {
    await scheduleFailure(job, dependencies, 'timeout or network error');
  }
}

async function scheduleFailure(
  job: WebhookJob,
  dependencies: DeliveryDependencies,
  reason: string
) {
  const nextAttempt = job.attempt + 1;
  if (nextAttempt >= maxAttempts) {
    await dependencies.deadLetter({ ...job, attempt: nextAttempt }, reason);
    return;
  }

  const cappedBackoff = Math.min(3_600, 2 ** nextAttempt * 15);
  const jitteredDelay = Math.round(cappedBackoff * (0.8 + Math.random() * 0.4));
  await dependencies.retry({ ...job, attempt: nextAttempt }, jitteredDelay);
}
