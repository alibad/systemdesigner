'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CircleGauge,
  Database,
  Gauge,
  Layers3,
  ListFilter,
  Search,
  ShieldCheck,
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

type IndexType = 'exact' | 'hnsw' | 'ivfflat';
type StorageType = 'vector' | 'halfvec';

interface IndexProfile {
  id: IndexType;
  label: string;
  detail: string;
  indexToPayloadRatio: number;
  baselineCandidates: number;
  baselineRecallPct: number;
}

interface PlannerData {
  title: string;
  description: string;
  defaults: {
    rowsMillions: number;
    dimensions: number;
    indexType: IndexType;
    storageType: StorageType;
    candidateBudget: number;
    filterSelectivityPct: number;
    topK: number;
  };
  indexes: IndexProfile[];
}

const BLOCK_ID = 'technology/pgvector-performance';

function valid(value: unknown): value is PlannerData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PlannerData>;
  return Boolean(candidate.title && candidate.description && candidate.defaults && Array.isArray(candidate.indexes) && candidate.indexes.length);
}

export default function PgvectorPerformance({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<PlannerData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No vector-search planning assumptions were supplied.');
      return;
    }
    const controller = new AbortController();
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!valid(payload)) throw new Error('Vector-search planning assumptions are incomplete.');
        setData(payload);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Unable to load vector-search planning assumptions.');
      });
    return () => controller.abort();
  }, [dataFile]);

  if (error) return <State title="Search planner unavailable" detail={error} />;
  if (!data) return <State title="Loading search planner" detail="Preparing index assumptions..." />;
  return <Planner data={data} />;
}

