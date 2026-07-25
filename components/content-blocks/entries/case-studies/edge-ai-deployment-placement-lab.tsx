'use client';

import { useMemo, useState } from 'react';
import {
  BatteryCharging,
  Camera,
  Check,
  ChevronRight,
  CircleAlert,
  Cloud,
  Cpu,
  Gauge,
  HardDrive,
  LockKeyhole,
  MemoryStick,
  Router,
  ShieldCheck,
  Smartphone,
  WifiOff,
  Zap,
  type LucideIcon,
} from 'lucide-react';

type DeviceId = 'flagship' | 'midrange' | 'camera';
type ModelId = 'tiny' | 'balanced' | 'quality';
type PlacementId = 'device' | 'gateway' | 'cloud';

type Device = {
  id: DeviceId;
  label: string;
  detail: string;
  memoryBudget: number;
  tops: number;
  icon: LucideIcon;
};

type Model = {
  id: ModelId;
  label: string;
  detail: string;
  size: number;
  work: number;
  accuracy: number;
};

const devices: Device[] = [
  {
    id: 'flagship',
    label: 'Flagship phone',
    detail: 'Dedicated NPU, generous thermal envelope',
    memoryBudget: 220,
    tops: 15,
    icon: Smartphone,
  },
  {
    id: 'midrange',
    label: 'Mid-range phone',
    detail: 'Shared accelerator, tighter memory pressure',
    memoryBudget: 140,
    tops: 4,
    icon: Smartphone,
  },
  {
    id: 'camera',
    label: 'IoT camera',
    detail: 'Small RAM budget, low-power inference',
    memoryBudget: 48,
    tops: 1.2,
    icon: Camera,
  },
];

const models: Model[] = [
  {
    id: 'tiny',
    label: 'Tiny INT8',
    detail: 'Fastest fallback with reduced quality',
    size: 9,
    work: 1.2,
    accuracy: 89,
  },
  {
    id: 'balanced',
    label: 'Balanced INT8',
    detail: 'Primary mobile model for most devices',
    size: 34,
    work: 4.4,
    accuracy: 95,
  },
  {
    id: 'quality',
    label: 'Quality FP16',
    detail: 'Highest quality, largest resource demand',
    size: 118,
    work: 12,
    accuracy: 98,
  },
];

const placements: Array<{
  id: PlacementId;
  label: string;
  detail: string;
  icon: LucideIcon;
}> = [
  { id: 'device', label: 'On device', detail: 'Private and offline', icon: Smartphone },
  { id: 'gateway', label: 'Edge gateway', detail: 'Nearby shared compute', icon: Router },
  { id: 'cloud', label: 'Cloud region', detail: 'Maximum compute', icon: Cloud },
];

