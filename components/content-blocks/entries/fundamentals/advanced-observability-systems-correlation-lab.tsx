'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BadgeCheck,
  Boxes,
  Check,
  CheckCircle2,
  CircleAlert,
  FileSearch,
  Gauge,
  GitBranch,
  Link2,
  SearchX,
  ShieldAlert,
  TimerReset,
  TriangleAlert,
  Unplug,
  Wrench,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type EvidenceStage = {
  id: string;
  label: string;
  detail: string;
};

type Incident = {
  id: string;
  label: string;
  detail: string;
  symptom: string;
  presentStages: string[];
  requiredRepairId: string;
};

type Repair = {
  id: string;
  label: string;
  detail: string;
  addsStages: string[];
  consequence: string;
};

type CorrelationModel = {
  title: string;
  description: string;
  defaults: { incidentId: string; repairId: string };
  stages: EvidenceStage[];
  incidents: Incident[];
  repairs: Repair[];
};

const BLOCK_ID = 'fundamentals/advanced-observability-systems-correlation-lab';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/advanced-observability-systems/data/correlation-repair-model.json';

function isCorrelationModel(value: unknown): value is CorrelationModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CorrelationModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.incidentId
      && candidate.defaults.repairId
      && Array.isArray(candidate.stages)
      && candidate.stages.length >= 5
      && candidate.stages.every((stage) => (
        typeof stage.id === 'string'
        && typeof stage.label === 'string'
        && typeof stage.detail === 'string'
      ))
      && Array.isArray(candidate.incidents)
      && candidate.incidents.length >= 3
      && candidate.incidents.every((incident) => (
        typeof incident.id === 'string'
        && typeof incident.label === 'string'
        && typeof incident.detail === 'string'
        && typeof incident.symptom === 'string'
        && typeof incident.requiredRepairId === 'string'
        && Array.isArray(incident.presentStages)
      ))
      && Array.isArray(candidate.repairs)
      && candidate.repairs.length >= 4
      && candidate.repairs.every((repair) => (
        typeof repair.id === 'string'
        && typeof repair.label === 'string'
        && typeof repair.detail === 'string'
        && typeof repair.consequence === 'string'
        && Array.isArray(repair.addsStages)
      )),
  );
}

function incidentIcon(id: string) {
  if (id.includes('queue')) return Unplug;
  if (id.includes('log')) return FileSearch;
  if (id.includes('service')) return Boxes;
  return Gauge;
}

function stageIcon(id: string) {
  if (id === 'resource') return Boxes;
  if (id === 'trace') return Link2;
  if (id === 'span') return Activity;
  if (id === 'log') return FileSearch;
  if (id === 'exemplar') return Gauge;
  return GitBranch;
}

export default function AdvancedObservabilitySystemsCorrelationLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<CorrelationModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isCorrelationModel(payload)) throw new Error('The correlation model is incomplete.');
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load correlation data.');
      });
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Correlation repair lab"
            title="Restore the investigation chain"
            description="Loading the lesson-owned incident and instrumentation model."
            icon={Link2}
            accent="emerald"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <CorrelationLab model={model} />
      )}
    </div>
  );
}

function CorrelationLab({ model }: { model: CorrelationModel }) {
  const [incidentId, setIncidentId] = useState(model.defaults.incidentId);
  const [repairId, setRepairId] = useState(model.defaults.repairId);
  const incident = model.incidents.find((item) => item.id === incidentId) ?? model.incidents[0];
  const repair = model.repairs.find((item) => item.id === repairId) ?? model.repairs[0];

  const result = useMemo(() => {
    const available = new Set([...incident.presentStages, ...repair.addsStages]);
    const missing = model.stages.filter((stage) => !available.has(stage.id));
    const repaired = missing.length === 0;
    const targeted = incident.requiredRepairId === repair.id;
    const status = repaired
      ? 'The evidence chain can reach a representative request.'
      : `${missing.length} required ${missing.length === 1 ? 'link is' : 'links are'} still missing.`;
    return { available, missing, repaired, status, targeted };
  }, [incident, model.stages, repair]);

  function reset() {
    setIncidentId(model.defaults.incidentId);
    setRepairId(model.defaults.repairId);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Correlation repair lab"
        title={model.title}
        description={model.description}
        icon={Link2}
        accent="emerald"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Broken investigation
              </legend>
              <div className="mt-3 grid gap-2">
                {model.incidents.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === incident.id}
                    label={item.label}
                    detail={item.detail}
                    icon={incidentIcon(item.id)}
                    accent="rose"
                    onClick={() => setIncidentId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Instrumentation change
              </legend>
              <div className="mt-3 grid gap-2">
                {model.repairs.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === repair.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.addsStages.length === 0 ? TimerReset : Wrench}
                    accent={item.addsStages.length === 0 ? 'amber' : 'emerald'}
                    onClick={() => setRepairId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="space-y-6" aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Observed symptom"
              value={incident.label}
              detail={incident.symptom}
              icon={ShieldAlert}
              tone="rose"
            />
            <LabMetric
              label="Evidence links"
              value={`${result.available.size}/${model.stages.length}`}
              detail="Required stages available after the selected change."
              icon={Link2}
              tone={result.repaired ? 'emerald' : 'amber'}
            />
            <LabMetric
              label="Investigation"
              value={result.repaired ? 'Correlated' : 'Blocked'}
              detail={result.status}
              icon={result.repaired ? BadgeCheck : SearchX}
              tone={result.repaired ? 'emerald' : 'rose'}
            />
          </div>

          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Evidence path
                </p>
                <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                  Each stage must identify the same producer, request, measurement, and change.
                </p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${result.repaired
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200'}`}
              >
                {result.repaired ? 'Complete chain' : `${result.missing.length} missing`}
              </span>
            </div>

            <ol className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {model.stages.map((stage, index) => {
                const available = result.available.has(stage.id);
                const StageIcon = stageIcon(stage.id);
                return (
                  <li
                    key={stage.id}
                    className={`relative min-w-0 rounded-md border p-4 ${available
                      ? 'border-emerald-300 bg-white text-neutral-950 dark:border-emerald-900 dark:bg-neutral-950 dark:text-white'
                      : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${available
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'}`}
                      >
                        {available ? <Check aria-hidden="true" className="h-4 w-4" /> : <StageIcon aria-hidden="true" className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase opacity-60">Step {index + 1}</p>
                        <p className="mt-1 text-sm font-semibold">{stage.label}</p>
                        <p className="mt-1 text-xs leading-5 opacity-75">{stage.detail}</p>
                        <p className="mt-2 text-xs font-semibold">{available ? 'Available' : 'Missing'}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className={`rounded-md border p-4 ${result.repaired
            ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
            : result.targeted
              ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'
              : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'}`}
          >
            <div className="flex items-start gap-3">
              {result.repaired ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : result.targeted ? (
                <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div>
                <p className="text-sm font-semibold">{result.status}</p>
                <p className="mt-1 text-sm leading-6 opacity-80">{repair.consequence}</p>
                {!result.repaired ? (
                  <p className="mt-2 text-xs font-semibold">
                    Still missing: {result.missing.map((stage) => stage.label).join(', ')}.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="p-5 md:p-6">
      {error ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50">
          <div className="flex items-start gap-3">
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Correlation model unavailable</p>
              <p className="mt-1 text-sm opacity-80">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-32 items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
          Loading correlation model…
        </div>
      )}
    </div>
  );
}
