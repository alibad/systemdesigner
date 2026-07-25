'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Box,
  Braces,
  CircleAlert,
  Clock3,
  FileJson2,
  Gauge,
  ListFilter,
  Route,
  Rows3,
  Send,
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

type Option = {
  id: string;
  label: string;
  detail: string;
};

type Workload = Option & {
  method: string;
  path: string;
  actionPath: string;
  successStatus: string;
  latencyBudgetMs: number;
  maxResponseKb: number;
  collection: boolean;
  maxPageSize: number | null;
  sideEffect: boolean;
  recommended: {
    shape: string;
    completion: string;
    pagination: string;
  };
};

type ContractModel = {
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    shapeId: string;
    completionId: string;
    paginationId: string;
  };
  workloads: Workload[];
  shapes: Option[];
  completions: Option[];
  pagination: Option[];
};

const BLOCK_ID = 'technology/api-design-contract-shape-lab';

function isOption(value: unknown): value is Option {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Option>;
  return Boolean(candidate.id && candidate.label && candidate.detail);
}

function isContractModel(value: unknown): value is ContractModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ContractModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.workloadId
      && candidate.defaults.shapeId
      && candidate.defaults.completionId
      && candidate.defaults.paginationId
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length > 0
      && candidate.workloads.every(isOption)
      && Array.isArray(candidate.shapes)
      && candidate.shapes.every(isOption)
      && Array.isArray(candidate.completions)
      && candidate.completions.every(isOption)
      && Array.isArray(candidate.pagination)
      && candidate.pagination.every(isOption),
  );
}

export default function ApiDesignContractShapeLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ContractModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No contract model was supplied.');
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
        if (!isContractModel(payload)) throw new Error('The contract model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the contract lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <ContractWorkbench data={data} />;
}

