'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Boxes,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Gauge,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Tags,
  TextSearch,
  XCircle,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

const BLOCK_ID = 'genai/clip-architecture-release-assessment-lab';

type UseCase = {
  id: 'retrieval' | 'zero-shot';
  label: string;
  detail: string;
  primaryMetric: string;
  artifactRequirement: string;
};

type Policy = {
  id: string;
  label: string;
  detail: string;
  minimumRetrievalRecall10: number;
  minimumZeroShotAccuracy: number;
  maximumCalibrationError: number;
  minimumWorstSliceDelta: number;
  maximumP95LatencyMs: number;
};

type Candidate = {
  id: string;
  label: string;
  detail: string;
  processorFixtureMatch: boolean;
  tokenizerFixtureMatch: boolean;
  normalizedEmbeddings: boolean;
  embeddingDimension: number;
  expectedDimension: number;
  indexManifestMatches: boolean;
  promptBankValidated: boolean;
  rollbackReady: boolean;
  retrievalRecall10: number;
  zeroShotAccuracy: number;
  calibrationError: number;
  worstSliceDelta: number;
  p95LatencyMs: number;
  operationalTruth: string;
};

type ReleaseAssessmentModel = {
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    useCaseId: UseCase['id'];
    candidateId: string;
    policyId: string;
  };
  useCases: UseCase[];
  policies: Policy[];
  candidates: Candidate[];
};

type Gate = {
  id: string;
  label: string;
  observed: string;
  threshold: string;
  passed: boolean;
  contract: boolean;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isUseCase(value: unknown): value is UseCase {
  if (!value || typeof value !== 'object') return false;
  const useCase = value as Partial<UseCase>;
  return Boolean(
    ['retrieval', 'zero-shot'].includes(useCase.id ?? '')
      && useCase.label
      && useCase.detail
      && useCase.primaryMetric
      && useCase.artifactRequirement,
  );
}

function isPolicy(value: unknown): value is Policy {
  if (!value || typeof value !== 'object') return false;
  const policy = value as Partial<Policy>;
  return Boolean(
    policy.id
      && policy.label
      && policy.detail
      && isFiniteNumber(policy.minimumRetrievalRecall10)
      && isFiniteNumber(policy.minimumZeroShotAccuracy)
      && isFiniteNumber(policy.maximumCalibrationError)
      && isFiniteNumber(policy.minimumWorstSliceDelta)
      && isFiniteNumber(policy.maximumP95LatencyMs),
  );
}

function isCandidate(value: unknown): value is Candidate {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Candidate>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && typeof candidate.processorFixtureMatch === 'boolean'
      && typeof candidate.tokenizerFixtureMatch === 'boolean'
      && typeof candidate.normalizedEmbeddings === 'boolean'
      && isFiniteNumber(candidate.embeddingDimension)
      && isFiniteNumber(candidate.expectedDimension)
      && typeof candidate.indexManifestMatches === 'boolean'
      && typeof candidate.promptBankValidated === 'boolean'
      && typeof candidate.rollbackReady === 'boolean'
      && isFiniteNumber(candidate.retrievalRecall10)
      && isFiniteNumber(candidate.zeroShotAccuracy)
      && isFiniteNumber(candidate.calibrationError)
      && isFiniteNumber(candidate.worstSliceDelta)
      && isFiniteNumber(candidate.p95LatencyMs)
      && candidate.operationalTruth,
  );
}

function isReleaseAssessmentModel(value: unknown): value is ReleaseAssessmentModel {
  if (!value || typeof value !== 'object') return false;
  const model = value as Partial<ReleaseAssessmentModel>;
  return Boolean(
    model.blockId === BLOCK_ID
      && model.title
      && model.description
      && ['retrieval', 'zero-shot'].includes(model.defaults?.useCaseId ?? '')
      && model.defaults?.candidateId
      && model.defaults?.policyId
      && Array.isArray(model.useCases)
      && model.useCases.length === 2
      && model.useCases.every(isUseCase)
      && Array.isArray(model.policies)
      && model.policies.length >= 2
      && model.policies.every(isPolicy)
      && Array.isArray(model.candidates)
      && model.candidates.length >= 3
      && model.candidates.every(isCandidate)
      && model.candidates.some((candidate) => candidate.id === model.defaults?.candidateId)
      && model.policies.some((policy) => policy.id === model.defaults?.policyId),
  );
}

