type SubmitRequest = {
  experimentId: string;
  circuitHash: string;
  shots: number;
  backendId: string;
};

type ProviderJob = {
  id: string;
  state: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  requestedShots: number;
  completedShots: number;
  resultDigest?: string;
  calibrationId?: string;
  compilerVersion?: string;
};

interface QuantumProvider {
  findByIdempotencyKey(key: string): Promise<ProviderJob | null>;
  submit(request: SubmitRequest, idempotencyKey: string): Promise<ProviderJob>;
  get(jobId: string): Promise<ProviderJob>;
}

interface ExperimentStore {
  reserve(experimentId: string, circuitHash: string): Promise<void>;
  attachProviderJob(experimentId: string, providerJobId: string): Promise<void>;
  complete(experimentId: string, manifest: ExecutionManifest): Promise<void>;
}

type ExecutionManifest = {
  experimentId: string;
  providerJobId: string;
  circuitHash: string;
  backendId: string;
  calibrationId: string;
  compilerVersion: string;
  requestedShots: number;
  completedShots: number;
  resultDigest: string;
};

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function requireCompleteEvidence(
  request: SubmitRequest,
  job: ProviderJob,
): ExecutionManifest {
  if (job.state !== 'succeeded') {
    throw new Error(`Quantum job ended in ${job.state}`);
  }
  if (job.completedShots !== request.shots) {
    throw new Error(
      `Shot contract failed: ${job.completedShots}/${request.shots}`,
    );
  }
  if (!job.resultDigest || !job.calibrationId || !job.compilerVersion) {
    throw new Error('Provider result is missing execution provenance');
  }

  return {
    experimentId: request.experimentId,
    providerJobId: job.id,
    circuitHash: request.circuitHash,
    backendId: request.backendId,
    calibrationId: job.calibrationId,
    compilerVersion: job.compilerVersion,
    requestedShots: request.shots,
    completedShots: job.completedShots,
    resultDigest: job.resultDigest,
  };
}

export async function runExperiment(
  request: SubmitRequest,
  provider: QuantumProvider,
  store: ExperimentStore,
  signal: AbortSignal,
): Promise<ExecutionManifest> {
  const idempotencyKey = `quantum-experiment:${request.experimentId}`;
  await store.reserve(request.experimentId, request.circuitHash);

  // A lost submit response must resume the accepted provider job, not create another.
  const existing = await provider.findByIdempotencyKey(idempotencyKey);
  const submitted =
    existing ?? (await provider.submit(request, idempotencyKey));
  await store.attachProviderJob(request.experimentId, submitted.id);

  let job = submitted;
  while (job.state === 'queued' || job.state === 'running') {
    signal.throwIfAborted();
    await sleep(1_000);
    job = await provider.get(job.id);
  }

  const manifest = requireCompleteEvidence(request, job);

  // complete() must be idempotent because terminal callbacks can be delivered twice.
  await store.complete(request.experimentId, manifest);
  return manifest;
}
