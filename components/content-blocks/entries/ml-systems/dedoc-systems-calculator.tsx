'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Boxes,
  CircleAlert,
  Clock3,
  FileStack,
  Gauge,
  LoaderCircle,
  MemoryStick,
  ScanText,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bound = { min: number; max: number; step: number };
type Profile = {
  id: string;
  label: string;
  detail: string;
  documentsPerDay: number;
  pagesPerDocument: number;
  scannedPagePct: number;
  tablePagePct: number;
  workers: number;
  completionWindowHours: number;
};
type EnvelopeData = {
  title: string;
  description: string;
  assumptions: {
    nativePageSeconds: number;
    ocrPageSeconds: number;
    tableAnalysisMultiplier: number;
    workerMemoryGiB: number;
    warningUtilizationPct: number;
  };
  bounds: {
    documentsPerDay: Bound;
    pagesPerDocument: Bound;
    scannedPagePct: Bound;
    tablePagePct: Bound;
    workers: Bound;
  };
  profiles: Profile[];
};

const BLOCK_ID = 'ml-systems/dedoc-systems-calculator';
const DATA_FILE = '/api/content/ml-systems/dedoc-systems/data/processing-envelope.json';

function isEnvelopeData(value: unknown): value is EnvelopeData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EnvelopeData>;
  return Boolean(
    candidate.assumptions
      && candidate.bounds
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length > 0
  );
}

