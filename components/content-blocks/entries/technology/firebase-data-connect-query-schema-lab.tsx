'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Braces,
  CheckCircle2,
  CircleAlert,
  Code2,
  Database,
  Filter,
  Gauge,
  Layers3,
  LoaderCircle,
  PackageCheck,
  Rows3,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Capability =
  | 'bounded-list'
  | 'ownership'
  | 'relational-filter'
  | 'transactional-write';

type Workload = {
  id: string;
  label: string;
  detail: string;
  expectedRows: number;
  relationshipFanout: number;
  requiredCapabilities: Capability[];
};

type SchemaOption = {
  id: string;
  label: string;
  detail: string;
  tableCount: number;
  capabilities: Capability[];
  invariant: string;
};

type OperationOption = {
  id: string;
  label: string;
  detail: string;
  auth: string;
  resultFields: number;
  rowLimit: number;
  relationshipDepth: number;
  capabilities: Capability[];
};

type QuerySchemaModel = {
  kind: 'query-schema';
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    schemaId: string;
    operationId: string;
  };
  capabilityLabels: Record<Capability, string>;
  workloads: Workload[];
  schemas: SchemaOption[];
  operations: OperationOption[];
};

const BLOCK_ID = 'technology/firebase-data-connect-query-schema-lab';

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isQuerySchemaModel(value: unknown): value is QuerySchemaModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<QuerySchemaModel>;
  return Boolean(
    candidate.kind === 'query-schema'
      && typeof candidate.title === 'string'
      && typeof candidate.description === 'string'
      && candidate.defaults?.workloadId
      && candidate.defaults.schemaId
      && candidate.defaults.operationId
      && candidate.capabilityLabels
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length > 0
      && candidate.workloads.every((item) =>
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && typeof item.expectedRows === 'number'
        && typeof item.relationshipFanout === 'number'
        && isStringArray(item.requiredCapabilities))
      && Array.isArray(candidate.schemas)
      && candidate.schemas.length > 0
      && candidate.schemas.every((item) =>
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && typeof item.tableCount === 'number'
        && typeof item.invariant === 'string'
        && isStringArray(item.capabilities))
      && Array.isArray(candidate.operations)
      && candidate.operations.length > 0
      && candidate.operations.every((item) =>
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && typeof item.auth === 'string'
        && typeof item.resultFields === 'number'
        && typeof item.rowLimit === 'number'
        && typeof item.relationshipDepth === 'number'
        && isStringArray(item.capabilities)),
  );
}

export default function FirebaseDataConnectQuerySchemaLab({
  dataFile,
  model,
}: {
  dataFile?: string;
  model?: unknown;
}) {
  const [loadedModel, setLoadedModel] = useState<unknown>(model ?? null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (model !== undefined) {
      setLoadedModel(model);
      setLoadError(null);
      return;
    }

    if (!dataFile) {
      setLoadedModel(null);
      setLoadError('No query and schema model was supplied.');
      return;
    }

    const controller = new AbortController();
    setLoadedModel(null);
    setLoadError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then(setLoadedModel)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the query model.');
      });

    return () => controller.abort();
  }, [dataFile, model]);

  if (loadError) {
    return <ModelError message={loadError} />;
  }
  if (!loadedModel) {
    return <ModelLoading label="Loading the query and schema model..." />;
  }
  if (!isQuerySchemaModel(loadedModel)) {
    return <ModelError message="The query and schema model is invalid." />;
  }
  return <QuerySchemaWorkbench model={loadedModel} />;
}

