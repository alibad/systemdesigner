'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock3,
  FileArchive,
  Gauge,
  MoveHorizontal,
  Network,
  Package,
  Route,
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

type UnitOption = {
  id: string;
  label: string;
  bytes: number;
  detail: string;
};

type RepresentationOption = {
  id: string;
  label: string;
  bodyRatio: number;
  detail: string;
};

type PathOption = {
  id: string;
  label: string;
  bottleneckMbps: number;
  goodputMbps: number;
  rttMs: number;
  detail: string;
};

type ConnectionOption = {
  id: string;
  label: string;
  sequentialRtts: number;
  overheadPercent: number;
  detail: string;
};

type TransferBudgetModel = {
  defaults: {
    unitId: string;
    representationId: string;
    pathId: string;
    connectionId: string;
    budgetMs: number;
  };
  units: UnitOption[];
  representations: RepresentationOption[];
  paths: PathOption[];
  connections: ConnectionOption[];
  budgetRange: { min: number; max: number; step: number };
};

const block = 'reference/one-mb-transfer-transfer-budget-lab';
const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

function formatBytes(bytes: number) {
  if (bytes >= 1_000_000) return `${decimal.format(bytes / 1_000_000)} MB`;
  if (bytes >= 1_000) return `${decimal.format(bytes / 1_000)} KB`;
  return `${Math.round(bytes).toLocaleString()} B`;
}

function formatMs(milliseconds: number) {
  if (milliseconds >= 1_000) return `${decimal.format(milliseconds / 1_000)} s`;
  return `${decimal.format(milliseconds)} ms`;
}

