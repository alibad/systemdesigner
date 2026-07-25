'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Boxes,
  CheckCircle2,
  CircleAlert,
  Database,
  FileJson,
  Gauge,
  Link2,
  PackageOpen,
  PencilLine,
  ScanLine,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bound = { min: number; max: number; step: number };
type Workload = {
  id: string;
  label: string;
  detail: string;
  baseDocumentKiB: number;
  childKiB: number;
  readsTogetherPercent: number;
  parentDocuments: number;
  hotPercent: number;
  subsetChildren: number;
};
type Model = {
  id: 'embedded' | 'referenced' | 'subset';
  label: string;
  detail: string;
  batchSize: number;
  duplicateWrites: number;
};
type DocumentBoundaryData = {
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    modelId: string;
    relatedCount: number;
    independentUpdatesPerHour: number;
  };
  bounds: {
    relatedCount: Bound;
    independentUpdatesPerHour: Bound;
  };
  workloads: Workload[];
  models: Model[];
};

const BLOCK_ID = 'technology/mongodb-performance';
const MIB_IN_KIB = 1024;
const DOCUMENT_LIMIT_KIB = 16 * MIB_IN_KIB;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return isFiniteNumber(candidate.min)
    && isFiniteNumber(candidate.max)
    && isFiniteNumber(candidate.step);
}

function isDocumentBoundaryData(value: unknown): value is DocumentBoundaryData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DocumentBoundaryData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.workloadId
      && candidate.defaults.modelId
      && isFiniteNumber(candidate.defaults.relatedCount)
      && isFiniteNumber(candidate.defaults.independentUpdatesPerHour)
      && isBound(candidate.bounds?.relatedCount)
      && isBound(candidate.bounds?.independentUpdatesPerHour)
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length > 0
      && candidate.workloads.every((item) => item.id && isFiniteNumber(item.childKiB))
      && Array.isArray(candidate.models)
      && candidate.models.length > 0
      && candidate.models.every((item) => ['embedded', 'referenced', 'subset'].includes(item.id)),
  );
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatSize(kibibytes: number) {
  if (kibibytes >= MIB_IN_KIB) return `${(kibibytes / MIB_IN_KIB).toFixed(1)} MiB`;
  return `${kibibytes.toFixed(1)} KiB`;
}

export default function MongoDBDocumentBoundaryLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<DocumentBoundaryData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No document-boundary model was supplied.');
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
        if (!isDocumentBoundaryData(payload)) {
          throw new Error('The document-boundary model is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadState error={error} />;
  if (!data) return <LoadState />;
  return <DocumentBoundaryWorkbench data={data} />;
}

function DocumentBoundaryWorkbench({ data }: { data: DocumentBoundaryData }) {
  const [workloadId, setWorkloadId] = useState(data.defaults.workloadId);
  const [modelId, setModelId] = useState(data.defaults.modelId);
  const [relatedCount, setRelatedCount] = useState(data.defaults.relatedCount);
  const [independentUpdatesPerHour, setIndependentUpdatesPerHour] = useState(
    data.defaults.independentUpdatesPerHour,
  );

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];
  const model = data.models.find((item) => item.id === modelId) ?? data.models[0];

  const result = useMemo(() => {
    const subsetCount = Math.min(workload.subsetChildren, relatedCount);
    const rootDocumentKiB = model.id === 'embedded'
      ? workload.baseDocumentKiB + workload.childKiB * relatedCount
      : model.id === 'subset'
        ? workload.baseDocumentKiB + workload.childKiB * subsetCount
        : workload.baseDocumentKiB;
    const externalChildren = model.id === 'embedded' ? 0 : relatedCount;
    const followupReads = model.id === 'embedded'
      ? 0
      : Math.ceil(Math.max(0, relatedCount - (model.id === 'subset' ? subsetCount : 0)) / model.batchSize);
    const documentsPerCommonRead = 1 + followupReads;
    const duplicatedKiB = model.id === 'subset' ? workload.childKiB * subsetCount : 0;
    const logicalKiBPerParent = workload.baseDocumentKiB
      + workload.childKiB * relatedCount
      + duplicatedKiB;
    const logicalGiB = logicalKiBPerParent * workload.parentDocuments / MIB_IN_KIB / MIB_IN_KIB;
    const hotGiB = logicalGiB * workload.hotPercent / 100;
    const mutationKiB = model.id === 'embedded'
      ? rootDocumentKiB
      : workload.childKiB * model.duplicateWrites;
    const hourlyMutationGiB = mutationKiB * independentUpdatesPerHour * workload.parentDocuments
      / MIB_IN_KIB / MIB_IN_KIB;
    const limitPercent = rootDocumentKiB / DOCUMENT_LIMIT_KIB * 100;

    let verdict = 'The boundary is credible for this workload';
    let detail = 'The common read is bounded, the document has growth headroom, and consistency ownership is visible. Validate with measured document percentiles and query plans.';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';

    if (rootDocumentKiB >= DOCUMENT_LIMIT_KIB) {
      verdict = 'The root document crosses MongoDB\'s hard limit';
      detail = 'Move the unbounded relationship to child documents or bounded buckets before accepting more growth.';
      tone = 'rose';
    } else if (rootDocumentKiB >= DOCUMENT_LIMIT_KIB * 0.75) {
      verdict = 'The document has unsafe growth headroom';
      detail = 'A schema can fail before the average reaches the hard limit. Model p95 and maximum cardinality, then split the relationship.';
      tone = 'rose';
    } else if (model.id === 'embedded' && independentUpdatesPerHour >= 250) {
      verdict = 'Independent writes are concentrated on one parent';
      detail = 'Embedding preserves atomicity but turns unrelated child mutations into contention and large-document write pressure.';
      tone = 'amber';
    } else if (model.id === 'referenced' && workload.readsTogetherPercent >= 80 && relatedCount <= 500) {
      verdict = 'References make the dominant read chatty';
      detail = 'The relationship is usually consumed together. Consider bounded embedding or a versioned subset if ownership and growth allow it.';
      tone = 'amber';
    } else if (model.id === 'subset') {
      verdict = 'The hot read is fast, but duplication is now a contract';
      detail = 'Assign one update owner, store a source version with the subset, and monitor or repair stale snapshots.';
      tone = 'amber';
    }

    return {
      atomicScope: model.id === 'embedded'
        ? 'Parent + children'
        : model.id === 'subset'
          ? 'Snapshot only'
          : 'One record',
      detail,
      documentsPerCommonRead,
      externalChildren,
      hotGiB,
      hourlyMutationGiB,
      limitPercent,
      logicalGiB,
      mutationKiB,
      rootDocumentKiB,
      subsetCount,
      tone,
      verdict,
    };
  }, [independentUpdatesPerHour, model, relatedCount, workload]);

  function reset() {
    setWorkloadId(data.defaults.workloadId);
    setModelId(data.defaults.modelId);
    setRelatedCount(data.defaults.relatedCount);
    setIndependentUpdatesPerHour(data.defaults.independentUpdatesPerHour);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Document boundary workbench"
          title={data.title}
          description={data.description}
          icon={FileJson}
          accent="blue"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup
                label="1. Workload"
                items={data.workloads}
                selectedId={workload.id}
                icon={PackageOpen}
                accent="blue"
                onSelect={setWorkloadId}
              />
              <ChoiceGroup
                label="2. Relationship model"
                items={data.models}
                selectedId={model.id}
                icon={modelIcon(model.id)}
                accent="violet"
                onSelect={setModelId}
              />
              <LabRange
                label="Related records per parent"
                value={relatedCount}
                output={formatCompact(relatedCount)}
                {...data.bounds.relatedCount}
                accent="blue"
                lowLabel="Bounded"
                highLabel="Unbounded pressure"
                onChange={setRelatedCount}
              />
              <LabRange
                label="Independent child updates / hour"
                value={independentUpdatesPerHour}
                output={formatCompact(independentUpdatesPerHour)}
                {...data.bounds.independentUpdatesPerHour}
                accent="amber"
                lowLabel="Mostly immutable"
                highLabel="Write hot"
                onChange={setIndependentUpdatesPerHour}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Common read"
                value={`${result.documentsPerCommonRead} ${result.documentsPerCommonRead === 1 ? 'batch' : 'batches'}`}
                detail={`${workload.readsTogetherPercent}% of reads need the relationship`}
                icon={ScanLine}
                tone={result.documentsPerCommonRead <= 2 ? 'emerald' : result.documentsPerCommonRead <= 8 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Root document"
                value={formatSize(result.rootDocumentKiB)}
                detail={`${result.limitPercent.toFixed(1)}% of the 16 MiB limit`}
                icon={FileJson}
                tone={result.limitPercent < 25 ? 'blue' : result.limitPercent < 75 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Atomic scope"
                value={result.atomicScope}
                detail="One MongoDB write boundary"
                icon={CheckCircle2}
                tone={model.id === 'embedded' ? 'emerald' : 'violet'}
              />
              <LabMetric
                label="Hot logical set"
                value={`${result.hotGiB.toFixed(1)} GiB`}
                detail={`${result.logicalGiB.toFixed(0)} GiB total before indexes and replicas`}
                icon={Gauge}
                tone={result.hotGiB < 64 ? 'cyan' : result.hotGiB < 256 ? 'amber' : 'rose'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-start gap-3">
                {result.tone === 'emerald' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                ) : (
                  <CircleAlert
                    aria-hidden="true"
                    className={`mt-0.5 h-5 w-5 shrink-0 ${result.tone === 'rose' ? 'text-rose-600 dark:text-rose-300' : 'text-amber-600 dark:text-amber-300'}`}
                  />
                )}
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">{result.verdict}</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{result.detail}</p>
                </div>
              </div>
            </section>

            <section aria-label="Document and read path" className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Visible relationship</p>
                <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">Where the common read and atomic boundary travel</h4>
              </div>
              <div className="mt-5 grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
                <PathNode
                  icon={ScanLine}
                  eyebrow="Request"
                  title="Load the aggregate"
                  detail={`${workload.readsTogetherPercent}% of reads need related data`}
                  tone="blue"
                />
                <FlowArrow />
                <PathNode
                  icon={Database}
                  eyebrow="Root collection"
                  title={formatSize(result.rootDocumentKiB)}
                  detail={model.id === 'embedded' ? 'Owns every child' : model.id === 'subset' ? `Owns ${result.subsetCount} hot children` : 'Stores references only'}
                  tone="violet"
                />
                <FlowArrow />
                <PathNode
                  icon={model.id === 'embedded' ? Boxes : Link2}
                  eyebrow={model.id === 'embedded' ? 'Inside root' : 'Child collection'}
                  title={model.id === 'embedded' ? `${formatCompact(relatedCount)} embedded` : `${formatCompact(result.externalChildren)} referenced`}
                  detail={model.id === 'embedded' ? 'Same atomic write' : `${Math.max(0, result.documentsPerCommonRead - 1)} follow-up read batches`}
                  tone={model.id === 'embedded' ? 'green' : 'amber'}
                />
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-3">
              <Fact label="Modeled mutation" value={formatSize(result.mutationKiB)} detail="Bytes touched per independent child change" />
              <Fact label="Hourly mutation" value={`${result.hourlyMutationGiB.toFixed(1)} GiB`} detail="Transparent workload-wide planning estimate" />
              <Fact label="Consistency owner" value={model.id === 'embedded' ? 'Document write' : model.id === 'subset' ? 'Snapshot updater' : 'Workflow / transaction'} detail="Mechanism responsible for cross-field correctness" />
            </div>
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
  accent: 'blue' | 'violet';
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</legend>
      <div className="space-y-2">
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

function PathNode({ icon: Icon, eyebrow, title, detail, tone }: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  detail: string;
  tone: 'blue' | 'violet' | 'green' | 'amber';
}) {
  const styles = {
    blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50',
    violet: 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-50',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
    amber: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
  };

  return (
    <div className={`min-w-0 rounded-md border p-4 ${styles[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {eyebrow}
      </div>
      <p className="mt-2 break-words text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function FlowArrow() {
  return (
    <div aria-hidden="true" className="flex items-center justify-center text-neutral-400 dark:text-neutral-600">
      <ArrowDown className="h-5 w-5 md:hidden" />
      <ArrowRight className="hidden h-5 w-5 md:block" />
    </div>
  );
}

function Fact({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}

function modelIcon(modelId: Model['id']): LucideIcon {
  if (modelId === 'embedded') return Boxes;
  if (modelId === 'subset') return PencilLine;
  return Link2;
}

function LoadState({ error }: { error?: string }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow={error ? 'Model unavailable' : 'Loading workbench'}
          title={error ? 'The document-boundary model could not load' : 'Preparing the document-boundary model'}
          description={error ?? 'Loading workload, relationship, and capacity assumptions.'}
          icon={error ? CircleAlert : FileJson}
          accent={error ? 'rose' : 'blue'}
        />
      </LearningLab>
    </div>
  );
}
