'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  FileDiff,
  Files,
  ShieldAlert,
} from 'lucide-react';
import {
  LabChoice,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Field = {
  id: string;
  name: string;
  type: string;
  mode: 'required' | 'optional';
};

type Outcome = {
  status: 'compatible' | 'review' | 'incompatible';
  headline: string;
  explanation: string;
  actions: string[];
};

type Change = {
  id: string;
  label: string;
  detail: string;
  before: Field[];
  after: Field[];
  changedFieldIds: string[];
  outcomes: Record<string, Outcome>;
};

type Contract = {
  id: string;
  label: string;
  detail: string;
};

type SchemaEvolutionModel = {
  defaultChangeId: string;
  defaultContractId: string;
  contracts: Contract[];
  changes: Change[];
};

const DEFAULT_DATA_FILE =
  '/api/content/technology/parquet/data/schema-evolution-scenarios.json';

function isSchemaEvolutionModel(value: unknown): value is SchemaEvolutionModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SchemaEvolutionModel>;
  return Boolean(
    Array.isArray(candidate.contracts)
      && candidate.contracts.length > 0
      && Array.isArray(candidate.changes)
      && candidate.changes.length > 0
      && candidate.changes.every(
        (change) => Array.isArray(change.before) && Array.isArray(change.after) && change.outcomes,
      ),
  );
}

const statusStyles = {
  compatible: {
    shell: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100',
    label: 'Compatible contract',
    icon: CheckCircle2,
  },
  review: {
    shell: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100',
    label: 'Migration required',
    icon: CircleAlert,
  },
  incompatible: {
    shell: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100',
    label: 'Contract broken',
    icon: ShieldAlert,
  },
} as const;

function SchemaCard({
  title,
  subtitle,
  fields,
  changedFieldIds,
}: {
  title: string;
  subtitle: string;
  fields: Field[];
  changedFieldIds: string[];
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
      <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-sm font-semibold text-neutral-950 dark:text-white">{title}</p>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{subtitle}</p>
      </header>
      <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {fields.map((field) => {
          const changed = changedFieldIds.includes(field.id);
          return (
            <div
              key={field.id}
              className={`grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3 text-sm ${
                changed ? 'bg-violet-50 dark:bg-violet-950/25' : 'bg-white dark:bg-neutral-950'
              }`}
            >
              <div className="min-w-0">
                <p className="break-words font-semibold text-neutral-900 dark:text-neutral-100">{field.name}</p>
                <p className="mt-1 break-words font-mono text-xs text-neutral-500 dark:text-neutral-400">{field.type}</p>
              </div>
              <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{field.mode}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function ParquetSchemaEvolutionLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<SchemaEvolutionModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [changeId, setChangeId] = useState('');
  const [contractId, setContractId] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    async function load() {
      try {
        const response = await fetch(dataFile, { signal: controller.signal });
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isSchemaEvolutionModel(payload)) throw new Error('The schema model is incomplete.');
        setData(payload);
        setChangeId(payload.defaultChangeId);
        setContractId(payload.defaultContractId);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the schema model.');
      }
    }

    void load();
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const result = useMemo(() => {
    if (!data) return null;
    const change = data.changes.find((item) => item.id === changeId) ?? data.changes[0];
    const contract = data.contracts.find((item) => item.id === contractId) ?? data.contracts[0];
    return { change, contract, outcome: change.outcomes[contract.id] };
  }, [changeId, contractId, data]);

  if (error) {
    return (
      <div className="min-h-48 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
        <p className="font-semibold">The schema-evolution model could not be loaded.</p>
        <p className="mt-2 leading-6 opacity-80">{error}</p>
        <button
          type="button"
          onClick={() => setReloadKey((value) => value + 1)}
          className="mt-4 rounded-md border border-current px-3 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data || !result || !result.outcome) {
    return (
      <div
        className="min-h-[620px] animate-pulse rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading Parquet schema-evolution model"
      />
    );
  }

  const status = statusStyles[result.outcome.status];
  const StatusIcon = status.icon;

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Dataset contract lab"
        title="Evolve files without surprising readers"
        description="Each Parquet file carries its own schema. Choose a change and a dataset-level read contract to see what a mixed set of old and new files exposes."
        icon={FileDiff}
        accent="violet"
        onReset={() => {
          setChangeId(data.defaultChangeId);
          setContractId(data.defaultContractId);
        }}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Producer change
              </legend>
              <div className="mt-3 space-y-2">
                {data.changes.map((change) => (
                  <LabChoice
                    key={change.id}
                    selected={change.id === result.change.id}
                    label={change.label}
                    detail={change.detail}
                    icon={FileDiff}
                    accent="violet"
                    onClick={() => setChangeId(change.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Reader contract
              </legend>
              <div className="mt-3 space-y-2">
                {data.contracts.map((contract) => (
                  <LabChoice
                    key={contract.id}
                    selected={contract.id === result.contract.id}
                    label={contract.label}
                    detail={contract.detail}
                    icon={Files}
                    accent="cyan"
                    onClick={() => setContractId(contract.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_40px_minmax(0,1fr)] lg:items-center">
          <SchemaCard
            title="Existing files"
            subtitle="Schema already present in the dataset"
            fields={result.change.before}
            changedFieldIds={result.change.changedFieldIds}
          />
          <div className="flex h-8 items-center justify-center text-neutral-400" aria-hidden="true">
            <ArrowRight className="h-5 w-5 rotate-90 lg:rotate-0" />
          </div>
          <SchemaCard
            title="New files"
            subtitle="Schema emitted after the producer change"
            fields={result.change.after}
            changedFieldIds={result.change.changedFieldIds}
          />
        </div>

        <section className={`mt-5 rounded-md border p-5 ${status.shell}`}>
          <div className="flex items-start gap-3">
            <StatusIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase opacity-75">{status.label}</p>
              <h4 className="mt-1 text-base font-semibold">{result.outcome.headline}</h4>
              <p className="mt-2 text-sm leading-6 opacity-85">{result.outcome.explanation}</p>
            </div>
          </div>
        </section>

        <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-sm font-semibold text-neutral-950 dark:text-white">Release actions</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-neutral-700 marker:text-neutral-400 dark:text-neutral-300">
            {result.outcome.actions.map((action) => <li key={action}>{action}</li>)}
          </ul>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