function LabState({ label, error }: { label: string; error?: string }) {
  return (
    <div data-content-block={block}>
      <div
        className={`min-h-[640px] rounded-md border p-5 text-sm ${
          error
            ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
            : 'border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900'
        }`}
        aria-label={label}
        role={error ? 'alert' : undefined}
      >
        {error ? (
          <>
            <p className="font-semibold">Transfer budget unavailable</p>
            <p className="mt-2 opacity-80">{error}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function OneMbTransferTransferBudgetLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<TransferBudgetModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [unitId, setUnitId] = useState('mb');
  const [representationId, setRepresentationId] = useState('compressed-text');
  const [pathId, setPathId] = useState('regional');
  const [connectionId, setConnectionId] = useState('warm');
  const [budgetMs, setBudgetMs] = useState(250);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The transfer budget data file was not provided.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<TransferBudgetModel>;
      })
      .then((model) => {
        setData(model);
        setUnitId(model.defaults.unitId);
        setRepresentationId(model.defaults.representationId);
        setPathId(model.defaults.pathId);
        setConnectionId(model.defaults.connectionId);
        setBudgetMs(model.defaults.budgetMs);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the transfer budget.');
      });

    return () => controller.abort();
  }, [dataFile]);

  const model = useMemo(() => {
    if (!data) return null;
    const unit = data.units.find((item) => item.id === unitId) ?? data.units[0];
    const representation = data.representations.find((item) => item.id === representationId) ?? data.representations[0];
    const path = data.paths.find((item) => item.id === pathId) ?? data.paths[0];
    const connection = data.connections.find((item) => item.id === connectionId) ?? data.connections[0];
    if (!unit || !representation || !path || !connection) return null;

    const representationBytes = unit.bytes * representation.bodyRatio;
    const wireBytes = representationBytes * (1 + connection.overheadPercent / 100);
    const serializationMs = wireBytes * 8 / (path.goodputMbps * 1_000_000) * 1_000;
    const pathDelayMs = connection.sequentialRtts * path.rttMs;
    const completionMs = pathDelayMs + serializationMs;
    const bdpBytes = path.bottleneckMbps * 1_000_000 * (path.rttMs / 1_000) / 8;
    const remainingMs = budgetMs - completionMs;
    const scaleMs = Math.max(budgetMs, completionMs);
    const dominant = pathDelayMs >= serializationMs ? 'Sequential path delay' : 'Wire serialization';

    return {
      bdpBytes,
      completionMs,
      connection,
      dominant,
      path,
      pathDelayMs,
      remainingMs,
      representation,
      representationBytes,
      scaleMs,
      serializationMs,
      unit,
      wireBytes,
    };
  }, [budgetMs, connectionId, data, pathId, representationId, unitId]);

  if (loadError) return <LabState label="Transfer budget unavailable" error={loadError} />;
  if (!data) return <LabState label="Loading transfer budget" />;
  if (!model) return <LabState label="Transfer budget unavailable" error="The unit, representation, path, or connection options are incomplete." />;

  const withinBudget = model.remainingMs >= 0;
  const pathShare = model.pathDelayMs / model.scaleMs * 100;
  const serializationShare = model.serializationMs / model.scaleMs * 100;
  const remainingShare = withinBudget ? model.remainingMs / model.scaleMs * 100 : 0;
  const bdpRatio = model.wireBytes / Math.max(1, model.bdpBytes);
  const recommendation = withinBudget
    ? model.dominant === 'Sequential path delay'
      ? 'The model fits, but round trips are the larger term. Preserve connection reuse and avoid another sequential exchange.'
      : 'The model fits, but bytes are the larger term. Validate the representation ratio against real payload samples.'
    : model.dominant === 'Sequential path delay'
      ? 'The deadline is already consumed by sequential path delay. Moving bytes faster will not remove the missing round trips.'
      : 'Wire serialization exceeds the available budget. Reduce delivered bytes or increase measured end-to-end goodput.';

  return (
    <div data-content-block={block}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Transfer-time budget lab"
          title="Separate path delay from byte serialization"
          description="Start with one explicit unit, transform it into a representation, add a modeled wire allowance, and see which term spends the deadline."
          icon={Gauge}
          accent="violet"
          onReset={() => {
            setUnitId(data.defaults.unitId);
            setRepresentationId(data.defaults.representationId);
            setPathId(data.defaults.pathId);
            setConnectionId(data.defaults.connectionId);
            setBudgetMs(data.defaults.budgetMs);
          }}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Source unit</legend>
                <div className="mt-3 space-y-2">
                  {data.units.map((unit) => (
                    <LabChoice key={unit.id} selected={unit.id === model.unit.id} label={unit.label} detail={unit.detail} icon={Package} accent="blue" onClick={() => setUnitId(unit.id)} />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Wire representation</legend>
                <div className="mt-3 space-y-2">
                  {data.representations.map((representation) => (
                    <LabChoice key={representation.id} selected={representation.id === model.representation.id} label={representation.label} detail={representation.detail} icon={FileArchive} accent="cyan" onClick={() => setRepresentationId(representation.id)} />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">3. Measured path profile</legend>
                <div className="mt-3 space-y-2">
                  {data.paths.map((path) => (
                    <LabChoice key={path.id} selected={path.id === model.path.id} label={`${path.label}: ${path.goodputMbps} Mb/s goodput, ${path.rttMs} ms RTT`} detail={`${path.detail} Modeled bottleneck bandwidth: ${path.bottleneckMbps} Mb/s.`} icon={Network} accent={path.id === 'constrained-mobile' ? 'amber' : 'violet'} onClick={() => setPathId(path.id)} />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">4. Sequential path exchanges</legend>
                <div className="mt-3 space-y-2">
                  {data.connections.map((connection) => (
                    <LabChoice key={connection.id} selected={connection.id === model.connection.id} label={connection.label} detail={connection.detail} icon={Route} accent={connection.id === 'warm' ? 'emerald' : 'amber'} onClick={() => setConnectionId(connection.id)} />
                  ))}
                </div>
              </fieldset>

              <LabRange label="Completion budget" value={budgetMs} output={formatMs(budgetMs)} {...data.budgetRange} accent="rose" lowLabel="50 ms" highLabel="2 seconds" onChange={setBudgetMs} />
            </div>
          }
        >
          <div aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Representation body" value={formatBytes(model.representationBytes)} detail={`${decimal.format(model.representation.bodyRatio * 100)}% of ${model.unit.label}`} icon={FileArchive} tone="cyan" />
              <LabMetric label="Modeled wire bytes" value={formatBytes(model.wireBytes)} detail={`Adds ${model.connection.overheadPercent}% planning allowance`} icon={Package} tone="blue" />
              <LabMetric label="Estimated completion" value={formatMs(model.completionMs)} detail={`${formatMs(model.pathDelayMs)} path + ${formatMs(model.serializationMs)} serialization`} icon={Clock3} tone={withinBudget ? 'emerald' : 'rose'} />
              <LabMetric label="Path BDP" value={formatBytes(model.bdpBytes)} detail={`${model.path.bottleneckMbps} Mb/s bottleneck x ${model.path.rttMs} ms RTT`} icon={MoveHorizontal} tone="violet" />
            </div>

            <section className="mt-5 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-neutral-950 dark:text-white">Where the deadline goes</p>
                    <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Bar scale is the larger of the completion estimate and selected budget.</p>
                  </div>
                  <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${withinBudget ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100' : 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100'}`}>{withinBudget ? `${formatMs(model.remainingMs)} remaining` : `${formatMs(Math.abs(model.remainingMs))} over`}</span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex h-12 w-full overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-800" aria-label={`${formatMs(model.pathDelayMs)} sequential path delay, ${formatMs(model.serializationMs)} serialization, ${withinBudget ? `${formatMs(model.remainingMs)} remaining` : `${formatMs(Math.abs(model.remainingMs))} over budget`}`}>
                  <div className="flex min-w-0 items-center justify-center bg-violet-500 px-1 text-xs font-semibold text-white" style={{ width: `${pathShare}%` }} title={`Path delay: ${formatMs(model.pathDelayMs)}`}>
                    {pathShare >= 17 ? 'RTT path' : null}
                  </div>
                  <div className="flex min-w-0 items-center justify-center bg-amber-500 px-1 text-xs font-semibold text-amber-950" style={{ width: `${serializationShare}%` }} title={`Serialization: ${formatMs(model.serializationMs)}`}>
                    {serializationShare >= 17 ? 'Wire bytes' : null}
                  </div>
                  {remainingShare > 0 ? <div className="flex min-w-0 items-center justify-center bg-emerald-100 px-1 text-xs font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100" style={{ width: `${remainingShare}%` }}>{remainingShare >= 17 ? 'Headroom' : null}</div> : null}
                </div>
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                  <p className="border-l-4 border-violet-500 pl-2 text-neutral-600 dark:text-neutral-300"><strong className="text-neutral-950 dark:text-white">Path:</strong> {model.connection.sequentialRtts} x {model.path.rttMs} ms RTT</p>
                  <p className="border-l-4 border-amber-500 pl-2 text-neutral-600 dark:text-neutral-300"><strong className="text-neutral-950 dark:text-white">Serialization:</strong> {formatBytes(model.wireBytes)} at {model.path.goodputMbps} Mb/s</p>
                  <p className="border-l-4 border-emerald-500 pl-2 text-neutral-600 dark:text-neutral-300"><strong className="text-neutral-950 dark:text-white">Deadline:</strong> {formatMs(budgetMs)}</p>
                </div>
              </div>
            </section>

            <section className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                <div className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white"><Activity aria-hidden="true" className="h-4 w-4 text-violet-600 dark:text-violet-300" />Bandwidth-delay product</div>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">{decimal.format(bdpRatio)}x</p>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">The wire payload is {decimal.format(bdpRatio)} times this path's BDP. Filling the selected bottleneck requires enough congestion and receive-window credit for about {formatBytes(model.bdpBytes)} in flight.</p>
              </div>
              <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                <div className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white"><Gauge aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-300" />Dominant modeled term</div>
                <p className="mt-2 text-2xl font-semibold text-neutral-950 dark:text-white">{model.dominant}</p>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Optimize the largest honest term first. Faster server code does not remove round trips or reduce response bytes.</p>
              </div>
            </section>

            <section className={`mt-5 border-l-4 p-5 ${withinBudget ? 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50' : 'border-rose-500 bg-rose-50 text-rose-950 dark:bg-rose-950/30 dark:text-rose-50'}`} role="status">
              <div className="flex items-start gap-3">
                {withinBudget ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" /> : <TriangleAlert aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-70">Decision consequence</p>
                  <h4 className="mt-2 text-lg font-semibold">{withinBudget ? 'The modeled transfer fits the selected deadline' : 'The modeled transfer misses the selected deadline'}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-85">{recommendation}</p>
                </div>
              </div>
            </section>

            <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Illustrative model: completion adds the selected sequential RTTs to wire-bit serialization at measured goodput. BDP uses the separate bottleneck-bandwidth input multiplied by RTT. The estimate excludes server work, queueing, congestion-window growth, loss recovery, pacing, and client processing. The overhead and representation ratios are planning inputs, not protocol constants.</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