function ContractWorkbench({ data }: { data: ContractModel }) {
  const [workloadId, setWorkloadId] = useState(data.defaults.workloadId);
  const [shapeId, setShapeId] = useState(data.defaults.shapeId);
  const [completionId, setCompletionId] = useState(data.defaults.completionId);
  const [paginationId, setPaginationId] = useState(data.defaults.paginationId);

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];
  const shape = data.shapes.find((item) => item.id === shapeId) ?? data.shapes[0];
  const completion = data.completions.find((item) => item.id === completionId) ?? data.completions[0];
  const pagination = data.pagination.find((item) => item.id === paginationId) ?? data.pagination[0];

  const result = useMemo(() => {
    const checks = [
      {
        label: 'Resource semantics',
        pass: shape.id === workload.recommended.shape,
        repair: `Use the ${workload.method} ${workload.path} resource contract.`,
      },
      {
        label: 'Completion semantics',
        pass: completion.id === workload.recommended.completion,
        repair: workload.recommended.completion === 'tracked'
          ? 'Return 202 with a durable operation resource that the client can inspect.'
          : `Return ${workload.successStatus} only after the documented result is true.`,
      },
      {
        label: 'Collection bound',
        pass: !workload.collection || pagination.id === workload.recommended.pagination,
        repair: workload.collection
          ? `Use an opaque cursor and cap each page at ${workload.maxPageSize} items.`
          : 'This operation returns one bounded representation, so collection pagination does not apply.',
      },
    ];
    const passed = checks.filter((check) => check.pass).length;
    const endpoint = shape.id === 'resource'
      ? `${workload.method} ${workload.path}`
      : shape.id === 'action'
        ? `POST ${workload.actionPath}`
        : 'POST /v1/execute';
    const status = completion.id === 'tracked'
      ? '202 Accepted + operation ID'
      : completion.id === 'fire-and-forget'
        ? '204 No Content'
        : workload.successStatus;
    const pagePolicy = !workload.collection
      ? 'Single bounded representation'
      : pagination.id === 'cursor'
        ? `Opaque cursor, maximum ${workload.maxPageSize} items`
        : pagination.id === 'offset'
          ? 'Offset and limit; mutable pages may drift'
          : 'Unbounded response; work grows with stored data';
    const fit = Math.round((passed / checks.length) * 100);
    const unsafe = completion.id === 'fire-and-forget'
      || (workload.collection && pagination.id === 'unbounded')
      || shape.id === 'generic';
    const verdict = fit === 100
      ? 'The contract makes client expectations explicit'
      : unsafe
        ? 'The contract hides work or outcome from the client'
        : 'The contract is usable but carries avoidable ambiguity';
    const clientAction = completion.id === 'tracked'
      ? 'Poll or subscribe to the operation resource until it reaches a terminal state.'
      : completion.id === 'fire-and-forget'
        ? 'The client cannot distinguish accepted, rejected, or lost work from this response.'
        : workload.sideEffect
          ? 'Store the returned resource and reuse the same idempotency key after an uncertain response.'
          : 'Use validators or a cursor to continue without repeating unbounded work.';

    return { checks, clientAction, endpoint, fit, pagePolicy, status, unsafe, verdict };
  }, [completion.id, pagination.id, shape.id, workload]);

  const reset = () => {
    setWorkloadId(data.defaults.workloadId);
    setShapeId(data.defaults.shapeId);
    setCompletionId(data.defaults.completionId);
    setPaginationId(data.defaults.paginationId);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Contract design studio"
          title={data.title}
          description={data.description}
          icon={Braces}
          accent="blue"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <ChoiceGroup
                label="1. Client workflow"
                options={data.workloads}
                selectedId={workload.id}
                icon={Send}
                accent="blue"
                onSelect={setWorkloadId}
              />
              <ChoiceGroup
                label="2. Interface shape"
                options={data.shapes}
                selectedId={shape.id}
                icon={Route}
                accent="violet"
                onSelect={setShapeId}
              />
              <ChoiceGroup
                label="3. Completion promise"
                options={data.completions}
                selectedId={completion.id}
                icon={Clock3}
                accent="amber"
                onSelect={setCompletionId}
              />
              {workload.collection ? (
                <ChoiceGroup
                  label="4. Collection policy"
                  options={data.pagination}
                  selectedId={pagination.id}
                  icon={ListFilter}
                  accent="emerald"
                  onSelect={setPaginationId}
                />
              ) : (
                <div className="rounded-md border border-neutral-200 bg-white p-4 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                  <p className="font-semibold text-neutral-950 dark:text-white">4. Collection policy</p>
                  <p className="mt-1 leading-6">This workflow returns one bounded resource, so pagination is intentionally absent.</p>
                </div>
              )}
            </div>
          }
        >
          <div aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Contract fit"
                value={`${result.fit}%`}
                detail={`${result.checks.filter((check) => check.pass).length} of ${result.checks.length} modeled decisions match the workload.`}
                icon={result.fit === 100 ? BadgeCheck : TriangleAlert}
                tone={result.fit === 100 ? 'emerald' : result.unsafe ? 'rose' : 'amber'}
              />
              <LabMetric
                label="Latency promise"
                value={`p95 <= ${workload.latencyBudgetMs} ms`}
                detail="The server must either finish within this envelope or expose tracked progress."
                icon={Gauge}
                tone="blue"
              />
              <LabMetric
                label="Payload ceiling"
                value={`${workload.maxResponseKb} KB`}
                detail={workload.collection ? 'Per page, before transport compression.' : 'For the documented success representation.'}
                icon={FileJson2}
                tone="violet"
              />
            </div>

            <section className="mt-5 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/70">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Generated client contract</p>
                <p className="mt-1 break-words font-mono text-base font-semibold text-neutral-950 dark:text-white">{result.endpoint}</p>
              </header>
              <dl className="grid gap-px bg-neutral-200 sm:grid-cols-3 dark:bg-neutral-800">
                <ContractFact label="Success means" value={result.status} icon={BadgeCheck} />
                <ContractFact label="Response bound" value={result.pagePolicy} icon={Rows3} />
                <ContractFact label="Client follows up" value={result.clientAction} icon={Box} />
              </dl>
            </section>

            <section className={`mt-5 border-l-4 px-4 py-4 ${result.fit === 100 ? 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50' : result.unsafe ? 'border-rose-500 bg-rose-50 text-rose-950 dark:bg-rose-950/30 dark:text-rose-50' : 'border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-50'}`}>
              <p className="text-xs font-semibold uppercase opacity-75">Design consequence</p>
              <p className="mt-2 text-base font-semibold">{result.verdict}</p>
              <p className="mt-1 text-sm leading-6 opacity-90">A resource name, status code, and page rule are promises the client can test. They should not reveal the server's internal function names or queue layout.</p>
            </section>

            <section className="mt-5 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">Contract review</h4>
              <ul className="mt-3 space-y-3">
                {result.checks.map((check) => (
                  <li key={check.label} className="flex items-start gap-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    {check.pass ? (
                      <BadgeCheck aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <CircleAlert aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    )}
                    <span><strong className="text-neutral-950 dark:text-white">{check.label}:</strong> {check.pass ? 'The selected promise matches the workload.' : check.repair}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ChoiceGroup({
  label,
  options,
  selectedId,
  icon,
  accent,
  onSelect,
}: {
  label: string;
  options: Option[];
  selectedId: string;
  icon: LucideIcon;
  accent: 'blue' | 'violet' | 'amber' | 'emerald';
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</legend>
      <div className="mt-3 space-y-2">
        {options.map((option) => (
          <LabChoice
            key={option.id}
            selected={selectedId === option.id}
            label={option.label}
            detail={option.detail}
            icon={icon}
            accent={accent}
            onClick={() => onSelect(option.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function ContractFact({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="min-w-0 bg-white p-4 dark:bg-neutral-950">
      <dt className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {label}
      </dt>
      <dd className="mt-2 break-words text-sm font-semibold leading-6 text-neutral-950 dark:text-white">{value}</dd>
    </div>
  );
}

function LoadState() {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="min-h-[680px] animate-pulse rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
      aria-label="Loading API contract design lab"
    />
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div
      data-content-block={BLOCK_ID}
      role="alert"
      className="min-h-48 rounded-lg border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
    >
      <p className="font-semibold">API contract lab unavailable</p>
      <p className="mt-2 opacity-80">{detail}</p>
    </div>
  );
}
