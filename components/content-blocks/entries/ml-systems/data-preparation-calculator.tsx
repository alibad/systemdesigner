'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  PackageCheck,
  ShieldAlert,
  Users,
} from 'lucide-react';

import {
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/data-preparation/data/preparation-release-policy.json';
const BLOCK_ID = 'ml-systems/data-preparation-calculator';

type LabData = {
  title: string;
  description: string;
  defaults: {
    records: number;
    workers: number;
    recordsPerSecondPerWorker: number;
    invalidRatePct: number;
    slaMinutes: number;
  };
  policy: {
    workerEfficiency: number;
    warningInvalidRatePct: number;
    blockingInvalidRatePct: number;
    maximumWorkers: number;
    detail: string;
  };
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      data.defaults &&
      typeof data.defaults.records === 'number' &&
      typeof data.defaults.workers === 'number' &&
      typeof data.defaults.recordsPerSecondPerWorker === 'number' &&
      typeof data.defaults.invalidRatePct === 'number' &&
      typeof data.defaults.slaMinutes === 'number' &&
      data.policy &&
      typeof data.policy.workerEfficiency === 'number' &&
      typeof data.policy.blockingInvalidRatePct === 'number',
  );
}

const formatCount = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(value));

const formatCompact = (value: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
    Math.round(value),
  );

