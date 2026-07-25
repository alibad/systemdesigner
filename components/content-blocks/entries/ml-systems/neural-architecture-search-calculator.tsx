'use client';

import { useMemo, useState } from 'react';
import {
  Boxes,
  Clock3,
  Cpu,
  Gauge,
  GitBranch,
  Search,
  ShieldCheck,
  TriangleAlert,
  WalletCards,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type SearchMethod = 'evolution' | 'bayesian' | 'differentiable';

const BLOCK_ID = 'ml-systems/neural-architecture-search-calculator';
const methods: Array<{
  id: SearchMethod;
  label: string;
  detail: string;
  evaluationMultiplier: number;
  orchestrationOverhead: number;
}> = [
  { id: 'evolution', label: 'Regularized evolution', detail: 'Discrete, parallel, and robust; spends many candidate evaluations.', evaluationMultiplier: 1, orchestrationOverhead: 1.08 },
  { id: 'bayesian', label: 'Bayesian optimization', detail: 'Uses a surrogate to choose fewer expensive candidates.', evaluationMultiplier: 0.42, orchestrationOverhead: 1.15 },
  { id: 'differentiable', label: 'Differentiable search', detail: 'Optimizes a relaxed supernet, then discretizes and retrains.', evaluationMultiplier: 0.18, orchestrationOverhead: 1.35 },
];

export default function NeuralArchitectureSearchCalculator() {
  const [methodId, setMethodId] = useState<SearchMethod>('evolution');
  const [populationSize, setPopulationSize] = useState(48);
  const [rounds, setRounds] = useState(60);
  const [evaluationHours, setEvaluationHours] = useState(1.5);
  const [parallelAccelerators, setParallelAccelerators] = useState(16);
  const [earlyStopPct, setEarlyStopPct] = useState(55);

  const method = methods.find((item) => item.id === methodId) ?? methods[0];
  const result = useMemo(() => {
    const proposedEvaluations = populationSize * rounds;
    const executedEvaluations = Math.ceil(proposedEvaluations * method.evaluationMultiplier);
    const averageEvaluationHours = evaluationHours * (1 - earlyStopPct / 100 * 0.65);
    const acceleratorHours = executedEvaluations * averageEvaluationHours * method.orchestrationOverhead;
    const wallHours = acceleratorHours / parallelAccelerators;
    const estimatedCost = acceleratorHours * 1.8;
    const fullTrainingEquivalents = acceleratorHours / Math.max(evaluationHours, 0.1);
    const stressed = wallHours > 168 || estimatedCost > 25_000;
    return {
      acceleratorHours,
      averageEvaluationHours,
      estimatedCost,
      executedEvaluations,
      fullTrainingEquivalents,
      proposedEvaluations,
      stressed,
      wallHours,
    };
  }, [earlyStopPct, evaluationHours, method, parallelAccelerators, populationSize, rounds]);

  const reset = () => {
    setMethodId('evolution');
    setPopulationSize(48);
    setRounds(60);
    setEvaluationHours(1.5);
    setParallelAccelerators(16);
    setEarlyStopPct(55);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="NAS search budget lab"
          title="Separate candidate work from wall-clock time"
          description="Choose a search strategy and evaluation policy. The model tracks proposed candidates, executed proxies, accelerator-hours, parallel wall time, and cost as different quantities."
          icon={Search}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Search strategy</legend>
                <div className="mt-3 grid gap-2">
                  {methods.map((item) => (
                    <LabChoice key={item.id} selected={method.id === item.id} label={item.label} detail={item.detail} icon={GitBranch} accent={item.id === 'evolution' ? 'violet' : 'cyan'} onClick={() => setMethodId(item.id)} />
                  ))}
                </div>
              </fieldset>
              <LabRange label="Candidates per round" value={populationSize} output={populationSize.toLocaleString()} min={8} max={128} step={8} accent="blue" lowLabel="Narrow pool" highLabel="Broader pool" onChange={setPopulationSize} />
              <LabRange label="Search rounds" value={rounds} output={rounds.toLocaleString()} min={10} max={200} step={10} accent="violet" lowLabel="Short search" highLabel="Long search" onChange={setRounds} />
              <LabRange label="Full proxy hours" value={evaluationHours} output={`${evaluationHours.toFixed(1)}h`} min={0.5} max={12} step={0.5} accent="amber" lowLabel="Cheap proxy" highLabel="More evidence" onChange={setEvaluationHours} />
              <LabRange label="Early-stopped candidates" value={earlyStopPct} output={`${earlyStopPct}%`} min={0} max={90} step={5} accent="emerald" lowLabel="Train all equally" highLabel="Aggressive pruning" onChange={setEarlyStopPct} />
              <LabRange label="Parallel accelerators" value={parallelAccelerators} output={parallelAccelerators.toLocaleString()} min={1} max={128} step={1} accent="cyan" lowLabel="Long wall time" highLabel="More parallel spend" onChange={setParallelAccelerators} />
            </div>
          )}
        >
          <div className="space-y-6">
            <div className={`rounded-md border p-5 ${result.stressed ? warningClass : healthyClass}`}>
              <div className="flex items-start gap-3">
                {result.stressed ? <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Budget verdict</p>
                  <h4 className="mt-1 text-xl font-semibold">{result.stressed ? 'The search exceeds the illustrative release budget' : 'The search fits the illustrative one-week budget'}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">{result.stressed ? 'Narrow the space, validate a cheaper proxy, reduce rounds, or require stronger evidence that extra search work changes the Pareto frontier.' : 'Reserve separate compute for full retraining, repeated seeds, hardware measurement, and held-out confirmation of the finalists.'}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Executed proxies" value={result.executedEvaluations.toLocaleString()} detail={`${result.proposedEvaluations.toLocaleString()} proposed by the search loop`} icon={Boxes} tone="blue" />
              <LabMetric label="Accelerator work" value={`${result.acceleratorHours.toFixed(0)} h`} detail="Total work before parallelism" icon={Cpu} tone="violet" />
              <LabMetric label="Wall time" value={`${result.wallHours.toFixed(1)} h`} detail={`${parallelAccelerators} concurrent accelerators`} icon={Clock3} tone={result.wallHours > 168 ? 'rose' : 'emerald'} />
              <LabMetric label="Estimated cost" value={`$${result.estimatedCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} detail="$1.80 per accelerator-hour assumption" icon={WalletCards} tone={result.estimatedCost > 25_000 ? 'rose' : 'amber'} />
            </div>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Evidence accounting</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <BudgetCard icon={Search} title="Average proxy" value={`${result.averageEvaluationHours.toFixed(2)}h`} detail="After the modeled early-stop savings" />
                <BudgetCard icon={Gauge} title="Full-training equivalents" value={result.fullTrainingEquivalents.toFixed(0)} detail="Useful only as a budget comparison, not equal evidence" />
                <BudgetCard icon={ShieldCheck} title="Final confirmation" value="Not included" detail="Retrain finalists with repeated seeds and production hardware" />
              </div>
            </div>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">This planning model excludes queueing, data loading, failed jobs, checkpoint storage, controller cost, and full finalist retraining. Measure the actual platform before approving a search.</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function BudgetCard({ icon: Icon, title, value, detail }: { icon: typeof Search; title: string; value: string; detail: string }) {
  return <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"><div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400"><Icon aria-hidden="true" className="h-4 w-4" />{title}</div><p className="mt-2 text-xl font-semibold text-neutral-950 dark:text-white">{value}</p><p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p></div>;
}

const healthyClass = 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50';
const warningClass = 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50';
