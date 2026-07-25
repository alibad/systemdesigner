'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Box,
  CheckCircle2,
  FileKey2,
  KeyRound,
  RefreshCw,
  Send,
  ShieldAlert,
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

type Purpose = 'kem' | 'signature';
type Bound = { min: number; max: number; step: number };
type UseCase = {
  id: string;
  label: string;
  detail: string;
  requiredPurpose: Purpose;
  transportBudgetBytes: number;
  keyCopies: number;
  sendsPublicKeyPerOperation: boolean;
};
type Primitive = {
  id: string;
  label: string;
  standard: string;
  purpose: Purpose;
  parameterCategory: string;
  publicKeyBytes: number;
  secretKeyBytes: number;
  outputBytes: number;
  outputLabel: string;
};
type EnvelopeModel = {
  title: string;
  description: string;
  defaults: {
    useCaseId: string;
    primitiveId: string;
    operationsPerDay: number;
  };
  bounds: { operationsPerDay: Bound };
  useCases: UseCase[];
  primitives: Primitive[];
};

const BLOCK_ID = 'fundamentals/quantum-safe-cryptography-systems-envelope-lab';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/quantum-safe-cryptography-systems/data/algorithm-envelope-model.json';

function isEnvelopeModel(value: unknown): value is EnvelopeModel {
  if (!value || typeof value !== 'object') return false;
  const model = value as Partial<EnvelopeModel>;
  return Boolean(
    model.title
      && model.description
      && model.defaults?.useCaseId
      && model.defaults?.primitiveId
      && model.bounds?.operationsPerDay
      && Array.isArray(model.useCases)
      && model.useCases.length >= 3
      && Array.isArray(model.primitives)
      && model.primitives.length >= 6,
  );
}

