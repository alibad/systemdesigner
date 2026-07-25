'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CircleAlert,
  Clock3,
  HardDrive,
  Network,
  Route,
  ShieldCheck,
  Siren,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

interface RecoveryAction {
  id: string;
  label: string;
  detail: string;
}

interface FailureScenario {
  id: string;
  label: string;
  detail: string;
  lostRawTb: number;
  underReplicatedPct: number;
  unavailablePct: number;
  correctActionId: string;
  explanation: string;
}

interface RecoveryData {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    actionId: string;
    repairBandwidthGbps: number;
  };
  actions: RecoveryAction[];
  scenarios: FailureScenario[];
}

const BLOCK_ID = 'technology/hadoop-hdfs-recovery-lab';

function isRecoveryData(value: unknown): value is RecoveryData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RecoveryData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && Array.isArray(candidate.actions)
      && candidate.actions.length > 0
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0,
  );
}

export default function HadoopHdfsRecoveryLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<RecoveryData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No recovery scenarios were supplied.');
      return;
    }
    const controller = new AbortController();
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isRecoveryData(payload)) throw new Error('Recovery scenario data is incomplete.');
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load recovery scenarios.');
      });
    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabState title="Recovery lab unavailable" detail={loadError} />;
  if (!data) return <LabState title="Loading recovery lab" detail="Preparing failure scenarios..." />;
  return <RecoveryLab data={data} />;
}

function RecoveryLab({ data }: { data: RecoveryData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [actionId, setActionId] = useState(data.defaults.actionId);
  const [repairBandwidthGbps, setRepairBandwidthGbps] = useState(
    data.defaults.repairBandwidthGbps,
  );

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const action = data.actions.find((item) => item.id === actionId) ?? data.actions[0];
  const result = useMemo(() => {
    const correct = action.id === scenario.correctActionId;
    const repairHours = scenario.lostRawTb === 0
      ? 0
      : (scenario.lostRawTb * 8_000) / (repairBandwidthGbps * 3_600);
    const exposureHours = correct ? repairHours : repairHours * 2.4 + 0.5;
    const residualUnavailablePct = correct
      ? Math.max(0, scenario.unavailablePct * 0.15)
      : Math.min(100, scenario.unavailablePct + scenario.underReplicatedPct * 0.08);
    return { correct, exposureHours, repairHours, residualUnavailablePct };
  }, [action.id, repairBandwidthGbps, scenario]);

  const reset = () => {
    setScenarioId(data.defaults.scenarioId);
    setActionId(data.defaults.actionId);
    setRepairBandwidthGbps(data.defaults.repairBandwidthGbps);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Failure and recovery lab"
          title={data.title}
          description={data.description}
          icon={Siren}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Inject a failure
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={scenario.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'namenode-loss' ? Network : HardDrive}
                      accent="amber"
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Safe repair bandwidth"
                value={repairBandwidthGbps}
                output={`${repairBandwidthGbps} Gbps`}
                min={2}
                max={80}
                step={2}
                accent="cyan"
                lowLabel="Protect foreground jobs"
                highLabel="Faster repair pressure"
                onChange={setRepairBandwidthGbps}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Choose the first response
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.actions.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={action.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Route}
                      accent="violet"
                      onClick={() => setActionId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="space-y-6">
            <div className={`rounded-md border p-5 ${result.correct ? healthyClass : dangerClass}`}>
              <div className="flex items-start gap-3">
                {result.correct ? (
                  <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Recovery verdict</p>
                  <h4 className="mt-1 text-xl font-semibold">
                    {result.correct ? 'The response matches the failed control plane' : 'This response leaves the main failure unresolved'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {result.correct ? scenario.explanation : `${action.label} does not address the first invariant broken by ${scenario.label.toLowerCase()}.`}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Data to repair" value={`${scenario.lostRawTb} TB`} detail="Illustrative raw block data" icon={HardDrive} tone="blue" />
              <LabMetric label="Under-replicated" value={`${scenario.underReplicatedPct}%`} detail="Blocks below target copies" icon={Activity} tone={scenario.underReplicatedPct > 10 ? 'amber' : 'cyan'} />
              <LabMetric label="Exposure window" value={`${result.exposureHours.toFixed(1)}h`} detail="Until the selected response restores margin" icon={Clock3} tone={result.correct ? 'emerald' : 'rose'} />
              <LabMetric label="Residual unavailability" value={`${result.residualUnavailablePct.toFixed(2)}%`} detail="After the selected first response" icon={Network} tone={result.residualUnavailablePct === 0 ? 'emerald' : 'rose'} />
            </div>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Recovery sequence</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <RecoveryStep number="1" title="Contain" detail="Protect namespace correctness and stop unsafe writes or repeated repair work." />
                <RecoveryStep number="2" title="Restore margin" detail={`Use about ${repairBandwidthGbps} Gbps without starving foreground readers and writers.`} />
                <RecoveryStep number="3" title="Verify" detail="Check block counts, checksums, rack diversity, metadata health, and client-visible reads." />
              </div>
            </div>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              Repair time is a planning estimate from lost data and safe aggregate bandwidth. Real recovery also depends on disk throughput, topology, block skew, competing jobs, and NameNode scheduling.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function RecoveryStep({ number, title, detail }: { number: string; title: string; detail: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">{number}</span>
      <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

function LabState({ title, detail }: { title: string; detail: string }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div className="flex items-start gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100">
            <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{detail}</p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

const healthyClass = 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50';
const dangerClass = 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50';
