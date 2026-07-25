'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Database,
  Gauge,
  RotateCcw,
  ShieldCheck,
  TestTube2,
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

interface Scenario {
  id: string;
  label: string;
  detail: string;
  overallDrop: number;
  sliceDrop: number;
  latencyGainPct: number;
  calibrationSensitive: boolean;
}
interface ReleaseData {
  title: string;
  description: string;
  defaults: { scenarioId: string; canaryPct: number };
  scenarios: Scenario[];
}
const BLOCK_ID = 'ml-systems/model-compression-release-lab';

function valid(value: unknown): value is ReleaseData {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ReleaseData>;
  return Boolean(item.title && item.description && item.defaults && Array.isArray(item.scenarios) && item.scenarios.length);
}

export default function ModelCompressionReleaseLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ReleaseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!dataFile) { setError('No compression scenarios were supplied.'); return; }
    const controller = new AbortController();
    fetch(dataFile, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error(`Request failed with status ${response.status}`); return response.json() as Promise<unknown>; })
      .then((payload) => { if (!valid(payload)) throw new Error('Compression scenario data is incomplete.'); setData(payload); })
      .catch((cause: unknown) => { if (cause instanceof DOMException && cause.name === 'AbortError') return; setError(cause instanceof Error ? cause.message : 'Unable to load compression scenarios.'); });
    return () => controller.abort();
  }, [dataFile]);
  if (error) return <State title="Release lab unavailable" detail={error} />;
  if (!data) return <State title="Loading release lab" detail="Preparing compression failures..." />;
  return <ReleaseLab data={data} />;
}

function ReleaseLab({ data }: { data: ReleaseData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [canaryPct, setCanaryPct] = useState(data.defaults.canaryPct);
  const [representativeCalibration, setRepresentativeCalibration] = useState(true);
  const [sliceGate, setSliceGate] = useState(true);
  const [runtimeBenchmark, setRuntimeBenchmark] = useState(true);
  const [rollback, setRollback] = useState(true);
  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const result = useMemo(() => {
    const calibrationPenalty = scenario.calibrationSensitive && !representativeCalibration ? 2.5 : 0;
    const effectiveSliceDrop = scenario.sliceDrop + calibrationPenalty;
    const qualityDetected = sliceGate ? effectiveSliceDrop > 1 : scenario.overallDrop > 1;
    const latencyDetected = runtimeBenchmark && scenario.latencyGainPct < 10;
    const detected = qualityDetected || latencyDetected;
    const contained = detected && rollback && canaryPct <= 10;
    const release = !detected && effectiveSliceDrop <= 1 && scenario.latencyGainPct >= 10;
    return { contained, detected, effectiveSliceDrop, latencyDetected, qualityDetected, release };
  }, [canaryPct, representativeCalibration, rollback, runtimeBenchmark, scenario, sliceGate]);
  const reset = () => { setScenarioId(data.defaults.scenarioId); setCanaryPct(data.defaults.canaryPct); setRepresentativeCalibration(true); setSliceGate(true); setRuntimeBenchmark(true); setRollback(true); };
  const safe = result.release || result.contained;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader eyebrow="Compression release drill" title={data.title} description={data.description} icon={TestTube2} accent="amber" onReset={reset} />
        <LearningLabBody controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Candidate behavior</legend>
              <div className="mt-3 grid gap-2">
                {data.scenarios.map((item) => <LabChoice key={item.id} selected={item.id === scenario.id} label={item.label} detail={item.detail} icon={TriangleAlert} accent="rose" onClick={() => setScenarioId(item.id)} />)}
              </div>
            </fieldset>
            <LabRange label="Canary traffic" value={canaryPct} output={`${canaryPct}%`} min={1} max={100} step={1} accent="amber" lowLabel="Small exposure" highLabel="Full rollout" onChange={setCanaryPct} />
            <LabChoice selected={representativeCalibration} label="Representative calibration set" detail="Calibration covers production ranges, sequence shapes, languages, modalities, and edge cases." icon={Database} accent="blue" onClick={() => setRepresentativeCalibration((value) => !value)} />
            <LabChoice selected={sliceGate} label="Gate required quality slices" detail="Release compares the worst critical slice, not only an aggregate metric." icon={ShieldCheck} accent="emerald" onClick={() => setSliceGate((value) => !value)} />
            <LabChoice selected={runtimeBenchmark} label="Benchmark the exported runtime" detail="Latency and memory are measured after lowering on the target device and backend." icon={Gauge} accent="violet" onClick={() => setRuntimeBenchmark((value) => !value)} />
            <LabChoice selected={rollback} label="Retain uncompressed rollback" detail="The previous artifact and runtime configuration remain ready for immediate reversal." icon={RotateCcw} accent="amber" onClick={() => setRollback((value) => !value)} />
          </div>
        )}>
          <div className="space-y-6">
            <div className={`rounded-md border p-5 ${safe ? healthyClass : warningClass}`}>
              <p className="text-xs font-semibold uppercase opacity-75">Release outcome</p>
              <h4 className="mt-1 text-xl font-semibold">
                {result.contained ? 'The canary detects the regression and rolls back' : result.release ? 'The compressed candidate clears every release gate' : result.detected ? 'The regression is detected after unsafe exposure' : 'A hidden regression passes the selected evidence'}
              </h4>
              <p className="mt-2 text-sm leading-6 opacity-80">
                {safe ? 'Preserve the candidate and baseline evidence under immutable artifact and runtime identities.' : 'Restore representative calibration, slice-level quality gates, target-runtime benchmarks, bounded canary exposure, and rollback.'}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Worst slice drop" value={`${result.effectiveSliceDrop.toFixed(1)} points`} detail={result.qualityDetected ? 'Quality gate detects it' : 'Not detected by selected gate'} icon={ShieldCheck} tone={result.effectiveSliceDrop <= 1 ? 'emerald' : 'rose'} />
              <LabMetric label="Measured latency gain" value={`${scenario.latencyGainPct}%`} detail={result.latencyDetected ? 'Below release threshold' : 'Meets selected threshold'} icon={Gauge} tone={scenario.latencyGainPct >= 10 ? 'cyan' : 'rose'} />
              <LabMetric label="Canary exposure" value={`${canaryPct}%`} detail="Traffic before promotion decision" icon={Activity} tone={canaryPct <= 10 ? 'blue' : 'amber'} />
              <LabMetric label="Recovery" value={result.contained ? 'Rollback' : rollback ? 'Ready' : 'Missing'} detail="Uncompressed baseline artifact" icon={RotateCcw} tone={rollback ? 'violet' : 'rose'} />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Stage title="Compare" detail="Use identical inputs and traffic shapes against the uncompressed artifact under the same serving contract." />
              <Stage title="Slice" detail="Inspect required cohorts and tasks; aggregate retention can hide concentrated harm from compression error." />
              <Stage title="Operate" detail="Canary memory, latency, errors, quality proxies, power, and cost before expanding traffic or removing rollback." />
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function Stage({ title, detail }: { title: string; detail: string }) { return <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60"><p className="text-sm font-semibold text-neutral-950 dark:text-white">{title}</p><p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p></div>; }
function State({ title, detail }: { title: string; detail: string }) { return <div data-content-block={BLOCK_ID}><LearningLab><LearningLabBody><div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900"><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-sm text-neutral-500">{detail}</p></div></LearningLabBody></LearningLab></div>; }
const healthyClass = 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50';
const warningClass = 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50';
