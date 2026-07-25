'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  FileScan,
  FileStack,
  Gauge,
  Layers3,
  LoaderCircle,
  Route,
  ScanText,
  Table2,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type DocumentProfile = { id: string; label: string; detail: string };
type ParseRoute = { id: string; label: string; detail: string };
type Outcome = {
  profileId: string;
  routeId: string;
  reader: string;
  parameters: string[];
  textCoveragePct: number;
  structureScore: number;
  tableScore: number;
  relativeWork: number;
  verdict: 'fit' | 'review' | 'mismatch';
  explanation: string;
  output: string[];
};
type RoutingData = {
  title: string;
  description: string;
  profiles: DocumentProfile[];
  routes: ParseRoute[];
  outcomes: Outcome[];
};

const BLOCK_ID = 'ml-systems/dedoc-systems-routing-lab';
const DATA_FILE = '/api/content/ml-systems/dedoc-systems/data/document-routing.json';

function isRoutingData(value: unknown): value is RoutingData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RoutingData>;
  return Boolean(
    Array.isArray(candidate.profiles)
      && candidate.profiles.length > 0
      && Array.isArray(candidate.routes)
      && candidate.routes.length > 0
      && Array.isArray(candidate.outcomes)
  );
}

export default function DedocSystemsRoutingLab() {
  const [data, setData] = useState<RoutingData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [profileId, setProfileId] = useState('digital-report');
  const [routeId, setRouteId] = useState('auto-tabby');

  useEffect(() => {
    const controller = new AbortController();
    fetch(DATA_FILE, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Routing model request failed: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isRoutingData(payload)) throw new Error('Routing model is invalid');
        setData(payload);
        setProfileId(payload.profiles[0].id);
        setRouteId(payload.routes[0].id);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(true);
      });
    return () => controller.abort();
  }, []);

  const outcome = data?.outcomes.find((item) => item.profileId === profileId && item.routeId === routeId);

  if (loadError) {
    return (
      <div className="not-prose my-7 flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
        <TriangleAlert aria-hidden="true" className="h-5 w-5" />
        The document routing model could not be loaded.
      </div>
    );
  }

  if (!data || !outcome) {
    return (
      <div className="not-prose my-7 flex min-h-72 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-950 text-neutral-300 dark:border-neutral-800">
        <LoaderCircle aria-hidden="true" className="mr-2 h-5 w-5 animate-spin" />
        Loading document routes...
      </div>
    );
  }

  const verdictStyles = {
    fit: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100',
    review: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100',
    mismatch: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100',
  } as const;
  const verdictLabel = outcome.verdict === 'fit' ? 'Route fit' : outcome.verdict === 'review' ? 'Review required' : 'Route mismatch';

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Reader and parameter routing lab"
          title={data.title}
          description={data.description}
          icon={Route}
          accent="cyan"
          onReset={() => {
            setProfileId(data.profiles[0].id);
            setRouteId(data.routes[0].id);
          }}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Input contract</p>
                <div className="mt-3 space-y-2">
                  {data.profiles.map((profile) => (
                    <LabChoice key={profile.id} selected={profile.id === profileId} label={profile.label} detail={profile.detail} icon={FileStack} accent="blue" onClick={() => setProfileId(profile.id)} />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Parse route</p>
                <div className="mt-3 space-y-2">
                  {data.routes.map((route) => (
                    <LabChoice key={route.id} selected={route.id === routeId} label={route.label} detail={route.detail} icon={ScanText} accent="violet" onClick={() => setRouteId(route.id)} />
                  ))}
                </div>
              </div>
            </div>
          )}
        >
          <div className={`rounded-md border p-5 ${verdictStyles[outcome.verdict]}`}>
            <div className="flex items-start gap-3">
              {outcome.verdict === 'fit'
                ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
              <div>
                <p className="text-xs font-semibold uppercase opacity-75">{verdictLabel}</p>
                <h4 className="mt-1 text-xl font-semibold">{outcome.reader}</h4>
                <p className="mt-2 text-sm leading-6 opacity-80">{outcome.explanation}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Text coverage" value={`${outcome.textCoveragePct}%`} detail="Modeled recoverable text" icon={FileScan} tone={outcome.textCoveragePct >= 90 ? 'emerald' : 'rose'} />
            <LabMetric label="Structure" value={`${outcome.structureScore}/100`} detail="Hierarchy and reading-order fit" icon={Layers3} tone={outcome.structureScore >= 80 ? 'blue' : 'amber'} />
            <LabMetric label="Tables" value={`${outcome.tableScore}/100`} detail="Table extraction fit" icon={Table2} tone={outcome.tableScore >= 80 ? 'cyan' : 'amber'} />
            <LabMetric label="Relative work" value={`${outcome.relativeWork.toFixed(1)}x`} detail="Illustrative compute versus a native text path" icon={Gauge} tone={outcome.relativeWork <= 2 ? 'violet' : 'rose'} />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Request parameters</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {outcome.parameters.map((parameter) => (
                  <code key={parameter} className="rounded bg-neutral-900 px-2 py-1 text-xs text-cyan-200 dark:bg-black">{parameter}</code>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Expected output contract</p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
                {outcome.output.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
