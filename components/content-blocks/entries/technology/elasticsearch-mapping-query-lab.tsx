'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Braces,
  Check,
  CheckCircle2,
  CircleAlert,
  Database,
  FileJson2,
  Filter,
  Gauge,
  ListFilter,
  SlidersHorizontal,
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

type Capability = 'fullText' | 'exact' | 'range' | 'sort' | 'aggregate' | 'dateMath';

type FieldScenario = {
  id: string;
  label: string;
  detail: string;
  sample: string;
  requirements: Capability[];
  analyzedTerms: string[];
  exactValue: string;
  recommendedMappingId: string;
};

type MappingOption = {
  id: string;
  label: string;
  detail: string;
  capabilities: Capability[];
  structures: string[];
  footprint: string;
  indexingCost: string;
};

type DynamicPolicy = {
  id: string;
  label: string;
  detail: string;
  risk: string;
};

type MappingModel = {
  title: string;
  description: string;
  defaults: {
    fieldId: string;
    mappingId: string;
    dynamicPolicyId: string;
  };
  fields: FieldScenario[];
  mappings: MappingOption[];
  dynamicPolicies: DynamicPolicy[];
  capabilityLabels: Record<Capability, string>;
};

const BLOCK_ID = 'technology/elasticsearch-mapping-query-lab';

function isMappingModel(value: unknown): value is MappingModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MappingModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.fieldId
      && candidate.defaults.mappingId
      && candidate.defaults.dynamicPolicyId
      && Array.isArray(candidate.fields)
      && candidate.fields.length > 0
      && Array.isArray(candidate.mappings)
      && candidate.mappings.length > 0
      && Array.isArray(candidate.dynamicPolicies)
      && candidate.dynamicPolicies.length > 0
      && candidate.capabilityLabels,
  );
}

export default function ElasticsearchMappingQueryLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<MappingModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No mapping-query model was supplied.');
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
        if (!isMappingModel(payload)) throw new Error('The mapping-query model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the mapping lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <MappingWorkbench data={data} />;
}