function formatBytes(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} GB`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} MB`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)} KB`;
  return `${value} B`;
}

function purposeLabel(purpose: Purpose) {
  return purpose === 'kem' ? 'Key establishment' : 'Digital signature';
}

export default function QuantumSafeCryptographySystemsEnvelopeLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<EnvelopeModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [useCaseId, setUseCaseId] = useState('');
  const [primitiveId, setPrimitiveId] = useState('');
  const [operationsPerDay, setOperationsPerDay] = useState(250000);

  function reset(model: EnvelopeModel) {
    setUseCaseId(model.defaults.useCaseId);
    setPrimitiveId(model.defaults.primitiveId);
    setOperationsPerDay(model.defaults.operationsPerDay);
  }

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isEnvelopeModel(payload)) {
          throw new Error('The algorithm envelope model is incomplete.');
        }
        setData(payload);
        reset(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setData(null);
        setError(
          loadError instanceof Error ? loadError.message : 'Unable to load algorithm data.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const view = useMemo(() => {
    if (!data) return null;
    const useCase =
      data.useCases.find((candidate) => candidate.id === useCaseId) ?? data.useCases[0];
    const primitive =
      data.primitives.find((candidate) => candidate.id === primitiveId) ?? data.primitives[0];
    const purposeMatches = useCase.requiredPurpose === primitive.purpose;
    const transportBytes =
      primitive.outputBytes
      + (useCase.sendsPublicKeyPerOperation ? primitive.publicKeyBytes : 0);
    const budgetShare = transportBytes / useCase.transportBudgetBytes;
    const dailyTransportBytes = transportBytes * operationsPerDay;
    const storedKeyBytes =
      (primitive.publicKeyBytes + primitive.secretKeyBytes) * useCase.keyCopies;

    let status = 'Purpose and byte envelope fit';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';
    let verdict =
      `${primitive.label} performs the required operation and stays inside the modeled transport budget.`;

    if (!purposeMatches) {
      status = 'Primitive serves the wrong purpose';
      tone = 'rose';
      verdict = `${primitive.label} is for ${purposeLabel(primitive.purpose).toLowerCase()}, while this workflow requires ${purposeLabel(useCase.requiredPurpose).toLowerCase()}.`;
    } else if (transportBytes > useCase.transportBudgetBytes) {
      status = 'Transport envelope exceeded';
      tone = 'rose';
      verdict = `${formatBytes(transportBytes)} exceeds the modeled ${formatBytes(useCase.transportBudgetBytes)} per-operation budget before framing, certificates, or application payload.`;
    } else if (budgetShare > 0.8) {
      status = 'Envelope fits with little headroom';
      tone = 'amber';
      verdict = `${formatBytes(transportBytes)} consumes ${(budgetShare * 100).toFixed(0)}% of the modeled budget. Measure framing, fragmentation, retries, and certificates before selection.`;
    }

    return {
      useCase,
      primitive,
      purposeMatches,
      transportBytes,
      budgetShare,
      dailyTransportBytes,
      storedKeyBytes,
      status,
      tone,
      verdict,
    };
  }, [data, operationsPerDay, primitiveId, useCaseId]);

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Algorithm envelope lab"
          title={data?.title ?? 'Match the standardized primitive to the protocol envelope'}
          description={
            data?.description
            ?? 'Load the final NIST primitive sizes and a protocol-specific byte budget.'
          }
          icon={FileKey2}
          accent="violet"
          onReset={data ? () => reset(data) : undefined}
        />

        {!data || !view ? (
          <div className="flex min-h-[540px] items-center justify-center p-6">
            {error ? (
              <div className="max-w-md text-center">
                <TriangleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
                <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
                  Algorithm model could not be loaded
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={() => setReloadKey((current) => current + 1)}
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100"
                >
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                  Try again
                </button>
              </div>
            ) : (
              <div className="text-center" role="status">
                <Activity
                  aria-hidden="true"
                  className="mx-auto h-7 w-7 animate-pulse text-violet-500 motion-reduce:animate-none"
                />
                <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
                  Loading FIPS byte envelopes...
                </p>
              </div>
            )}
          </div>
        ) : (
          <LearningLabBody
            controls={
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Protocol job
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.useCases.map((useCase) => (
                      <LabChoice
                        key={useCase.id}
                        selected={useCase.id === view.useCase.id}
                        label={useCase.label}
                        detail={useCase.detail}
                        icon={useCase.requiredPurpose === 'kem' ? KeyRound : FileKey2}
                        accent="blue"
                        onClick={() => setUseCaseId(useCase.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Final NIST primitive
                  </legend>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    {data.primitives.map((primitive) => (
                      <LabChoice
                        key={primitive.id}
                        selected={primitive.id === view.primitive.id}
                        label={primitive.label}
                        detail={`${primitive.standard} · ${purposeLabel(primitive.purpose)} · ${primitive.parameterCategory}`}
                        icon={primitive.purpose === 'kem' ? KeyRound : FileKey2}
                        accent={primitive.purpose === 'kem' ? 'cyan' : 'violet'}
                        onClick={() => setPrimitiveId(primitive.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="Operations per day"
                  value={operationsPerDay}
                  output={operationsPerDay.toLocaleString()}
                  {...data.bounds.operationsPerDay}
                  accent="violet"
                  lowLabel="small system"
                  highLabel="high volume"
                  onChange={setOperationsPerDay}
                />
              </div>
            }
          >
            <div aria-live="polite">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label={
                    view.primitive.purpose === 'kem'
                      ? 'Encapsulation key'
                      : 'Verification key'
                  }
                  value={formatBytes(view.primitive.publicKeyBytes)}
                  detail={`${view.primitive.standard} ${view.primitive.label}.`}
                  icon={KeyRound}
                  tone="blue"
                />
                <LabMetric
                  label={
                    view.primitive.purpose === 'kem'
                      ? 'Decapsulation key'
                      : 'Signing key'
                  }
                  value={formatBytes(view.primitive.secretKeyBytes)}
                  detail={`${view.useCase.keyCopies} modeled key copies use ${formatBytes(view.storedKeyBytes)} in total.`}
                  icon={Box}
                  tone="violet"
                />
                <LabMetric
                  label={view.primitive.outputLabel}
                  value={formatBytes(view.primitive.outputBytes)}
                  detail={`Exact ${view.primitive.standard} output size for this parameter set.`}
                  icon={Send}
                  tone={view.purposeMatches ? 'cyan' : 'rose'}
                />
                <LabMetric
                  label="Modeled exchange"
                  value={formatBytes(view.transportBytes)}
                  detail={`${formatBytes(view.dailyTransportBytes)} per day at selected volume.`}
                  icon={FileKey2}
                  tone={
                    !view.purposeMatches || view.budgetShare > 1
                      ? 'rose'
                      : view.budgetShare > 0.8
                        ? 'amber'
                        : 'emerald'
                  }
                />
              </div>

              <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/50">
                <div className="flex items-center justify-between gap-4 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  <span>Transport budget</span>
                  <span>
                    {formatBytes(view.transportBytes)} / {formatBytes(view.useCase.transportBudgetBytes)}
                  </span>
                </div>
                <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <div
                    className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${
                      view.budgetShare > 1
                        ? 'bg-rose-500'
                        : view.budgetShare > 0.8
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, view.budgetShare * 100)}%` }}
                  />
                </div>
                <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  The fixture includes the standardized output and, where modeled, the public
                  key. Real protocols also carry framing, certificates, negotiation, and
                  application data.
                </p>
              </section>

              <section
                className={`mt-5 rounded-md border p-5 ${
                  view.tone === 'rose'
                    ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100'
                    : view.tone === 'amber'
                      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100'
                }`}
              >
                <div className="flex items-start gap-3">
                  {view.tone === 'emerald' ? (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  ) : (
                    <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  )}
                  <div>
                    <h4 className="font-semibold">{view.status}</h4>
                    <p className="mt-2 text-sm leading-6 opacity-85">{view.verdict}</p>
                  </div>
                </div>
              </section>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}
