'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  Blocks,
  CheckCircle2,
  Clock3,
  CloudCog,
  Compass,
  Database,
  Gauge,
  Globe2,
  ListChecks,
  ServerCog,
  ShieldCheck,
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

type WorkloadId = 'bursty-events' | 'long-running-api' | 'relational-transactions' | 'async-batch';
type LatencyId = 'tight-tail' | 'interactive' | 'flexible';
type OperationsId = 'low' | 'medium' | 'high';
type ConsistencyId = 'strict-regional' | 'global-strong' | 'eventual';
type PortabilityId = 'outcomes-first' | 'balanced' | 'exit-priority';

type SelectionOption<Id extends string> = {
  id: Id;
  label: string;
  detail: string;
};

type ServiceCategory = {
  id: string;
  label: string;
  role: string;
  eligibleWorkloads: WorkloadId[];
  workloadScores: Partial<Record<WorkloadId, number>>;
  latencyScores: Record<LatencyId, number>;
  operationsScores: Record<OperationsId, number>;
  consistencyScores: Record<ConsistencyId, number>;
  portabilityScores: Record<PortabilityId, number>;
  fitReason: string;
  consistencyContract: string;
  failure: string;
  verify: string;
  equivalenceCaveat: string;
  providers: {
    aws: string;
    gcp: string;
    azure: string;
  };
};

type ServiceMapperModel = {
  dimensions: {
    workloads: Array<SelectionOption<WorkloadId>>;
    latencies: Array<SelectionOption<LatencyId>>;
    operations: Array<SelectionOption<OperationsId>>;
    consistencies: Array<SelectionOption<ConsistencyId>>;
    portabilities: Array<SelectionOption<PortabilityId>>;
  };
  categories: ServiceCategory[];
};

type RankedCategory = ServiceCategory & {
  score: number;
  breakdown: Array<{ label: string; value: number }>;
};

const workloadIcons = {
  'bursty-events': Workflow,
  'long-running-api': Globe2,
  'relational-transactions': Database,
  'async-batch': ListChecks,
} as const;

const barTones = ['bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500'] as const;

function SelectControl<Id extends string>({
  id,
  label,
  value,
  options,
  icon,
  onChange,
}: {
  id: string;
  label: string;
  value: Id;
  options: Array<SelectionOption<Id>>;
  icon: ReactNode;
  onChange: (value: Id) => void;
}) {
  const selected = options.find((option) => option.id === value) ?? options[0];

  return (
    <label htmlFor={id} className="block">
      <span className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {icon}
        {label}
      </span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as Id)}
        className="mt-2 h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-950 outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="mt-2 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        {selected?.detail}
      </span>
    </label>
  );
}

function LoadingState() {
  return (
    <div
      className="min-h-[520px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
      aria-label="Loading cloud service mapping model"
    />
  );
}

