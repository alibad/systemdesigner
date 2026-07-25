'use client';

import { useMemo, useState } from 'react';
import {
  Boxes,
  Database,
  Gauge,
  Layers3,
  MemoryStick,
  Search,
  Server,
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

type Precision = 'fp32' | 'fp16' | 'int8';

const BLOCK_ID = 'ml-systems/recommender-systems-advanced-calculator';
const precisionOptions: Array<{
  id: Precision;
  label: string;
  detail: string;
  bytes: number;
}> = [
  { id: 'fp32', label: 'FP32', detail: 'Highest memory cost; useful as an offline reference.', bytes: 4 },
  { id: 'fp16', label: 'FP16', detail: 'Common serving balance for learned embeddings.', bytes: 2 },
  { id: 'int8', label: 'INT8', detail: 'Smaller footprint after measured quality validation.', bytes: 1 },
];

const formatCount = (value: number) => value >= 1_000_000_000
  ? `${(value / 1_000_000_000).toFixed(1)}B`
  : value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(1)}M`
    : value >= 1_000
      ? `${(value / 1_000).toFixed(1)}K`
      : value.toFixed(0);

export default function RecommenderSystemsAdvancedCalculator() {
  const [userMillions, setUserMillions] = useState(25);
  const [itemMillions, setItemMillions] = useState(5);
  const [embeddingDim, setEmbeddingDim] = useState(256);
  const [requestsPerSecond, setRequestsPerSecond] = useState(12_000);
  const [candidateCount, setCandidateCount] = useState(800);
  const [precision, setPrecision] = useState<Precision>('fp16');

  const result = useMemo(() => {
    const bytes = precisionOptions.find((option) => option.id === precision)?.bytes ?? 2;
    const totalEntities = (userMillions + itemMillions) * 1_000_000;
    const embeddingGiB = totalEntities * embeddingDim * bytes / 1024 ** 3;
    const replicatedGiB = embeddingGiB * 2;
    const retrievalMs = 4 + Math.log2(itemMillions * 1_000_000) * 0.12;
    const rankingMs = 3 + candidateCount * 0.018;
    const policyMs = 2.5;
    const modeledLatencyMs = retrievalMs + rankingMs + policyMs;
    const inFlightRequests = requestsPerSecond * modeledLatencyMs / 1_000;
    const candidatesPerSecond = requestsPerSecond * candidateCount;
    const servingUnits = Math.ceil(inFlightRequests / 40 / 0.65);
    const stressed = modeledLatencyMs > 30 || candidatesPerSecond > 18_000_000;
    return {
      candidatesPerSecond,
      embeddingGiB,
      inFlightRequests,
      modeledLatencyMs,
      rankingMs,
      replicatedGiB,
      retrievalMs,
      servingUnits,
      stressed,
    };
  }, [candidateCount, embeddingDim, itemMillions, precision, requestsPerSecond, userMillions]);

  const reset = () => {
    setUserMillions(25);
    setItemMillions(5);
    setEmbeddingDim(256);
    setRequestsPerSecond(12_000);
    setCandidateCount(800);
    setPrecision('fp16');
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Serving envelope lab"
          title="Bound embedding memory and ranking work together"
          description="Change the population, catalog, vector format, request rate, and candidate width. The model keeps storage footprint separate from online retrieval and ranking latency."
          icon={Layers3}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <LabRange
                label="Users represented"
                value={userMillions}
                output={`${userMillions}M`}
                min={1}
                max={200}
                step={1}
                accent="blue"
                lowLabel="Narrow audience"
                highLabel="Large population"
                onChange={setUserMillions}
              />
              <LabRange
                label="Item catalog"
                value={itemMillions}
                output={`${itemMillions}M`}
                min={1}
                max={50}
                step={1}
                accent="cyan"
                lowLabel="Focused catalog"
                highLabel="Broad inventory"
                onChange={setItemMillions}
              />
              <LabRange
                label="Embedding width"
                value={embeddingDim}
                output={`${embeddingDim} dimensions`}
                min={64}
                max={1_024}
                step={64}
                accent="violet"
                lowLabel="Compact representation"
                highLabel="Richer vectors"
                onChange={setEmbeddingDim}
              />
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Vector precision
                </legend>
                <div className="mt-3 grid gap-2">
                  {precisionOptions.map((option) => (
                    <LabChoice
                      key={option.id}
                      selected={precision === option.id}
                      label={option.label}
                      detail={option.detail}
                      icon={MemoryStick}
                      accent={option.id === 'fp16' ? 'emerald' : 'amber'}
                      onClick={() => setPrecision(option.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <LabRange
                label="Peak requests per second"
                value={requestsPerSecond}
                output={requestsPerSecond.toLocaleString()}
                min={1_000}
                max={80_000}
                step={1_000}
                accent="emerald"
                lowLabel="Small surface"
                highLabel="Peak traffic"
                onChange={setRequestsPerSecond}
              />
              <LabRange
                label="Candidates sent to ranking"
                value={candidateCount}
                output={candidateCount.toLocaleString()}
                min={100}
                max={2_000}
                step={100}
                accent="amber"
                lowLabel="Narrow recall"
                highLabel="More ranking work"
                onChange={setCandidateCount}
              />
            </div>
          )}
        >
          <div className="space-y-6">
            <div className={`rounded-md border p-5 ${result.stressed ? warningClass : healthyClass}`}>
              <div className="flex items-start gap-3">
                {result.stressed ? (
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Serving verdict</p>
                  <h4 className="mt-1 text-xl font-semibold">
                    {result.stressed ? 'Ranking work exceeds the illustrative serving envelope' : 'The online path remains inside the modeled envelope'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {result.stressed
                      ? 'Reduce candidate width, introduce a cheaper pre-ranker, batch compatible work, or add serving capacity without hiding the quality trade-off.'
                      : 'Retrieval narrows the catalog before the rich ranker, while two embedding copies preserve a bounded failover target.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Embedding footprint" value={`${result.embeddingGiB.toFixed(1)} GiB`} detail={`${result.replicatedGiB.toFixed(1)} GiB with two copies`} icon={Database} tone="violet" />
              <LabMetric label="Modeled latency" value={`${result.modeledLatencyMs.toFixed(1)} ms`} detail="Retrieval, ranking, and policy stages" icon={Gauge} tone={result.stressed ? 'rose' : 'emerald'} />
              <LabMetric label="Candidate scores" value={`${formatCount(result.candidatesPerSecond)}/s`} detail="Peak ranking work" icon={Search} tone={result.candidatesPerSecond > 18_000_000 ? 'amber' : 'cyan'} />
              <LabMetric label="Serving units" value={result.servingUnits.toLocaleString()} detail="At 40 concurrent requests and 65% target load" icon={Server} tone="blue" />
            </div>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Online request budget</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <BudgetStage icon={Search} label="Retrieve" value={`${result.retrievalMs.toFixed(1)} ms`} detail="Approximate search over the item index" />
                <BudgetStage icon={Boxes} label="Rank" value={`${result.rankingMs.toFixed(1)} ms`} detail={`${candidateCount.toLocaleString()} candidates with richer features`} />
                <BudgetStage icon={ShieldCheck} label="Constrain" value="2.5 ms" detail="Eligibility, safety, diversity, and deduplication" />
              </div>
            </div>

            <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">Model boundary</p>
              <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                The latency constants and 40-request serving unit are illustrative. Benchmark the actual ANN index, feature joins, model, accelerator, batching policy, p99 tail, and quality loss from quantization before choosing capacity.
              </p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function BudgetStage({ icon: Icon, label, value, detail }: { icon: typeof Search; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        <Icon aria-hidden="true" className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-xl font-semibold text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

const healthyClass = 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50';
const warningClass = 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50';
