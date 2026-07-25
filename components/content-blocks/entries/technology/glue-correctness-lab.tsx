'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArchiveRestore,
  CheckCircle2,
  CopyCheck,
  FileWarning,
  GitCompareArrows,
  ListRestart,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type ScenarioKind = 'schema-drift' | 'bookmark-replay' | 'small-file-skew';

interface Scenario {
  id: string;
  label: string;
  detail: string;
  kind: ScenarioKind;
  records: number;
  affectedPct: number;
  fileCount: number;
}

interface CorrectnessData {
  title: string;
  description: string;
  defaults: { scenarioId: string };
  scenarios: Scenario[];
}

const BLOCK_ID = 'technology/glue-correctness-lab';

function valid(value: unknown): value is CorrectnessData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CorrectnessData>;
  return Boolean(candidate.title && candidate.description && candidate.defaults && Array.isArray(candidate.scenarios) && candidate.scenarios.length);
}

export default function GlueCorrectnessLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<CorrectnessData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No Glue failure scenarios were supplied.');
      return;
    }
    const controller = new AbortController();
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!valid(payload)) throw new Error('Glue failure scenarios are incomplete.');
        setData(payload);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Unable to load Glue failure scenarios.');
      });
    return () => controller.abort();
  }, [dataFile]);

  if (error) return <State title="Correctness lab unavailable" detail={error} />;
  if (!data) return <State title="Loading correctness lab" detail="Preparing pipeline incidents..." />;
  return <CorrectnessLab data={data} />;
}

