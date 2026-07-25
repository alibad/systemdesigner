'use client';

import { useEffect, useState } from 'react';
import {
  Blocks,
  BriefcaseBusiness,
  CheckCircle2,
  CloudCog,
  Compass,
  Gauge,
  Globe2,
  LockKeyhole,
  ServerCog,
  TriangleAlert,
  Workflow,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type ServiceId = 'functions' | 'managed-containers' | 'managed-kubernetes' | 'virtual-machines';
type WorkloadId = 'bursty-events' | 'steady-service' | 'custom-runtime';
type ConstraintId = 'minimal-operations' | 'portability' | 'platform-control';
type TeamId = 'generalists' | 'platform-team' | 'migration-team';
type ProviderPostureId = 'greenfield' | 'governed-incumbent' | 'fixed-geography';
type ScoreMap = Record<ServiceId, number>;

type SelectionOption<Id extends string> = {
  id: Id;
  label: string;
  detail: string;
};

type ServiceModel = {
  id: ServiceId;
  label: string;
  examples: string;
  operations: string;
  portability: string;
  control: string;
  failure: string;
  verify: string;
};

type SelectionModel = {
  workloads: Array<SelectionOption<WorkloadId> & { scores: ScoreMap }>;
  constraints: Array<SelectionOption<ConstraintId> & { adjustments: ScoreMap }>;
  teams: Array<SelectionOption<TeamId> & { adjustments: ScoreMap }>;
  providerPostures: Array<SelectionOption<ProviderPostureId> & { status: string; gate: string }>;
  serviceModels: ServiceModel[];
};

type RankedService = ServiceModel & { score: number };

const workloadIcons = {
  'bursty-events': Workflow,
  'steady-service': CloudCog,
  'custom-runtime': ServerCog,
} as const;

export default function CloudComparisonServiceSelectorLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<SelectionModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [workloadId, setWorkloadId] = useState<WorkloadId>('steady-service');
  const [constraintId, setConstraintId] = useState<ConstraintId>('minimal-operations');
  const [teamId, setTeamId] = useState<TeamId>('generalists');
  const [providerPostureId, setProviderPostureId] = useState<ProviderPostureId>('greenfield');

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The service-selection data file was not provided.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<SelectionModel>;
      })
      .then(setData)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setLoadError(error instanceof Error ? error.message : 'Unable to load the selection model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) {
    return (
      <div className="min-h-48 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
        <p className="font-semibold">Service selection model unavailable</p>
        <p className="mt-2 opacity-80">{loadError}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-[420px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading service selection model" />
    );
  }

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];
  const constraint = data.constraints.find((item) => item.id === constraintId) ?? data.constraints[0];
  const team = data.teams.find((item) => item.id === teamId) ?? data.teams[0];
  const providerPosture = data.providerPostures.find((item) => item.id === providerPostureId) ?? data.providerPostures[0];
  const ranked: RankedService[] = data.serviceModels
    .map((service) => ({
      ...service,
      score: workload.scores[service.id] + constraint.adjustments[service.id] + team.adjustments[service.id],
    }))
    .sort((left, right) => right.score - left.score);
  const recommendation = ranked[0];
  const runnerUp = ranked[1];
  const providerBlocked = providerPosture.id === 'fixed-geography';

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Constraint-driven selector"
        title="Choose an operating model, then validate providers"
        description="Change four decision inputs. The model ranks compute service families and keeps the provider decision conditional on region, contract, and workload evidence."
        icon={Compass}
        accent="blue"
        onReset={() => {
          setWorkloadId('steady-service');
          setConstraintId('minimal-operations');
          setTeamId('generalists');
          setProviderPostureId('greenfield');
        }}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Workload shape</legend>
              <div className="mt-3 space-y-2">
                {data.workloads.map((option) => (
                  <LabChoice
                    key={option.id}
                    selected={option.id === workload.id}
                    label={option.label}
                    detail={option.detail}
                    icon={workloadIcons[option.id]}
                    accent="blue"
                    onClick={() => setWorkloadId(option.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Dominant constraint</legend>
              <div className="mt-3 space-y-2">
                {data.constraints.map((option) => (
                  <LabChoice
                    key={option.id}
                    selected={option.id === constraint.id}
                    label={option.label}
                    detail={option.detail}
                    icon={option.id === 'portability' ? Blocks : option.id === 'platform-control' ? Gauge : CloudCog}
                    accent="violet"
                    onClick={() => setConstraintId(option.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">3. Team capability</legend>
              <div className="mt-3 space-y-2">
                {data.teams.map((option) => (
                  <LabChoice
                    key={option.id}
                    selected={option.id === team.id}
                    label={option.label}
                    detail={option.detail}
                    icon={BriefcaseBusiness}
                    accent="cyan"
                    onClick={() => setTeamId(option.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">4. Provider posture</legend>
              <div className="mt-3 space-y-2">
                {data.providerPostures.map((option) => (
                  <LabChoice
                    key={option.id}
                    selected={option.id === providerPosture.id}
                    label={option.label}
                    detail={option.detail}
                    icon={option.id === 'fixed-geography' ? LockKeyhole : Globe2}
                    accent={option.id === 'fixed-geography' ? 'amber' : 'emerald'}
                    onClick={() => setProviderPostureId(option.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        }
      >
        <div aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric label="Starting service" value={recommendation.label} detail={`Runner-up: ${runnerUp.label}`} icon={ServerCog} tone="blue" />
            <LabMetric label="Portability" value={recommendation.portability} detail={`Platform control: ${recommendation.control}`} icon={Blocks} tone="violet" />
            <LabMetric label="Operations load" value={recommendation.operations} detail="Relative platform work, not application ownership." icon={CloudCog} tone="cyan" />
          </div>

          <section className="mt-5 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
            <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">Service-family ranking</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Scores compare only the selected workload, constraint, and team model. They are not provider benchmarks.</p>
            </header>
            <ol className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {ranked.map((service, index) => (
                <li key={service.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_52px] sm:items-center sm:gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{index + 1}. {service.label}</span>
                      <span className="text-xs font-semibold tabular-nums text-neutral-500 sm:hidden">{service.score} points</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                      <div className="h-full rounded-full bg-blue-500 transition-[width] duration-300" style={{ width: `${Math.max(4, Math.min(100, (service.score / 12) * 100))}%` }} />
                    </div>
                  </div>
                  <span className="hidden text-right text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-300 sm:block">{service.score}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-5 rounded-md border border-blue-200 bg-blue-50 p-5 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-50">
            <p className="text-xs font-semibold uppercase opacity-70">Starting hypothesis</p>
            <h4 className="mt-2 text-lg font-semibold">{recommendation.label}</h4>
            <p className="mt-2 text-sm leading-6 opacity-85">Examples to benchmark: {recommendation.examples}.</p>
            <p className="mt-3 text-sm leading-6"><strong>Verify:</strong> {recommendation.verify}</p>
          </section>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50">
              <div className="flex items-start gap-3">
                <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Failure still owned by the team</p>
                  <p className="mt-2 text-sm leading-6 opacity-85">{recommendation.failure}</p>
                </div>
              </div>
            </section>
            <section className={`rounded-md border p-4 ${providerBlocked ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50' : 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'}`}>
              <div className="flex items-start gap-3">
                {providerBlocked ? <LockKeyhole aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-sm font-semibold">{providerPosture.status}</p>
                  <p className="mt-2 text-sm leading-6 opacity-85">{providerPosture.gate}</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
