'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Braces,
  CheckCircle2,
  CircleAlert,
  Database,
  HardDrive,
  RadioTower,
  Search,
  Server,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import {
  LabChoice,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type StageKind =
  | 'source'
  | 'endpoint'
  | 'ingest'
  | 'storage'
  | 'query';

type GenerationStage = {
  id: string;
  label: string;
  eyebrow: string;
  detail: string;
  kind: StageKind;
};

type FailureScenario = {
  id: string;
  label: string;
  detail: string;
  activeStageIds: string[];
  degradedStageIds?: string[];
  failedStageIds?: string[];
  outcome: string;
  response: string;
};

type Generation = {
  id: string;
  label: string;
  detail: string;
  querySurface: string;
  retentionContract: string;
  storageContract: string;
  stages: GenerationStage[];
  scenarios: FailureScenario[];
};

type GenerationFailureModel = {
  note: string;
  generations: Generation[];
};

const DEFAULT_DATA_FILE =
  '/api/content/technology/influxdb/data/generation-failure-paths.json';

const stageIcons: Record<StageKind, LucideIcon> = {
  source: RadioTower,
  endpoint: Server,
  ingest: Activity,
  storage: HardDrive,
  query: Search,
};

function isGenerationFailureModel(value: unknown): value is GenerationFailureModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<GenerationFailureModel>;
  return Boolean(
    Array.isArray(candidate.generations)
      && candidate.generations.length > 0
      && candidate.generations.every(
        (generation) =>
          Array.isArray(generation.stages)
          && generation.stages.length > 0
          && Array.isArray(generation.scenarios)
          && generation.scenarios.length > 0,
      ),
  );
}

export default function InfluxDBGenerationFailureLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<GenerationFailureModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [generationId, setGenerationId] = useState('');
  const [scenarioId, setScenarioId] = useState('');

  function applyGeneration(generation: Generation) {
    setGenerationId(generation.id);
    setScenarioId(generation.scenarios[0]?.id ?? '');
  }

  useEffect(() => {
    let active = true;

    async function load() {
      setError(null);
      try {
        const response = await fetch(dataFile);
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const payload = (await response.json()) as unknown;
        if (!isGenerationFailureModel(payload)) {
          throw new Error('The generation and failure model is incomplete.');
        }
        if (!active) return;
        setData(payload);
        const initial =
          payload.generations.find((generation) => generation.id === 'v3-core')
          ?? payload.generations[0];
        applyGeneration(initial);
      } catch (loadError) {
        if (!active) return;
        setData(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the failure-path model.',
        );
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const generation = useMemo(
    () => data?.generations.find((item) => item.id === generationId) ?? null,
    [data, generationId],
  );
  const scenario = useMemo(
    () =>
      generation?.scenarios.find((item) => item.id === scenarioId)
      ?? generation?.scenarios[0]
      ?? null,
    [generation, scenarioId],
  );

  return (
    <div data-content-block="technology/influxdb-generation-failure-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Generation and failure-path lab"
          title="Trace the architecture you actually operate"
          description="Switch product generations, then inject a failure. The selected path changes because query languages, storage engines, retention behavior, and operational limits are generation-specific."
          icon={ShieldAlert}
          accent="violet"
          onReset={
            data
              ? () =>
                  applyGeneration(
                    data.generations.find((item) => item.id === 'v3-core')
                      ?? data.generations[0],
                  )
              : undefined
          }
        />

        {!data || !generation || !scenario ? (
          <LoadState
            error={error}
            onRetry={() => setReloadKey((key) => key + 1)}
          />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Choose the product generation
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.generations.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === generation.id}
                        label={item.label}
                        detail={item.detail}
                        icon={
                          item.id === 'v2-oss'
                            ? Database
                            : item.id === 'v3-enterprise'
                              ? HardDrive
                              : Braces
                        }
                        accent="violet"
                        onClick={() => applyGeneration(item)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    2. Inject a condition
                  </legend>
                  <div className="mt-3 space-y-2">
                    {generation.scenarios.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === scenario.id}
                        label={item.label}
                        detail={item.detail}
                        icon={
                          item.id === 'healthy'
                            ? CheckCircle2
                            : CircleAlert
                        }
                        accent={item.id === 'healthy' ? 'emerald' : 'rose'}
                        onClick={() => setScenarioId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
          >
            <div className="grid gap-3 md:grid-cols-3">
              <ContractCard
                label="Query surface"
                value={generation.querySurface}
                icon={Search}
              />
              <ContractCard
                label="Storage path"
                value={generation.storageContract}
                icon={HardDrive}
              />
              <ContractCard
                label="Retention contract"
                value={generation.retentionContract}
                icon={Database}
              />
            </div>

            <div className="relative mt-5">
              <div
                aria-hidden="true"
                className="absolute left-[10%] right-[10%] top-8 hidden h-px bg-neutral-300 xl:block dark:bg-neutral-700"
              />
              <div className="relative grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {generation.stages.map((stage, index) => (
                  <StageCard
                    key={stage.id}
                    stage={stage}
                    number={index + 1}
                    active={scenario.activeStageIds.includes(stage.id)}
                    degraded={scenario.degradedStageIds?.includes(stage.id) ?? false}
                    failed={scenario.failedStageIds?.includes(stage.id) ?? false}
                  />
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase">
                  <CircleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
                  Observable outcome
                </div>
                <p className="mt-2 text-sm leading-6">{scenario.outcome}</p>
              </div>
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase">
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
                  Engineering response
                </div>
                <p className="mt-2 text-sm leading-6">{scenario.response}</p>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {data.note}
            </p>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function ContractCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {label}
      </div>
      <p className="mt-2 text-sm leading-6 text-neutral-800 dark:text-neutral-200">
        {value}
      </p>
    </div>
  );
}

function StageCard({
  stage,
  number,
  active,
  degraded,
  failed,
}: {
  stage: GenerationStage;
  number: number;
  active: boolean;
  degraded: boolean;
  failed: boolean;
}) {
  const Icon = stageIcons[stage.kind];
  let style =
    'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300';
  let status = 'Outside this path';

  if (active) {
    style =
      'border-cyan-300 bg-cyan-50 text-cyan-950 ring-1 ring-cyan-200 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-50 dark:ring-cyan-900';
    status = 'Active path';
  }
  if (degraded) {
    style =
      'border-amber-400 bg-amber-50 text-amber-950 ring-1 ring-amber-300 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-50 dark:ring-amber-900';
    status = 'Degraded';
  }
  if (failed) {
    style =
      'border-rose-400 bg-rose-50 text-rose-950 ring-1 ring-rose-300 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-50 dark:ring-rose-900';
    status = 'Blocked or rejected';
  }

  return (
    <div className={`relative min-w-0 rounded-md border p-4 ${style}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current bg-white text-xs font-bold dark:bg-neutral-950">
          {number}
        </span>
        <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
      </div>
      <p className="mt-3 text-[11px] font-semibold uppercase opacity-70">
        {stage.eyebrow}
      </p>
      <p className="mt-1 text-sm font-semibold">{stage.label}</p>
      <p className="mt-2 text-xs leading-5 opacity-80">{stage.detail}</p>
      <p className="mt-3 border-t border-current/20 pt-2 text-[11px] font-semibold uppercase">
        {status}
      </p>
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
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
        <p>{error ?? 'Loading the architecture model...'}</p>
        {error ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
          >
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}
