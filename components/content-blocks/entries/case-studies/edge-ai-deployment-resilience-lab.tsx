'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowDown,
  Check,
  CircleAlert,
  CloudOff,
  Download,
  HardDriveDownload,
  History,
  Pause,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  Wifi,
  WifiOff,
  X,
  type LucideIcon,
} from 'lucide-react';

type RolloutId = 'staged' | 'immediate';
type FailureId = 'none' | 'signature' | 'interrupted' | 'regression';

const failures: Array<{
  id: FailureId;
  label: string;
  detail: string;
  icon: LucideIcon;
}> = [
  { id: 'none', label: 'Healthy package', detail: 'Signed, compatible, and within quality bounds', icon: Check },
  { id: 'signature', label: 'Invalid signature', detail: 'Package authenticity cannot be verified', icon: ShieldCheck },
  { id: 'interrupted', label: 'Download interrupted', detail: 'Connectivity drops before the new image is complete', icon: Download },
  { id: 'regression', label: 'Accuracy regression', detail: 'The model activates but fails the canary quality guardrail', icon: Activity },
];

function compactDevices(value: number) {
  if (value >= 1_000_000) return `${formatTrimmed(value / 1_000_000)}M`;
  if (value >= 1_000) return `${formatTrimmed(value / 1_000)}K`;
  return value.toLocaleString();
}

function formatTrimmed(value: number) {
  return value.toFixed(value % 1 === 0 ? 0 : 1);
}

function Stage({
  icon: Icon,
  label,
  detail,
  status,
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
  status: 'complete' | 'active' | 'blocked' | 'pending';
}) {
  const style = {
    complete: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-50',
    active: 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-50',
    blocked: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-50',
    pending: 'border-neutral-200 bg-white text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200',
  }[status];
  const statusLabel = {
    complete: 'Complete',
    active: 'Waiting',
    blocked: 'Stopped',
    pending: 'Pending',
  }[status];

  return (
    <div className={`min-w-0 flex-1 rounded-md border p-3 ${style}`}>
      <div className="flex items-center justify-between gap-2">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="text-[10px] font-bold uppercase opacity-70">{statusLabel}</span>
      </div>
      <p className="mt-3 text-sm font-bold">{label}</p>
      <p className="mt-1 text-xs leading-5 opacity-70">{detail}</p>
    </div>
  );
}