function Planner({ data }: { data: PlannerData }) {
  const [rowsMillions, setRowsMillions] = useState(data.defaults.rowsMillions);
  const [dimensions, setDimensions] = useState(data.defaults.dimensions);
  const [indexType, setIndexType] = useState<IndexType>(data.defaults.indexType);
  const [storageType, setStorageType] = useState<StorageType>(data.defaults.storageType);
  const [candidateBudget, setCandidateBudget] = useState(data.defaults.candidateBudget);
  const [filterSelectivityPct, setFilterSelectivityPct] = useState(data.defaults.filterSelectivityPct);
  const [topK, setTopK] = useState(data.defaults.topK);
  const [iterativeScan, setIterativeScan] = useState(true);
  const profile = data.indexes.find((item) => item.id === indexType) ?? data.indexes[0];

  const result = useMemo(() => {
    const bytesPerDimension = storageType === 'vector' ? 4 : 2;
    const rows = rowsMillions * 1_000_000;
    const payloadBytes = rows * (dimensions * bytesPerDimension + 8);
    const payloadGiB = payloadBytes / 1024 ** 3;
    const indexGiB = payloadGiB * profile.indexToPayloadRatio;
    const expectedFilteredCandidates = candidateBudget * (filterSelectivityPct / 100);
    const requiredCandidates = topK / Math.max(0.001, filterSelectivityPct / 100);
    const effectiveCandidates = iterativeScan ? Math.max(candidateBudget, requiredCandidates) : candidateBudget;
    const enoughRows = iterativeScan || expectedFilteredCandidates >= topK;
    const recallProxy = indexType === 'exact'
      ? 100
      : Math.min(99.9, profile.baselineRecallPct + Math.log2(Math.max(1, effectiveCandidates / profile.baselineCandidates)) * 1.8);

    return {
      enoughRows,
      expectedFilteredCandidates,
      indexGiB,
      payloadGiB,
      recallProxy,
      requiredCandidates,
      totalGiB: payloadGiB + indexGiB,
    };
  }, [candidateBudget, dimensions, filterSelectivityPct, indexType, iterativeScan, profile, rowsMillions, storageType, topK]);

  const reset = () => {
    setRowsMillions(data.defaults.rowsMillions);
    setDimensions(data.defaults.dimensions);
    setIndexType(data.defaults.indexType);
    setStorageType(data.defaults.storageType);
    setCandidateBudget(data.defaults.candidateBudget);
    setFilterSelectivityPct(data.defaults.filterSelectivityPct);
    setTopK(data.defaults.topK);
    setIterativeScan(true);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader eyebrow="Index and filter budget lab" title={data.title} description={data.description} icon={Search} accent="violet" onReset={reset} />
        <LearningLabBody controls={<div className="space-y-7">
          <fieldset><legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Search path</legend><div className="mt-3 grid gap-2">{data.indexes.map((item) => <LabChoice key={item.id} selected={item.id === indexType} label={item.label} detail={item.detail} icon={item.id === 'exact' ? Database : Layers3} accent={item.id === 'hnsw' ? 'violet' : item.id === 'ivfflat' ? 'cyan' : 'blue'} onClick={() => setIndexType(item.id)} />)}</div></fieldset>
          <fieldset><legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Vector storage</legend><div className="mt-3 grid grid-cols-2 gap-2"><LabChoice selected={storageType === 'vector'} label="vector" detail="4 bytes per dimension" icon={Boxes} accent="blue" onClick={() => setStorageType('vector')} /><LabChoice selected={storageType === 'halfvec'} label="halfvec" detail="2 bytes per dimension" icon={Boxes} accent="emerald" onClick={() => setStorageType('halfvec')} /></div></fieldset>
          <LabRange label="Rows" value={rowsMillions} output={`${rowsMillions}M`} min={1} max={100} accent="blue" lowLabel="1M" highLabel="100M" onChange={setRowsMillions} />
          <LabRange label="Dimensions" value={dimensions} output={`${dimensions}`} min={128} max={2000} step={64} accent="violet" lowLabel="128" highLabel="2,000" onChange={setDimensions} />
          <LabRange label="Initial candidates" value={candidateBudget} output={`${candidateBudget}`} min={20} max={1000} step={20} accent="cyan" lowLabel="Fast" highLabel="Broad" onChange={setCandidateBudget} />
          <LabRange label="Filter selectivity" value={filterSelectivityPct} output={`${filterSelectivityPct}%`} min={1} max={100} accent="amber" lowLabel="Rare tenant/category" highLabel="All rows" onChange={setFilterSelectivityPct} />
          <LabRange label="Requested results" value={topK} output={`${topK}`} min={1} max={50} accent="emerald" lowLabel="Top 1" highLabel="Top 50" onChange={setTopK} />
          {indexType !== 'exact' ? <LabChoice selected={iterativeScan} label="Iterative index scan" detail="Visit more index candidates when post-filtering does not produce enough rows." icon={ListFilter} accent="emerald" onClick={() => setIterativeScan((value) => !value)} /> : null}
        </div>}>
          <div className="space-y-6">
            <div className={`rounded-md border p-5 ${result.enoughRows ? healthyClass : warningClass}`}><div className="flex items-start gap-3">{result.enoughRows ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}<div><p className="text-xs font-semibold uppercase opacity-75">Search-envelope verdict</p><h4 className="mt-1 text-xl font-semibold">{result.enoughRows ? 'The search can expand until the filtered result target is filled' : 'Post-filtering can return fewer rows than the caller requested'}</h4><p className="mt-2 text-sm leading-6 opacity-80">Storage arithmetic uses the documented vector payload formula. Index size and recall are benchmark proxies; validate both with the real embedding model, data distribution, filters, PostgreSQL plan, cache state, and hardware.</p></div></div></div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Vector payload" value={`${result.payloadGiB.toFixed(1)} GiB`} detail={`${rowsMillions}M x (${dimensions} dimensions + header)`} icon={Database} tone="blue" />
              <LabMetric label="Modeled index" value={`${result.indexGiB.toFixed(1)} GiB`} detail={`${profile.indexToPayloadRatio.toFixed(2)}x payload assumption`} icon={Layers3} tone="violet" />
              <LabMetric label="Post-filter rows" value={`${result.expectedFilteredCandidates.toFixed(0)}`} detail={`${candidateBudget} initial candidates x ${filterSelectivityPct}%`} icon={ListFilter} tone={result.enoughRows ? 'emerald' : 'rose'} />
              <LabMetric label="Recall proxy" value={`${result.recallProxy.toFixed(1)}%`} detail="Compare against exact search on labeled queries" icon={CircleGauge} tone="cyan" />
            </div>
            <div className="grid gap-3 md:grid-cols-3"><Stage title="Candidate stage" value={`${candidateBudget}`} detail="HNSW ef_search or IVFFlat probes determine work differently; benchmark the chosen index." /><Stage title="Filter requirement" value={`${Math.ceil(result.requiredCandidates)}`} detail={`Approximate candidates needed to expect ${topK} rows at ${filterSelectivityPct}% selectivity.`} /><Stage title="Total working set" value={`${result.totalGiB.toFixed(1)} GiB`} detail="Payload plus modeled index; add table, heap, PostgreSQL, and operating-system memory." /></div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function Stage({ title, value, detail }: { title: string; value: string; detail: string }) { return <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60"><p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{title}</p><p className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">{value}</p><p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p></div>; }
function State({ title, detail }: { title: string; detail: string }) { return <div data-content-block={BLOCK_ID}><LearningLab><LearningLabBody><div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900"><p className="text-sm font-semibold text-neutral-950 dark:text-white">{title}</p><p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{detail}</p></div></LearningLabBody></LearningLab></div>; }
const healthyClass = 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50';
const warningClass = 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50';