function QuerySchemaWorkbench({ model }: { model: QuerySchemaModel }) {
  const [workloadId, setWorkloadId] = useState(model.defaults.workloadId);
  const [schemaId, setSchemaId] = useState(model.defaults.schemaId);
  const [operationId, setOperationId] = useState(model.defaults.operationId);

  const workload = model.workloads.find((item) => item.id === workloadId) ?? model.workloads[0];
  const schema = model.schemas.find((item) => item.id === schemaId) ?? model.schemas[0];
  const operation = model.operations.find((item) => item.id === operationId) ?? model.operations[0];

  const result = useMemo(() => {
    const supported = workload.requiredCapabilities.filter(
      (capability) =>
        schema.capabilities.includes(capability) && operation.capabilities.includes(capability),
    );
    const missing = workload.requiredCapabilities.filter((capability) => !supported.includes(capability));
    const returnedRows = Math.min(workload.expectedRows, operation.rowLimit);
    const modeledRowTouches = Math.round(
      returnedRows * Math.max(1, operation.relationshipDepth) * workload.relationshipFanout,
    );
    const modeledPayloadKiB = Math.max(
      1,
      Math.round((returnedRows * operation.resultFields * 12) / 1024),
    );
    const bounded = operation.rowLimit <= 100 && operation.resultFields <= 16;
    const complete = missing.length === 0;

    if (!complete) {
      return {
        bounded,
        missing,
        modeledPayloadKiB,
        modeledRowTouches,
        returnedRows,
        tone: 'rose' as const,
        title: 'The deployed contract cannot satisfy this workload',
        detail: `Missing: ${missing.map((item) => model.capabilityLabels[item]).join(', ')}. Change the schema or operation source, then regenerate the SDK before client rollout.`,
      };
    }

    if (!bounded || modeledRowTouches > 1_000) {
      return {
        bounded,
        missing,
        modeledPayloadKiB,
        modeledRowTouches,
        returnedRows,
        tone: 'amber' as const,
        title: 'The contract works, but its read envelope is too broad',
        detail: 'Narrow the selected fields, add a deliberate limit, and verify the generated SQL path against representative PostgreSQL data.',
      };
    }

    return {
      bounded,
      missing,
      modeledPayloadKiB,
      modeledRowTouches,
      returnedRows,
      tone: 'emerald' as const,
      title: 'Schema and connector express one bounded client contract',
      detail: 'The client calls one generated operation; the deployed connector owns the selection set, authorization directive, and relational access path.',
    };
  }, [model.capabilityLabels, operation, schema, workload]);

  const reset = () => {
    setWorkloadId(model.defaults.workloadId);
    setSchemaId(model.defaults.schemaId);
    setOperationId(model.defaults.operationId);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Schema and query studio"
          title={model.title}
          description={model.description}
          icon={Braces}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup
                label="1. App workload"
                items={model.workloads}
                selectedId={workload.id}
                icon={Layers3}
                accent="cyan"
                onSelect={setWorkloadId}
              />
              <ChoiceGroup
                label="2. Relational shape"
                items={model.schemas}
                selectedId={schema.id}
                icon={Database}
                accent="blue"
                onSelect={setSchemaId}
              />
              <ChoiceGroup
                label="3. Deployed operation"
                items={model.operations}
                selectedId={operation.id}
                icon={Code2}
                accent="violet"
                onSelect={setOperationId}
              />
            </div>
          )}
        >
          <div className="min-w-0" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Contract coverage"
                value={`${workload.requiredCapabilities.length - result.missing.length} / ${workload.requiredCapabilities.length}`}
                detail="Required behaviors expressed by schema and operation"
                icon={PackageCheck}
                tone={result.missing.length ? 'rose' : 'emerald'}
              />
              <LabMetric
                label="Result envelope"
                value={`${result.returnedRows} rows`}
                detail={`${operation.resultFields} selected fields`}
                icon={Rows3}
                tone={result.bounded ? 'blue' : 'amber'}
              />
              <LabMetric
                label="Modeled row work"
                value={result.modeledRowTouches.toLocaleString()}
                detail="Teaching estimate, not a latency prediction"
                icon={Gauge}
                tone={result.modeledRowTouches > 1_000 ? 'amber' : 'cyan'}
              />
              <LabMetric
                label="Modeled payload"
                value={`${result.modeledPayloadKiB} KiB`}
                detail="Uses a simple 12-byte value assumption"
                icon={Filter}
                tone={result.modeledPayloadKiB > 128 ? 'amber' : 'neutral'}
              />
            </div>

            <section className={`mt-5 rounded-md border p-4 ${result.tone === 'emerald' ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50' : result.tone === 'amber' ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50' : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'}`}>
              <div className="flex items-start gap-3">
                {result.tone === 'emerald' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : result.tone === 'amber' ? (
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="font-semibold">{result.title}</p>
                  <p className="mt-1 text-sm leading-6 opacity-80">{result.detail}</p>
                </div>
              </div>
            </section>

            <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                One client call, four owned boundaries
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] md:items-stretch">
                <PathNode icon={Code2} eyebrow="Client" title="Generated SDK">
                  Calls the named operation with typed variables.
                </PathNode>
                <PathArrow />
                <PathNode icon={ShieldCheck} eyebrow="Connector" title={operation.label}>
                  {operation.auth}; selects {operation.resultFields} fields.
                </PathNode>
                <PathArrow />
                <PathNode icon={Braces} eyebrow="Application schema" title={schema.label}>
                  Maps {schema.tableCount} PostgreSQL tables and their relationships.
                </PathNode>
                <PathArrow />
                <PathNode icon={Database} eyebrow="Data plane" title="Cloud SQL">
                  Executes SQL and preserves database constraints.
                </PathNode>
              </div>
            </section>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <DetailPanel title="Schema invariant" icon={Database}>
                {schema.invariant}
              </DetailPanel>
              <DetailPanel title="Operation boundary" icon={ShieldCheck}>
                {operation.detail}
              </DetailPanel>
            </div>

            <section className="mt-5">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Required capability trace
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {workload.requiredCapabilities.map((capability) => {
                  const supported = !result.missing.includes(capability);
                  return (
                    <div
                      key={capability}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${supported ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50' : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'}`}
                    >
                      {supported ? (
                        <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
                      ) : (
                        <CircleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
                      )}
                      {model.capabilityLabels[capability]}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ChoiceGroup({
  label,
  items,
  selectedId,
  icon,
  accent,
  onSelect,
}: {
  label: string;
  items: Array<{ id: string; label: string; detail: string }>;
  selectedId: string;
  icon: LucideIcon;
  accent: 'cyan' | 'blue' | 'violet';
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </legend>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <LabChoice
            key={item.id}
            selected={item.id === selectedId}
            label={item.label}
            detail={item.detail}
            icon={icon}
            accent={accent}
            onClick={() => onSelect(item.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function PathNode({
  icon: Icon,
  eyebrow,
  title,
  children,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-950">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-cyan-700 dark:text-cyan-300">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {eyebrow}
      </div>
      <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{children}</p>
    </div>
  );
}

function PathArrow() {
  return (
    <div className="flex items-center justify-center text-neutral-400" aria-hidden="true">
      <ArrowDown className="h-5 w-5 md:hidden" />
      <ArrowRight className="hidden h-5 w-5 md:block" />
    </div>
  );
}

function DetailPanel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: string;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
        <Icon aria-hidden="true" className="h-4 w-4 text-violet-600 dark:text-violet-300" />
        {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{children}</p>
    </div>
  );
}

function ModelError({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
      {message}
    </div>
  );
}

function ModelLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 p-6 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
      <LoaderCircle aria-hidden="true" className="mr-2 h-5 w-5 animate-spin" />
      {label}
    </div>
  );
}
