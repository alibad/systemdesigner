'use client';

import { useEffect, useMemo, useState } from 'react';
import { Clock3, Gauge, Glasses, MonitorUp, Network, TimerReset } from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

interface Placement {
  id: string;
  label: string;
  detail: string;
  sensorMs: number;
  trackingMs: number;
  composeMs: number;
  encodeMs: number;
  decodeMs: number;
  displayMs: number;
  defaultNetworkMs: number;
  networkFactor: number;
}

interface BudgetModel {
  title: string;
  description: string;
  defaults: { placementId: string; refreshHz: number; renderMs: number; networkMs: number };
  refreshRates: number[];
  placements: Placement[];
}

const BLOCK_ID = 'fundamentals/extended-reality-infrastructure-calculator';

export default function ExtendedRealityInfrastructureCalculator({ dataFile }: { dataFile?: string }) {
  const [model, setModel] = useState<BudgetModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [placementId, setPlacementId] = useState('');
  const [refreshHz, setRefreshHz] = useState(72);
  const [renderMs, setRenderMs] = useState(4);
  const [networkMs, setNetworkMs] = useState(6);

  useEffect(() => {
    let active = true;
    if (!dataFile) {
      setError('The XR budget model is not configured.');
      return () => { active = false; };
    }
    fetch(dataFile)
      .then((response) => {
        if (!response.ok) throw new Error(`XR budget model returned ${response.status}`);
        return response.json() as Promise<BudgetModel>;
      })
      .then((next) => {
        if (!active) return;
        setModel(next);
        setPlacementId(next.defaults.placementId);
        setRefreshHz(next.defaults.refreshHz);
        setRenderMs(next.defaults.renderMs);
        setNetworkMs(next.defaults.networkMs);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load the XR budget.');
      });
    return () => { active = false; };
  }, [dataFile]);

  const placement = model?.placements.find((item) => item.id === placementId) ?? model?.placements[0];
  const result = useMemo(() => {
    if (!placement) return null;
    const fixedMs = placement.sensorMs + placement.trackingMs + placement.composeMs + placement.encodeMs + placement.decodeMs + placement.displayMs;
    const effectiveNetworkMs = networkMs * placement.networkFactor;
    const totalMs = fixedMs + renderMs + effectiveNetworkMs;
    const frameBudgetMs = 1000 / refreshHz;
    return {
      fixedMs,
      effectiveNetworkMs,
      totalMs,
      frameBudgetMs,
      headroomMs: frameBudgetMs - totalMs,
      frames: totalMs / frameBudgetMs,
      withinTarget: totalMs <= frameBudgetMs,
    };
  }, [networkMs, placement, refreshHz, renderMs]);

  if (!model || !placement || !result) {
    return <div data-content-block={BLOCK_ID}><LearningLab><LearningLabHeader eyebrow="Frame budget lab" title="Trace an illustrative XR presentation budget" description={error ?? 'Loading lesson-owned pipeline timings.'} icon={Glasses} accent={error ? 'rose' : 'violet'} /></LearningLab></div>;
  }

  const reset = () => {
    setPlacementId(model.defaults.placementId);
    setRefreshHz(model.defaults.refreshHz);
    setRenderMs(model.defaults.renderMs);
    setNetworkMs(model.defaults.networkMs);
  };

  const choosePlacement = (item: Placement) => {
    setPlacementId(item.id);
    setNetworkMs(item.defaultNetworkMs);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader eyebrow="Frame budget lab" title={model.title} description={model.description} icon={Glasses} accent="violet" onReset={reset} />
        <LearningLabBody controls={<div className="space-y-7">
          <fieldset><legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Rendering placement</legend><div className="mt-3 space-y-2">{model.placements.map((item) => <LabChoice key={item.id} selected={item.id === placement.id} label={item.label} detail={item.detail} icon={MonitorUp} accent="violet" onClick={() => choosePlacement(item)} />)}</div></fieldset>
          <fieldset><legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Display refresh target</legend><div className="mt-3 grid grid-cols-3 gap-2">{model.refreshRates.map((rate) => <button key={rate} type="button" aria-pressed={rate === refreshHz} onClick={() => setRefreshHz(rate)} className={`rounded-md border px-2 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${rate === refreshHz ? 'border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/35 dark:text-cyan-50' : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'}`}>{rate} Hz</button>)}</div></fieldset>
          <LabRange label="Application render" value={renderMs} output={`${renderMs.toFixed(1)} ms`} min={2} max={20} step={0.5} lowLabel="2 ms" highLabel="20 ms" accent="blue" onChange={setRenderMs} />
          <LabRange label="Network round trip" value={networkMs} output={placement.networkFactor === 0 ? 'local path' : `${networkMs} ms`} min={2} max={60} step={2} lowLabel="2 ms" highLabel="60 ms" accent="amber" onChange={setNetworkMs} />
        </div>}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Frame interval" value={`${result.frameBudgetMs.toFixed(1)} ms`} detail={`${refreshHz} Hz target`} icon={Clock3} tone="cyan" />
            <LabMetric label="Pipeline total" value={`${result.totalMs.toFixed(1)} ms`} detail={`Fixture fixed path ${result.fixedMs.toFixed(1)} ms`} icon={TimerReset} tone={result.withinTarget ? 'emerald' : 'rose'} />
            <LabMetric label="Frame intervals" value={`${result.frames.toFixed(2)}x`} detail="Pipeline total / frame interval" icon={Gauge} tone={result.withinTarget ? 'emerald' : 'amber'} />
            <LabMetric label="Target margin" value={`${result.headroomMs >= 0 ? '+' : ''}${result.headroomMs.toFixed(1)} ms`} icon={Network} tone={result.headroomMs >= 0 ? 'blue' : 'rose'} />
          </div>

          <section className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
            <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">Timing trace</h4>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Timing label="Sense + track" value={placement.sensorMs + placement.trackingMs} />
              <Timing label="Network" value={result.effectiveNetworkMs} />
              <Timing label="Render + codec" value={renderMs + placement.encodeMs + placement.decodeMs} />
              <Timing label="Compose + display" value={placement.composeMs + placement.displayMs} />
            </div>
          </section>

          <div className={`mt-6 rounded-md border p-5 ${result.withinTarget ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50' : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'}`}>
            <p className="font-semibold">{result.withinTarget ? 'The fixture fits its selected one-frame target.' : 'The fixture exceeds its selected one-frame target.'}</p>
            <p className="mt-2 text-sm leading-6 opacity-80">This arithmetic is an engineering budget, not a universal comfort threshold. Measure predicted display timing, runtime reprojection, jitter, dropped frames, and device-specific behavior.</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function Timing({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"><p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p><p className="mt-2 text-lg font-semibold tabular-nums text-neutral-950 dark:text-white">{value.toFixed(1)} ms</p></div>;
}