export default function CloudServicesComparisonServiceMapper({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ServiceMapperModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [workloadId, setWorkloadId] = useState<WorkloadId>('long-running-api');
  const [latencyId, setLatencyId] = useState<LatencyId>('interactive');
  const [operationsId, setOperationsId] = useState<OperationsId>('low');
  const [consistencyId, setConsistencyId] = useState<ConsistencyId>('strict-regional');
  const [portabilityId, setPortabilityId] = useState<PortabilityId>('balanced');

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The service mapping data file was not provided.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<ServiceMapperModel>;
      })
      .then(setData)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setLoadError(error instanceof Error ? error.message : 'Unable to load the mapping model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) {
    return (
      <div data-content-block="reference/cloud-services-comparison-service-mapper">
        <div
          className="min-h-48 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
          role="alert"
        >
          <p className="font-semibold">Service mapping model unavailable</p>
          <p className="mt-2 opacity-80">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div data-content-block="reference/cloud-services-comparison-service-mapper">
        <LoadingState />
      </div>
    );
  }

  const workload = data.dimensions.workloads.find((item) => item.id === workloadId) ?? data.dimensions.workloads[0];
  const latency = data.dimensions.latencies.find((item) => item.id === latencyId) ?? data.dimensions.latencies[0];
  const operations = data.dimensions.operations.find((item) => item.id === operationsId) ?? data.dimensions.operations[0];
  const consistency = data.dimensions.consistencies.find((item) => item.id === consistencyId) ?? data.dimensions.consistencies[0];
  const portability = data.dimensions.portabilities.find((item) => item.id === portabilityId) ?? data.dimensions.portabilities[0];

  const ranked: RankedCategory[] = data.categories
    .filter((category) => category.eligibleWorkloads.includes(workloadId))
    .map((category) => {
      const breakdown = [
        { label: 'workload', value: (category.workloadScores[workloadId] ?? 0) * 2 },
        { label: 'latency', value: category.latencyScores[latencyId] },
        { label: 'operations', value: category.operationsScores[operationsId] },
        { label: 'consistency', value: category.consistencyScores[consistencyId] },
        { label: 'portability', value: category.portabilityScores[portabilityId] },
      ];
      return {
        ...category,
        breakdown,
        score: breakdown.reduce((total, item) => total + item.value, 0),
      };
    })
    .sort((left, right) => right.score - left.score);

  const recommendation = ranked[0];
  const runnerUp = ranked[1];

  if (!recommendation) {
    return (
      <div data-content-block="reference/cloud-services-comparison-service-mapper">
        <div className="rounded-md border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100" role="alert">
          No service categories are configured for this workload.
        </div>
      </div>
    );
  }

  const providerExamples = [
    { label: 'AWS investigation', value: recommendation.providers.aws },
    { label: 'Google Cloud investigation', value: recommendation.providers.gcp },
    { label: 'Azure investigation', value: recommendation.providers.azure },
  ];

  return (
    <div data-content-block="reference/cloud-services-comparison-service-mapper">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Constraint-driven service mapper"
          title="Rank a service category without inventing equivalence"
          description="Choose the workload and four operating constraints. Only categories that perform the selected role enter the ranking; provider examples remain products to verify, not substitutes for one another."
          icon={Compass}
          accent="blue"
          onReset={() => {
            setWorkloadId('long-running-api');
            setLatencyId('interactive');
            setOperationsId('low');
            setConsistencyId('strict-regional');
            setPortabilityId('balanced');
          }}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Workload shape
                </legend>
                <div className="mt-3 space-y-2">
                  {data.dimensions.workloads.map((option) => (
                    <LabChoice
                      key={option.id}
                      selected={option.id === workloadId}
                      label={option.label}
                      detail={option.detail}
                      icon={workloadIcons[option.id]}
                      accent="blue"
                      onClick={() => setWorkloadId(option.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <SelectControl
                id="cloud-service-latency"
                label="2. Latency target"
                value={latencyId}
                options={data.dimensions.latencies}
                icon={<Clock3 aria-hidden="true" className="h-4 w-4" />}
                onChange={setLatencyId}
              />
              <SelectControl
                id="cloud-service-operations"
                label="3. Operations tolerance"
                value={operationsId}
                options={data.dimensions.operations}
                icon={<CloudCog aria-hidden="true" className="h-4 w-4" />}
                onChange={setOperationsId}
              />
              <SelectControl
                id="cloud-service-consistency"
                label="4. Consistency need"
                value={consistencyId}
                options={data.dimensions.consistencies}
                icon={<ShieldCheck aria-hidden="true" className="h-4 w-4" />}
                onChange={setConsistencyId}
              />
              <SelectControl
                id="cloud-service-portability"
                label="5. Portability posture"
                value={portabilityId}
                options={data.dimensions.portabilities}
                icon={<Blocks aria-hidden="true" className="h-4 w-4" />}
                onChange={setPortabilityId}
              />
            </div>
          }
        >
          <div>
            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Starting category"
                value={recommendation.label}
                detail={runnerUp ? `Runner-up: ${runnerUp.label}` : 'Only one credible category in this model.'}
                icon={ServerCog}
                tone="blue"
              />
              <LabMetric
                label="Consistency input"
                value={consistency?.label ?? consistencyId}
                detail="Execution and data semantics are evaluated separately."
                icon={ShieldCheck}
                tone="violet"
              />
              <LabMetric
                label="Eligible categories"
                value={String(ranked.length)}
                detail={`Filtered for ${workload?.label ?? workloadId}.`}
                icon={Gauge}
                tone="emerald"
              />
            </div>

            <section className="mt-6 border-y border-neutral-200 py-4 dark:border-neutral-800">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                <div>
                  <h4 className="text-base font-semibold text-neutral-950 dark:text-white">Category ranking</h4>
                  <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    Workload fit is weighted twice; the other four decisions remain visible in each score.
                  </p>
                </div>
                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Maximum 32 points</p>
              </div>
              <ol className="mt-4 divide-y divide-neutral-200 dark:divide-neutral-800">
                {ranked.map((category, index) => (
                  <li key={category.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                          {index + 1}. {category.label}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{category.role}</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-300">
                        {category.score}/32
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                      <div
                        className={`h-full rounded-full transition-[width] duration-300 ${barTones[index % barTones.length]}`}
                        style={{ width: `${Math.max(4, (category.score / 32) * 100)}%` }}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                      {category.breakdown.map((item) => (
                        <span key={item.label}>
                          {item.label} +{item.value}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="mt-6" aria-live="polite">
              <div className="flex items-start gap-3">
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-300">Starting hypothesis</p>
                  <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{recommendation.label}</h4>
                  <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{recommendation.fitReason}</p>
                </div>
              </div>

              <dl className="mt-5 grid overflow-hidden border-y border-neutral-200 bg-neutral-200 sm:grid-cols-3 dark:border-neutral-800 dark:bg-neutral-800">
                {providerExamples.map((provider) => (
                  <div key={provider.label} className="min-w-0 bg-white p-4 dark:bg-neutral-950">
                    <dt className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{provider.label}</dt>
                    <dd className="mt-2 break-words text-sm font-semibold leading-6 text-neutral-950 dark:text-white">{provider.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span><strong className="text-neutral-700 dark:text-neutral-200">Not equivalent:</strong> {recommendation.equivalenceCaveat}</span>
              </p>
            </section>

            <div className="mt-6 grid gap-5 border-t border-neutral-200 pt-5 md:grid-cols-2 dark:border-neutral-800">
              <section>
                <p className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                  <Database aria-hidden="true" className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  Consistency consequence
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{recommendation.consistencyContract}</p>
              </section>
              <section>
                <p className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                  <TriangleAlert aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  Failure still owned
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{recommendation.failure}</p>
              </section>
            </div>

            <section className="mt-5 border-l-4 border-blue-500 bg-blue-50 px-4 py-3 text-blue-950 dark:bg-blue-950/30 dark:text-blue-50">
              <p className="text-sm font-semibold">Evidence required before selection</p>
              <p className="mt-1 text-sm leading-6 opacity-85">{recommendation.verify}</p>
              <p className="mt-2 text-xs leading-5 opacity-75">
                Selected posture: {latency?.label}; {operations?.label}; {portability?.label}.
              </p>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
