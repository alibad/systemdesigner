'use client';

import { useMemo, useState } from 'react';
import {
  Boxes,
  Database,
  Gauge,
  MemoryStick,
  Search,
  ShieldCheck,
  TriangleAlert,
  Zap,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Family = 'flat' | 'ivf' | 'hnsw' | 'ivfpq';
const BLOCK_ID = 'technology/faiss-performance';
const families: Array<{ id: Family; label: string; detail: string }> = [
  {
    id: 'flat',
    label: 'Flat exact',
    detail: 'Scan every vector. Use as the exact baseline and when build complexity cannot be amortized.',
  },
  {
    id: 'ivf',
    label: 'IVF with flat codes',
    detail: 'Train coarse cells and search a selected fraction through nprobe.',
  },
  {
    id: 'hnsw',
    label: 'HNSW graph',
    detail: 'Traverse a proximity graph for fast, memory-rich approximate search.',
  },
  {
    id: 'ivfpq',
    label: 'IVF with PQ codes',
    detail: 'Search compressed residual codes when RAM is the binding constraint.',
  },
];

export default function FaissPerformance() {
  const [familyId, setFamilyId] = useState<Family>('ivf');
  const [vectorsMillions, setVectorsMillions] = useState(10);
  const [dimensions, setDimensions] = useState(768);
  const [searchBreadth, setSearchBreadth] = useState(12);
  const [codeBytes, setCodeBytes] = useState(64);
  const [queriesPerSecond, setQueriesPerSecond] = useState(250);
  const [ramGb, setRamGb] = useState(128);
  const family = families.find((item) => item.id === familyId) ?? families[0];

  const result = useMemo(() => {
    const vectors = vectorsMillions * 1_000_000;
    const rawBytes = vectors * dimensions * 4;
    const hnswLinks = 32;
    const memoryBytes = familyId === 'ivfpq'
      ? vectors * (codeBytes + 8) + dimensions * codeBytes * 256
      : familyId === 'hnsw'
        ? rawBytes + vectors * hnswLinks * 8
        : familyId === 'ivf'
          ? rawBytes * 1.08
          : rawBytes;
    const scannedFraction = familyId === 'flat'
      ? 1
      : familyId === 'hnsw'
        ? Math.min(1, searchBreadth / 2_000)
        : Math.min(1, searchBreadth / 100);
    const scannedVectors = vectors * scannedFraction;
    const estimatedRecall = familyId === 'flat'
      ? 100
      : familyId === 'ivfpq'
        ? Math.min(99, 72 + searchBreadth * 0.2 + codeBytes * 0.12)
        : familyId === 'hnsw'
          ? Math.min(99.5, 82 + searchBreadth * 0.15)
          : Math.min(99.5, 76 + searchBreadth * 0.22);
    const ramPressure = memoryBytes / (ramGb * 1024 ** 3) * 100;
    const distanceOpsPerSecond = scannedVectors * dimensions * queriesPerSecond;
    const computePressure = distanceOpsPerSecond / 150_000_000_000 * 100;
    const unhealthy = ramPressure > 80 || computePressure > 80 || estimatedRecall < 90;
    return {
      computePressure,
      estimatedRecall,
      memoryGb: memoryBytes / 1024 ** 3,
      ramPressure,
      rawGb: rawBytes / 1024 ** 3,
      scannedVectors,
      unhealthy,
    };
  }, [codeBytes, dimensions, familyId, queriesPerSecond, ramGb, searchBreadth, vectorsMillions]);

  const reset = () => {
    setFamilyId('ivf');
    setVectorsMillions(10);
    setDimensions(768);
    setSearchBreadth(12);
    setCodeBytes(64);
    setQueriesPerSecond(250);
    setRamGb(128);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="FAISS index design lab"
          title="Trade exactness, memory, and search work explicitly"
          description="Choose an index family and change dataset, vector, breadth, compression, traffic, and RAM assumptions. The estimates identify a benchmark candidate; measured recall and latency remain the release evidence."
          icon={Search}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Index family</legend>
              <div className="mt-3 grid gap-2">
                {families.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === family.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'flat' ? Database : Boxes}
                    accent={item.id === 'ivfpq' ? 'violet' : 'blue'}
                    onClick={() => setFamilyId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
            <LabRange label="Vector count" value={vectorsMillions} output={`${vectorsMillions}M`} min={1} max={1_000} step={1} accent="blue" lowLabel="One million" highLabel="One billion" onChange={setVectorsMillions} />
            <LabRange label="Dimensions" value={dimensions} output={`${dimensions}`} min={64} max={3_072} step={64} accent="cyan" lowLabel="Compact" highLabel="Wide embedding" onChange={setDimensions} />
            <LabRange
              label={familyId === 'hnsw' ? 'efSearch planning value' : familyId === 'flat' ? 'Exact scan breadth' : 'Percent of IVF cells probed'}
              value={familyId === 'flat' ? 100 : searchBreadth}
              output={`${familyId === 'flat' ? 100 : searchBreadth}${familyId === 'hnsw' ? '' : '%'}`}
              min={familyId === 'flat' ? 100 : 1}
              max={100}
              step={1}
              accent="emerald"
              lowLabel="Faster"
              highLabel="Higher recall"
              onChange={setSearchBreadth}
            />
            {familyId === 'ivfpq' ? <LabRange label="PQ bytes per vector" value={codeBytes} output={`${codeBytes} bytes`} min={8} max={256} step={8} accent="violet" lowLabel="More compression" highLabel="More detail" onChange={setCodeBytes} /> : null}
            <LabRange label="Query rate" value={queriesPerSecond} output={`${queriesPerSecond}/s`} min={1} max={5_000} step={10} accent="amber" lowLabel="Offline" highLabel="Serving" onChange={setQueriesPerSecond} />
            <LabRange label="RAM budget" value={ramGb} output={`${ramGb}GB`} min={16} max={2_048} step={16} accent="rose" lowLabel="One host" highLabel="Large shard" onChange={setRamGb} />
          </div>
        )}>
          <div className="space-y-6">
            <div className={`rounded-md border p-5 ${result.unhealthy ? warningClass : healthyClass}`}>
              <div className="flex items-start gap-3">
                {result.unhealthy ? <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Candidate verdict</p>
                  <h4 className="mt-1 text-xl font-semibold">
                    {result.ramPressure > 80 ? 'The index leaves too little RAM headroom' : result.computePressure > 80 ? 'Estimated distance work exceeds the search envelope' : result.estimatedRecall < 90 ? 'The breadth and compression target risk weak recall' : 'This family is ready for dataset-specific benchmarking'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {result.unhealthy ? 'Change index family, shard size, search breadth, compression, or traffic admission before loading the full production corpus.' : 'Build an exact Flat ground-truth sample and benchmark recall@K, p50/p99 latency, throughput, memory, build time, and filtered workload behavior.'}
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Index memory" value={`${result.memoryGb.toFixed(1)}GB`} detail={`${result.ramPressure.toFixed(0)}% of RAM budget`} icon={MemoryStick} tone={result.ramPressure > 80 ? 'rose' : 'violet'} />
              <LabMetric label="Raw vectors" value={`${result.rawGb.toFixed(1)}GB`} detail="float32 values before index overhead" icon={Database} tone="blue" />
              <LabMetric label="Vectors examined" value={formatCompact(result.scannedVectors)} detail="Planning estimate per query" icon={Search} tone="cyan" />
              <LabMetric label="Recall target" value={`${result.estimatedRecall.toFixed(1)}%`} detail={`${result.computePressure.toFixed(0)}% modeled compute pressure`} icon={Gauge} tone={result.estimatedRecall < 90 ? 'rose' : 'emerald'} />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Stage title="Ground truth" detail="Use Flat exact search on a representative query and corpus sample to establish true neighbors and recall@K." />
              <Stage title="Sweep" detail="Tune nprobe, efSearch, code size, re-ranking, threads, and batch size under the real traffic and filter mix." />
              <Stage title="Publish" detail="Bind embeddings, metric, normalization, factory string, trained state, IDs, metadata snapshot, and benchmark evidence to one version." />
            </div>
            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              <Zap aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" />
              This model intentionally excludes cache behavior, SIMD and GPU kernels, training quality, thread topology, filter selectivity, and storage I/O. Use it to reject obviously poor candidates, not to claim production latency.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function Stage({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
      <p className="text-sm font-semibold text-neutral-950 dark:text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

const healthyClass = 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50';
const warningClass = 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50';