function CorrectnessLab({ data }: { data: CorrectnessData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [quarantine, setQuarantine] = useState(true);
  const [bookmark, setBookmark] = useState(true);
  const [idempotentSink, setIdempotentSink] = useState(true);
  const [compactOutput, setCompactOutput] = useState(true);
  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];

  const result = useMemo(() => {
    const affected = Math.round(scenario.records * scenario.affectedPct / 100);
    if (scenario.kind === 'schema-drift') {
      return {
        safe: quarantine,
        title: quarantine ? 'Breaking records are isolated before the shared table changes' : 'The inferred schema can silently alter a shared contract',
        detail: quarantine ? 'Publish compatible columns, retain raw input, and route incompatible rows with reason codes for review.' : 'Automatic catalog updates can surprise downstream queries; a crawler is not a schema-compatibility approval system.',
        duplicates: 0,
        quarantined: quarantine ? affected : 0,
        outputFiles: scenario.fileCount,
        reprocessed: 0,
      };
    }
    if (scenario.kind === 'bookmark-replay') {
      const reprocessed = bookmark ? 0 : affected;
      const duplicates = reprocessed && !idempotentSink ? reprocessed : 0;
      return {
        safe: duplicates === 0,
        title: bookmark ? 'The committed bookmark limits the next run to new source data' : idempotentSink ? 'The replay repeats work but converges on stable output keys' : 'The replay creates duplicate output records',
        detail: 'Bookmarks track supported source progress, not arbitrary downstream side effects. Rewind into a separate target or make writes idempotent.',
        duplicates,
        quarantined: 0,
        outputFiles: scenario.fileCount,
        reprocessed,
      };
    }
    const outputFiles = compactOutput ? Math.max(8, Math.round(scenario.fileCount / 100)) : scenario.fileCount;
    return {
      safe: compactOutput,
      title: compactOutput ? 'The write plan bounds output-file count and downstream listing cost' : 'The job publishes thousands of tiny output objects',
      detail: compactOutput ? 'Repartition from measured output volume and query partitions; do not force one giant file or a fixed count for every run.' : 'More workers can make the small-file problem worse when each task writes independently.',
      duplicates: 0,
      quarantined: 0,
      outputFiles,
      reprocessed: 0,
    };
  }, [bookmark, compactOutput, idempotentSink, quarantine, scenario]);

  const reset = () => {
    setScenarioId(data.defaults.scenarioId);
    setQuarantine(true);
    setBookmark(true);
    setIdempotentSink(true);
    setCompactOutput(true);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader eyebrow="Incremental correctness lab" title={data.title} description={data.description} icon={ShieldAlert} accent="rose" onReset={reset} />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Inject an incident</legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((item) => (
                    <LabChoice key={item.id} selected={item.id === scenario.id} label={item.label} detail={item.detail} icon={item.kind === 'schema-drift' ? GitCompareArrows : item.kind === 'bookmark-replay' ? ArchiveRestore : FileWarning} accent="rose" onClick={() => setScenarioId(item.id)} />
                  ))}
                </div>
              </fieldset>
              {scenario.kind === 'schema-drift' ? <LabChoice selected={quarantine} label="Compatibility gate and quarantine" detail="Keep incompatible rows out of the published table while preserving evidence and reason codes." icon={ShieldCheck} accent="emerald" onClick={() => setQuarantine((value) => !value)} /> : null}
              {scenario.kind === 'bookmark-replay' ? (
                <>
                  <LabChoice selected={bookmark} label="Committed job bookmark" detail="Advance source progress only after the job reaches its successful commit boundary." icon={ArchiveRestore} accent="blue" onClick={() => setBookmark((value) => !value)} />
                  <LabChoice selected={idempotentSink} label="Stable output identity" detail="A replay overwrites or merges the same logical batch instead of appending duplicates." icon={CopyCheck} accent="emerald" onClick={() => setIdempotentSink((value) => !value)} />
                </>
              ) : null}
              {scenario.kind === 'small-file-skew' ? <LabChoice selected={compactOutput} label="Bounded output partitioning" detail="Estimate output bytes and write a measured number of useful files per query partition." icon={FileWarning} accent="violet" onClick={() => setCompactOutput((value) => !value)} /> : null}
            </div>
          )}
        >
          <div className="space-y-6">
            <div className={`rounded-md border p-5 ${result.safe ? healthyClass : warningClass}`}>
              <div className="flex items-start gap-3">
                {result.safe ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div><p className="text-xs font-semibold uppercase opacity-75">Observed outcome</p><h4 className="mt-1 text-xl font-semibold">{result.title}</h4><p className="mt-2 text-sm leading-6 opacity-80">{result.detail}</p></div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Reprocessed rows" value={result.reprocessed.toLocaleString()} detail="Source records read again" icon={ListRestart} tone={result.reprocessed ? 'amber' : 'blue'} />
              <LabMetric label="Duplicate rows" value={result.duplicates.toLocaleString()} detail="Repeated logical sink outcomes" icon={CopyCheck} tone={result.duplicates ? 'rose' : 'emerald'} />
              <LabMetric label="Quarantined rows" value={result.quarantined.toLocaleString()} detail="Preserved outside the published contract" icon={ShieldCheck} tone={result.quarantined ? 'violet' : 'cyan'} />
              <LabMetric label="Output files" value={result.outputFiles.toLocaleString()} detail="Objects exposed to downstream readers" icon={FileWarning} tone={result.outputFiles > 1000 ? 'rose' : 'cyan'} />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Stage title="Read boundary" detail="Name source identity, late-arrival policy, bookmark or checkpoint semantics, and a reproducible input snapshot." />
              <Stage title="Transform boundary" detail="Validate schema, quality, nullability, keys, and rejected records before mutating a shared catalog contract." />
              <Stage title="Publish boundary" detail="Write versioned or idempotent outputs, compact intentionally, commit progress last, and expose lineage plus run evidence." />
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function Stage({ title, detail }: { title: string; detail: string }) { return <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60"><p className="text-sm font-semibold text-neutral-950 dark:text-white">{title}</p><p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p></div>; }
function State({ title, detail }: { title: string; detail: string }) { return <div data-content-block={BLOCK_ID}><LearningLab><LearningLabBody><div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900"><p className="text-sm font-semibold text-neutral-950 dark:text-white">{title}</p><p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{detail}</p></div></LearningLabBody></LearningLab></div>; }
const healthyClass = 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50';
const warningClass = 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50';
