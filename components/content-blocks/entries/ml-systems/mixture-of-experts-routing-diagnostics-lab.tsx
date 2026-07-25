'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Network,
  Route,
  ServerCrash,
  ShieldCheck,
  Stethoscope,
  XCircle,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_DATA_FILE = '/api/content/ml-systems/mixture-of-experts/data/routing-failure-scenarios.json';
const BLOCK_ID = 'ml-systems/mixture-of-experts-routing-diagnostics-lab';

type Stage = 'route' | 'dispatch' | 'execute' | 'combine';

type Outcome = {
  score: number;
  verdict: string;
  detail: string;
  droppedTokensPct: number;
  p99LatencyMs: number;
  maxExpertLoadPct: number;
  survivesFailure: boolean;
};

type Incident = {
  id: string;
  label: string;
  detail: string;
  failureStage: Stage;
  signals: string[];
  outcomes: Record<string, Outcome>;
};

type Mitigation = {
  id: string;
  label: string;
  detail: string;
  kind: 'routing' | 'placement' | 'recovery' | 'capacity';
};

type LabData = {
  title: string;
  description: string;
  defaults: { incidentId: string; mitigationId: string };
  incidents: Incident[];
  mitigations: Mitigation[];
};

const stages: Array<{ id: Stage; label: string; icon: typeof Route }> = [
  { id: 'route', label: 'Score & select', icon: Route },
  { id: 'dispatch', label: 'All-to-all', icon: Network },
  { id: 'execute', label: 'Expert compute', icon: Cpu },
  { id: 'combine', label: 'Merge outputs', icon: ShieldCheck },
];

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
        && ['route', 'dispatch', 'execute', 'combine'].includes(incident.failureStage)
        && Array.isArray(incident.signals)
        && incident.outcomes
      ))
      && Array.isArray(data.mitigations)
      && data.mitigations.length > 0
      && data.mitigations.every((mitigation) => (
        typeof mitigation.id === 'string'
        && typeof mitigation.label === 'string'
      )),
  );
}

function choiceIcon(kind: Mitigation['kind']) {
  if (kind === 'routing') return Route;
  if (kind === 'placement') return Network;
  if (kind === 'recovery') return ServerCrash;
  return Cpu;
}

export default function MixtureOfExpertsRoutingDiagnosticsLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [incidentId, setIncidentId] = useState('');
  const [mitigationId, setMitigationId] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load routing scenarios (${response.status}).`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isLabData(payload)) throw new Error('Routing scenario data is incomplete.');
        setData(payload);
        setIncidentId(payload.defaults.incidentId);
        setMitigationId(payload.defaults.mitigationId);
      })
      .catch((loadError: unknown) => {
        if ((loadError as { name?: string }).name !== 'AbortError') {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load the routing lab.');
        }
      });

    return () => controller.abort();
  }, [dataFile]);

  const incident = data?.incidents.find((item) => item.id === incidentId) ?? data?.incidents[0];
  const mitigation = data?.mitigations.find((item) => item.id === mitigationId) ?? data?.mitigations[0];
  const outcome = useMemo(
    () => incident && mitigation ? incident.outcomes[mitigation.id] : undefined,
    [incident, mitigation],
  );

  function reset() {
    if (!data) return;
    setIncidentId(data.defaults.incidentId);
    setMitigationId(data.defaults.mitigationId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Routing incident lab"
          title={data?.title ?? 'Diagnose the failed stage before changing capacity'}
          description={data?.description ?? 'Loading incident evidence...'}
          icon={Stethoscope}
          accent="rose"
          onReset={data ? reset : undefined}
        />

        {!data || !incident || !mitigation || !outcome ? (
          <div className="p-6">
            <div className={`rounded-md border p-4 text-sm ${error
              ? 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
              : 'border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300'}`}>
              {error ?? 'Loading routing scenarios...'}
            </div>
          </div>
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Inject a production symptom
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.incidents.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === incident.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.failureStage === 'dispatch' ? Network : item.failureStage === 'execute' ? ServerCrash : AlertTriangle}
                        accent={item.failureStage === 'execute' ? 'rose' : item.failureStage === 'dispatch' ? 'amber' : 'violet'}
                        onClick={() => setIncidentId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    2. Commit a mitigation
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.mitigations.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === mitigation.id}
                        label={item.label}
                        detail={item.detail}
                        icon={choiceIcon(item.kind)}
                        accent={item.kind === 'recovery' ? 'rose' : item.kind === 'capacity' ? 'amber' : item.kind === 'placement' ? 'blue' : 'violet'}
                        onClick={() => setMitigationId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Mitigation score"
                value={`${outcome.score}/100`}
                detail="Fit for this incident, not a universal ranking"
                icon={CheckCircle2}
                tone={outcome.score >= 80 ? 'emerald' : outcome.score >= 55 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Dropped tokens"
                value={`${outcome.droppedTokensPct.toFixed(1)}%`}
                detail="Tokens without the intended expert result"
                icon={XCircle}
                tone={outcome.droppedTokensPct <= 0.5 ? 'emerald' : outcome.droppedTokensPct <= 3 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="p99 layer latency"
                value={`${outcome.p99LatencyMs} ms`}
                detail="Modeled MoE-layer tail latency"
                icon={Network}
                tone={outcome.p99LatencyMs <= 18 ? 'emerald' : outcome.p99LatencyMs <= 35 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Hottest expert"
                value={`${outcome.maxExpertLoadPct}%`}
                detail={outcome.survivesFailure ? 'Request path remains available' : 'Request path still loses expert work'}
                icon={Cpu}
                tone={outcome.maxExpertLoadPct <= 100 ? 'emerald' : outcome.maxExpertLoadPct <= 125 ? 'amber' : 'rose'}
              />
            </div>

            <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Failed token path
              </p>
              <div className="mt-4 grid gap-2 md:grid-cols-4">
                {stages.map((stage, index) => {
                  const Icon = stage.icon;
                  const failed = stage.id === incident.failureStage;
                  return (
                    <div key={stage.id} className="relative min-w-0">
                      <div className={`h-full rounded-md border p-3 ${failed
                        ? 'border-rose-400 bg-rose-50 text-rose-950 ring-1 ring-rose-400 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50'
                        : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'}`}>
                        <Icon aria-hidden="true" className="h-4 w-4" />
                        <p className="mt-2 text-xs font-semibold uppercase opacity-70">Step {index + 1}</p>
                        <p className="mt-1 text-sm font-semibold">{stage.label}</p>
                        {failed ? <p className="mt-1 text-xs font-semibold">Observed fault</p> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)]">
              <div className={`rounded-md border p-4 ${outcome.score >= 80
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
                : outcome.score >= 55
                  ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'}`}>
                <p className="font-semibold">{outcome.verdict}</p>
                <p className="mt-2 text-sm leading-6 opacity-80">{outcome.detail}</p>
              </div>
              <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Evidence to confirm
                </p>
                <ul className="mt-3 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
                  {incident.signals.map((signal) => (
                    <li key={signal} className="flex gap-2">
                      <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                      <span>{signal}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}