export default function DataPreparationCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState(20_000_000);
  const [workers, setWorkers] = useState(4);
  const [recordsPerSecondPerWorker, setRecordsPerSecondPerWorker] = useState(2_500);
  const [invalidRatePct, setInvalidRatePct] = useState(1.25);
  const [slaMinutes, setSlaMinutes] = useState(45);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load the release policy (${response.status}).`);
        return response.json() as Promise<unknown>;
      })
      .then((value) => {
        if (!isLabData(value)) throw new Error('The preparation policy has an invalid contract.');
        setData(value);
        setRecords(value.defaults.records);
        setWorkers(value.defaults.workers);
        setRecordsPerSecondPerWorker(value.defaults.recordsPerSecondPerWorker);
        setInvalidRatePct(value.defaults.invalidRatePct);
        setSlaMinutes(value.defaults.slaMinutes);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') {
          setError(fetchError instanceof Error ? fetchError.message : 'Could not load the lab.');
        }
      });
    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    if (!data) return null;
    const effectiveThroughput =
      workers * recordsPerSecondPerWorker * data.policy.workerEfficiency;
    const durationMinutes = records / effectiveThroughput / 60;
    const quarantinedRecords = records * (invalidRatePct / 100);
    const publishableRecords = records - quarantinedRecords;
    const requiredWorkers = Math.ceil(
      records /
        (slaMinutes * 60 * recordsPerSecondPerWorker * data.policy.workerEfficiency),
    );
    const meetsTime = durationMinutes <= slaMinutes;
    const blocksQuality = invalidRatePct >= data.policy.blockingInvalidRatePct;
    const warnsQuality = invalidRatePct >= data.policy.warningInvalidRatePct;

    if (blocksQuality) {
      return {
        status: 'block' as const,
        title: 'Block the dataset release',
        detail:
          'The batch may finish on time, but its invalid-record rate crosses the example blocking contract. Scaling workers cannot repair data quality.',
        durationMinutes,
        effectiveThroughput,
        meetsTime,
        publishableRecords,
        quarantinedRecords,
        requiredWorkers,
      };
    }
    if (!meetsTime) {
      return {
        status: 'late' as const,
        title: 'The batch misses its preparation SLA',
        detail: `At least ${requiredWorkers} workers are needed at the observed per-worker rate, assuming the same efficiency. Quality checks still remain mandatory.`,
        durationMinutes,
        effectiveThroughput,
        meetsTime,
        publishableRecords,
        quarantinedRecords,
        requiredWorkers,
      };
    }
    if (warnsQuality) {
      return {
        status: 'review' as const,
        title: 'Finish on time, then review the quarantine spike',
        detail:
          'The prepared output can meet the time budget, but the invalid share crossed the warning threshold. Compare reason codes with the previous release before publishing.',
        durationMinutes,
        effectiveThroughput,
        meetsTime,
        publishableRecords,
        quarantinedRecords,
        requiredWorkers,
      };
    }
    return {
      status: 'ready' as const,
      title: 'The candidate is inside both example gates',
      detail:
        'Capacity and invalid-record checks pass. The dataset still needs split, leakage, privacy, and semantic validation before model training.',
      durationMinutes,
      effectiveThroughput,
      meetsTime,
      publishableRecords,
      quarantinedRecords,
      requiredWorkers,
    };
  }, [data, invalidRatePct, records, recordsPerSecondPerWorker, slaMinutes, workers]);

  const reset = () => {
    if (!data) return;
    setRecords(data.defaults.records);
    setWorkers(data.defaults.workers);
    setRecordsPerSecondPerWorker(data.defaults.recordsPerSecondPerWorker);
    setInvalidRatePct(data.defaults.invalidRatePct);
    setSlaMinutes(data.defaults.slaMinutes);
  };

  if (error) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!data || !result) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className="not-prose my-7 h-96 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading preparation capacity lab"
      />
    );
  }

  const verdictClass =
    result.status === 'ready'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
      : result.status === 'review'
        ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
        : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100';
  const VerdictIcon = result.status === 'ready' ? CheckCircle2 : AlertTriangle;
  const validPct = 100 - invalidRatePct;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Preparation capacity lab"
          title={data.title}
          description={data.description}
          icon={Gauge}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <LabRange
                label="Raw batch size"
                value={records}
                output={`${formatCompact(records)} rows`}
                min={1_000_000}
                max={100_000_000}
                step={1_000_000}
                accent="cyan"
                lowLabel="1 million"
                highLabel="100 million"
                onChange={setRecords}
              />
              <LabRange
                label="Parallel workers"
                value={workers}
                output={`${workers}`}
                min={1}
                max={data.policy.maximumWorkers}
                accent="blue"
                lowLabel="One worker"
                highLabel={`${data.policy.maximumWorkers} workers`}
                onChange={setWorkers}
              />
              <LabRange
                label="Observed rate per worker"
                value={recordsPerSecondPerWorker}
                output={`${formatCount(recordsPerSecondPerWorker)} rows/s`}
                min={500}
                max={10_000}
                step={500}
                accent="violet"
                lowLabel="Heavy transforms"
                highLabel="Light transforms"
                onChange={setRecordsPerSecondPerWorker}
              />
              <LabRange
                label="Invalid records"
                value={invalidRatePct}
                output={`${invalidRatePct.toFixed(2)}%`}
                min={0}
                max={8}
                step={0.25}
                accent="rose"
                lowLabel="Clean batch"
                highLabel="Contract breach"
                onChange={setInvalidRatePct}
              />
              <LabRange
                label="Preparation SLA"
                value={slaMinutes}
                output={`${slaMinutes} min`}
                min={15}
                max={180}
                step={5}
                accent="amber"
                lowLabel="15 minutes"
                highLabel="3 hours"
                onChange={setSlaMinutes}
              />
            </div>
          }
        >
          <div className="space-y-6" aria-live="polite">
            <div className={`rounded-md border p-5 ${verdictClass}`}>
              <div className="flex items-start gap-3">
                <VerdictIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Release verdict</p>
                  <h4 className="mt-1 text-xl font-semibold">{result.title}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-85">{result.detail}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Prepare time"
                value={`${result.durationMinutes.toFixed(1)} min`}
                detail={`SLA: ${slaMinutes} min`}
                icon={Clock3}
                tone={result.meetsTime ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Effective rate"
                value={`${formatCompact(result.effectiveThroughput)}/s`}
                detail={`${Math.round(data.policy.workerEfficiency * 100)}% worker efficiency assumption`}
                icon={Users}
                tone="blue"
              />
              <LabMetric
                label="Publishable"
                value={formatCompact(result.publishableRecords)}
                detail={`${validPct.toFixed(2)}% of input`}
                icon={PackageCheck}
                tone="cyan"
              />
              <LabMetric
                label="Quarantined"
                value={formatCompact(result.quarantinedRecords)}
                detail="Retained with reason codes"
                icon={ShieldAlert}
                tone={result.status === 'block' ? 'rose' : 'amber'}
              />
            </div>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                <Database aria-hidden="true" className="h-4 w-4" />
                Batch disposition
              </div>
              <div className="mt-4 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div className="flex h-5 w-full">
                  <div
                    className="bg-emerald-500 transition-[width] motion-reduce:transition-none"
                    style={{ width: `${validPct}%` }}
                    title={`${formatCount(result.publishableRecords)} publishable records`}
                  />
                  <div
                    className="bg-rose-500 transition-[width] motion-reduce:transition-none"
                    style={{ width: `${invalidRatePct}%` }}
                    title={`${formatCount(result.quarantinedRecords)} quarantined records`}
                  />
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-neutral-600 sm:grid-cols-2 dark:text-neutral-300">
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Prepared: {formatCount(result.publishableRecords)}
                </span>
                <span className="inline-flex items-center gap-2 sm:justify-end">
                  <ShieldAlert aria-hidden="true" className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  Quarantine: {formatCount(result.quarantinedRecords)}
                </span>
              </div>
            </div>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {data.policy.detail} Throughput is an observed input, not a vendor guarantee. Measure it
              with representative transforms, record sizes, storage, and worker limits.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
