'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Files,
  Gauge,
  LoaderCircle,
  ScanText,
  Timer,
  Users,
  Workflow,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/document-parsing/data/capacity-scenarios.json';
const BLOCK_ID = 'ml-systems/document-parsing-calculator';

type Workload = {
  id: string;
  label: string;
  detail: string;
  nativeSecondsPerPage: number;
  ocrSecondsPerPage: number;
  structureSecondsPerPage: number;
  defaultDocumentsPerMinute: number;
  defaultPagesPerDocument: number;
  defaultOcrPercent: number;
  defaultReviewPercent: number;
};

type CapacityData = {
  title: string;
  description: string;
  reviewMinutesPerDocument: number;
  targetUtilizationPercent: number;
  workloads: Workload[];
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isCapacityData(value: unknown): value is CapacityData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<CapacityData>;
  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && isFiniteNumber(data.reviewMinutesPerDocument)
      && isFiniteNumber(data.targetUtilizationPercent)
      && Array.isArray(data.workloads)
      && data.workloads.length > 0
      && data.workloads.every((workload) => (
        typeof workload.id === 'string'
        && typeof workload.label === 'string'
        && typeof workload.detail === 'string'
        && isFiniteNumber(workload.nativeSecondsPerPage)
        && isFiniteNumber(workload.ocrSecondsPerPage)
        && isFiniteNumber(workload.structureSecondsPerPage)
        && isFiniteNumber(workload.defaultDocumentsPerMinute)
        && isFiniteNumber(workload.defaultPagesPerDocument)
        && isFiniteNumber(workload.defaultOcrPercent)
        && isFiniteNumber(workload.defaultReviewPercent)
      )),
  );
}

function formatRate(value: number, unit: string) {
  return `${value.toFixed(value < 10 ? 1 : 0)} ${unit}`;
}

