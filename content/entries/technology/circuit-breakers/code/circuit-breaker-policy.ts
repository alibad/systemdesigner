type BreakerState = 'closed' | 'open' | 'half-open';

type Outcome = {
  ok: boolean;
  durationMs: number;
  countsAsFailure: boolean;
};

type Policy = {
  windowSize: number;
  minimumCalls: number;
  failureRateThresholdPct: number;
  slowCallThresholdPct: number;
  slowCallDurationMs: number;
  openForMs: number;
  halfOpenCalls: number;
};

export class CircuitBreaker {
  private state: BreakerState = 'closed';
  private outcomes: Outcome[] = [];
  private openedAtMs = 0;
  private probes: Outcome[] = [];

  constructor(private readonly policy: Policy) {}

  allow(nowMs: number): boolean {
    if (this.state === 'open' && nowMs - this.openedAtMs >= this.policy.openForMs) {
      this.state = 'half-open';
      this.probes = [];
    }

    if (this.state === 'open') return false;
    if (this.state === 'half-open') {
      return this.probes.length < this.policy.halfOpenCalls;
    }
    return true;
  }

  record(outcome: Outcome, nowMs: number): void {
    if (this.state === 'half-open') {
      this.probes.push(outcome);
      if (outcome.countsAsFailure) {
        this.open(nowMs);
        return;
      }
      if (this.probes.length === this.policy.halfOpenCalls) {
        this.state = 'closed';
        this.outcomes = [];
      }
      return;
    }

    this.outcomes.push(outcome);
    this.outcomes = this.outcomes.slice(-this.policy.windowSize);
    if (this.outcomes.length < this.policy.minimumCalls) return;

    const failureRate = percentage(
      this.outcomes.filter((item) => item.countsAsFailure).length,
      this.outcomes.length,
    );
    const slowCallRate = percentage(
      this.outcomes.filter((item) => item.durationMs >= this.policy.slowCallDurationMs).length,
      this.outcomes.length,
    );

    if (
      failureRate >= this.policy.failureRateThresholdPct
      || slowCallRate >= this.policy.slowCallThresholdPct
    ) {
      this.open(nowMs);
    }
  }

  currentState(): BreakerState {
    return this.state;
  }

  private open(nowMs: number): void {
    this.state = 'open';
    this.openedAtMs = nowMs;
    this.probes = [];
  }
}

function percentage(count: number, total: number): number {
  return total === 0 ? 0 : (count / total) * 100;
}
