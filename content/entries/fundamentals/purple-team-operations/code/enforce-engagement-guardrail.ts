type AuthorizedTest = {
  targetId: string;
  allowedTargets: Set<string>;
  expiresAt: Date;
  stopRequested: boolean;
};

export function assertExecutionAllowed(test: AuthorizedTest, now = new Date()): void {
  if (test.stopRequested) {
    throw new Error('Exercise stop requested');
  }
  if (now >= test.expiresAt) {
    throw new Error('Authorization window expired');
  }
  if (!test.allowedTargets.has(test.targetId)) {
    throw new Error(`Target ${test.targetId} is outside the rules of engagement`);
  }
}

const test: AuthorizedTest = {
  targetId: 'sandbox-workstation-04',
  allowedTargets: new Set(['sandbox-workstation-04']),
  expiresAt: new Date('2026-07-24T12:00:00Z'),
  stopRequested: false,
};

assertExecutionAllowed(test, new Date('2026-07-24T11:30:00Z'));