export default function DedocSystemsCalculator() {
  const [data, setData] = useState<EnvelopeData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [profileId, setProfileId] = useState('contracts');
  const [documentsPerDay, setDocumentsPerDay] = useState(12000);
  const [pagesPerDocument, setPagesPerDocument] = useState(18);
  const [scannedPagePct, setScannedPagePct] = useState(20);
  const [tablePagePct, setTablePagePct] = useState(25);
  const [workers, setWorkers] = useState(8);

  useEffect(() => {
    const controller = new AbortController();
    fetch(DATA_FILE, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Processing envelope request failed: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isEnvelopeData(payload)) throw new Error('Processing envelope is invalid');
        setData(payload);
        applyProfile(payload.profiles[0]);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(true);
      });
    return () => controller.abort();
  }, []);

  const selectedProfile = data?.profiles.find((profile) => profile.id === profileId) ?? data?.profiles[0];

  const model = useMemo(() => {
    if (!data || !selectedProfile) return null;
    const nativeShare = 1 - scannedPagePct / 100;
    const averagePageSeconds =
      nativeShare * data.assumptions.nativePageSeconds
      + (scannedPagePct / 100) * data.assumptions.ocrPageSeconds;
    const tableFactor = 1 + (tablePagePct / 100) * (data.assumptions.tableAnalysisMultiplier - 1);
    const documentSeconds = pagesPerDocument * averagePageSeconds * tableFactor;
    const docsPerWorkerHour = 3600 / documentSeconds;
    const fleetThroughputPerHour = docsPerWorkerHour * workers;
    const completionHours = documentsPerDay / fleetThroughputPerHour;
    const utilizationPct = (completionHours / selectedProfile.completionWindowHours) * 100;
    const completedInWindow = fleetThroughputPerHour * selectedProfile.completionWindowHours;
    const backlogDocuments = Math.max(0, Math.ceil(documentsPerDay - completedInWindow));
    return {
      documentSeconds,
      fleetThroughputPerHour,
      completionHours,
      utilizationPct,
      backlogDocuments,
      peakMemoryGiB: workers * data.assumptions.workerMemoryGiB,
      healthy: utilizationPct < data.assumptions.warningUtilizationPct,
    };
  }, [data, documentsPerDay, pagesPerDocument, scannedPagePct, selectedProfile, tablePagePct, workers]);

  function applyProfile(profile: Profile) {
    setProfileId(profile.id);
    setDocumentsPerDay(profile.documentsPerDay);
    setPagesPerDocument(profile.pagesPerDocument);
    setScannedPagePct(profile.scannedPagePct);
    setTablePagePct(profile.tablePagePct);
    setWorkers(profile.workers);
  }

  const reset = () => {
    if (data?.profiles[0]) applyProfile(data.profiles[0]);
  };

  if (loadError) {
    return (
      <div className="not-prose my-7 flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
        <TriangleAlert aria-hidden="true" className="h-5 w-5" />
        The document processing model could not be loaded.
      </div>
    );
  }

  if (!data || !selectedProfile || !model) {
    return (
      <div className="not-prose my-7 flex min-h-72 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-950 text-neutral-300 dark:border-neutral-800">
        <LoaderCircle aria-hidden="true" className="mr-2 h-5 w-5 animate-spin" />
        Loading the processing envelope...
      </div>
    );
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Document fleet capacity lab"
          title={data.title}
          description={data.description}
          icon={Gauge}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Document population</p>
                <div className="mt-3 space-y-2">
                  {data.profiles.map((profile) => (
                    <LabChoice
                      key={profile.id}
                      selected={profile.id === profileId}
                      label={profile.label}
                      detail={profile.detail}
                      icon={FileStack}
                      accent="violet"
                      onClick={() => applyProfile(profile)}
                    />
                  ))}
                </div>
              </div>
              <LabRange label="Documents per day" value={documentsPerDay} output={documentsPerDay.toLocaleString()} {...data.bounds.documentsPerDay} accent="blue" lowLabel="small queue" highLabel="large intake" onChange={setDocumentsPerDay} />
              <LabRange label="Pages per document" value={pagesPerDocument} output={String(pagesPerDocument)} {...data.bounds.pagesPerDocument} accent="cyan" lowLabel="brief" highLabel="binder" onChange={setPagesPerDocument} />
              <LabRange label="Scanned pages" value={scannedPagePct} output={`${scannedPagePct}%`} {...data.bounds.scannedPagePct} accent="amber" lowLabel="native text" highLabel="OCR-heavy" onChange={setScannedPagePct} />
              <LabRange label="Pages with tables" value={tablePagePct} output={`${tablePagePct}%`} {...data.bounds.tablePagePct} accent="emerald" lowLabel="plain text" highLabel="table-heavy" onChange={setTablePagePct} />
              <LabRange label="Workers" value={workers} output={String(workers)} {...data.bounds.workers} accent="rose" lowLabel="lean fleet" highLabel="parallel fleet" onChange={setWorkers} />
            </div>
          )}
        >
          <div className={`rounded-md border p-5 ${
            model.healthy
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35'
              : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35'
          }`}>
            <div className="flex items-start gap-3">
              {model.healthy
                ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />}
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">Queue verdict</p>
                <h4 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">
                  {model.healthy ? 'The fleet clears the modeled intake window' : 'The queue grows beyond the target window'}
                </h4>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  {model.healthy
                    ? `${workers} workers finish the modeled day in ${model.completionHours.toFixed(1)} hours, leaving room for retries and difficult outliers.`
                    : `${model.backlogDocuments.toLocaleString()} documents remain after the ${selectedProfile.completionWindowHours}-hour target. OCR and table analysis, not file count alone, drive the pressure.`}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Fleet throughput" value={`${Math.round(model.fleetThroughputPerHour).toLocaleString()}/h`} detail="Modeled sustained documents per hour" icon={Activity} tone="cyan" />
            <LabMetric label="Completion time" value={`${model.completionHours.toFixed(1)} h`} detail={`${selectedProfile.completionWindowHours} h target window`} icon={Clock3} tone={model.healthy ? 'emerald' : 'rose'} />
            <LabMetric label="Worker memory" value={`${model.peakMemoryGiB.toFixed(0)} GiB`} detail="Concurrent fleet envelope, excluding platform overhead" icon={MemoryStick} tone="violet" />
            <LabMetric label="Parse time" value={`${model.documentSeconds.toFixed(1)} s`} detail="Average modeled document service time" icon={ScanText} tone="amber" />
          </div>

          <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Window utilization</p>
                <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{Math.round(model.utilizationPct)}%</p>
              </div>
              <p className="text-right text-sm text-neutral-600 dark:text-neutral-300">
                {model.backlogDocuments === 0 ? 'Queue drains in the target window' : `${model.backlogDocuments.toLocaleString()} docs left`}
              </p>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              <div
                className={`h-full rounded-full transition-[width] duration-300 ${model.healthy ? 'bg-emerald-500' : 'bg-rose-500'}`}
                style={{ width: `${Math.min(100, model.utilizationPct)}%` }}
              />
            </div>
            <div className="mt-4 flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
              <Boxes aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              Benchmark native text, OCR, tables, attachments, and malformed files separately. A single documents-per-hour number hides the tail that determines queue age and memory pressure.
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