function formatNumber(value: number, digits = 0) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function ConstraintRow({
  icon: Icon,
  label,
  value,
  target,
  pass,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  target: string;
  pass: boolean;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-neutral-200 py-3 last:border-b-0 dark:border-neutral-800">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-md ${
          pass
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
            : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
        }`}
      >
        <Icon aria-hidden="true" className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">Target: {target}</p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-bold tabular-nums ${pass ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
          {value}
        </p>
        <p className="mt-0.5 text-[10px] font-bold uppercase text-neutral-500 dark:text-neutral-400">
          {pass ? 'Within budget' : 'Budget missed'}
        </p>
      </div>
    </div>
  );
}

export default function EdgeAiDeploymentPlacementLab() {
  const [deviceId, setDeviceId] = useState<DeviceId>('midrange');
  const [modelId, setModelId] = useState<ModelId>('balanced');
  const [placement, setPlacement] = useState<PlacementId>('device');

  const device = devices.find((item) => item.id === deviceId) ?? devices[0];
  const model = models.find((item) => item.id === modelId) ?? models[0];

  const result = useMemo(() => {
    const memory = placement === 'device' ? Math.round(model.size * 3.2 + 18) : placement === 'gateway' ? 24 : 16;
    const latency = Math.round(
      placement === 'device'
        ? 7 + (model.work / device.tops) * 34
        : placement === 'gateway'
          ? 27 + model.work * 2.6
          : 78 + model.work * 1.1,
    );
    const battery =
      placement === 'device'
        ? 0.7 + (model.work / device.tops) * 3.8
        : placement === 'gateway'
          ? 1.1
          : 0.8;
    const memoryFits = memory <= device.memoryBudget;
    const latencyFits = latency <= 50;
    const batteryFits = battery < 5;
    const offline = placement === 'device';
    const privateInput = placement === 'device';
    const hardPasses = [memoryFits, latencyFits, batteryFits, offline].filter(Boolean).length;

    let recommendation = 'This is a viable local configuration. Validate operator support on every hardware tier before rollout.';
    if (!memoryFits) {
      recommendation = 'The runtime cannot hold this model safely. Select a smaller model or move execution to a better-provisioned target.';
    } else if (!latencyFits) {
      recommendation = 'The response misses the interaction budget. Reduce model work or use a faster accelerator close to the user.';
    } else if (!batteryFits) {
      recommendation = 'Continuous use exceeds the power budget. Schedule inference, lower input resolution, or use the tiny model.';
    } else if (!offline) {
      recommendation = 'Compute fits, but the network is now part of the critical path. Keep a local fallback for offline availability.';
    } else if (model.id === 'tiny') {
      recommendation = 'The tiny model protects latency and power. Confirm that its lower task quality still satisfies the product decision.';
    }

    return {
      memory,
      latency,
      battery,
      memoryFits,
      latencyFits,
      batteryFits,
      offline,
      privateInput,
      hardPasses,
      recommendation,
    };
  }, [device, model, placement]);

  const ready = result.hardPasses === 4;

  return (
    <section className="not-prose my-8 overflow-hidden rounded-lg border border-neutral-200 bg-white text-neutral-950 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-white">
      <header className="border-b border-neutral-200 bg-neutral-950 px-5 py-5 text-white dark:border-neutral-800 md:px-6">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-cyan-400/15 text-cyan-300">
            <Cpu aria-hidden="true" className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase text-cyan-300">Hardware placement lab</p>
            <h3 className="mt-1 text-xl font-bold md:text-2xl">Fit the model to the device and decision path</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-300">
              Choose a hardware tier, model variant, and execution location. The same model can be excellent on one device and unusable on another.
            </p>
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <div className="min-w-0 border-b border-neutral-200 p-5 dark:border-neutral-800 lg:border-b-0 lg:border-r md:p-6">
          <fieldset>
            <legend className="text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">1. Choose the hardware tier</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {devices.map((item) => {
                const Icon = item.icon;
                const selected = item.id === deviceId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setDeviceId(item.id)}
                    className={`min-h-32 rounded-md border p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 ${
                      selected
                        ? 'border-cyan-600 bg-cyan-50 text-cyan-950 dark:border-cyan-400 dark:bg-cyan-950 dark:text-cyan-50'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-900 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-600'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <Icon aria-hidden="true" className={`h-5 w-5 ${selected ? 'text-cyan-700 dark:text-cyan-300' : 'text-neutral-500'}`} />
                      {selected ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase">
                          <Check aria-hidden="true" className="h-3.5 w-3.5" /> Selected
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-4 block text-sm font-bold">{item.label}</span>
                    <span className="mt-1 block text-xs leading-5 opacity-70">{item.detail}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="mt-6">
            <legend className="text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">2. Select a model variant</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {models.map((item) => {
                const selected = item.id === modelId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setModelId(item.id)}
                    className={`min-h-32 rounded-md border p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 ${
                      selected
                        ? 'border-violet-600 bg-violet-50 text-violet-950 dark:border-violet-400 dark:bg-violet-950 dark:text-violet-50'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-900 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-600'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <Zap aria-hidden="true" className={`h-5 w-5 ${selected ? 'text-violet-700 dark:text-violet-300' : 'text-neutral-500'}`} />
                      <span className="text-xs font-bold tabular-nums">{item.size}MB</span>
                    </span>
                    <span className="mt-4 block text-sm font-bold">{item.label}</span>
                    <span className="mt-1 block text-xs leading-5 opacity-70">{item.detail}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="mt-6">
            <legend className="text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">3. Place inference</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {placements.map((item) => {
                const Icon = item.icon;
                const selected = item.id === placement;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setPlacement(item.id)}
                    className={`rounded-md border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 ${
                      selected
                        ? 'border-amber-500 bg-amber-50 text-amber-950 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-50'
                        : 'border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:border-neutral-600'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon aria-hidden="true" className={`h-4 w-4 ${selected ? 'text-amber-700 dark:text-amber-300' : 'text-neutral-500'}`} />
                      <span className="text-sm font-bold">{item.label}</span>
                    </span>
                    <span className="mt-1 block pl-6 text-xs opacity-70">{item.detail}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <p className="text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">Selected decision path</p>
            <div className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-stretch">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-950">
                <Camera aria-hidden="true" className="h-5 w-5 shrink-0 text-cyan-600 dark:text-cyan-300" />
                <div className="min-w-0">
                  <p className="text-sm font-bold">Sensor input</p>
                  <p className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">Pixels stay local until routing</p>
                </div>
              </div>
              <ChevronRight aria-hidden="true" className="mx-auto h-5 w-5 rotate-90 self-center text-neutral-400 sm:rotate-0" />
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-md border border-amber-400 bg-amber-50 p-3 text-amber-950 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-50">
                {placement === 'device' ? <Smartphone aria-hidden="true" className="h-5 w-5 shrink-0" /> : placement === 'gateway' ? <Router aria-hidden="true" className="h-5 w-5 shrink-0" /> : <Cloud aria-hidden="true" className="h-5 w-5 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-bold">{placements.find((item) => item.id === placement)?.label}</p>
                  <p className="mt-0.5 truncate text-xs opacity-70">{model.label} executes here</p>
                </div>
              </div>
              <ChevronRight aria-hidden="true" className="mx-auto h-5 w-5 rotate-90 self-center text-neutral-400 sm:rotate-0" />
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-950">
                <ShieldCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                <div className="min-w-0">
                  <p className="text-sm font-bold">Product decision</p>
                  <p className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">{model.accuracy}% modeled quality</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="min-w-0 bg-neutral-50 p-5 dark:bg-neutral-900/35 md:p-6">
          <div className={`rounded-lg border p-5 ${ready ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/70' : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/70'}`}>
            <div className="flex items-start justify-between gap-4">
              <span className={`flex h-10 w-10 items-center justify-center rounded-md ${ready ? 'bg-emerald-200 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : 'bg-rose-200 text-rose-800 dark:bg-rose-900 dark:text-rose-200'}`}>
                {ready ? <Check aria-hidden="true" className="h-5 w-5" /> : <CircleAlert aria-hidden="true" className="h-5 w-5" />}
              </span>
              <span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase ${ready ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100' : 'bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-100'}`}>
                {result.hardPasses}/4 release constraints
              </span>
            </div>
            <p className="mt-4 text-xl font-bold text-neutral-950 dark:text-white">{ready ? 'Candidate is edge-ready' : 'Rework this placement'}</p>
            <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{result.recommendation}</p>
          </div>

          <div className="mt-5 rounded-lg border border-neutral-200 bg-white px-4 dark:border-neutral-800 dark:bg-neutral-950">
            <ConstraintRow icon={MemoryStick} label="Peak memory" value={`${result.memory}MB`} target={`<= ${device.memoryBudget}MB`} pass={result.memoryFits} />
            <ConstraintRow icon={Gauge} label="Interaction latency" value={`${result.latency}ms`} target="<= 50ms" pass={result.latencyFits} />
            <ConstraintRow icon={BatteryCharging} label="Battery drain" value={`${formatNumber(result.battery, 1)}%/hr`} target="< 5%/hr" pass={result.batteryFits} />
            <ConstraintRow icon={WifiOff} label="Offline inference" value={result.offline ? 'Available' : 'Unavailable'} target="Required" pass={result.offline} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <LockKeyhole aria-hidden="true" className={`h-5 w-5 ${result.privateInput ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300'}`} />
              <p className="mt-3 text-sm font-bold">Raw input</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{result.privateInput ? 'Stays on device' : 'Leaves the device'}</p>
            </div>
            <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <HardDrive aria-hidden="true" className="h-5 w-5 text-violet-600 dark:text-violet-300" />
              <p className="mt-3 text-sm font-bold">Model quality</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{model.accuracy}% of task benchmark</p>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-neutral-800 bg-neutral-950 p-4 text-white">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Cpu aria-hidden="true" className="h-4 w-4 text-cyan-300" />
              Placement invariant
            </div>
            <p className="mt-2 text-xs leading-5 text-neutral-400">
              A model is deployable only when its compiled runtime fits the actual hardware tier and the entire decision path meets latency, power, privacy, and offline requirements.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
