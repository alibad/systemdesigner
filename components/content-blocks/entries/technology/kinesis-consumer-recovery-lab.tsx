'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Gauge,
  History,
  LoaderCircle,
  RadioTower,
  Repeat2,
  ShieldCheck,
  ShieldOff,
  Users,
  Wifi,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bound = {
  min: number;
  max: number;
  step: number;
};

type ReadMode = {
  id: 'shared' | 'enhanced';
  label: string;
  detail: string;
  readMiBPerSecondPerShard: number;
  dedicatedPerConsumer: boolean;
};

type SinkPolicy = {
  id: 'apply-every-time' | 'idempotent';
  label: string;
  detail: string;
  idempotent: boolean;
};

type RecoveryModel = {
  title: string;
  description: string;
  defaults: {
    readModeId: string;
    consumerApplications: number;
    outageMinutes: number;
    sinkPolicyId: string;
  };
  bounds: {
    consumerApplications: Bound;
    outageMinutes: Bound;
  };
  stream: {
    shards: number;
    retentionHours: number;
    recordsPerSecondPerShard: number;
    averageRecordKiB: number;
    modeledReplayDuplicatePercent: number;
  };
  readModes: ReadMode[];
  sinkPolicies: SinkPolicy[];
};

const BLOCK_ID = 'technology/kinesis-consumer-recovery-lab';
const KIB_PER_MIB = 1024;

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return [candidate.min, candidate.max, candidate.step].every(
    (item) => typeof item === 'number' && Number.isFinite(item),
  );
}

function isReadMode(value: unknown): value is ReadMode {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ReadMode>;
  return Boolean(
    (candidate.id === 'shared' || candidate.id === 'enhanced')
      && candidate.label
      && candidate.detail
      && typeof candidate.readMiBPerSecondPerShard === 'number'
      && typeof candidate.dedicatedPerConsumer === 'boolean',
  );
}

function isSinkPolicy(value: unknown): value is SinkPolicy {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SinkPolicy>;
  return Boolean(
    (candidate.id === 'apply-every-time' || candidate.id === 'idempotent')
      && candidate.label
      && candidate.detail
      && typeof candidate.idempotent === 'boolean',
  );
}

function isRecoveryModel(value: unknown): value is RecoveryModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RecoveryModel>;
  const stream = candidate.stream;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.readModeId
      && candidate.defaults.sinkPolicyId
      && typeof candidate.defaults.consumerApplications === 'number'
      && typeof candidate.defaults.outageMinutes === 'number'
      && isBound(candidate.bounds?.consumerApplications)
      && isBound(candidate.bounds?.outageMinutes)
      && typeof stream?.shards === 'number'
      && typeof stream.retentionHours === 'number'
      && typeof stream.recordsPerSecondPerShard === 'number'
      && typeof stream.averageRecordKiB === 'number'
      && typeof stream.modeledReplayDuplicatePercent === 'number'
      && Array.isArray(candidate.readModes)
      && candidate.readModes.length === 2
      && candidate.readModes.every(isReadMode)
      && Array.isArray(candidate.sinkPolicies)
      && candidate.sinkPolicies.length === 2
      && candidate.sinkPolicies.every(isSinkPolicy),
  );
}

function formatNumber(value: number, digits = 1) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: value > 0 && value < 1 ? Math.min(2, digits) : 0,
  }).format(value);
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return 'Never';
  if (seconds < 60) return `${Math.ceil(seconds)} sec`;
  if (seconds < 3600) return `${formatNumber(seconds / 60)} min`;
  return `${formatNumber(seconds / 3600)} hr`;
}

export default function KinesisConsumerRecoveryLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<RecoveryModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No consumer-recovery model was supplied.');
      return;
    }

    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isRecoveryModel(payload)) {
          throw new Error('The consumer-recovery model is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the recovery lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return (
      <LoadState
        error={error}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  return <RecoveryWorkbench data={data} />;
}

function RecoveryWorkbench({ data }: { data: RecoveryModel }) {
  const [readModeId, setReadModeId] = useState(data.defaults.readModeId);
  const [consumerApplications, setConsumerApplications] = useState(
    data.defaults.consumerApplications,
  );
  const [outageMinutes, setOutageMinutes] = useState(data.defaults.outageMinutes);
  const [sinkPolicyId, setSinkPolicyId] = useState(data.defaults.sinkPolicyId);

  const readMode = data.readModes.find((item) => item.id === readModeId)
    ?? data.readModes[0];
  const sinkPolicy = data.sinkPolicies.find((item) => item.id === sinkPolicyId)
    ?? data.sinkPolicies[0];

  const result = useMemo(() => {
    const stream = data.stream;
    const ingressMiBPerSecondPerShard = (
      stream.recordsPerSecondPerShard
      * stream.averageRecordKiB
      / KIB_PER_MIB
    );
    const readBudgetPerApplication = readMode.dedicatedPerConsumer
      ? readMode.readMiBPerSecondPerShard
      : readMode.readMiBPerSecondPerShard / consumerApplications;
    const catchUpHeadroom = readBudgetPerApplication - ingressMiBPerSecondPerShard;
    const outageSeconds = outageMinutes * 60;
    const backlogMiBPerShard = ingressMiBPerSecondPerShard * outageSeconds;
    const recoverySeconds = outageSeconds === 0
      ? 0
      : catchUpHeadroom > 0
        ? backlogMiBPerShard / catchUpHeadroom
        : Number.POSITIVE_INFINITY;
    const oldestAgeAtRestartHours = outageSeconds / 3600;
    const replayWindowRemainingHours = Math.max(
      0,
      stream.retentionHours - oldestAgeAtRestartHours,
    );
    const retentionRisk = oldestAgeAtRestartHours >= stream.retentionHours;
    const cannotCatchUp = catchUpHeadroom <= 0;
    const replayedRecords = (
      stream.recordsPerSecondPerShard
      * stream.shards
      * outageSeconds
    );
    const duplicateCandidates = Math.ceil(
      replayedRecords * stream.modeledReplayDuplicatePercent / 100,
    );
    const duplicateEffects = sinkPolicy.idempotent ? 0 : duplicateCandidates;
    const utilization = ingressMiBPerSecondPerShard / readBudgetPerApplication * 100;
    const status = retentionRisk || duplicateEffects > 0 || cannotCatchUp
      ? 'critical'
      : utilization > 80
        ? 'warning'
        : 'healthy';

    return {
      backlogMiBPerShard,
      catchUpHeadroom,
      cannotCatchUp,
      duplicateCandidates,
      duplicateEffects,
      ingressMiBPerSecondPerShard,
      oldestAgeAtRestartHours,
      readBudgetPerApplication,
      recoverySeconds,
      replayWindowRemainingHours,
      retentionRisk,
      status,
      utilization,
    } as const;
  }, [consumerApplications, data.stream, outageMinutes, readMode, sinkPolicy.idempotent]);

  function reset() {
    setReadModeId(data.defaults.readModeId);
    setConsumerApplications(data.defaults.consumerApplications);
    setOutageMinutes(data.defaults.outageMinutes);
    setSinkPolicyId(data.defaults.sinkPolicyId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Replay and recovery lab"
          title={data.title}
          description={data.description}
          icon={History}
          accent="emerald"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Read path
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.readModes.map((mode) => (
                    <LabChoice
                      key={mode.id}
                      selected={mode.id === readMode.id}
                      label={mode.label}
                      detail={mode.detail}
                      icon={mode.dedicatedPerConsumer ? Wifi : Users}
                      accent={mode.dedicatedPerConsumer ? 'emerald' : 'blue'}
                      onClick={() => setReadModeId(mode.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="space-y-6">
                <LabRange
                  label="Consumer applications"
                  value={consumerApplications}
                  output={`${consumerApplications} apps`}
                  {...data.bounds.consumerApplications}
                  lowLabel="One reader"
                  highLabel="More fan-out"
                  accent="blue"
                  onChange={setConsumerApplications}
                />
                <LabRange
                  label="Application outage"
                  value={outageMinutes}
                  output={`${outageMinutes} min`}
                  {...data.bounds.outageMinutes}
                  lowLabel="No backlog"
                  highLabel="One day"
                  accent="amber"
                  onChange={setOutageMinutes}
                />
              </div>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Destination contract
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.sinkPolicies.map((policy) => (
                    <LabChoice
                      key={policy.id}
                      selected={policy.id === sinkPolicy.id}
                      label={policy.label}
                      detail={policy.detail}
                      icon={policy.idempotent ? ShieldCheck : ShieldOff}
                      accent={policy.idempotent ? 'emerald' : 'rose'}
                      onClick={() => setSinkPolicyId(policy.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Read budget per app"
                value={`${formatNumber(result.readBudgetPerApplication, 2)} MiB/s`}
                detail={readMode.dedicatedPerConsumer ? 'Dedicated per shard' : 'Equal-share planning estimate'}
                icon={Gauge}
                tone={result.utilization > 100 ? 'rose' : 'blue'}
              />
              <LabMetric
                label="Backlog per shard"
                value={`${formatNumber(result.backlogMiBPerShard)} MiB`}
                detail={`${outageMinutes} minutes at ${formatNumber(result.ingressMiBPerSecondPerShard, 2)} MiB/s`}
                icon={History}
                tone="violet"
              />
              <LabMetric
                label="Catch-up time"
                value={result.cannotCatchUp
                  ? (outageMinutes === 0 ? 'Lag grows' : 'Never')
                  : formatDuration(result.recoverySeconds)}
                detail={result.cannotCatchUp ? 'New traffic consumes the full read budget' : `${formatNumber(result.catchUpHeadroom, 2)} MiB/s spare per shard`}
                icon={Clock3}
                tone={result.retentionRisk ? 'rose' : result.utilization > 80 ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Repeated effects"
                value={result.duplicateEffects.toLocaleString()}
                detail={`${result.duplicateCandidates.toLocaleString()} modeled replay duplicates`}
                icon={Repeat2}
                tone={result.duplicateEffects > 0 ? 'rose' : 'emerald'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Recovery path
              </p>
              <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                Read capacity and side-effect safety solve different failures
              </h4>
              <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-stretch">
                <FlowStage
                  icon={RadioTower}
                  eyebrow={`${data.stream.shards} shards`}
                  title={`${data.stream.recordsPerSecondPerShard.toLocaleString()} records/s each`}
                  detail={`${data.stream.retentionHours}-hour replay window`}
                  tone="blue"
                />
                <PathArrow />
                <FlowStage
                  icon={readMode.dedicatedPerConsumer ? Wifi : Users}
                  eyebrow="Read contract"
                  title={readMode.dedicatedPerConsumer ? 'Dedicated pipe' : 'Shared pipe'}
                  detail={`${formatNumber(result.readBudgetPerApplication, 2)} MiB/s per app per shard`}
                  tone={result.utilization > 100 ? 'rose' : 'violet'}
                />
                <PathArrow />
                <FlowStage
                  icon={History}
                  eyebrow="Recovery"
                  title={result.cannotCatchUp
                    ? (outageMinutes === 0 ? 'Lag starts immediately' : 'Cannot catch up')
                    : formatDuration(result.recoverySeconds)}
                  detail={result.cannotCatchUp
                    ? `${formatNumber(result.replayWindowRemainingHours)} hours before the current oldest record expires`
                    : `${formatNumber(result.oldestAgeAtRestartHours)} hours old at restart`}
                  tone={result.retentionRisk || result.cannotCatchUp ? 'rose' : 'amber'}
                />
                <PathArrow />
                <FlowStage
                  icon={sinkPolicy.idempotent ? ShieldCheck : ShieldOff}
                  eyebrow="Destination"
                  title={sinkPolicy.idempotent ? 'One business effect' : 'Replay repeats work'}
                  detail={sinkPolicy.detail}
                  tone={sinkPolicy.idempotent ? 'emerald' : 'rose'}
                />
              </div>
            </section>

            <section className={`rounded-md border p-4 ${
              result.status === 'critical'
                ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100'
                : result.status === 'warning'
                  ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100'
            }`}>
              <div className="flex items-start gap-3">
                {result.status === 'healthy' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <h4 className="font-semibold">
                    {result.retentionRisk
                      ? 'The consumer crosses the configured replay window'
                      : result.cannotCatchUp
                        ? 'This consumer never catches the live head'
                        : result.duplicateEffects > 0
                          ? 'The backlog drains, but replay repeats business work'
                          : 'The consumer recovers with one visible business effect'}
                  </h4>
                  <ul className="mt-3 space-y-2 text-sm leading-6">
                    <li className="flex gap-2">
                      <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                      <span>
                        Read utilization is {formatNumber(result.utilization)}% before
                        catch-up work.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                      <span>
                        {readMode.dedicatedPerConsumer
                          ? 'Adding registered consumer applications does not divide this modeled read pipe.'
                          : 'Adding shared polling applications divides the planning budget and can remove recovery headroom.'}
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                      <span>
                        The {data.stream.modeledReplayDuplicatePercent}% duplicate rate
                        is a synthetic failure fixture, not an AWS guarantee.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function FlowStage({
  icon: Icon,
  eyebrow,
  title,
  detail,
  tone,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  detail: string;
  tone: 'blue' | 'violet' | 'amber' | 'emerald' | 'rose';
}) {
  const styles = {
    blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100',
    violet: 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-100',
    amber: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100',
    rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100',
  } as const;

  return (
    <div className={`min-w-0 flex-1 rounded-md border p-3 ${styles[tone]}`}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase opacity-75">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span>{eyebrow}</span>
      </div>
      <p className="mt-2 break-words text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 opacity-80">{detail}</p>
    </div>
  );
}

function PathArrow() {
  return (
    <div className="flex shrink-0 items-center justify-center text-neutral-400 dark:text-neutral-600">
      <ArrowDown aria-hidden="true" className="h-4 w-4 md:hidden" />
      <ArrowRight aria-hidden="true" className="hidden h-4 w-4 md:block" />
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <div className="flex min-h-56 flex-col items-center justify-center px-5 py-10 text-center">
          {error ? (
            <CircleAlert aria-hidden="true" className="h-7 w-7 text-rose-500" />
          ) : (
            <LoaderCircle
              aria-hidden="true"
              className="h-7 w-7 animate-spin text-emerald-500 motion-reduce:animate-none"
            />
          )}
          <h3 className="mt-3 text-base font-semibold text-neutral-950 dark:text-white">
            {error ? 'Recovery model unavailable' : 'Loading recovery model'}
          </h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            {error ?? 'Loading the lesson-owned replay assumptions.'}
          </p>
          {error ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
            >
              Retry
            </button>
          ) : null}
        </div>
      </LearningLab>
    </div>
  );
}