function formatDelta(value: number) {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)} pp`;
}

export default function ClipArchitectureReleaseAssessmentLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ReleaseAssessmentModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No CLIP release model was supplied.');
      return;
    }

    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isReleaseAssessmentModel(payload)) {
          throw new Error('The release model is incomplete or has the wrong blockId.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load release evidence.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return (
      <LabState
        error={error}
        onRetry={() => setReloadKey((key) => key + 1)}
      />
    );
  }

  return <ReleaseAssessmentLab data={data} />;
}

function ReleaseAssessmentLab({ data }: { data: ReleaseAssessmentModel }) {
  const [useCaseId, setUseCaseId] = useState<UseCase['id']>(data.defaults.useCaseId);
  const [candidateId, setCandidateId] = useState(data.defaults.candidateId);
  const [policyId, setPolicyId] = useState(data.defaults.policyId);
  const useCase = data.useCases.find((item) => item.id === useCaseId) ?? data.useCases[0];
  const candidate = data.candidates.find((item) => item.id === candidateId)
    ?? data.candidates[0];
  const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];

  const assessment = useMemo(() => {
    const geometryMatches = (
      candidate.normalizedEmbeddings
      && candidate.embeddingDimension === candidate.expectedDimension
    );
    const useArtifactPasses = useCase.id === 'retrieval'
      ? candidate.indexManifestMatches
      : candidate.promptBankValidated;
    const primaryValue = useCase.id === 'retrieval'
      ? candidate.retrievalRecall10
      : candidate.zeroShotAccuracy;
    const primaryThreshold = useCase.id === 'retrieval'
      ? policy.minimumRetrievalRecall10
      : policy.minimumZeroShotAccuracy;

    const gates: Gate[] = [
      {
        id: 'processor',
        label: 'Image processor fixtures',
        observed: candidate.processorFixtureMatch ? 'Exact match' : 'Changed',
        threshold: 'Exact approved tensors',
        passed: candidate.processorFixtureMatch,
        contract: true,
      },
      {
        id: 'tokenizer',
        label: 'Tokenizer fixtures',
        observed: candidate.tokenizerFixtureMatch ? 'Exact match' : 'Changed',
        threshold: 'Exact approved IDs',
        passed: candidate.tokenizerFixtureMatch,
        contract: true,
      },
      {
        id: 'geometry',
        label: 'Embedding geometry',
        observed: `${candidate.embeddingDimension}D ${candidate.normalizedEmbeddings ? 'normalized' : 'unnormalized'}`,
        threshold: `${candidate.expectedDimension}D and L2-normalized`,
        passed: geometryMatches,
        contract: true,
      },
      {
        id: 'derived-artifact',
        label: useCase.id === 'retrieval' ? 'Catalog image index' : 'Class prompt bank',
        observed: useArtifactPasses ? 'Candidate manifest' : 'Missing or stale',
        threshold: useCase.artifactRequirement,
        passed: useArtifactPasses,
        contract: true,
      },
      {
        id: 'primary-quality',
        label: useCase.primaryMetric,
        observed: `${primaryValue.toFixed(1)}%`,
        threshold: `At least ${primaryThreshold.toFixed(1)}%`,
        passed: primaryValue >= primaryThreshold,
        contract: false,
      },
      ...(useCase.id === 'zero-shot'
        ? [{
          id: 'calibration',
          label: 'Expected calibration error',
          observed: candidate.calibrationError.toFixed(2),
          threshold: `At most ${policy.maximumCalibrationError.toFixed(2)}`,
          passed: candidate.calibrationError <= policy.maximumCalibrationError,
          contract: false,
        }]
        : []),
      {
        id: 'slice',
        label: 'Worst protected slice',
        observed: formatDelta(candidate.worstSliceDelta),
        threshold: `No worse than ${formatDelta(policy.minimumWorstSliceDelta)}`,
        passed: candidate.worstSliceDelta >= policy.minimumWorstSliceDelta,
        contract: false,
      },
      {
        id: 'latency',
        label: 'Encoder p95 latency',
        observed: `${candidate.p95LatencyMs.toFixed(0)} ms`,
        threshold: `At most ${policy.maximumP95LatencyMs.toFixed(0)} ms`,
        passed: candidate.p95LatencyMs <= policy.maximumP95LatencyMs,
        contract: false,
      },
      {
        id: 'rollback',
        label: 'Complete rollback',
        observed: candidate.rollbackReady ? 'Loaded' : 'Unavailable',
        threshold: 'Previous manifest routable',
        passed: candidate.rollbackReady,
        contract: true,
      },
    ];
    const failed = gates.filter((gate) => !gate.passed);
    const contractFailures = failed.filter((gate) => gate.contract);
    const ready = failed.length === 0;

    let verdict = 'Eligible for a bounded canary';
    let explanation = 'Every exact artifact and use-specific evidence gate passes. Keep the candidate attributable and expand only on healthy online evidence.';

    if (contractFailures.length > 0) {
      verdict = 'Hold: the serving contract is incomplete';
      explanation = `${contractFailures.length} exact contract gate${contractFailures.length === 1 ? '' : 's'} failed. Average quality cannot make incompatible vectors or derived artifacts safe.`;
    } else if (failed.length > 0) {
      verdict = 'Hold: use-specific evidence is below policy';
      explanation = `${failed.length} quality, slice, calibration, latency, or rollback gate${failed.length === 1 ? '' : 's'} failed for ${useCase.label.toLowerCase()}.`;
    }

    return {
      contractFailures,
      failed,
      gates,
      primaryValue,
      ready,
      explanation,
      verdict,
    };
  }, [candidate, policy, useCase]);

  function reset() {
    setUseCaseId(data.defaults.useCaseId);
    setCandidateId(data.defaults.candidateId);
    setPolicyId(data.defaults.policyId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Use-specific release gate"
          title={data.title}
          description={data.description}
          icon={ShieldCheck}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Product decision
                </legend>
                <div className="mt-3 space-y-2">
                  {data.useCases.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === useCase.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'retrieval' ? Search : Tags}
                      accent={item.id === 'retrieval' ? 'cyan' : 'violet'}
                      onClick={() => setUseCaseId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Candidate bundle
                </legend>
                <div className="mt-3 space-y-2">
                  {data.candidates.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === candidate.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'identical-repack' ? PackageCheck : Boxes}
                      accent={item.id === 'identical-repack' ? 'emerald' : item.id === 'processor-drift' ? 'rose' : item.id === 'fast-quantized' ? 'amber' : 'blue'}
                      onClick={() => setCandidateId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <label className="block">
                <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Evidence policy
                </span>
                <select
                  value={policy.id}
                  onChange={(event) => setPolicyId(event.target.value)}
                  className="mt-3 h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                >
                  {data.policies.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
                <span className="mt-2 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  {policy.detail}
                </span>
              </label>
            </div>
          )}
        >
          <div className="min-h-[540px]">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label={useCase.primaryMetric}
                value={`${assessment.primaryValue.toFixed(1)}%`}
                detail={useCase.label}
                icon={useCase.id === 'retrieval' ? TextSearch : BadgeCheck}
                tone={assessment.gates.find((gate) => gate.id === 'primary-quality')?.passed ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Worst slice delta"
                value={formatDelta(candidate.worstSliceDelta)}
                detail="Candidate versus approved baseline"
                icon={Gauge}
                tone={candidate.worstSliceDelta >= policy.minimumWorstSliceDelta ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Encoder p95"
                value={`${candidate.p95LatencyMs.toFixed(0)} ms`}
                detail={`Budget ${policy.maximumP95LatencyMs.toFixed(0)} ms`}
                icon={Clock3}
                tone={candidate.p95LatencyMs <= policy.maximumP95LatencyMs ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Release"
                value={assessment.ready ? 'Canary' : 'Hold'}
                detail={`${assessment.gates.length - assessment.failed.length}/${assessment.gates.length} gates pass`}
                icon={assessment.ready ? CheckCircle2 : XCircle}
                tone={assessment.ready ? 'emerald' : 'rose'}
              />
            </div>

            <section
              className={`mt-5 rounded-md border p-5 ${
                assessment.ready
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-50'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {assessment.ready
                  ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-70">Release decision</p>
                  <h4 className="mt-1 text-lg font-semibold">{assessment.verdict}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-85">{assessment.explanation}</p>
                  <p className="mt-2 text-sm font-semibold leading-6">{candidate.operationalTruth}</p>
                </div>
              </div>
            </section>

            <div className="mt-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Independent evidence
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    Exact contracts do not average with quality metrics
                  </h4>
                </div>
                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                  {candidate.embeddingDimension}D output | {candidate.normalizedEmbeddings ? 'normalized' : 'not normalized'}
                </p>
              </div>

              <div className="mt-4 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
                {assessment.gates.map((gate) => (
                  <div
                    key={gate.id}
                    className="grid gap-2 border-b border-neutral-200 bg-white p-4 last:border-b-0 sm:grid-cols-[minmax(0,1.2fr)_minmax(120px,0.7fr)_minmax(0,1.4fr)] sm:items-center dark:border-neutral-800 dark:bg-neutral-950"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      {gate.passed
                        ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                        : <XCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-300" />}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-950 dark:text-white">{gate.label}</p>
                        <p className="mt-0.5 text-[11px] font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                          {gate.contract ? 'Exact contract' : 'Measured evidence'}
                        </p>
                      </div>
                    </div>
                    <p className={`text-sm font-semibold tabular-nums ${gate.passed ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                      {gate.observed}
                    </p>
                    <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">{gate.threshold}</p>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              <RotateCcw aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              Fixture metrics demonstrate gate independence. Replace them with versioned offline evaluations, artifact attestations, and canary evidence owned by the product team.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LabState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="not-prose my-7 flex min-h-72 items-center justify-center rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950"
    >
      <div className="max-w-md text-center">
        {error
          ? <AlertTriangle aria-hidden="true" className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-300" />
          : <LoaderCircle aria-hidden="true" className="mx-auto h-7 w-7 text-cyan-600 dark:text-cyan-300" />}
        <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
          {error ? 'Release assessment unavailable' : 'Loading release evidence...'}
        </p>
        {error ? (
          <>
            <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-neutral-950 px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:bg-white dark:text-neutral-950"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Retry
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
