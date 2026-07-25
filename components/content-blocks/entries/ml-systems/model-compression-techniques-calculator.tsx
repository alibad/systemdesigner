'use client';

import { useMemo, useState } from 'react';
import {
  Boxes,
  Cpu,
  Gauge,
  HardDrive,
  MemoryStick,
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

type Format = 'fp16' | 'int8' | 'int4';
const BLOCK_ID = 'ml-systems/model-compression-techniques-calculator';
const formats: Array<{ id: Format; label: string; detail: string; bits: number }> = [
  { id: 'fp16', label: 'FP16 or BF16 weights', detail: 'Broad accelerator support and a useful deployment baseline.', bits: 16 },
  { id: 'int8', label: 'INT8 weights', detail: 'Backend-specific integer kernels with calibration or dynamic activation handling.', bits: 8 },
  { id: 'int4', label: 'INT4 weight-only', detail: 'Strong weight compression that needs compatible packing, kernels, and accuracy evidence.', bits: 4 },
];

export default function ModelCompressionTechniquesCalculator() {
  const [formatId, setFormatId] = useState<Format>('int8');
  const [parametersBillions, setParametersBillions] = useState(7);
  const [structuredPruningPct, setStructuredPruningPct] = useState(0);
  const [runtimeOverheadGb, setRuntimeOverheadGb] = useState(4);
  const [batchMemoryGb, setBatchMemoryGb] = useState(8);
  const [deviceMemoryGb, setDeviceMemoryGb] = useState(24);
  const [baselineLatencyMs, setBaselineLatencyMs] = useState(80);
  const [measuredLatencyMs, setMeasuredLatencyMs] = useState(52);
  const [qualityDropPct, setQualityDropPct] = useState(0.7);
  const [kernelSupported, setKernelSupported] = useState(true);
  const format = formats.find((item) => item.id === formatId) ?? formats[0];

  const result = useMemo(() => {
    const retainedFraction = 1 - structuredPruningPct / 100;
    const weightGb = parametersBillions * 1_000_000_000 * retainedFraction * format.bits / 8 / 1024 ** 3;
    const totalMemoryGb = weightGb + runtimeOverheadGb + batchMemoryGb;
    const memoryPressure = totalMemoryGb / deviceMemoryGb * 100;
    const measuredSpeedup = baselineLatencyMs / measuredLatencyMs;
    const fits = memoryPressure <= 85;
    const qualityPass = qualityDropPct <= 1;
    const latencyPass = measuredSpeedup >= 1.15;
    const releaseReady = fits && qualityPass && latencyPass && kernelSupported;
    return { fits, latencyPass, measuredSpeedup, memoryPressure, qualityPass, releaseReady, totalMemoryGb, weightGb };
  }, [baselineLatencyMs, batchMemoryGb, deviceMemoryGb, format.bits, kernelSupported, measuredLatencyMs, parametersBillions, qualityDropPct, runtimeOverheadGb, structuredPruningPct]);

  const reset = () => {
    setFormatId('int8');
    setParametersBillions(7);
    setStructuredPruningPct(0);
    setRuntimeOverheadGb(4);
    setBatchMemoryGb(8);
    setDeviceMemoryGb(24);
    setBaselineLatencyMs(80);
    setMeasuredLatencyMs(52);
    setQualityDropPct(0.7);
    setKernelSupported(true);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Compression deployment lab"
          title="Make the exported artifact fit, then prove it is faster"
          description="Theoretical bits determine weight storage. Runtime memory, backend kernels, representative quality, and measured latency determine whether compression is useful in production."
          icon={Boxes}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Exported weight format</legend>
              <div className="mt-3 grid gap-2">
                {formats.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === format.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'fp16' ? Cpu : HardDrive}
                    accent={item.id === 'int4' ? 'violet' : 'blue'}
                    onClick={() => setFormatId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
            <LabRange label="Model parameters" value={parametersBillions} output={`${parametersBillions}B`} min={1} max={200} step={1} accent="blue" lowLabel="Compact" highLabel="Large model" onChange={setParametersBillions} />
            <LabRange label="Structured weights removed" value={structuredPruningPct} output={`${structuredPruningPct}%`} min={0} max={70} step={5} accent="cyan" lowLabel="Dense" highLabel="Smaller topology" onChange={setStructuredPruningPct} />
            <LabRange label="Runtime overhead" value={runtimeOverheadGb} output={`${runtimeOverheadGb}GB`} min={1} max={32} step={1} accent="amber" lowLabel="Small workspace" highLabel="Large workspace" onChange={setRuntimeOverheadGb} />
            <LabRange label="Batch and cache memory" value={batchMemoryGb} output={`${batchMemoryGb}GB`} min={1} max={80} step={1} accent="emerald" lowLabel="Small batch" highLabel="Large working set" onChange={setBatchMemoryGb} />
            <LabRange label="Device memory" value={deviceMemoryGb} output={`${deviceMemoryGb}GB`} min={8} max={192} step={8} accent="rose" lowLabel="Edge device" highLabel="Large accelerator" onChange={setDeviceMemoryGb} />
            <LabRange label="Baseline p99 latency" value={baselineLatencyMs} output={`${baselineLatencyMs}ms`} min={5} max={500} step={5} accent="blue" lowLabel="Fast baseline" highLabel="Slow baseline" onChange={setBaselineLatencyMs} />
            <LabRange label="Compressed p99 latency" value={measuredLatencyMs} output={`${measuredLatencyMs}ms`} min={5} max={500} step={5} accent="violet" lowLabel="Faster" highLabel="Regression" onChange={setMeasuredLatencyMs} />
            <LabRange label="Worst gated quality drop" value={qualityDropPct} output={`${qualityDropPct.toFixed(1)} points`} min={0} max={10} step={0.1} accent="amber" lowLabel="No loss" highLabel="Large regression" onChange={setQualityDropPct} />
            <LabChoice selected={kernelSupported} label="Target backend supports this format" detail="The exported operators, packing, device, and serving runtime use a measured optimized path." icon={Zap} accent="emerald" onClick={() => setKernelSupported((value) => !value)} />
          </div>
        )}>
          <div className="space-y-6">
            <div className={`rounded-md border p-5 ${result.releaseReady ? healthyClass : warningClass}`}>
              <div className="flex items-start gap-3">
                {result.releaseReady ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Deployment verdict</p>
                  <h4 className="mt-1 text-xl font-semibold">
                    {!result.fits ? 'The compressed artifact still exceeds the memory envelope' : !kernelSupported ? 'The backend cannot execute the chosen format efficiently' : !result.qualityPass ? 'A required quality slice exceeds the release threshold' : !result.latencyPass ? 'The smaller artifact has no meaningful measured speedup' : 'The candidate fits and clears the measured release gates'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {result.releaseReady ? 'Publish the exact artifact, backend, benchmark, calibration, and evaluation identities together; keep the baseline ready for rollback.' : 'Change the technique, target runtime, batch shape, or release threshold and re-measure the exported artifact on the actual device.'}
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Weight storage" value={`${result.weightGb.toFixed(1)}GB`} detail={`${format.bits}-bit exported weights`} icon={HardDrive} tone="violet" />
              <LabMetric label="Runtime memory" value={`${result.totalMemoryGb.toFixed(1)}GB`} detail={`${result.memoryPressure.toFixed(0)}% of device memory`} icon={MemoryStick} tone={result.fits ? 'blue' : 'rose'} />
              <LabMetric label="Measured speedup" value={`${result.measuredSpeedup.toFixed(2)}x`} detail="Baseline p99 / candidate p99" icon={Gauge} tone={result.latencyPass ? 'emerald' : 'rose'} />
              <LabMetric label="Worst quality drop" value={`${qualityDropPct.toFixed(1)} points`} detail="Across required evaluation slices" icon={ShieldCheck} tone={result.qualityPass ? 'cyan' : 'rose'} />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Stage title="Export" detail="Pin the compression recipe, calibration data, operator set, weight packing, backend, and artifact checksum." />
              <Stage title="Benchmark" detail="Measure cold and warm latency, throughput, memory, power, and quality at representative batch and sequence shapes." />
              <Stage title="Gate" detail="Compare required slices to the uncompressed baseline, canary the exact runtime artifact, and retain rapid rollback." />
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
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
