'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  FlaskConical,
  Gauge,
  ScanSearch,
  ShieldQuestion,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type EvidenceKey = 'promptSensitivity' | 'rubricAgreement' | 'contamination';

interface AuditMode {
  id: string;
  label: string;
  detail: string;
  reveals: EvidenceKey[];
}

interface Thresholds {
  minimumAggregatePct: number;
  minimumCriticalLowerPct: number;
  minimumCriticalItems: number;
  maximumPromptSwingPct: number;
  minimumRubricAgreementPct: number;
  maximumSuspectedOverlapPct: number;
}

interface UseCase {
  id: string;
  label: string;
  detail: string;
  thresholds: Thresholds;
}

interface EvaluationSlice {
  id: string;
  label: string;
  scorePct: number;
  items: number;
  critical: boolean;
}

interface Candidate {
  id: string;
  label: string;
  detail: string;
  aggregatePct: number;
  promptSwingPct: number;
  rubricAgreementPct: number;
  suspectedOverlapPct: number;
  slices: EvaluationSlice[];
}

interface EvidenceGateData {
  title: string;
  description: string;
  defaults: {
    candidateId: string;
    useCaseId: string;
    auditModeId: string;
  };
  auditModes: AuditMode[];
  useCases: UseCase[];
  candidates: Candidate[];
}

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/knowledge-evaluation/data/evidence-gate-model.json';
const BLOCK_ID = 'ml-systems/knowledge-evaluation-evidence-gate-lab';
const Z_95 = 1.96;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isThresholds(value: unknown): value is Thresholds {
  if (!isRecord(value)) return false;
  return [
    'minimumAggregatePct',
    'minimumCriticalLowerPct',
    'minimumCriticalItems',
    'maximumPromptSwingPct',
    'minimumRubricAgreementPct',
    'maximumSuspectedOverlapPct',
  ].every((key) => typeof value[key] === 'number');
}

function isEvidenceGateData(value: unknown): value is EvidenceGateData {
  if (!isRecord(value) || !isRecord(value.defaults)) return false;

  return Boolean(
    typeof value.title === 'string'
      && typeof value.description === 'string'
      && typeof value.defaults.candidateId === 'string'
      && typeof value.defaults.useCaseId === 'string'
      && typeof value.defaults.auditModeId === 'string'
      && Array.isArray(value.auditModes)
      && value.auditModes.length > 0
      && value.auditModes.every(
        (mode) => isRecord(mode)
          && typeof mode.id === 'string'
          && typeof mode.label === 'string'
          && typeof mode.detail === 'string'
          && Array.isArray(mode.reveals)
          && mode.reveals.every((item) => typeof item === 'string'),
      )
      && Array.isArray(value.useCases)
      && value.useCases.length > 0
      && value.useCases.every(
        (useCase) => isRecord(useCase)
          && typeof useCase.id === 'string'
          && typeof useCase.label === 'string'
          && typeof useCase.detail === 'string'
          && isThresholds(useCase.thresholds),
      )
      && Array.isArray(value.candidates)
      && value.candidates.length > 0
      && value.candidates.every(
        (candidate) => isRecord(candidate)
          && typeof candidate.id === 'string'
          && typeof candidate.label === 'string'
          && typeof candidate.detail === 'string'
          && typeof candidate.aggregatePct === 'number'
          && typeof candidate.promptSwingPct === 'number'
          && typeof candidate.rubricAgreementPct === 'number'
          && typeof candidate.suspectedOverlapPct === 'number'
          && Array.isArray(candidate.slices)
          && candidate.slices.length > 0
          && candidate.slices.every(
            (slice) => isRecord(slice)
              && typeof slice.id === 'string'
              && typeof slice.label === 'string'
              && typeof slice.scorePct === 'number'
              && typeof slice.items === 'number'
              && typeof slice.critical === 'boolean',
          ),
      ),
  );
}

