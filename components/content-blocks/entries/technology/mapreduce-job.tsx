'use client';

import { useMemo, useState } from 'react';
import {
  Boxes,
  Clock3,
  Database,
  Gauge,
  Network,
  Server,
  ShieldCheck,
  TriangleAlert,
  Workflow,
} from 'lucide-react';

import {
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/mapreduce-job';

export default function MapReduceJob() {
  const [inputGiB, setInputGiB] = useState(2_000);
  const [splitMiB, setSplitMiB] = useState(256);
  const [mapSlots, setMapSlots] = useState(240);
  const [reducers, setReducers] = useState(80);
  const [shufflePct, setShufflePct] = useState(25);
  const [combinerReductionPct, setCombinerReductionPct] = useState(60);
  const [rackBandwidthGbps, setRackBandwidthGbps] = useState(40);

  const result = useMemo(() => {
    const mapperTasks = Math.ceil(inputGiB * 1024 / splitMiB);
    const mapWaves = Math.ceil(mapperTasks / mapSlots);
    const mapMinutes = mapWaves * 3.2;
    const rawShuffleGiB = inputGiB * shufflePct / 100;
    const shuffleGiB = rawShuffleGiB * (1 - combinerReductionPct / 100);
    const shuffleMinutes = shuffleGiB * 8 / rackBandwidthGbps / 60 * 1.25;
    const reduceGiB = shuffleGiB / reducers;
    const reduceMinutes = reduceGiB / 1.8 + 2;
    const totalMinutes = mapMinutes + shuffleMinutes + reduceMinutes;
    const reducerTooSmall = reduceGiB < 0.5;
    const mapperTooSmall = splitMiB < 128;
    const networkPressure = shuffleMinutes > mapMinutes * 0.7;
    const stressed = mapperTooSmall || reducerTooSmall || networkPressure;
    return {
      mapMinutes,
      mapperTasks,
      mapWaves,
      networkPressure,
      rawShuffleGiB,
      reduceGiB,
      reduceMinutes,
      reducerTooSmall,
      shuffleGiB,
      shuffleMinutes,
      stressed,
      totalMinutes,
    };
  }, [combinerReductionPct, inputGiB, mapSlots, rackBandwidthGbps, reducers, shufflePct, splitMiB]);

  const reset = () => {
    setInputGiB(2_000);
    setSplitMiB(256);
    setMapSlots(240);
    setReducers(80);
    setShufflePct(25);
    setCombinerReductionPct(60);
    setRackBandwidthGbps(40);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader eyebrow="MapReduce execution lab" title="Size task waves and shuffle pressure" description="Change the input layout, cluster slots, reducer count, intermediate-data ratio, combiner effect, and rack bandwidth. Inspect each phase instead of collapsing the job into one opaque duration." icon={Workflow} accent="blue" onReset={reset} />
        <LearningLabBody controls={<div className="space-y-7"><LabRange label="Input data" value={inputGiB} output={`${inputGiB.toLocaleString()} GiB`} min={100} max={10_000} step={100} accent="blue" lowLabel="Small batch" highLabel="Large scan" onChange={setInputGiB} /><LabRange label="Input split" value={splitMiB} output={`${splitMiB} MiB`} min={64} max={512} step={64} accent="violet" lowLabel="Many short tasks" highLabel="Fewer long tasks" onChange={setSplitMiB} /><LabRange label="Concurrent map slots" value={mapSlots} output={mapSlots.toLocaleString()} min={40} max={800} step={20} accent="cyan" lowLabel="More waves" highLabel="More parallelism" onChange={setMapSlots} /><LabRange label="Reducers" value={reducers} output={reducers.toLocaleString()} min={10} max={300} step={10} accent="emerald" lowLabel="Large partitions" highLabel="Scheduling overhead" onChange={setReducers} /><LabRange label="Mapper output" value={shufflePct} output={`${shufflePct}% of input`} min={5} max={100} step={5} accent="amber" lowLabel="Selective map" highLabel="Wide expansion" onChange={setShufflePct} /><LabRange label="Combiner reduction" value={combinerReductionPct} output={`${combinerReductionPct}%`} min={0} max={90} step={5} accent="emerald" lowLabel="No local aggregation" highLabel="Less shuffle" onChange={setCombinerReductionPct} /><LabRange label="Safe rack bandwidth" value={rackBandwidthGbps} output={`${rackBandwidthGbps} Gbps`} min={5} max={160} step={5} accent="cyan" lowLabel="Network bound" highLabel="More shuffle headroom" onChange={setRackBandwidthGbps} /></div>}>
          <div className="space-y-6">
            <div className={`rounded-md border p-5 ${result.stressed ? warningClass : healthyClass}`}><div className="flex items-start gap-3">{result.stressed ? <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}<div><p className="text-xs font-semibold uppercase opacity-75">Execution verdict</p><h4 className="mt-1 text-xl font-semibold">{result.stressed ? 'One phase carries avoidable scheduling or network pressure' : 'The illustrative job keeps phase work balanced'}</h4><p className="mt-2 text-sm leading-6 opacity-80">{result.networkPressure ? 'Shuffle transfer dominates the map phase. Reduce mapper output, use a mathematically safe combiner, compress intermediates, or add bounded network capacity.' : result.reducerTooSmall ? 'Reducers receive tiny partitions, so startup and file overhead may exceed useful work.' : 'Map waves, shuffle transfer, and reducer partitions remain visible and independently tunable.'}</p></div></div></div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><LabMetric label="Mapper tasks" value={result.mapperTasks.toLocaleString()} detail={`${result.mapWaves} waves across ${mapSlots} slots`} icon={Boxes} tone="blue" /><LabMetric label="Shuffle traffic" value={`${result.shuffleGiB.toFixed(0)} GiB`} detail={`${result.rawShuffleGiB.toFixed(0)} GiB before local combine`} icon={Network} tone={result.networkPressure ? 'rose' : 'cyan'} /><LabMetric label="Per reducer" value={`${result.reduceGiB.toFixed(2)} GiB`} detail={`${reducers} output partitions`} icon={Database} tone={result.reducerTooSmall ? 'amber' : 'emerald'} /><LabMetric label="Modeled duration" value={`${result.totalMinutes.toFixed(1)} min`} detail="Sequential phase envelope" icon={Clock3} tone="violet" /></div>
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60"><p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Phase envelope</p><div className="mt-4 grid gap-3 md:grid-cols-3"><PhaseCard icon={Server} label="Map" value={`${result.mapMinutes.toFixed(1)} min`} detail={`${result.mapperTasks.toLocaleString()} tasks in ${result.mapWaves} waves`} /><PhaseCard icon={Network} label="Shuffle and sort" value={`${result.shuffleMinutes.toFixed(1)} min`} detail={`${result.shuffleGiB.toFixed(0)} GiB over bounded rack bandwidth`} /><PhaseCard icon={Gauge} label="Reduce" value={`${result.reduceMinutes.toFixed(1)} min`} detail={`${result.reduceGiB.toFixed(2)} GiB average per reducer`} /></div></div>
            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">This planning model excludes input skew, task startup distribution, spills, disk contention, failures, queueing, speculative duplicates, and output commit. Validate with framework counters and representative jobs.</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function PhaseCard({ icon: Icon, label, value, detail }: { icon: typeof Server; label: string; value: string; detail: string }) { return <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"><div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400"><Icon aria-hidden="true" className="h-4 w-4" />{label}</div><p className="mt-2 text-xl font-semibold text-neutral-950 dark:text-white">{value}</p><p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p></div>; }
const healthyClass = 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50';
const warningClass = 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50';
