'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  Calculator,
  CheckCircle2,
  Database,
  Gauge,
  Network,
  Server,
  TriangleAlert,
  Users,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type RangeLimit = { min: number; max: number; step: number };

type PayloadOption = {
  id: string;
  label: string;
  bytes: number;
  detail: string;
};

type CapacityProfile = {
  id: string;
  label: string;
  detail: string;
  testedNodeRps: number;
  targetUtilizationPercent: number;
  reserveNodes: number;
  evidence: 'heuristic' | 'analogy' | 'measurement';
};

type CoupledEstimationModel = {
  assumptions: {
    secondsPerDay: number;
    retentionDays: number;
    replicationFactor: number;
  };
  limits: {
    usersMillions: RangeLimit;
    dailyActivePercent: RangeLimit;
    actionsPerUser: RangeLimit;
    peakFactor: RangeLimit;
    readPercent: RangeLimit;
  };
  payloadOptions: PayloadOption[];
  capacityProfiles: CapacityProfile[];
};

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

function formatData(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let amount = Math.max(0, bytes);
  let index = 0;
  while (amount >= 1000 && index < units.length - 1) {
    amount /= 1000;
    index += 1;
  }
  return `${decimal.format(amount)} ${units[index]}`;
}

function LabState({ block, label, error }: { block: string; label: string; error?: string }) {
  return (
    <div data-content-block={block}>
      <div
        className={`min-h-48 rounded-md border p-5 text-sm ${error ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100' : 'border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900'}`}
        aria-label={label}
        role={error ? 'alert' : undefined}
      >
        {error ? <><p className="font-semibold">Estimation model unavailable</p><p className="mt-2 opacity-80">{error}</p></> : null}
      </div>
    </div>
  );
}

export default function RulesOfThumbCoupledEstimationLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<CoupledEstimationModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [usersMillions, setUsersMillions] = useState(5);
  const [dailyActivePercent, setDailyActivePercent] = useState(20);
  const [actionsPerUser, setActionsPerUser] = useState(12);
  const [peakFactor, setPeakFactor] = useState(4);
  const [readPercent, setReadPercent] = useState(92);
  const [payloadId, setPayloadId] = useState('document');
  const [capacityId, setCapacityId] = useState('analogous');

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The coupled estimation data file was not provided.');
      return;
    }
    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<CoupledEstimationModel>;
      })
      .then(setData)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the estimation model.');
      });
    return () => controller.abort();
  }, [dataFile]);

  const block = 'reference/rules-of-thumb-coupled-estimation-lab';
  if (loadError) return <LabState block={block} label="Estimation model unavailable" error={loadError} />;
  if (!data) return <LabState block={block} label="Loading coupled estimation model" />;

  const payload = data.payloadOptions.find((option) => option.id === payloadId) ?? data.payloadOptions[0];
  const capacity = data.capacityProfiles.find((option) => option.id === capacityId) ?? data.capacityProfiles[0];
  if (!payload || !capacity) {
    return <LabState block={block} label="Estimation model unavailable" error="Payload or capacity options are missing." />;
  }

  const activeUsers = usersMillions * 1_000_000 * (dailyActivePercent / 100);
  const dailyOperations = activeUsers * actionsPerUser;
  const averageRps = dailyOperations / data.assumptions.secondsPerDay;
  const peakRps = averageRps * peakFactor;
  const peakReads = peakRps * (readPercent / 100);
  const peakWrites = peakRps - peakReads;
  const peakBandwidthMbps = peakRps * payload.bytes * 8 / 1_000_000;
  const dailyWriteBytes = averageRps * (1 - readPercent / 100) * payload.bytes * data.assumptions.secondsPerDay;
  const retainedReplicatedBytes = dailyWriteBytes * data.assumptions.retentionDays * data.assumptions.replicationFactor;
  const safeNodeRps = capacity.testedNodeRps * (capacity.targetUtilizationPercent / 100);
  const servingNodes = Math.max(1, Math.ceil(peakRps / safeNodeRps));
  const plannedNodes = servingNodes + capacity.reserveNodes;
  const evidenceReady = capacity.evidence === 'measurement';

  return (
    <div data-content-block={block}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Coupled estimation lab"
          title="Trace product behavior into a capacity plan"
          description="Every control changes several downstream quantities. Follow the chain from active users to average demand, peak traffic, bandwidth, stored writes, and a rounded fleet with explicit reserve."
          icon={Calculator}
          accent="blue"
          onReset={() => {
            setUsersMillions(5);
            setDailyActivePercent(20);
            setActionsPerUser(12);
            setPeakFactor(4);
            setReadPercent(92);
            setPayloadId('document');
            setCapacityId('analogous');
          }}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <LabRange label="Registered users" value={usersMillions} output={`${decimal.format(usersMillions)}M`} {...data.limits.usersMillions} accent="blue" lowLabel="100 thousand" highLabel="50 million" onChange={setUsersMillions} />
              <LabRange label="Daily active share" value={dailyActivePercent} output={`${dailyActivePercent}%`} {...data.limits.dailyActivePercent} accent="cyan" lowLabel="5%" highLabel="100%" onChange={setDailyActivePercent} />
              <LabRange label="Actions per active user" value={actionsPerUser} output={`${actionsPerUser}/day`} {...data.limits.actionsPerUser} accent="violet" lowLabel="1" highLabel="100" onChange={setActionsPerUser} />
              <LabRange label="Peak factor" value={peakFactor} output={`${decimal.format(peakFactor)}x`} {...data.limits.peakFactor} accent="amber" lowLabel="flat" highLabel="10x average" onChange={setPeakFactor} />
              <LabRange label="Read share" value={readPercent} output={`${readPercent}% reads`} {...data.limits.readPercent} accent="emerald" lowLabel="balanced" highLabel="read-heavy" onChange={setReadPercent} />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Response or event payload</legend>
                <div className="mt-3 space-y-2">
                  {data.payloadOptions.map((option) => (
                    <LabChoice key={option.id} selected={payload.id === option.id} label={`${option.label} · ${formatData(option.bytes)}`} detail={option.detail} icon={Network} accent="violet" onClick={() => setPayloadId(option.id)} />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Per-node capacity evidence</legend>
                <div className="mt-3 space-y-2">
                  {data.capacityProfiles.map((option) => (
                    <LabChoice key={option.id} selected={capacity.id === option.id} label={option.label} detail={option.detail} icon={Server} accent={option.evidence === 'measurement' ? 'emerald' : option.evidence === 'analogy' ? 'blue' : 'amber'} onClick={() => setCapacityId(option.id)} />
                  ))}
                </div>
              </fieldset>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Daily active users" value={compact.format(activeUsers)} detail={`${dailyActivePercent}% of ${decimal.format(usersMillions)}M registered users.`} icon={Users} tone="blue" />
            <LabMetric label="Average rate" value={`${compact.format(averageRps)} RPS`} detail={`${compact.format(dailyOperations)} operations spread across ${data.assumptions.secondsPerDay.toLocaleString()} seconds.`} icon={Activity} tone="cyan" />
            <LabMetric label="Peak rate" value={`${compact.format(peakRps)} RPS`} detail={`${decimal.format(peakFactor)}x the modeled average rate.`} icon={Gauge} tone="amber" />
            <LabMetric label="Planned app fleet" value={`${plannedNodes} nodes`} detail={`${servingNodes} serving + ${capacity.reserveNodes} explicit reserve.`} icon={Server} tone={evidenceReady ? 'emerald' : 'violet'} />
          </div>

          <section className="mt-5 border-y border-neutral-200 py-5 dark:border-neutral-800">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
              <div className="border-l-4 border-blue-500 bg-blue-50 p-4 text-blue-950 dark:bg-blue-950/30 dark:text-blue-50">
                <p className="text-xs font-semibold uppercase opacity-70">Read path</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{compact.format(peakReads)} RPS</p>
                <p className="mt-1 text-xs opacity-75">{readPercent}% of the selected peak</p>
              </div>
              <div className="hidden h-px w-10 bg-neutral-300 md:block dark:bg-neutral-700" aria-hidden="true" />
              <div className="border-l-4 border-violet-500 bg-violet-50 p-4 text-violet-950 dark:bg-violet-950/30 dark:text-violet-50">
                <p className="text-xs font-semibold uppercase opacity-70">Write path</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{compact.format(peakWrites)} RPS</p>
                <p className="mt-1 text-xs opacity-75">{100 - readPercent}% of the selected peak</p>
              </div>
            </div>
          </section>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <LabMetric label="Peak payload traffic" value={`${decimal.format(peakBandwidthMbps)} Mb/s`} detail={`${formatData(payload.bytes)} x peak requests x 8 bits/byte; protocol overhead excluded.`} icon={Network} tone={peakBandwidthMbps >= 800 ? 'rose' : peakBandwidthMbps >= 100 ? 'amber' : 'blue'} />
            <LabMetric label="Raw writes per day" value={formatData(dailyWriteBytes)} detail="Average write rate, before indexes, compression, and backups." icon={Database} tone="violet" />
            <LabMetric label="30-day replicated writes" value={formatData(retainedReplicatedBytes)} detail={`${data.assumptions.replicationFactor} copies; raw payload only.`} icon={Database} tone="cyan" />
          </div>

          <section className={`mt-5 border-l-4 p-5 ${evidenceReady ? 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50' : 'border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-50'}`} aria-live="polite">
            <div className="flex items-start gap-3">
              {evidenceReady ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" /> : <TriangleAlert aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />}
              <div>
                <p className="text-xs font-semibold uppercase opacity-70">Capacity evidence</p>
                <h4 className="mt-2 text-lg font-semibold">{evidenceReady ? 'The node estimate uses representative measurement' : 'The node estimate is still a planning placeholder'}</h4>
                <p className="mt-2 text-sm leading-6 opacity-85">
                  {capacity.label} provides {compact.format(capacity.testedNodeRps)} RPS/node at {capacity.targetUtilizationPercent}% target utilization, or {compact.format(safeNodeRps)} safe RPS/node. {evidenceReady ? 'Re-run the test after meaningful workload or runtime changes.' : 'Use this result to size a benchmark, not to make a final capacity promise.'}
                </p>
              </div>
            </div>
          </section>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