export default function EdgeAiDeploymentResilienceLab() {
  const [rollout, setRollout] = useState<RolloutId>('staged');
  const [outageDays, setOutageDays] = useState(3);
  const [keepRollback, setKeepRollback] = useState(true);
  const [failure, setFailure] = useState<FailureId>('none');

  const result = useMemo(() => {
    const connected = outageDays === 0;
    const cohort = rollout === 'staged' ? 100_000 : 10_000_000;
    const transfer = 0.8;
    const updateState = connected ? 'Delivery can begin now' : `Queued for ${outageDays} offline day${outageDays === 1 ? '' : 's'}`;

    let activeModel = 'v42 current';
    let fleetExposed = 0;
    let inferenceAvailable = true;
    let releaseState = connected ? 'Ready to activate' : 'Serving locally while offline';
    let explanation = connected
      ? 'The signed delta can move through verification and activation.'
      : 'The device keeps serving with its last-known-good model. The update waits without blocking inference.';

    if (connected) {
      if (failure === 'none') {
        activeModel = 'v43 candidate';
        releaseState = rollout === 'staged' ? 'Canary healthy' : 'Fleet updated';
        explanation = rollout === 'staged'
          ? 'The first 1% cohort is healthy. Promotion can continue only while latency, crash, and quality guardrails hold.'
          : 'The candidate reached the whole fleet at once. Success is fast, but there was no small cohort to reveal a hidden defect.';
      }

      if (failure === 'signature') {
        activeModel = 'v42 current';
        releaseState = 'Package rejected';
        explanation = 'Verification stops the package before activation. The trusted current model continues to serve.';
      }

      if (failure === 'interrupted') {
        fleetExposed = keepRollback ? 0 : cohort;
        inferenceAvailable = keepRollback;
        activeModel = keepRollback ? 'v42 current' : 'No complete model';
        releaseState = keepRollback ? 'Download discarded' : 'Runtime unavailable';
        explanation = keepRollback
          ? 'The incomplete candidate is discarded and the current slot remains bootable.'
          : 'Replacing the only model slot in place leaves the device without a complete artifact after the connection drops.';
      }

      if (failure === 'regression') {
        fleetExposed = cohort;
        activeModel = keepRollback ? 'v42 rolled back' : 'v43 regressed';
        inferenceAvailable = true;
        releaseState = rollout === 'staged' ? (keepRollback ? 'Canary rolled back' : 'Canary degraded') : keepRollback ? 'Fleet rollback required' : 'Fleet degraded';
        explanation = rollout === 'staged'
          ? keepRollback
            ? 'The quality guardrail stops promotion after the 1% cohort and restores the previous model.'
            : 'The canary limits exposure, but affected devices cannot restore quality without a retained model.'
          : keepRollback
            ? 'Every connected device sees the regression before rollback begins. The old slot enables recovery but does not erase the blast radius.'
            : 'The regression reaches the fleet and there is no local artifact to restore.';
      }
    }

    const protectedRollout = rollout === 'staged' && keepRollback;
    const safe = inferenceAvailable && fleetExposed <= 100_000;

    let stages: Array<'complete' | 'active' | 'blocked' | 'pending'>;
    if (!connected) {
      stages = ['complete', 'active', 'pending', 'pending'];
    } else if (failure === 'signature') {
      stages = ['complete', 'complete', 'blocked', 'pending'];
    } else if (failure === 'interrupted') {
      stages = ['complete', 'blocked', 'pending', 'pending'];
    } else if (failure === 'regression') {
      stages = ['complete', 'complete', 'complete', 'blocked'];
    } else {
      stages = ['complete', 'complete', 'complete', 'complete'];
    }

    return {
      connected,
      transfer,
      updateState,
      activeModel,
      fleetExposed,
      inferenceAvailable,
      releaseState,
      explanation,
      protectedRollout,
      safe,
      stages,
    };
  }, [failure, keepRollback, outageDays, rollout]);

  return (
    <section className="not-prose my-8 overflow-hidden rounded-lg border border-neutral-200 bg-white text-neutral-950 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-white">
      <header className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 text-white md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-emerald-400/15 text-emerald-300">
              <RefreshCcw aria-hidden="true" className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase text-emerald-300">Offline and rollout resilience lab</p>
              <h3 className="mt-1 text-xl font-bold md:text-2xl">Keep inference alive while the model changes</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-300">
                Change connectivity and rollout safeguards, then inject an update failure. Observe which artifact remains active and how much of the fleet is exposed.
              </p>
            </div>
          </div>
          <div className={`shrink-0 rounded-md border px-3 py-2 text-sm font-bold ${result.inferenceAvailable ? 'border-emerald-500/50 bg-emerald-400/10 text-emerald-200' : 'border-rose-500/50 bg-rose-400/10 text-rose-200'}`}>
            {result.inferenceAvailable ? 'Inference available' : 'Inference unavailable'}
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-[350px_minmax(0,1fr)]">
        <div className="border-b border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/45 lg:border-b-0 lg:border-r md:p-6">
          <fieldset>
            <legend className="text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">Rollout strategy</legend>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {([
                { id: 'staged' as const, label: '1% canary', detail: '100K first' },
                { id: 'immediate' as const, label: 'Fleet-wide', detail: '10M at once' },
              ]).map((item) => {
                const selected = rollout === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setRollout(item.id)}
                    className={`rounded-md border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                      selected
                        ? 'border-blue-600 bg-blue-50 text-blue-950 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-50'
                        : 'border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:border-neutral-600'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">{item.label}</span>
                      {selected ? <Check aria-hidden="true" className="h-4 w-4" /> : null}
                    </span>
                    <span className="mt-1 block text-xs opacity-70">{item.detail}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <label htmlFor="edge-outage-days" className="text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">Connectivity outage</label>
                <p className="mt-2 text-2xl font-bold tabular-nums">{outageDays === 0 ? 'Online' : `${outageDays} day${outageDays === 1 ? '' : 's'}`}</p>
              </div>
              {outageDays === 0 ? <Wifi aria-hidden="true" className="h-6 w-6 text-emerald-600 dark:text-emerald-300" /> : <WifiOff aria-hidden="true" className="h-6 w-6 text-amber-600 dark:text-amber-300" />}
            </div>
            <input
              id="edge-outage-days"
              type="range"
              min="0"
              max="14"
              step="1"
              value={outageDays}
              onChange={(event) => setOutageDays(Number(event.target.value))}
              className="mt-4 h-2 w-full cursor-pointer accent-amber-500"
            />
            <div className="mt-2 flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
              <span>Connected</span>
              <span>14 days offline</span>
            </div>
          </div>

          <div className="mt-6 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold">Retain rollback slot</p>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Keep v42 until v43 passes activation checks.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={keepRollback}
                onClick={() => setKeepRollback((value) => !value)}
                className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 ${
                  keepRollback
                    ? 'border-violet-600 bg-violet-600 dark:border-violet-400 dark:bg-violet-500'
                    : 'border-neutral-300 bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800'
                }`}
              >
                <span className={`absolute left-0 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${keepRollback ? 'translate-x-5' : 'translate-x-0.5'}`} />
                <span className="sr-only">{keepRollback ? 'Disable rollback slot' : 'Enable rollback slot'}</span>
              </button>
            </div>
          </div>

          <fieldset className="mt-6">
            <legend className="text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">Inject an update condition</legend>
            <div className="mt-3 space-y-2">
              {failures.map((item) => {
                const Icon = item.icon;
                const selected = failure === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setFailure(item.id)}
                    className={`flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 ${
                      selected
                        ? item.id === 'none'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950 dark:text-emerald-50'
                          : 'border-rose-500 bg-rose-50 text-rose-950 dark:border-rose-500 dark:bg-rose-950 dark:text-rose-50'
                        : 'border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:border-neutral-600'
                    }`}
                  >
                    <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-bold">
                        {item.label}
                        {selected ? <span className="text-[10px] uppercase opacity-70">Selected</span> : null}
                      </span>
                      <span className="mt-1 block text-xs leading-5 opacity-70">{item.detail}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div className="min-w-0 p-5 md:p-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'Active artifact', value: result.activeModel, icon: Smartphone, tone: 'text-blue-600 dark:text-blue-300' },
              { label: 'Fleet exposed', value: compactDevices(result.fleetExposed), icon: TriangleAlert, tone: result.fleetExposed > 100_000 ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300' },
              { label: 'Delta transfer', value: `${result.transfer}MB`, icon: HardDriveDownload, tone: 'text-violet-600 dark:text-violet-300' },
              { label: 'Update state', value: result.connected ? 'Connected' : 'Deferred', icon: result.connected ? Wifi : CloudOff, tone: result.connected ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300' },
            ].map((metric) => (
              <div key={metric.label} className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60 md:p-4">
                <metric.icon aria-hidden="true" className={`h-5 w-5 ${metric.tone}`} />
                <p className="mt-3 break-words text-base font-bold tabular-nums md:text-lg">{metric.value}</p>
                <p className="mt-1 text-xs leading-4 text-neutral-500 dark:text-neutral-400">{metric.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/45">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">Atomic update path</p>
                <p className="mt-1 text-sm font-semibold">{result.updateState}</p>
              </div>
              <span className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-bold ${result.connected ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'}`}>
                {result.connected ? <Wifi aria-hidden="true" className="h-4 w-4" /> : <Pause aria-hidden="true" className="h-4 w-4" />}
                {result.connected ? 'Online' : 'Held safely'}
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <Stage icon={ShieldCheck} label="Sign" detail="Publisher identity" status={result.stages[0]} />
              <ArrowDown aria-hidden="true" className="mx-auto h-5 w-5 shrink-0 text-neutral-400 sm:rotate-[-90deg] sm:self-center" />
              <Stage icon={Download} label="Download" detail="Delta into inactive slot" status={result.stages[1]} />
              <ArrowDown aria-hidden="true" className="mx-auto h-5 w-5 shrink-0 text-neutral-400 sm:rotate-[-90deg] sm:self-center" />
              <Stage icon={ShieldCheck} label="Verify" detail="Hash and compatibility" status={result.stages[2]} />
              <ArrowDown aria-hidden="true" className="mx-auto h-5 w-5 shrink-0 text-neutral-400 sm:rotate-[-90deg] sm:self-center" />
              <Stage icon={Activity} label="Activate" detail="Canary health gates" status={result.stages[3]} />
            </div>
          </div>

          <div className={`mt-5 rounded-lg border p-5 ${result.safe ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/70' : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/70'}`}>
            <div className="flex items-start gap-4">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${result.safe ? 'bg-emerald-200 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : 'bg-rose-200 text-rose-800 dark:bg-rose-900 dark:text-rose-200'}`}>
                {result.safe ? <Check aria-hidden="true" className="h-5 w-5" /> : <CircleAlert aria-hidden="true" className="h-5 w-5" />}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-bold text-neutral-950 dark:text-white">{result.releaseState}</p>
                  <span className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${result.protectedRollout ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100' : 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100'}`}>
                    {result.protectedRollout ? 'Blast radius bounded' : 'Safeguard gap'}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{result.explanation}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center gap-2 text-sm font-bold">
                <History aria-hidden="true" className="h-4 w-4 text-violet-600 dark:text-violet-300" />
                Last-known-good invariant
              </div>
              <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Download and verify into an inactive slot. Replace the active pointer only after the new artifact is complete and compatible.
              </p>
            </div>
            <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center gap-2 text-sm font-bold">
                {result.inferenceAvailable ? <Check aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-300" /> : <X aria-hidden="true" className="h-4 w-4 text-rose-600 dark:text-rose-300" />}
                User-visible promise
              </div>
              <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                {result.inferenceAvailable
                  ? 'The critical inference path remains usable even while connectivity or the release pipeline is unhealthy.'
                  : 'The update mechanism has broken the offline product promise by removing the only complete local model.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
