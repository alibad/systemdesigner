'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CircleX,
  GitCompareArrows,
  KeyRound,
  Layers3,
  RefreshCcw,
  ShieldAlert,
  TriangleAlert,
  Workflow,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Status = 'supported' | 'caution' | 'broken';

type Compatibility = {
  status: Status;
  explanation: string;
  alternative: string;
};

type PoolingMode = {
  id: string;
  label: string;
  detail: string;
  releaseBoundary: string;
  backendContinuity: string;
  multiStatementTransactions: boolean;
  trace: Array<{
    label: string;
    server: string;
    event: string;
  }>;
};

type Feature = {
  id: string;
  label: string;
  detail: string;
  preparedStatementBehavior?: boolean;
  compatibility: Record<string, Compatibility>;
};

type CompatibilityData = {
  title: string;
  description: string;
  defaults: {
    modeId: string;
    featureId: string;
    maxPreparedStatements: number;
  };
  preparedStatementCache: {
    min: number;
    max: number;
    step: number;
  };
  modes: PoolingMode[];
  features: Feature[];
};

const BLOCK_ID = 'technology/pgbouncer-pooling-mode-lab';

function isCompatibilityData(value: unknown): value is CompatibilityData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CompatibilityData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.modeId
      && candidate.defaults.featureId
      && typeof candidate.defaults.maxPreparedStatements === 'number'
      && typeof candidate.preparedStatementCache?.min === 'number'
      && typeof candidate.preparedStatementCache.max === 'number'
      && typeof candidate.preparedStatementCache.step === 'number'
      && Array.isArray(candidate.modes)
      && candidate.modes.length > 0
      && Array.isArray(candidate.features)
      && candidate.features.length > 0,
  );
}

export default function PgBouncerPoolingModeLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<CompatibilityData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No pooling-compatibility model was supplied.');
      return;
    }

    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isCompatibilityData(payload)) {
          throw new Error('The pooling-compatibility model is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the pooling lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <CompatibilityWorkbench data={data} />;
}

function CompatibilityWorkbench({ data }: { data: CompatibilityData }) {
  const [modeId, setModeId] = useState(data.defaults.modeId);
  const [featureId, setFeatureId] = useState(data.defaults.featureId);
  const [maxPreparedStatements, setMaxPreparedStatements] = useState(
    data.defaults.maxPreparedStatements,
  );

  const mode = data.modes.find((item) => item.id === modeId) ?? data.modes[0];
  const feature = data.features.find((item) => item.id === featureId) ?? data.features[0];

  const result = useMemo(() => {
    const configured = feature.compatibility[mode.id] ?? {
      status: 'broken' as const,
      explanation: 'No compatibility contract is defined for this pairing.',
      alternative: 'Treat the behavior as unsupported until an integration test proves otherwise.',
    };

    if (
      feature.preparedStatementBehavior
      && mode.id !== 'session'
      && maxPreparedStatements === 0
    ) {
      return {
        status: 'broken' as const,
        explanation: 'PgBouncer prepared-statement tracking is disabled, so a later execution can reach a backend without the named plan.',
        alternative: 'Set max_prepared_statements above zero explicitly, then test the exact driver, protocol path, schema migration, and PgBouncer version.',
      };
    }

    return configured;
  }, [feature, maxPreparedStatements, mode.id]);

  const statusPresentation = {
    supported: {
      label: 'Compatible',
      tone: 'emerald' as const,
      icon: CheckCircle2,
    },
    caution: {
      label: 'Use with care',
      tone: 'amber' as const,
      icon: TriangleAlert,
    },
    broken: {
      label: 'Contract breaks',
      tone: 'rose' as const,
      icon: CircleX,
    },
  }[result.status];

  function reset() {
    setModeId(data.defaults.modeId);
    setFeatureId(data.defaults.featureId);
    setMaxPreparedStatements(data.defaults.maxPreparedStatements);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Release-boundary lab"
          title={data.title}
          description={data.description}
          icon={GitCompareArrows}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Pooling mode
                </legend>
                <div className="mt-3 space-y-2">
                  {data.modes.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === mode.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Layers3}
                      accent="violet"
                      onClick={() => setModeId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Application behavior
                </legend>
                <div className="mt-3 space-y-2">
                  {data.features.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === feature.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Workflow}
                      accent="blue"
                      onClick={() => setFeatureId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <LabRange
                label="max_prepared_statements"
                value={maxPreparedStatements}
                output={String(maxPreparedStatements)}
                min={data.preparedStatementCache.min}
                max={data.preparedStatementCache.max}
                step={data.preparedStatementCache.step}
                lowLabel="Tracking off"
                highLabel="Larger tracked cache"
                accent="amber"
                onChange={setMaxPreparedStatements}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Release boundary"
                value={mode.releaseBoundary}
                detail="When the backend returns to its pool"
                icon={RefreshCcw}
                tone="violet"
              />
              <LabMetric
                label="Backend identity"
                value={mode.id === 'session' ? 'Stable' : 'May change'}
                detail={mode.backendContinuity}
                icon={GitCompareArrows}
                tone={mode.id === 'session' ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Multi-statement tx"
                value={mode.multiStatementTransactions ? 'Allowed' : 'Rejected'}
                detail="BEGIN through COMMIT on one backend"
                icon={Workflow}
                tone={mode.multiStatementTransactions ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Selected behavior"
                value={statusPresentation.label}
                detail={`${feature.label} in ${mode.label.toLowerCase()}`}
                icon={statusPresentation.icon}
                tone={statusPresentation.tone}
              />
            </div>

            <section className="overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Backend assignment trace
                </h4>
                <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                  The server label is illustrative; the release boundary is the contract.
                </p>
              </div>
              <div className="grid gap-0 md:grid-cols-3">
                {mode.trace.map((step, index) => (
                  <div
                    key={`${mode.id}-${step.label}`}
                    className="relative min-w-0 border-b border-neutral-200 p-4 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0 dark:border-neutral-800"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                        {step.label}
                      </p>
                      {index < mode.trace.length - 1 ? (
                        <ArrowRight
                          aria-hidden="true"
                          className="hidden h-4 w-4 translate-x-6 text-neutral-400 md:block"
                        />
                      ) : null}
                    </div>
                    <p className="mt-3 inline-flex rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
                      {step.server}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                      {step.event}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section
              className={`rounded-md border p-5 ${
                result.status === 'supported'
                  ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                  : result.status === 'caution'
                    ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
                    : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
              }`}
            >
              <div className="flex items-start gap-3">
                <statusPresentation.icon
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-neutral-800 dark:text-neutral-100"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                    {statusPresentation.label}
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    {feature.label}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                    {result.explanation}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950/30">
              <div className="flex items-start gap-3">
                <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-blue-700 dark:text-blue-300" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-300">
                    Safe application contract
                  </p>
                  <p className="mt-2 text-sm leading-6 text-blue-950 dark:text-blue-100">
                    {result.alternative}
                  </p>
                </div>
              </div>
            </section>

            <p className="flex items-start gap-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              <KeyRound aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              A non-zero prepared-statement cache changes only protocol-level named statement
              handling. It does not preserve arbitrary session state or make SQL PREPARE portable
              across backend sessions.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID}>
      <div
        className="min-h-[720px] rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading PgBouncer pooling-mode lab"
      />
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <div
        role="alert"
        className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
      >
        <p className="font-semibold">The pooling-mode lab could not load.</p>
        <p className="mt-2 opacity-80">{detail}</p>
      </div>
    </div>
  );
}