function wilsonLowerPct(scorePct: number, sampleSize: number) {
  const proportion = scorePct / 100;
  const squared = Z_95 * Z_95;
  const center = proportion + squared / (2 * sampleSize);
  const spread = Z_95 * Math.sqrt(
    proportion * (1 - proportion) / sampleSize
      + squared / (4 * sampleSize * sampleSize),
  );
  return Math.max(0, (center - spread) / (1 + squared / sampleSize) * 100);
}

export default function KnowledgeEvaluationEvidenceGateLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<EvidenceGateData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [candidateId, setCandidateId] = useState('');
  const [useCaseId, setUseCaseId] = useState('');
  const [auditModeId, setAuditModeId] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile, { signal: controller.signal });
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isEvidenceGateData(payload)) {
          throw new Error('The release evidence data is incomplete.');
        }

        setData(payload);
        setCandidateId(payload.defaults.candidateId);
        setUseCaseId(payload.defaults.useCaseId);
        setAuditModeId(payload.defaults.auditModeId);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load release evidence.');
      }
    }

    void loadData();
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const candidate = data?.candidates.find((item) => item.id === candidateId) ?? data?.candidates[0];
  const useCase = data?.useCases.find((item) => item.id === useCaseId) ?? data?.useCases[0];
  const auditMode = data?.auditModes.find((item) => item.id === auditModeId) ?? data?.auditModes[0];

  const result = useMemo(() => {
    if (!candidate || !useCase || !auditMode) return null;

    const known = new Set(auditMode.reveals);
    const sliceResults = candidate.slices.map((slice) => {
      const lowerPct = wilsonLowerPct(slice.scorePct, slice.items);
      const countReady = !slice.critical
        || slice.items >= useCase.thresholds.minimumCriticalItems;
      const scoreReady = !slice.critical
        || lowerPct >= useCase.thresholds.minimumCriticalLowerPct;
      return { ...slice, lowerPct, countReady, scoreReady };
    });
    const failures: string[] = [];
    const unknowns: string[] = [];

    if (candidate.aggregatePct < useCase.thresholds.minimumAggregatePct) {
      failures.push(
        `Aggregate accuracy is ${candidate.aggregatePct.toFixed(1)}%, below ${useCase.thresholds.minimumAggregatePct}%.`,
      );
    }

    for (const slice of sliceResults.filter((item) => item.critical)) {
      if (!slice.countReady) {
        failures.push(
          `${slice.label} has ${slice.items} items; the gate requires ${useCase.thresholds.minimumCriticalItems}.`,
        );
      }
      if (!slice.scoreReady) {
        failures.push(
          `${slice.label} has a ${slice.lowerPct.toFixed(1)}% lower bound; the gate requires ${useCase.thresholds.minimumCriticalLowerPct}%.`,
        );
      }
    }

    if (!known.has('promptSensitivity')) {
      unknowns.push('Prompt sensitivity was not measured.');
    } else if (candidate.promptSwingPct > useCase.thresholds.maximumPromptSwingPct) {
      failures.push(
        `Prompt swing is ${candidate.promptSwingPct.toFixed(1)} points; the maximum is ${useCase.thresholds.maximumPromptSwingPct}.`,
      );
    }

    if (!known.has('rubricAgreement')) {
      unknowns.push('Rubric agreement was not calibrated.');
    } else if (candidate.rubricAgreementPct < useCase.thresholds.minimumRubricAgreementPct) {
      failures.push(
        `Rubric agreement is ${candidate.rubricAgreementPct.toFixed(1)}%; the minimum is ${useCase.thresholds.minimumRubricAgreementPct}%.`,
      );
    }

    if (!known.has('contamination')) {
      unknowns.push('Item provenance and near-duplicate overlap were not checked.');
    } else if (candidate.suspectedOverlapPct > useCase.thresholds.maximumSuspectedOverlapPct) {
      failures.push(
        `Suspected overlap is ${candidate.suspectedOverlapPct.toFixed(1)}%; the maximum is ${useCase.thresholds.maximumSuspectedOverlapPct}%.`,
      );
    }

    const status: 'blocked' | 'investigate' | 'supported' =
      failures.length > 0 ? 'blocked' : unknowns.length > 0 ? 'investigate' : 'supported';
    return { failures, known, sliceResults, status, unknowns };
  }, [auditMode, candidate, useCase]);

  function reset() {
    if (!data) return;
    setCandidateId(data.defaults.candidateId);
    setUseCaseId(data.defaults.useCaseId);
    setAuditModeId(data.defaults.auditModeId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Evidence gate lab"
          title={data?.title ?? 'Decide what the evidence supports'}
          description={data?.description ?? 'Loading evaluation evidence...'}
          icon={ClipboardCheck}
          accent="violet"
          onReset={data ? reset : undefined}
        />

        {!data || !candidate || !useCase || !auditMode || !result ? (
          <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Evaluation run
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.candidates.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === candidate.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.id === 'protected-balanced' ? ShieldQuestion : item.id === 'high-score-unstable' ? AlertTriangle : Gauge}
                        accent={item.id === 'protected-balanced' ? 'emerald' : item.id === 'high-score-unstable' ? 'rose' : 'blue'}
                        onClick={() => setCandidateId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    2. Intended use
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.useCases.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === useCase.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.id === 'policy-guidance' ? AlertOctagon : item.id === 'support-assist' ? ClipboardCheck : FlaskConical}
                        accent={item.id === 'policy-guidance' ? 'rose' : item.id === 'support-assist' ? 'violet' : 'blue'}
                        onClick={() => setUseCaseId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    3. Evidence review
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.auditModes.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === auditMode.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.id === 'full-evidence' ? ScanSearch : item.id === 'protocol-review' ? FileSearch : Gauge}
                        accent={item.id === 'full-evidence' ? 'emerald' : item.id === 'protocol-review' ? 'amber' : 'rose'}
                        onClick={() => setAuditModeId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
          >
            <div className="min-h-[760px] min-w-0">
              <DecisionBanner
                status={result.status}
                failures={result.failures.length}
                unknowns={result.unknowns.length}
                useCase={useCase.label}
              />

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Aggregate"
                  value={`${candidate.aggregatePct.toFixed(1)}%`}
                  detail={`Gate: at least ${useCase.thresholds.minimumAggregatePct}%`}
                  icon={Gauge}
                  tone={candidate.aggregatePct >= useCase.thresholds.minimumAggregatePct ? 'emerald' : 'rose'}
                />
                <LabMetric
                  label="Prompt swing"
                  value={result.known.has('promptSensitivity') ? `${candidate.promptSwingPct.toFixed(1)} pp` : 'Unknown'}
                  detail={`Gate: at most ${useCase.thresholds.maximumPromptSwingPct} percentage points`}
                  icon={FlaskConical}
                  tone={!result.known.has('promptSensitivity') ? 'amber' : candidate.promptSwingPct <= useCase.thresholds.maximumPromptSwingPct ? 'emerald' : 'rose'}
                />
                <LabMetric
                  label="Rubric agreement"
                  value={result.known.has('rubricAgreement') ? `${candidate.rubricAgreementPct.toFixed(1)}%` : 'Unknown'}
                  detail={`Gate: at least ${useCase.thresholds.minimumRubricAgreementPct}%`}
                  icon={ClipboardCheck}
                  tone={!result.known.has('rubricAgreement') ? 'amber' : candidate.rubricAgreementPct >= useCase.thresholds.minimumRubricAgreementPct ? 'emerald' : 'rose'}
                />
                <LabMetric
                  label="Suspected overlap"
                  value={result.known.has('contamination') ? `${candidate.suspectedOverlapPct.toFixed(1)}%` : 'Unknown'}
                  detail={`Gate: at most ${useCase.thresholds.maximumSuspectedOverlapPct}%`}
                  icon={ScanSearch}
                  tone={!result.known.has('contamination') ? 'amber' : candidate.suspectedOverlapPct <= useCase.thresholds.maximumSuspectedOverlapPct ? 'emerald' : 'rose'}
                />
              </div>

              <section className="mt-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h4 className="font-semibold text-neutral-950 dark:text-white">
                      Slice evidence
                    </h4>
                    <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                      The gate uses a 95% Wilson lower bound for critical binary-score slices.
                    </p>
                  </div>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    Critical: at least {useCase.thresholds.minimumCriticalItems} items and {useCase.thresholds.minimumCriticalLowerPct}% lower bound
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {result.sliceResults.map((slice) => {
                    const ready = slice.countReady && slice.scoreReady;
                    return (
                      <article
                        key={slice.id}
                        className={`rounded-md border p-4 ${
                          slice.critical && !ready
                            ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                            : slice.critical
                              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                              : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h5 className="font-semibold text-neutral-950 dark:text-white">
                              {slice.label}
                            </h5>
                            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              {slice.items} protected items
                            </p>
                          </div>
                          {slice.critical ? (
                            <span className="rounded-sm border border-current px-2 py-1 text-[11px] font-semibold uppercase text-neutral-700 dark:text-neutral-200">
                              Critical
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                              Observed
                            </p>
                            <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">
                              {slice.scorePct.toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                              95% lower
                            </p>
                            <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">
                              {slice.lowerPct.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                        {slice.critical ? (
                          <p className={`mt-3 text-xs font-semibold ${ready ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                            {ready ? 'Critical evidence gate met' : 'Critical evidence gate failed'}
                          </p>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </section>

              <section className="mt-6 rounded-md border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
                <h4 className="font-semibold text-neutral-950 dark:text-white">
                  Decision record
                </h4>
                {result.failures.length === 0 && result.unknowns.length === 0 ? (
                  <div className="mt-3 flex items-start gap-3 text-sm leading-6 text-emerald-800 dark:text-emerald-200">
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                    <p>
                      The selected evidence supports this bounded use under the displayed thresholds. It does not prove general knowledge or safe behavior outside the evaluated claim.
                    </p>
                  </div>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {result.failures.map((failure) => (
                      <li key={failure} className="flex items-start gap-3 text-sm leading-6 text-rose-800 dark:text-rose-200">
                        <AlertOctagon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                        <span>{failure}</span>
                      </li>
                    ))}
                    {result.unknowns.map((unknown) => (
                      <li key={unknown} className="flex items-start gap-3 text-sm leading-6 text-amber-800 dark:text-amber-200">
                        <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                        <span>{unknown}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function DecisionBanner({
  status,
  failures,
  unknowns,
  useCase,
}: {
  status: 'blocked' | 'investigate' | 'supported';
  failures: number;
  unknowns: number;
  useCase: string;
}) {
  const styles = {
    blocked: {
      icon: AlertOctagon,
      eyebrow: 'Claim blocked',
      title: 'Observed evidence fails the gate',
      detail: `${failures} requirement${failures === 1 ? '' : 's'} failed for ${useCase}.`,
      className: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50',
    },
    investigate: {
      icon: AlertTriangle,
      eyebrow: 'Evidence incomplete',
      title: 'Do not convert unknowns into a pass',
      detail: `${unknowns} validity check${unknowns === 1 ? ' is' : 's are'} still missing for ${useCase}.`,
      className: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50',
    },
    supported: {
      icon: CheckCircle2,
      eyebrow: 'Bounded claim supported',
      title: 'The selected evidence clears the gate',
      detail: `All displayed requirements pass for ${useCase}.`,
      className: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50',
    },
  } as const;
  const state = styles[status];
  const Icon = state.icon;

  return (
    <div className={`rounded-md border p-5 ${state.className}`}>
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
        <div>
          <p className="text-xs font-semibold uppercase opacity-75">{state.eyebrow}</p>
          <h4 className="mt-1 text-xl font-semibold">{state.title}</h4>
          <p className="mt-2 text-sm leading-6 opacity-80">{state.detail}</p>
        </div>
      </div>
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
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
        <p className="font-semibold">
          {error ? 'The evidence model could not load.' : 'Loading the evidence model...'}
        </p>
        {error ? (
          <>
            <p className="mt-2 leading-6">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 rounded-md bg-neutral-950 px-3 py-2 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:bg-white dark:text-neutral-950"
            >
              Retry
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
