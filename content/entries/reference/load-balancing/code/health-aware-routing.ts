type BackendState = 'starting' | 'ready' | 'draining' | 'unhealthy';

type Backend = {
  id: string;
  weight: number;
  state: BackendState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  currentWeight: number;
};

type Thresholds = {
  unhealthy: number;
  healthy: number;
};

export class BackendPool {
  constructor(
    private readonly backends: Backend[],
    private readonly thresholds: Thresholds,
  ) {}

  recordProbe(backendId: string, passed: boolean): BackendState {
    const backend = this.requireBackend(backendId);

    if (backend.state === 'draining') return backend.state;

    if (passed) {
      backend.consecutiveSuccesses += 1;
      backend.consecutiveFailures = 0;

      if (
        backend.state !== 'ready' &&
        backend.consecutiveSuccesses >= this.thresholds.healthy
      ) {
        backend.state = 'ready';
      }
    } else {
      backend.consecutiveFailures += 1;
      backend.consecutiveSuccesses = 0;

      if (backend.consecutiveFailures >= this.thresholds.unhealthy) {
        backend.state = 'unhealthy';
        backend.currentWeight = 0;
      }
    }

    return backend.state;
  }

  beginDrain(backendId: string): void {
    const backend = this.requireBackend(backendId);
    backend.state = 'draining';
    backend.currentWeight = 0;
  }

  chooseReadyBackend(): Backend {
    const eligible = this.backends.filter((backend) => backend.state === 'ready');
    if (eligible.length === 0) {
      throw new Error('No ready backend; apply the explicit overload or fallback policy.');
    }

    const totalWeight = eligible.reduce((sum, backend) => sum + backend.weight, 0);
    for (const backend of eligible) backend.currentWeight += backend.weight;

    const selected = eligible.reduce((best, backend) =>
      backend.currentWeight > best.currentWeight ? backend : best,
    );
    selected.currentWeight -= totalWeight;
    return selected;
  }

  private requireBackend(backendId: string): Backend {
    const backend = this.backends.find((candidate) => candidate.id === backendId);
    if (!backend) throw new Error(`Unknown backend: ${backendId}`);
    return backend;
  }
}

export function createPool(): BackendPool {
  return new BackendPool(
    [
      { id: 'api-a', weight: 3, state: 'ready', consecutiveFailures: 0, consecutiveSuccesses: 0, currentWeight: 0 },
      { id: 'api-b', weight: 2, state: 'ready', consecutiveFailures: 0, consecutiveSuccesses: 0, currentWeight: 0 },
      { id: 'api-c', weight: 1, state: 'ready', consecutiveFailures: 0, consecutiveSuccesses: 0, currentWeight: 0 },
    ],
    { unhealthy: 3, healthy: 2 },
  );
}