function MappingWorkbench({ data }: { data: MappingModel }) {
  const [fieldId, setFieldId] = useState(data.defaults.fieldId);
  const [mappingId, setMappingId] = useState(data.defaults.mappingId);
  const [dynamicPolicyId, setDynamicPolicyId] = useState(data.defaults.dynamicPolicyId);
  const [inspectedCapability, setInspectedCapability] = useState<Capability>('fullText');

  const field = data.fields.find((item) => item.id === fieldId) ?? data.fields[0];
  const mapping = data.mappings.find((item) => item.id === mappingId) ?? data.mappings[0];
  const dynamicPolicy = data.dynamicPolicies.find((item) => item.id === dynamicPolicyId)
    ?? data.dynamicPolicies[0];

  useEffect(() => {
    setInspectedCapability(field.requirements[0]);
  }, [field.id, field.requirements]);

  const result = useMemo(() => {
    const supported = field.requirements.filter((capability) => mapping.capabilities.includes(capability));
    const missing = field.requirements.filter((capability) => !mapping.capabilities.includes(capability));
    const coverage = supported.length / field.requirements.length * 100;
    const recommended = field.recommendedMappingId === mapping.id;
    const dynamicRisk = dynamicPolicy.id === 'open' ? 'High' : dynamicPolicy.id === 'strict' ? 'Low' : 'Medium';
    const indexedValues = mapping.id === 'text'
      ? field.analyzedTerms
      : mapping.id === 'multi-field'
        ? [...field.analyzedTerms, `raw: ${field.exactValue}`]
        : [field.exactValue];

    let verdict = 'The mapping answers every required query';
    let detail = 'The selected field structures cover the retrieval contract. Validate analysis and sort behavior with representative documents.';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';

    if (missing.length > 0) {
      tone = 'rose';
      verdict = 'The mapping cannot satisfy the field contract';
      detail = `${missing.map((item) => data.capabilityLabels[item]).join(', ')} ${missing.length === 1 ? 'is' : 'are'} missing. Fix the next index generation instead of relying on an expensive runtime workaround.`;
    } else if (!recommended) {
      tone = 'amber';
      verdict = 'The queries work, but the mapping builds unnecessary structures';
      detail = `Use ${data.mappings.find((item) => item.id === field.recommendedMappingId)?.label ?? field.recommendedMappingId} unless measured requirements justify the extra index and ingest cost.`;
    } else if (dynamicPolicy.id === 'open') {
      tone = 'amber';
      verdict = 'The field works, but unknown payloads can change the schema';
      detail = 'Bound dynamic field creation before an unexpected value selects the wrong type or unbounded keys expand cluster state.';
    }

    return {
      coverage,
      detail,
      dynamicRisk,
      indexedValues,
      missing,
      recommended,
      supported,
      tone,
      verdict,
    };
  }, [data.capabilityLabels, data.mappings, dynamicPolicy.id, field, mapping]);

  const queryTrace = describeCapability(inspectedCapability, mapping.capabilities.includes(inspectedCapability));

  const selectField = (id: string) => {
    const next = data.fields.find((item) => item.id === id);
    setFieldId(id);
    if (next) setInspectedCapability(next.requirements[0]);
  };

  const reset = () => {
    setFieldId(data.defaults.fieldId);
    setMappingId(data.defaults.mappingId);
    setDynamicPolicyId(data.defaults.dynamicPolicyId);
    setInspectedCapability(data.fields.find((item) => item.id === data.defaults.fieldId)?.requirements[0] ?? 'fullText');
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Mapping and query studio"
          title={data.title}
          description={data.description}
          icon={Braces}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Field contract</legend>
                <div className="mt-3 space-y-2">
                  {data.fields.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={field.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={FileJson2}
                      accent="violet"
                      onClick={() => selectField(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <SelectControl
                label="2. Candidate mapping"
                value={mapping.id}
                options={data.mappings}
                icon={SlidersHorizontal}
                onChange={setMappingId}
              />
              <SelectControl
                label="3. Unknown field policy"
                value={dynamicPolicy.id}
                options={data.dynamicPolicies}
                icon={Filter}
                onChange={setDynamicPolicyId}
              />
            </div>
          )}
        >
          <div className="min-w-0" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Query coverage"
                value={`${result.supported.length} / ${field.requirements.length}`}
                detail={`${result.coverage.toFixed(0)}% of required behaviors`}
                icon={CheckCircle2}
                tone={result.coverage === 100 ? 'emerald' : result.coverage >= 50 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Reindex decision"
                value={result.missing.length ? 'Required' : result.recommended ? 'Avoidable' : 'Review'}
                detail="Field-type corrections normally need a new index generation"
                icon={Database}
                tone={result.missing.length ? 'rose' : result.recommended ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Index footprint"
                value={mapping.footprint}
                detail={`${mapping.indexingCost} modeled indexing cost`}
                icon={Gauge}
                tone={mapping.footprint === 'High' ? 'amber' : 'blue'}
              />
              <LabMetric
                label="Dynamic field risk"
                value={result.dynamicRisk}
                detail={dynamicPolicy.label}
                icon={ListFilter}
                tone={result.dynamicRisk === 'Low' ? 'emerald' : result.dynamicRisk === 'Medium' ? 'amber' : 'rose'}
              />
            </div>

            <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-start gap-3">
                {result.tone === 'emerald' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                ) : result.tone === 'amber' ? (
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
                ) : (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />
                )}
                <div className="min-w-0">
                  <p className="text-base font-semibold text-neutral-950 dark:text-white">{result.verdict}</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{result.detail}</p>
                </div>
              </div>
            </section>

            <section className="mt-5 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Index-time transformation</p>
              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] md:items-stretch">
                <TraceNode icon={FileJson2} label="Source value" tone="blue">
                  <code className="break-words text-xs">{field.sample}</code>
                </TraceNode>
                <FlowArrow />
                <TraceNode icon={Braces} label={mapping.label} tone="violet">
                  {mapping.structures.join(' + ')}
                </TraceNode>
                <FlowArrow />
                <TraceNode icon={Database} label="Indexed representation" tone={result.missing.length ? 'amber' : 'emerald'}>
                  <span className="flex flex-wrap gap-1.5">
                    {result.indexedValues.map((value) => (
                      <code key={value} className="rounded bg-white/70 px-1.5 py-0.5 text-xs dark:bg-neutral-950/60">{value}</code>
                    ))}
                  </span>
                </TraceNode>
              </div>
            </section>

            <section className="mt-5 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Query contract inspector</p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">Choose a required query to trace its access path</h4>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{field.label}</p>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {field.requirements.map((capability) => {
                  const supported = mapping.capabilities.includes(capability);
                  const selected = inspectedCapability === capability;
                  return (
                    <button
                      key={capability}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setInspectedCapability(capability)}
                      className={`flex min-h-11 items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${selected ? 'border-violet-400 bg-violet-50 text-violet-950 ring-1 ring-violet-400 dark:border-violet-600 dark:bg-violet-950/40 dark:text-violet-50' : 'border-neutral-200 bg-neutral-50 text-neutral-800 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-600'}`}
                    >
                      <span>{data.capabilityLabels[capability]}</span>
                      {supported ? (
                        <Check aria-label="Supported" className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                      ) : (
                        <CircleAlert aria-label="Unsupported" className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-300" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className={`mt-4 border-l-4 px-4 py-3 ${queryTrace.supported ? 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50' : 'border-rose-500 bg-rose-50 text-rose-950 dark:bg-rose-950/30 dark:text-rose-50'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{queryTrace.query}</p>
                  <span className="text-xs font-semibold uppercase opacity-75">{queryTrace.supported ? 'Supported path' : 'Missing structure'}</span>
                </div>
                <p className="mt-1 text-sm leading-6 opacity-85">{queryTrace.detail}</p>
              </div>
            </section>

            <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              <strong className="text-neutral-700 dark:text-neutral-200">Unknown-field policy:</strong> {dynamicPolicy.risk}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function describeCapability(capability: Capability, supported: boolean) {
  const paths: Record<Capability, { query: string; structure: string }> = {
    fullText: { query: '`match` query', structure: 'analyzed terms and positions in the inverted index' },
    exact: { query: '`term` filter', structure: 'one exact normalized term' },
    range: { query: '`range` query', structure: 'typed numeric or date points' },
    sort: { query: '`sort` clause', structure: 'column-oriented doc values' },
    aggregate: { query: 'bucket or metric aggregation', structure: 'doc values with a bounded aggregation plan' },
    dateMath: { query: 'date range such as `now-7d`', structure: 'a parsed date representation' },
  };
  const selected = paths[capability];
  return {
    query: selected.query,
    supported,
    detail: supported
      ? `Elasticsearch can use ${selected.structure} for this field contract.`
      : `This mapping does not build ${selected.structure}. Choose a compatible field type and reindex instead of forcing the query through an unsafe runtime workaround.`,
  };
}

function SelectControl<T extends { id: string; label: string; detail: string }>({
  label,
  value,
  options,
  icon: Icon,
  onChange,
}: {
  label: string;
  value: string;
  options: T[];
  icon: LucideIcon;
  onChange: (id: string) => void;
}) {
  const selected = options.find((item) => item.id === value) ?? options[0];
  return (
    <label className="block">
      <span className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        <Icon aria-hidden="true" className="h-4 w-4" />
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-950 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
      >
        {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
      <span className="mt-2 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">{selected.detail}</span>
    </label>
  );
}

function TraceNode({
  icon: Icon,
  label,
  tone,
  children,
}: {
  icon: LucideIcon;
  label: string;
  tone: 'blue' | 'violet' | 'amber' | 'emerald';
  children: ReactNode;
}) {
  const styles = {
    blue: 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-50',
    violet: 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-50',
    amber: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50',
    emerald: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50',
  };
  return (
    <div className={`min-w-0 rounded-md border p-4 ${styles[tone]}`}>
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <p className="text-sm font-semibold">{label}</p>
      </div>
      <div className="mt-3 break-words text-xs leading-5 opacity-80">{children}</div>
    </div>
  );
}

function FlowArrow() {
  return (
    <div aria-hidden="true" className="flex items-center justify-center text-neutral-400">
      <ArrowRight className="hidden h-5 w-5 md:block" />
      <ArrowDown className="h-5 w-5 md:hidden" />
    </div>
  );
}

function LoadState() {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="min-h-[720px] animate-pulse rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
      aria-label="Loading Elasticsearch mapping query lab"
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
      <p className="flex items-center gap-2 font-semibold"><CircleAlert aria-hidden="true" className="h-4 w-4" /> Elasticsearch mapping lab unavailable</p>
      <p className="mt-2 opacity-80">{detail}</p>
    </div>
  );
}
