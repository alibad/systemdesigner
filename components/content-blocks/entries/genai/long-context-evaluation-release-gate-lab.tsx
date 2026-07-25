'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Code2,
  FileCheck2,
  Gauge,
  Layers3,
  RefreshCw,
  Route,
  Scale,
  ShieldCheck,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

interface ProductProfile {
  id: string;
  label: string;
  detail: string;
  minimumEvidenceUsePct: number;
  taskWeight: number;
  evidenceWeight: number;
}

interface Measurement {
  contextK: number;
  taskSuccessPct: number;
  evidenceUsePct: number;
  p95LatencySeconds: number;
  costPerThousandUsd: number;
}

interface Candidate {
  id: string;
  label: string;
  detail: string;
  tradeoff: string;
  measurements: Measurement[];
}

interface ReleaseGateData {
  title: string;
  description: string;
  defaults: {
    profileId: string;
    candidateId: string;
    contextK: number;
    minimumTaskSuccessPct: number;
    latencyBudgetSeconds: number;
  };
  contextLengthsK: number[];
  profiles: ProductProfile[];
  candidates: Candidate[];
}

const DEFAULT_DATA_FILE =
  '/api/content/genai/long-context-evaluation/data/release-frontier-model.json';
const BLOCK_ID = 'genai/long-context-evaluation-release-gate-lab';

function isReleaseGateData(value: unknown): value is ReleaseGateData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<ReleaseGateData>;
  return Boolean(
    data.title
      && data.description
      && data.defaults
      && Array.isArray(data.contextLengthsK)
      && data.contextLengthsK.length > 0
      && Array.isArray(data.profiles)
      && data.profiles.length > 0
      && Array.isArray(data.candidates)
      && data.candidates.length > 0
      && data.candidates.every((candidate) => (
        typeof candidate.id === 'string'
        && Array.isArray(candidate.measurements)
        && candidate.measurements.length > 0
      )),
  );
}

function candidateIcon(candidateId: string) {
  if (candidateId === 'full-context') return Layers3;
  if (candidateId === 'retrieval-assisted') return Route;
  return FileCheck2;
}

function profileIcon(profileId: string) {
  if (profileId === 'repository-assistant') return Code2;
  if (profileId === 'regulated-review') return ShieldCheck;
  return FileCheck2;
}

export default function LongContextEvaluationReleaseGateLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ReleaseGateData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [profileId, setProfileId] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [contextIndex, setContextIndex] = useState(0);
  const [minimumTaskSuccessPct, setMinimumTaskSuccessPct] = useState(85);
  const [latencyBudgetSeconds, setLatencyBudgetSeconds] = useState(6);

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile, { signal: controller.signal });
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isReleaseGateData(payload)) {
          throw new Error('Release-frontier data is incomplete.');
        }

        setData(payload);
        setProfileId(payload.defaults.profileId);
        setCandidateId(payload.defaults.candidateId);
        setContextIndex(
          Math.max(0, payload.contextLengthsK.indexOf(payload.defaults.contextK)),
        );
        setMinimumTaskSuccessPct(payload.defaults.minimumTaskSuccessPct);
        setLatencyBudgetSeconds(payload.defaults.latencyBudgetSeconds);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the release model.');
      }
    }

    void loadData();
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const profile = data?.profiles.find((item) => item.id === profileId) ?? data?.profiles[0];
  const selectedCandidate =
    data?.candidates.find((item) => item.id === candidateId) ?? data?.candidates[0];

  const model = useMemo(() => {
    if (!data || !profile || !selectedCandidate) return null;
    const contextK = data.contextLengthsK[contextIndex] ?? data.contextLengthsK[0];
    const rows = data.candidates.map((candidate) => {
      const measurement =
        candidate.measurements.find((item) => item.contextK === contextK)
        ?? candidate.measurements[0];
      const weightedScore =
        measurement.taskSuccessPct * profile.taskWeight
        + measurement.evidenceUsePct * profile.evidenceWeight;
      const blockers = [
        measurement.taskSuccessPct < minimumTaskSuccessPct
          ? `task success is ${(minimumTaskSuccessPct - measurement.taskSuccessPct).toFixed(1)} points below the floor`
          : null,
        measurement.evidenceUsePct < profile.minimumEvidenceUsePct
          ? `evidence use is ${(profile.minimumEvidenceUsePct - measurement.evidenceUsePct).toFixed(1)} points below the profile floor`
          : null,
        measurement.p95LatencySeconds > latencyBudgetSeconds
          ? `p95 latency exceeds budget by ${(measurement.p95LatencySeconds - latencyBudgetSeconds).toFixed(1)}s`
          : null,
      ].filter((item): item is string => Boolean(item));

      return {
        ...candidate,
        blockers,
        measurement,
        passes: blockers.length === 0,
        weightedScore,
      };
    });
    const passing = rows
      .filter((row) => row.passes)
      .sort((left, right) => (
        right.weightedScore - left.weightedScore
        || left.measurement.costPerThousandUsd - right.measurement.costPerThousandUsd
      ));
    const selected = rows.find((row) => row.id === selectedCandidate.id) ?? rows[0];

    return {
      contextK,
      passing,
      recommendation: passing[0] ?? null,
      rows,
      selected,
    };
  }, [
    contextIndex,
    data,
    latencyBudgetSeconds,
    minimumTaskSuccessPct,
    profile,
    selectedCandidate,
  ]);

  function reset() {
    if (!data) return;
    setProfileId(data.defaults.profileId);
    setCandidateId(data.defaults.candidateId);
    setContextIndex(Math.max(0, data.contextLengthsK.indexOf(data.defaults.contextK)));
    setMinimumTaskSuccessPct(data.defaults.minimumTaskSuccessPct);
    setLatencyBudgetSeconds(data.defaults.latencyBudgetSeconds);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Usable-context release gate"
          title={data?.title ?? 'Choose a supported operating frontier'}
          description={
            data?.description
            ?? 'Loading the illustrative candidate evidence...'
          }
          icon={Scale}
          accent="violet"
          onReset={data ? reset : undefined}
        />

        {!data || !profile || !selectedCandidate || !model ? (
          <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Product contract
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.profiles.map((item) => {
                      const Icon = profileIcon(item.id);
                      return (
                        <LabChoice
                          key={item.id}
                          selected={item.id === profile.id}
                          label={item.label}
                          detail={item.detail}
                          icon={Icon}
                          accent={item.id === 'regulated-review' ? 'rose' : 'blue'}
                          onClick={() => setProfileId(item.id)}
                        />
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    2. Candidate to inspect
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.candidates.map((item) => {
                      const Icon = candidateIcon(item.id);
                      return (
                        <LabChoice
                          key={item.id}
                          selected={item.id === selectedCandidate.id}
                          label={item.label}
                          detail={item.detail}
                          icon={Icon}
                          accent={item.id === 'retrieval-assisted' ? 'emerald' : 'violet'}
                          onClick={() => setCandidateId(item.id)}
                        />
                      );
                    })}
                  </div>
                </fieldset>

                <LabRange
                  label="3. Required input length"
                  value={contextIndex}
                  output={`${model.contextK}K tokens`}
                  min={0}
                  max={data.contextLengthsK.length - 1}
                  step={1}
                  lowLabel={`${data.contextLengthsK[0]}K`}
                  highLabel={`${data.contextLengthsK[data.contextLengthsK.length - 1]}K`}
                  accent="violet"
                  onChange={setContextIndex}
                />

                <LabRange
                  label="4. Task-success floor"
                  value={minimumTaskSuccessPct}
                  output={`${minimumTaskSuccessPct}%`}
                  min={70}
                  max={95}
                  step={1}
                  lowLabel="Exploratory"
                  highLabel="Strict"
                  accent="emerald"
                  onChange={setMinimumTaskSuccessPct}
                />

                <LabRange
                  label="5. p95 latency budget"
                  value={latencyBudgetSeconds}
                  output={`${latencyBudgetSeconds.toFixed(1)}s`}
                  min={2}
                  max={14}
                  step={0.5}
                  lowLabel="Interactive"
                  highLabel="Offline workflow"
                  accent="amber"
                  onChange={setLatencyBudgetSeconds}
                />
              </div>
            )}
          >
            <div className="min-w-0 space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Candidates passing"
                  value={`${model.passing.length} / ${model.rows.length}`}
                  detail={`At ${model.contextK}K under the current gate`}
                  icon={ShieldCheck}
                  tone={model.passing.length > 0 ? 'emerald' : 'rose'}
                />
                <LabMetric
                  label="Task floor"
                  value={`${minimumTaskSuccessPct}%`}
                  detail="Minimum product-task success"
                  icon={Gauge}
                  tone="blue"
                />
                <LabMetric
                  label="Evidence floor"
                  value={`${profile.minimumEvidenceUsePct}%`}
                  detail={`${profile.label} grounding requirement`}
                  icon={FileCheck2}
                  tone="violet"
                />
                <LabMetric
                  label="Latency budget"
                  value={`${latencyBudgetSeconds.toFixed(1)}s`}
                  detail="Maximum acceptable p95"
                  icon={Clock3}
                  tone="amber"
                />
              </div>

              <section aria-labelledby="candidate-evidence-title">
                <p className="text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">
                  Candidate evidence at {model.contextK}K
                </p>
                <h4
                  id="candidate-evidence-title"
                  className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white"
                >
                  Inspect the worst constraint, not only the average
                </h4>
                <div className="mt-4 grid gap-3 xl:grid-cols-3">
                  {model.rows.map((row) => {
                    const Icon = candidateIcon(row.id);
                    const selected = row.id === model.selected.id;
                    return (
                      <button
                        key={row.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setCandidateId(row.id)}
                        className={`min-w-0 rounded-md border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                          selected
                            ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-500 dark:border-violet-400 dark:bg-violet-950/40'
                            : 'border-neutral-200 bg-white hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-600'
                        }`}
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className="flex min-w-0 items-start gap-2">
                            <Icon
                              aria-hidden="true"
                              className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300"
                            />
                            <span>
                              <span className="block font-semibold text-neutral-950 dark:text-white">
                                {row.label}
                              </span>
                              <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                                {row.tradeoff}
                              </span>
                            </span>
                          </span>
                          <span
                            className={`shrink-0 rounded px-2 py-1 text-[11px] font-semibold ${
                              row.passes
                                ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
                                : 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200'
                            }`}
                          >
                            {row.passes ? 'PASS' : 'BLOCKED'}
                          </span>
                        </span>
                        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <EvidenceMetric
                            label="Task success"
                            value={`${row.measurement.taskSuccessPct}%`}
                          />
                          <EvidenceMetric
                            label="Evidence use"
                            value={`${row.measurement.evidenceUsePct}%`}
                          />
                          <EvidenceMetric
                            label="p95 latency"
                            value={`${row.measurement.p95LatencySeconds.toFixed(1)}s`}
                          />
                          <EvidenceMetric
                            label="Cost / 1K"
                            value={`$${row.measurement.costPerThousandUsd.toFixed(0)}`}
                          />
                        </dl>
                      </button>
                    );
                  })}
                </div>
              </section>

              <div
                className={`rounded-md border p-5 ${
                  model.selected.passes
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
                    : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  {model.selected.passes ? (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  ) : (
                    <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  )}
                  <div>
                    <p className="font-semibold">
                      {model.selected.label}: {model.selected.passes ? 'supported by this gate' : 'not supported'}
                    </p>
                    {model.selected.blockers.length > 0 ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">
                        {model.selected.blockers.map((blocker) => (
                          <li key={blocker}>{blocker}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm leading-6">
                        All three declared constraints pass at {model.contextK}K.
                        A monitored canary is the next evidence step, not an automatic
                        global rollout.
                      </p>
                    )}
                    {model.recommendation && model.recommendation.id !== model.selected.id ? (
                      <p className="mt-2 text-sm leading-6">
                        Best passing weighted evidence: <strong>{model.recommendation.label}</strong>.
                      </p>
                    ) : null}
                    {!model.recommendation ? (
                      <p className="mt-2 text-sm leading-6">
                        No candidate passes. Reduce the required frontier, improve the
                        architecture, or gather new evidence; do not lower a gate after
                        seeing the result.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                All candidate measurements are illustrative. Replace them with versioned
                runs from the exact model, prompt, tokenizer, retrieval index, and serving
                path used in production.
              </p>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function EvidenceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-neutral-100 p-3 dark:bg-neutral-900">
      <dt className="text-[11px] font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </dt>
      <dd className="mt-1 text-base font-semibold tabular-nums text-neutral-950 dark:text-white">
        {value}
      </dd>
    </div>
  );
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="p-6">
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-start gap-3">
          <CircleAlert
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300"
          />
          <div>
            <p className="font-semibold text-neutral-950 dark:text-white">
              {error ? 'The release evidence could not load' : 'Loading release evidence'}
            </p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
              {error ?? 'Preparing the candidate frontier comparison.'}
            </p>
            {error ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Retry
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