function UtilizationBar({
  label,
  value,
  target,
}: {
  label: string;
  value: number;
  target: number;
}) {
  const width = Math.min(100, value);
  const overloaded = value >= 100;
  const nearTarget = !overloaded && value >= target;
  const barTone = overloaded
    ? 'bg-rose-600 dark:bg-rose-400'
    : nearTarget
      ? 'bg-amber-500 dark:bg-amber-400'
      : 'bg-emerald-600 dark:bg-emerald-400';

  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">{label}</span>
        <span className="font-semibold tabular-nums text-neutral-950 dark:text-white">
          {value.toFixed(0)}%
        </span>
      </div>
      <div
        className="mt-2 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
        role="progressbar"
        aria-label={`${label} utilization`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, Math.round(value))}
        aria-valuetext={`${value.toFixed(0)} percent${overloaded ? ', overloaded' : ''}`}
      >
        <div className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${barTone}`} style={{ width: `${width}%` }} />
      </div>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Planning target: below {target}%
      </p>
    </div>
  );
}

export default function DocumentParsingCapacityLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<CapacityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workloadId, setWorkloadId] = useState('mixed-packets');
  const [documentsPerMinute, setDocumentsPerMinute] = useState(18);
  const [pagesPerDocument, setPagesPerDocument] = useState(6);
  const [ocrPercent, setOcrPercent] = useState(45);
  const [parserWorkers, setParserWorkers] = useState(12);
  const [reviewPercent, setReviewPercent] = useState(12);
  const [reviewers, setReviewers] = useState(4);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Capacity model request failed (${response.status}).`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isCapacityData(payload)) throw new Error('Capacity model data is incomplete.');
        const initial = payload.workloads.find((item) => item.id === 'mixed-packets')
          ?? payload.workloads[0];
        setData(payload);
        setWorkloadId(initial.id);
        setDocumentsPerMinute(initial.defaultDocumentsPerMinute);
        setPagesPerDocument(initial.defaultPagesPerDocument);
        setOcrPercent(initial.defaultOcrPercent);
        setReviewPercent(initial.defaultReviewPercent);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load capacity model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    if (!data) return null;
    const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];
    const ocrShare = ocrPercent / 100;
    const reviewShare = reviewPercent / 100;
    const secondsPerPage = (
      (1 - ocrShare) * workload.nativeSecondsPerPage
      + ocrShare * workload.ocrSecondsPerPage
      + workload.structureSecondsPerPage
    );
    const incomingPagesPerMinute = documentsPerMinute * pagesPerDocument;
    const parserCapacityPagesPerMinute = parserWorkers * 60 / secondsPerPage;
    const parserUtilization = incomingPagesPerMinute / parserCapacityPagesPerMinute * 100;
    const parserBacklogPagesPerHour = Math.max(
      0,
      (incomingPagesPerMinute - parserCapacityPagesPerMinute) * 60,
    );
    const reviewLoadPerHour = documentsPerMinute * 60 * reviewShare;
    const reviewCapacityPerHour = reviewers * 60 / data.reviewMinutesPerDocument;
    const reviewUtilization = reviewLoadPerHour / reviewCapacityPerHour * 100;
    const reviewBacklogPerHour = Math.max(0, reviewLoadPerHour - reviewCapacityPerHour);
    const parserLimitDocumentsPerMinute = parserCapacityPagesPerMinute / pagesPerDocument;
    const reviewLimitDocumentsPerMinute = reviewShare === 0
      ? Number.POSITIVE_INFINITY
      : reviewCapacityPerHour / reviewShare / 60;
    const sustainableDocumentsPerMinute = Math.min(
      parserLimitDocumentsPerMinute,
      reviewLimitDocumentsPerMinute,
    );
    const parserOverloaded = parserUtilization >= 100;
    const reviewOverloaded = reviewUtilization >= 100;
    const nearCapacity = (
      parserUtilization >= data.targetUtilizationPercent
      || reviewUtilization >= data.targetUtilizationPercent
    );
    const bottleneck = parserLimitDocumentsPerMinute <= reviewLimitDocumentsPerMinute
      ? 'Parser workers'
      : 'Human review';
    const status = parserOverloaded || reviewOverloaded
      ? 'Backlog grows'
      : nearCapacity
        ? 'Headroom is thin'
        : 'Headroom available';
    const action = parserOverloaded
      ? `Parser demand exceeds service capacity by ${parserBacklogPagesPerHour.toFixed(0)} pages per hour. Reduce OCR work, add workers, or control intake.`
      : reviewOverloaded
        ? `Review demand exceeds reviewer capacity by ${reviewBacklogPerHour.toFixed(1)} documents per hour. Tighten routing only after measuring false accepts, or add review capacity.`
        : nearCapacity
          ? `${bottleneck} is above the ${data.targetUtilizationPercent}% planning target. Bursts, retries, or a slow document slice can create queue age.`
          : `${bottleneck} is the first modeled limit, with room for ordinary variation. Load-test slow and failure slices before release.`;

    return {
      action,
      bottleneck,
      incomingPagesPerMinute,
      parserBacklogPagesPerHour,
      parserCapacityPagesPerMinute,
      parserOverloaded,
      parserUtilization,
      reviewBacklogPerHour,
      reviewCapacityPerHour,
      reviewLoadPerHour,
      reviewOverloaded,
      reviewUtilization,
      secondsPerPage,
      status,
      sustainableDocumentsPerMinute,
      workload,
    };
  }, [
    data,
    documentsPerMinute,
    ocrPercent,
    pagesPerDocument,
    parserWorkers,
    reviewPercent,
    reviewers,
    workloadId,
  ]);

  function chooseWorkload(workload: Workload) {
    setWorkloadId(workload.id);
    setDocumentsPerMinute(workload.defaultDocumentsPerMinute);
    setPagesPerDocument(workload.defaultPagesPerDocument);
    setOcrPercent(workload.defaultOcrPercent);
    setReviewPercent(workload.defaultReviewPercent);
  }

  function reset() {
    if (!data) return;
    const initial = data.workloads.find((item) => item.id === 'mixed-packets') ?? data.workloads[0];
    chooseWorkload(initial);
    setParserWorkers(12);
    setReviewers(4);
  }

  if (error) {
    return (
      <p className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100">
        {error}
      </p>
    );
  }

  if (!data || !result) {
    return (
      <div className="not-prose my-7 flex h-72 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading document parsing capacity lab">
        <LoaderCircle aria-hidden="true" className="h-7 w-7 animate-spin text-neutral-500 motion-reduce:animate-none" />
      </div>
    );
  }

  const unhealthy = result.parserOverloaded || result.reviewOverloaded;
  const statusTone = unhealthy
    ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100'
    : result.parserUtilization >= data.targetUtilizationPercent
        || result.reviewUtilization >= data.targetUtilizationPercent
      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
      : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100';

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Queues and capacity lab"
          title={data.title}
          description={data.description}
          icon={Workflow}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Workload profile
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.workloads.map((workload) => (
                    <LabChoice
                      key={workload.id}
                      selected={workload.id === result.workload.id}
                      label={workload.label}
                      detail={workload.detail}
                      icon={workload.defaultOcrPercent >= 70 ? ScanText : Files}
                      accent={workload.defaultOcrPercent >= 70 ? 'violet' : 'cyan'}
                      onClick={() => chooseWorkload(workload)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset className="space-y-5">
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Arrival work
                </legend>
                <LabRange label="Documents per minute" value={documentsPerMinute} output={`${documentsPerMinute}/min`} min={1} max={120} accent="cyan" lowLabel="Light intake" highLabel="Burst intake" onChange={setDocumentsPerMinute} />
                <LabRange label="Average pages per document" value={pagesPerDocument} output={`${pagesPerDocument} pages`} min={1} max={30} accent="blue" lowLabel="Short forms" highLabel="Long packets" onChange={setPagesPerDocument} />
                <LabRange label="Pages routed to OCR" value={ocrPercent} output={`${ocrPercent}%`} min={0} max={100} step={5} accent="violet" lowLabel="Mostly native" highLabel="All OCR" onChange={setOcrPercent} />
              </fieldset>

              <fieldset className="space-y-5">
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Service capacity
                </legend>
                <LabRange label="Parser workers" value={parserWorkers} output={String(parserWorkers)} min={1} max={64} accent="emerald" lowLabel="Small pool" highLabel="Large pool" onChange={setParserWorkers} />
                <LabRange label="Documents routed to review" value={reviewPercent} output={`${reviewPercent}%`} min={0} max={50} step={1} accent="amber" lowLabel="More automation" highLabel="More review" onChange={setReviewPercent} />
                <LabRange label="Reviewers on shift" value={reviewers} output={String(reviewers)} min={1} max={20} accent="rose" lowLabel="One reviewer" highLabel="Full team" onChange={setReviewers} />
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0" aria-live="polite">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Modeled operating point
                </p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  {result.workload.label}: {result.bottleneck} limits throughput
                </h4>
              </div>
              <span className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${statusTone}`}>
                {unhealthy ? <AlertTriangle aria-hidden="true" className="h-4 w-4" /> : <Gauge aria-hidden="true" className="h-4 w-4" />}
                {result.status}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <LabMetric label="Incoming page work" value={formatRate(result.incomingPagesPerMinute, 'pages/min')} detail={`${documentsPerMinute} documents/min x ${pagesPerDocument} pages`} icon={Files} tone="blue" />
              <LabMetric label="Parser capacity" value={formatRate(result.parserCapacityPagesPerMinute, 'pages/min')} detail={`${result.secondsPerPage.toFixed(2)} modeled worker-seconds per page`} icon={ScanText} tone={result.parserOverloaded ? 'rose' : 'cyan'} />
              <LabMetric label="Review load" value={formatRate(result.reviewLoadPerHour, 'docs/hr')} detail={`${reviewPercent}% of documents enter review`} icon={Users} tone={result.reviewOverloaded ? 'rose' : 'amber'} />
              <LabMetric label="Review capacity" value={formatRate(result.reviewCapacityPerHour, 'docs/hr')} detail={`${reviewers} reviewers at ${data.reviewMinutesPerDocument} minutes/document`} icon={Timer} tone={result.reviewOverloaded ? 'rose' : 'emerald'} />
              <LabMetric label="Sustainable intake" value={formatRate(result.sustainableDocumentsPerMinute, 'docs/min')} detail="The lower of parser and review limits, before safety headroom" icon={Gauge} tone="violet" />
            </div>

            <div className="mt-6 grid gap-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-2 dark:border-neutral-800 dark:bg-neutral-900/60">
              <UtilizationBar label="Parser pool" value={result.parserUtilization} target={data.targetUtilizationPercent} />
              <UtilizationBar label="Review team" value={result.reviewUtilization} target={data.targetUtilizationPercent} />
            </div>

            <div className={`mt-6 rounded-md border p-4 ${statusTone}`}>
              <p className="text-sm font-semibold">Capacity consequence</p>
              <p className="mt-1 text-sm leading-6">{result.action}</p>
              {unhealthy ? (
                <p className="mt-2 text-xs font-medium tabular-nums">
                  Added each hour: {result.parserBacklogPagesPerHour.toFixed(0)} parser pages and {result.reviewBacklogPerHour.toFixed(1)} review documents.
                </p>
              ) : null}
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
