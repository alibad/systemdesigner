'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  ArrowDown,
  CheckCircle2,
  DatabaseBackup,
  FileClock,
  GitCompareArrows,
  History,
  KeyRound,
  Layers3,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/data-pipelines/data/replay-recovery-lab.json';
const BLOCK_ID = 'ml-systems/data-pipelines-replay-recovery-lab';

type Incident = {
  id: string;
  label: string;
  detail: string;
  affectedPartitions: number;
  recordsMillions: number;
  duplicatePressurePct: number;
  historyLossPct: number;
  requiresCorrection: boolean;
};

type RecoverySource = {
  id: string;
  label: string;
  detail: string;
  historyCoveragePct: number;
  versionPinned: boolean;
};

type WriteContract = {
  id: 'append' | 'replace-partition' | 'merge-record-key';
  label: string;
  detail: string;
  deduplicates: boolean;
  replacesWrongValues: boolean;
  rollbackReady: boolean;
};

type LabData = {
  title: string;
  description: string;
  defaults: {
    incidentId: string;
    sourceId: string;
    writeId: WriteContract['id'];
    validationGate: boolean;
  };
  incidents: Incident[];
  sources: RecoverySource[];
  writes: WriteContract[];
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && data.defaults
      && Array.isArray(data.incidents)
      && data.incidents.length > 0
      && data.incidents.every((incident) => (
        typeof incident.id === 'string'
        && typeof incident.affectedPartitions === 'number'
        && typeof incident.recordsMillions === 'number'
      ))
      && Array.isArray(data.sources)
      && data.sources.length > 0
      && data.sources.every((source) => (
        typeof source.id === 'string'
        && typeof source.historyCoveragePct === 'number'
        && typeof source.versionPinned === 'boolean'
      ))
      && Array.isArray(data.writes)
      && data.writes.length > 0
      && data.writes.every((write) => (
        ['append', 'replace-partition', 'merge-record-key'].includes(write.id)
        && typeof write.deduplicates === 'boolean'
        && typeof write.replacesWrongValues === 'boolean'
      )),
  );
}

export default function DataPipelinesReplayRecoveryLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [incidentId, setIncidentId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [writeId, setWriteId] = useState<WriteContract['id']>('replace-partition');
  const [validationGate, setValidationGate] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load recovery data (${response.status}).`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isLabData(payload)) throw new Error('Recovery lab data is incomplete.');
        setData(payload);
        setIncidentId(payload.defaults.incidentId);
        setSourceId(payload.defaults.sourceId);
        setWriteId(payload.defaults.writeId);
        setValidationGate(payload.defaults.validationGate);
      })
      .catch((loadError: unknown) => {
        if ((loadError as { name?: string }).name !== 'AbortError') {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load recovery data.');
        }
      });

    return () => controller.abort();
  }, [dataFile]);

  const incident = data?.incidents.find((item) => item.id === incidentId)
    ?? data?.incidents[0];
  const source = data?.sources.find((item) => item.id === sourceId)
    ?? data?.sources[0];
  const write = data?.writes.find((item) => item.id === writeId)
    ?? data?.writes[0];

  const result = useMemo(() => {
    if (!incident || !source || !write) return null;

    const completeness = source.versionPinned
      ? 100
      : Math.max(0, Math.min(source.historyCoveragePct, 100 - incident.historyLossPct));
    const duplicateRate = write.deduplicates
      ? Math.min(0.1, incident.duplicatePressurePct * 0.01)
      : 100 + incident.duplicatePressurePct;
    const correctionApplied = !incident.requiresCorrection || write.replacesWrongValues;
    const outputCorrect = completeness >= 99.5 && duplicateRate <= 0.5 && correctionApplied;
    const exposurePct = validationGate ? (outputCorrect ? 0 : 0) : (outputCorrect ? 0 : 100);
    const rollbackReady = validationGate && source.versionPinned && write.rollbackReady;
    const throughputMillionsPerMinute = write.id === 'replace-partition' ? 0.75 : write.id === 'merge-record-key' ? 0.45 : 1.2;
    const estimatedMinutes = Math.ceil(incident.recordsMillions / throughputMillionsPerMinute + incident.affectedPartitions * 0.35);
    const checks = [
      {
        id: 'snapshot',
        label: 'Pin historical input',
        detail: source.versionPinned ? 'Original interval is reproducible.' : 'History can change during replay.',
        pass: source.versionPinned,
      },
      {
        id: 'reconcile',
        label: 'Reconcile existing output',
        detail: write.deduplicates && correctionApplied ? 'Keys and corrected values converge.' : 'Replay can preserve or add wrong rows.',
        pass: write.deduplicates && correctionApplied,
      },
      {
        id: 'validate',
        label: 'Validate in shadow',
        detail: validationGate ? 'Bad output is blocked before publication.' : 'Replay writes are immediately consumer-visible.',
        pass: validationGate,
      },
      {
        id: 'publish',
        label: 'Publish and roll back',
        detail: rollbackReady ? 'Previous manifest remains recoverable.' : 'No complete rollback path is preserved.',
        pass: rollbackReady,
      },
    ];
    const passedChecks = checks.filter((check) => check.pass).length;

    const diagnosis = outputCorrect && validationGate && rollbackReady
      ? {
          title: 'Recovery converges on one auditable truth',
          detail: 'The plan replays versioned input, reconciles existing rows, validates outside the serving path, and preserves a rollback reference.',
          tone: 'emerald' as const,
        }
      : outputCorrect && validationGate
        ? {
            title: 'The data can be corrected, but rollback is weak',
            detail: 'Validation contains bad output, yet publication cannot restore the prior manifest quickly. Preserve the replaced artifact or use an atomic versioned pointer.',
            tone: 'amber' as const,
          }
        : {
            title: 'This replay can amplify the incident',
            detail: !validationGate
              ? 'Consumer-visible writes begin before the replay proves completeness, uniqueness, and corrected values.'
              : !write.deduplicates
                ? 'Blind append republishes records that already exist, so retrying the recovery creates duplicates by design.'
                : !correctionApplied
                  ? 'The selected write contract cannot replace the values produced by the bug.'
                  : 'The selected source cannot reconstruct the complete historical interval.',
            tone: 'rose' as const,
          };

    return {
      checks,
      completeness,
      correctionApplied,
      diagnosis,
      duplicateRate,
      estimatedMinutes,
      exposurePct,
      outputCorrect,
      passedChecks,
      rollbackReady,
    };
  }, [incident, source, validationGate, write]);

  function reset() {
    if (!data) return;
    setIncidentId(data.defaults.incidentId);
    setSourceId(data.defaults.sourceId);
    setWriteId(data.defaults.writeId);
    setValidationGate(data.defaults.validationGate);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Replay recovery lab"
          title={data?.title ?? 'Rebuild truth without multiplying the incident'}
          description={data?.description ?? 'Loading the recovery model...'}
          icon={DatabaseBackup}
          accent="rose"
          onReset={data ? reset : undefined}
        />

        {!data || !incident || !source || !write || !result ? (
          <LoadState error={error} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Inject an incident
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.incidents.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === incident.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.id === 'transform-bug' ? AlertOctagon : item.id === 'duplicate-redelivery' ? RefreshCcw : FileClock}
                        accent={item.id === 'transform-bug' ? 'rose' : item.id === 'duplicate-redelivery' ? 'amber' : 'violet'}
                        onClick={() => setIncidentId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    2. Choose replay input
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.sources.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === source.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.versionPinned ? History : Layers3}
                        accent={item.versionPinned ? 'blue' : 'amber'}
                        onClick={() => setSourceId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    3. Choose write contract
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.writes.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === write.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.id === 'append' ? Layers3 : item.id === 'replace-partition' ? RotateCcw : KeyRound}
                        accent={item.id === 'append' ? 'rose' : item.id === 'replace-partition' ? 'emerald' : 'violet'}
                        onClick={() => setWriteId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <button
                  type="button"
                  aria-pressed={validationGate}
                  onClick={() => setValidationGate((current) => !current)}
                  className={`w-full rounded-md border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                    validationGate
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-100'
                      : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/45 dark:text-rose-100'
                  }`}
                >
                  <span className="flex items-start justify-between gap-4">
                    <span className="flex min-w-0 items-start gap-3">
                      <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                      <span>
                        <span className="block text-sm font-semibold">Shadow validation gate</span>
                        <span className="mt-1 block text-xs leading-5 opacity-75">
                          Compare completeness, keys, distributions, and sample records before publication.
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold uppercase">
                      {validationGate ? 'On' : 'Off'}
                    </span>
                  </span>
                </button>
              </div>
            )}
          >
            <div className="min-w-0 space-y-6" aria-live="polite">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Recovery plan
                  </p>
                  <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                    {incident.affectedPartitions} partitions / {incident.recordsMillions.toFixed(1)}M records
                  </h4>
                </div>
                <span className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${
                  result.diagnosis.tone === 'emerald'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100'
                    : result.diagnosis.tone === 'amber'
                      ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100'
                      : 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100'
                }`}>
                  {result.diagnosis.tone === 'emerald'
                    ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                    : <TriangleAlert aria-hidden="true" className="h-4 w-4" />}
                  {result.passedChecks}/4 recovery controls pass
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Historical completeness"
                  value={`${result.completeness.toFixed(0)}%`}
                  detail={source.versionPinned ? 'Versioned input interval' : 'Limited by current mutable state'}
                  icon={History}
                  tone={result.completeness >= 99.5 ? 'emerald' : 'rose'}
                />
                <LabMetric
                  label="Duplicate output"
                  value={`${result.duplicateRate.toFixed(result.duplicateRate < 1 ? 1 : 0)}%`}
                  detail={write.deduplicates ? 'Reconciled by stable identity' : 'Existing rows remain beside replay rows'}
                  icon={KeyRound}
                  tone={result.duplicateRate <= 0.5 ? 'emerald' : 'rose'}
                />
                <LabMetric
                  label="Estimated replay"
                  value={`${result.estimatedMinutes} min`}
                  detail="Illustrative bounded-throughput estimate"
                  icon={RefreshCcw}
                  tone="blue"
                />
                <LabMetric
                  label="Bad-output exposure"
                  value={`${result.exposurePct}%`}
                  detail={validationGate ? 'Shadow output blocks consumer reads' : 'Writes become visible immediately'}
                  icon={ShieldCheck}
                  tone={result.exposurePct === 0 ? 'emerald' : 'rose'}
                />
              </div>

              <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Recovery circuit
                </p>
                <h4 className="mt-1 font-semibold text-neutral-950 dark:text-white">
                  Every stage must preserve the corrected truth
                </h4>

                <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)_20px_minmax(0,1fr)_20px_minmax(0,1fr)] md:items-stretch">
                  {result.checks.map((check, index) => (
                    <RecoveryStageFragment key={check.id} check={check} showArrow={index < result.checks.length - 1} />
                  ))}
                </div>
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                  <div className="flex items-center gap-2">
                    <GitCompareArrows aria-hidden="true" className="h-5 w-5 text-violet-700 dark:text-violet-300" />
                    <h4 className="font-semibold text-neutral-950 dark:text-white">What the replay changes</h4>
                  </div>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    <li>{result.correctionApplied ? 'Wrong derived values are replaced.' : 'Wrong derived values remain in the published dataset.'}</li>
                    <li>{write.deduplicates ? 'Retries converge by partition or stable record key.' : 'Each replay adds another copy of existing records.'}</li>
                    <li>{result.completeness >= 99.5 ? 'The full historical interval is available.' : `${(100 - result.completeness).toFixed(0)}% of historical records cannot be reconstructed.`}</li>
                  </ul>
                </div>

                <div className={`rounded-md border p-4 ${
                  result.rollbackReady
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                    : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
                }`}>
                  <div className="flex items-center gap-2">
                    <RotateCcw aria-hidden="true" className="h-5 w-5 text-neutral-800 dark:text-neutral-100" />
                    <h4 className="font-semibold text-neutral-950 dark:text-white">Rollback posture</h4>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    {result.rollbackReady
                      ? 'The replay publishes a new versioned partition manifest while retaining the previous reader-visible reference.'
                      : 'The selected plan does not preserve a complete, validated publication boundary that can be restored quickly.'}
                  </p>
                </div>
              </section>

              <section className={`rounded-md border p-5 ${
                result.diagnosis.tone === 'emerald'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
                  : result.diagnosis.tone === 'amber'
                    ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
                    : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100'
              }`}>
                <div className="flex items-start gap-3">
                  {result.diagnosis.tone === 'emerald'
                    ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                    : <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                  <div>
                    <h4 className="font-semibold">{result.diagnosis.title}</h4>
                    <p className="mt-2 text-sm leading-6 opacity-80">{result.diagnosis.detail}</p>
                  </div>
                </div>
              </section>

              <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Illustrative model: measure actual read throughput, write contention, consumer lag, validation time, and rollback behavior before scheduling a production backfill.
              </p>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function RecoveryStageFragment({
  check,
  showArrow,
}: {
  check: { label: string; detail: string; pass: boolean };
  showArrow: boolean;
}) {
  return (
    <>
      <div className={`min-w-0 rounded-md border p-3 ${
        check.pass
          ? 'border-emerald-200 bg-white text-neutral-950 dark:border-emerald-900 dark:bg-neutral-950 dark:text-white'
          : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/45 dark:text-rose-100'
      }`}>
        {check.pass
          ? <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
          : <AlertOctagon aria-hidden="true" className="h-5 w-5 text-rose-700 dark:text-rose-300" />}
        <p className="mt-3 text-sm font-semibold">{check.label}</p>
        <p className="mt-1 text-xs leading-5 opacity-75">{check.detail}</p>
      </div>
      {showArrow ? (
        <div className="flex items-center justify-center text-neutral-400 dark:text-neutral-600">
          <ArrowDown aria-hidden="true" className="h-5 w-5 md:-rotate-90" />
        </div>
      ) : null}
    </>
  );
}

function LoadState({ error }: { error: string | null }) {
  return (
    <div className="min-h-72 p-5 md:p-6">
      {error ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
          {error}
        </div>
      ) : (
        <div className="h-64 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-900" aria-label="Loading replay recovery lab" />
      )}
    </div>
  );
}
