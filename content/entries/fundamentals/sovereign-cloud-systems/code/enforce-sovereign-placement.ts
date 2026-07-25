type Authority = 'customer' | 'dual-control' | 'provider';
type DataSurface =
  | 'primary'
  | 'replicas'
  | 'backups'
  | 'indexes'
  | 'logs'
  | 'support-artifacts';

interface PlacementContract {
  policyVersion: string;
  workloadId: string;
  allowedJurisdictions: string[];
  requiredLocalSurfaces: DataSurface[];
  requiredAuthorities: {
    identity: Authority[];
    keys: Authority[];
    operations: Authority[];
  };
  maximumExternalCriticalDependencies: number;
  requiredEvidence: string[];
}

interface PlacementCandidate {
  platformId: string;
  jurisdiction: string;
  surfaceLocations: Record<DataSurface, string>;
  authorities: {
    identity: Authority;
    keys: Authority;
    operations: Authority;
  };
  externalCriticalDependencies: string[];
  evidenceCapabilities: string[];
}

interface PlacementDecision {
  admitted: boolean;
  policyVersion: string;
  workloadId: string;
  platformId: string;
  denials: string[];
  evaluatedAt: string;
}

export function evaluatePlacement(
  contract: PlacementContract,
  candidate: PlacementCandidate,
  evaluatedAt: Date,
): PlacementDecision {
  const denials: string[] = [];

  if (!contract.allowedJurisdictions.includes(candidate.jurisdiction)) {
    denials.push(`Jurisdiction ${candidate.jurisdiction} is not approved.`);
  }

  for (const surface of contract.requiredLocalSurfaces) {
    if (candidate.surfaceLocations[surface] !== candidate.jurisdiction) {
      denials.push(
        `${surface} is in ${candidate.surfaceLocations[surface]}, not ${candidate.jurisdiction}.`,
      );
    }
  }

  for (const [plane, allowed] of Object.entries(contract.requiredAuthorities)) {
    const actual = candidate.authorities[plane as keyof typeof candidate.authorities];
    if (!allowed.includes(actual)) {
      denials.push(`${plane} authority is ${actual}; allowed: ${allowed.join(', ')}.`);
    }
  }

  if (
    candidate.externalCriticalDependencies.length
    > contract.maximumExternalCriticalDependencies
  ) {
    denials.push(
      `Critical external dependencies exceed the maximum: `
      + `${candidate.externalCriticalDependencies.join(', ')}.`,
    );
  }

  const missingEvidence = contract.requiredEvidence.filter(
    (evidence) => !candidate.evidenceCapabilities.includes(evidence),
  );
  if (missingEvidence.length > 0) {
    denials.push(`Missing evidence capabilities: ${missingEvidence.join(', ')}.`);
  }

  return {
    admitted: denials.length === 0,
    policyVersion: contract.policyVersion,
    workloadId: contract.workloadId,
    platformId: candidate.platformId,
    denials,
    evaluatedAt: evaluatedAt.toISOString(),
  };
}

const residentRecords: PlacementContract = {
  policyVersion: 'resident-records/v4',
  workloadId: 'benefits-case-management',
  allowedJurisdictions: ['home-jurisdiction'],
  requiredLocalSurfaces: [
    'primary',
    'replicas',
    'backups',
    'indexes',
    'logs',
    'support-artifacts',
  ],
  requiredAuthorities: {
    identity: ['customer', 'dual-control'],
    keys: ['customer', 'dual-control'],
    operations: ['dual-control'],
  },
  maximumExternalCriticalDependencies: 1,
  requiredEvidence: ['placement-decision', 'key-use', 'privileged-session'],
};

const decision = evaluatePlacement(
  residentRecords,
  {
    platformId: 'sovereign-managed-zone',
    jurisdiction: 'home-jurisdiction',
    surfaceLocations: {
      primary: 'home-jurisdiction',
      replicas: 'home-jurisdiction',
      backups: 'home-jurisdiction',
      indexes: 'home-jurisdiction',
      logs: 'home-jurisdiction',
      'support-artifacts': 'home-jurisdiction',
    },
    authorities: {
      identity: 'customer',
      keys: 'customer',
      operations: 'dual-control',
    },
    externalCriticalDependencies: ['signed-update-mirror'],
    evidenceCapabilities: [
      'placement-decision',
      'key-use',
      'privileged-session',
    ],
  },
  new Date('2026-07-24T09:00:00Z'),
);

console.log(JSON.stringify(decision, null, 2));
