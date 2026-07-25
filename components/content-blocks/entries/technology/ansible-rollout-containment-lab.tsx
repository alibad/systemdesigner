'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  Network,
  Server,
  Shield,
  ShieldCheck,
  Target,
  TriangleAlert,
  XCircle,
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

type Environment = 'production' | 'staging';
type HostStatus = 'changed' | 'failed' | 'protected';

type InventoryHost = {
  id: string;
  label: string;
  environment: Environment;
  zone: string;
  groups: string[];
};

type InventoryPattern = {
  id: string;
  label: string;
  expression: string;
  detail: string;
  matchedHostIds: string[];
};

type RolloutModel = {
  title: string;
  description: string;
  defaults: {
    patternId: string;
    serial: number;
    maxFailPercentage: number;
    failedHosts: number;
  };
  hosts: InventoryHost[];
  patterns: InventoryPattern[];
};

type RolloutResult = {
  batchSize: number;
  failures: number;
  failurePercentage: number;
  aborted: boolean;
  changedHosts: number;
  untouchedTargets: number;
  nonProductionTargets: number;
};

const BLOCK_ID = 'technology/ansible-rollout-containment-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/ansible/data/inventory-rollout-model.json';

const hostStatusMeta: Record<
  HostStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  changed: {
    label: 'Changed',
    icon: CheckCircle2,
    className:
      'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    className:
      'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
  },
  protected: {
    label: 'Untouched',
    icon: Shield,
    className:
      'border-neutral-300 bg-neutral-100 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100',
  },
};

function isEnvironment(value: unknown): value is Environment {
  return value === 'production' || value === 'staging';
}

function isRolloutModel(value: unknown): value is RolloutModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RolloutModel>;

  if (
    typeof candidate.title !== 'string'
    || typeof candidate.description !== 'string'
    || typeof candidate.defaults?.patternId !== 'string'
    || typeof candidate.defaults.serial !== 'number'
    || typeof candidate.defaults.maxFailPercentage !== 'number'
    || typeof candidate.defaults.failedHosts !== 'number'
    || !Array.isArray(candidate.hosts)
    || candidate.hosts.length < 4
    || !Array.isArray(candidate.patterns)
    || candidate.patterns.length < 3
  ) {
    return false;
  }

  const hostIds = new Set(
    candidate.hosts
      .filter((host) => (
        typeof host.id === 'string'
        && typeof host.label === 'string'
        && isEnvironment(host.environment)
        && typeof host.zone === 'string'
        && Array.isArray(host.groups)
        && host.groups.every((group) => typeof group === 'string')
      ))
      .map((host) => host.id),
  );

  return (
    hostIds.size === candidate.hosts.length
    && candidate.patterns.every((pattern) => (
      typeof pattern.id === 'string'
      && typeof pattern.label === 'string'
      && typeof pattern.expression === 'string'
      && typeof pattern.detail === 'string'
      && Array.isArray(pattern.matchedHostIds)
      && pattern.matchedHostIds.length > 0
      && pattern.matchedHostIds.every((hostId) => hostIds.has(hostId))
    ))
    && candidate.patterns.some(
      (pattern) => pattern.id === candidate.defaults?.patternId,
    )
  );
}

export default function AnsibleRolloutContainmentLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<RolloutModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isRolloutModel(payload)) {
          throw new Error('The inventory and rollout model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the rollout model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Inventory and rollout lab"
            title="Load the failure-containment model"
            description="The lesson-owned inventory, patterns, and host groups are loading."
            icon={Network}
            accent="amber"
          />
          <LoadState
            error={error}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        </LearningLab>
      ) : (
        <RolloutWorkbench model={model} />
      )}
    </div>
  );
}

function RolloutWorkbench({ model }: { model: RolloutModel }) {
  const defaultPattern =
    model.patterns.find((item) => item.id === model.defaults.patternId)
    ?? model.patterns[0];
  const [patternId, setPatternId] = useState(defaultPattern.id);
  const [serial, setSerial] = useState(model.defaults.serial);
  const [maxFailPercentage, setMaxFailPercentage] = useState(
    model.defaults.maxFailPercentage,
  );
  const [failedHosts, setFailedHosts] = useState(model.defaults.failedHosts);

  const pattern =
    model.patterns.find((item) => item.id === patternId)
    ?? defaultPattern;
  const targetHosts = pattern.matchedHostIds
    .map((hostId) => model.hosts.find((host) => host.id === hostId))
    .filter((host): host is InventoryHost => Boolean(host));
  const batches = chunkHosts(targetHosts, serial);
  const batchSize = Math.min(serial, targetHosts.length);
  const effectiveFailures = Math.min(failedHosts, batchSize);

  const result = useMemo(
    () => calculateRollout({
      hosts: targetHosts,
      serial,
      failedHosts: effectiveFailures,
      maxFailPercentage,
    }),
    [effectiveFailures, maxFailPercentage, serial, targetHosts],
  );

  const verdict = describeRollout(pattern, result);
  const VerdictIcon = verdict.icon;

  function reset() {
    setPatternId(defaultPattern.id);
    setSerial(model.defaults.serial);
    setMaxFailPercentage(model.defaults.maxFailPercentage);
    setFailedHosts(model.defaults.failedHosts);
  }

  function selectPattern(nextPatternId: string) {
    const nextPattern =
      model.patterns.find((item) => item.id === nextPatternId)
      ?? defaultPattern;
    setPatternId(nextPattern.id);
    setFailedHosts((count) => Math.min(count, Math.min(serial, nextPattern.matchedHostIds.length)));
  }

  function selectSerial(nextSerial: number) {
    setSerial(nextSerial);
    setFailedHosts((count) => Math.min(count, Math.min(nextSerial, targetHosts.length)));
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Inventory and rollout lab"
        title={model.title}
        description={model.description}
        icon={Network}
        accent="amber"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Inventory target
              </legend>
              <div className="mt-3 grid gap-2">
                {model.patterns.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === pattern.id}
                    label={item.label}
                    detail={`${item.expression} - ${item.detail}`}
                    icon={item.id === 'broad' ? TriangleAlert : Target}
                    accent={item.id === 'broad' ? 'rose' : 'blue'}
                    onClick={() => selectPattern(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Serial batch size"
              value={serial}
              output={`${serial} host${serial === 1 ? '' : 's'}`}
              min={1}
              max={6}
              step={1}
              accent="blue"
              lowLabel="One at a time"
              highLabel="All production"
              onChange={selectSerial}
            />

            <LabRange
              label="max_fail_percentage"
              value={maxFailPercentage}
              output={`${maxFailPercentage}%`}
              min={0}
              max={100}
              step={1}
              accent="amber"
              lowLabel="Any failure aborts"
              highLabel="No batch can exceed"
              onChange={setMaxFailPercentage}
            />

            <LabRange
              label="Failures in first batch"
              value={effectiveFailures}
              output={`${effectiveFailures} failed`}
              min={0}
              max={Math.max(1, batchSize)}
              step={1}
              accent="rose"
              lowLabel="Healthy batch"
              highLabel="Whole batch"
              onChange={setFailedHosts}
            />

            <div className="rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Abort rule
              </p>
              <p className="mt-2 font-mono text-xs leading-5">
                {effectiveFailures} / {batchSize} x 100 ={' '}
                {formatPercentage(result.failurePercentage)}%
              </p>
              <p className="mt-1 text-xs leading-5">
                Abort only when {formatPercentage(result.failurePercentage)}% &gt;{' '}
                {maxFailPercentage}%.
              </p>
            </div>
          </div>
        )}
      >
        <div className="min-w-0 space-y-6" aria-live="polite">
          <div className={`rounded-md border p-5 ${verdict.className}`}>
            <div className="flex items-start gap-3">
              <VerdictIcon
                aria-hidden="true"
                className="mt-0.5 h-5 w-5 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase opacity-75">
                  Rollout verdict
                </p>
                <h4 className="mt-1 text-xl font-semibold">{verdict.title}</h4>
                <p className="mt-2 text-sm leading-6 opacity-80">
                  {verdict.detail}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Matched hosts"
              value={`${targetHosts.length}`}
              detail={pattern.expression}
              icon={Target}
              tone={result.nonProductionTargets > 0 ? 'rose' : 'blue'}
            />
            <LabMetric
              label="First batch"
              value={`${result.batchSize}`}
              detail={`serial: ${serial}`}
              icon={Boxes}
              tone="violet"
            />
            <LabMetric
              label="Changed hosts"
              value={`${result.changedHosts}`}
              detail={result.aborted ? 'Before the abort boundary' : 'Across the allowed rollout'}
              icon={CheckCircle2}
              tone="emerald"
            />
            <LabMetric
              label="Untouched targets"
              value={`${result.untouchedTargets}`}
              detail={result.aborted ? 'Protected by batch abort' : 'Rollout continues'}
              icon={Shield}
              tone={result.untouchedTargets > 0 ? 'amber' : 'neutral'}
            />
          </div>

          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Inventory execution map
                </p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  {pattern.expression}
                </h4>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                  Failures are injected at the start of batch 1. Later batches remain
                  untouched when the strict threshold is exceeded.
                </p>
              </div>
              <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                <Boxes aria-hidden="true" className="h-3.5 w-3.5" />
                {batches.length} batch{batches.length === 1 ? '' : 'es'}
              </span>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {batches.map((batch, batchIndex) => (
                <BatchCard
                  key={`batch-${batchIndex + 1}`}
                  batch={batch}
                  batchIndex={batchIndex}
                  failures={effectiveFailures}
                  aborted={result.aborted}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Boundary
              icon={Target}
              title="Inventory boundary"
              detail={`${targetHosts.length} of ${model.hosts.length} known hosts match. ${result.nonProductionTargets} matched host${result.nonProductionTargets === 1 ? '' : 's'} are outside production.`}
              tone={result.nonProductionTargets > 0 ? 'rose' : 'blue'}
            />
            <Boundary
              icon={Boxes}
              title="Batch boundary"
              detail={`At most ${result.batchSize} host${result.batchSize === 1 ? '' : 's'} enter the first batch. A smaller serial value reduces concurrent exposure.`}
              tone="violet"
            />
            <Boundary
              icon={result.aborted ? ShieldCheck : CircleAlert}
              title="Failure boundary"
              detail={result.aborted
                ? `${formatPercentage(result.failurePercentage)}% exceeds ${maxFailPercentage}%, so no later batch starts.`
                : `${formatPercentage(result.failurePercentage)}% does not exceed ${maxFailPercentage}%, so Ansible may advance.`}
              tone={result.aborted ? 'emerald' : 'amber'}
            />
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function calculateRollout({
  hosts,
  serial,
  failedHosts,
  maxFailPercentage,
}: {
  hosts: InventoryHost[];
  serial: number;
  failedHosts: number;
  maxFailPercentage: number;
}): RolloutResult {
  const batchSize = Math.min(serial, hosts.length);
  const failures = Math.min(failedHosts, batchSize);
  const failurePercentage =
    batchSize === 0 ? 0 : (failures / batchSize) * 100;
  const aborted = failures > 0 && failurePercentage > maxFailPercentage;
  const changedHosts = aborted
    ? Math.max(0, batchSize - failures)
    : Math.max(0, hosts.length - failures);

  return {
    batchSize,
    failures,
    failurePercentage,
    aborted,
    changedHosts,
    untouchedTargets: aborted ? Math.max(0, hosts.length - batchSize) : 0,
    nonProductionTargets: hosts.filter(
      (host) => host.environment !== 'production',
    ).length,
  };
}

function describeRollout(
  pattern: InventoryPattern,
  result: RolloutResult,
): {
  title: string;
  detail: string;
  icon: LucideIcon;
  className: string;
} {
  if (result.nonProductionTargets > 0) {
    return {
      title: 'The inventory expression crosses environments',
      detail:
        `${pattern.expression} includes ${result.nonProductionTargets} staging host${result.nonProductionTargets === 1 ? '' : 's'}. A safe batch policy cannot repair an unsafe target set.`,
      icon: TriangleAlert,
      className:
        'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
    };
  }

  if (result.failures === 0) {
    return {
      title: 'No failure is challenging the rollout',
      detail:
        'Inject at least one failed host to test whether the current batch size and threshold stop broader exposure.',
      icon: CircleAlert,
      className:
        'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50',
    };
  }

  if (result.aborted) {
    return {
      title: 'The first failed batch halts the rollout',
      detail:
        `${formatPercentage(result.failurePercentage)}% failed, which is greater than the configured threshold. ${result.untouchedTargets} later target${result.untouchedTargets === 1 ? '' : 's'} remain unchanged.`,
      icon: ShieldCheck,
      className:
        'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
    };
  }

  return {
    title: 'The failure policy permits the rollout to continue',
    detail:
      `${formatPercentage(result.failurePercentage)}% failed, which does not exceed the configured threshold. Later batches can still start unless another gate stops the play.`,
    icon: TriangleAlert,
    className:
      'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
  };
}

function chunkHosts(hosts: InventoryHost[], size: number): InventoryHost[][] {
  const batches: InventoryHost[][] = [];
  for (let index = 0; index < hosts.length; index += size) {
    batches.push(hosts.slice(index, index + size));
  }
  return batches;
}

function BatchCard({
  batch,
  batchIndex,
  failures,
  aborted,
}: {
  batch: InventoryHost[];
  batchIndex: number;
  failures: number;
  aborted: boolean;
}) {
  const batchProtected = aborted && batchIndex > 0;

  return (
    <div
      className={`min-w-0 rounded-md border p-4 ${
        batchProtected
          ? 'border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-950/60'
          : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-neutral-950 dark:text-white">
          Batch {batchIndex + 1}
        </p>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {batch.length} host{batch.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {batch.map((host, hostIndex) => {
          const status: HostStatus = batchIndex === 0 && hostIndex < failures
            ? 'failed'
            : batchProtected
              ? 'protected'
              : 'changed';
          return <HostCard key={host.id} host={host} status={status} />;
        })}
      </div>
    </div>
  );
}

function HostCard({
  host,
  status,
}: {
  host: InventoryHost;
  status: HostStatus;
}) {
  const meta = hostStatusMeta[status];
  const StatusIcon = meta.icon;

  return (
    <div className={`min-w-0 rounded-md border p-3 ${meta.className}`}>
      <div className="flex items-start gap-2.5">
        <StatusIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{host.label}</p>
          <p className="mt-1 text-xs opacity-75">
            {host.zone} - {host.environment}
          </p>
          <p className="mt-2 text-[10px] font-semibold uppercase opacity-75">
            {meta.label}
          </p>
        </div>
      </div>
    </div>
  );
}

function Boundary({
  icon: Icon,
  title,
  detail,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  tone: 'blue' | 'violet' | 'emerald' | 'amber' | 'rose';
}) {
  const classes = {
    blue:
      'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50',
    violet:
      'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-50',
    emerald:
      'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
    amber:
      'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
    rose:
      'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
  };

  return (
    <div className={`min-w-0 rounded-md border p-4 ${classes[tone]}`}>
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs leading-5 opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function formatPercentage(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <LearningLabBody>
      <div className="flex min-h-52 items-center justify-center p-4">
        {error ? (
          <div
            role="alert"
            className="max-w-lg rounded-md border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50"
          >
            <div className="flex items-start gap-3">
              <XCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Unable to load the lab</p>
                <p className="mt-1 text-sm leading-6 opacity-80">{error}</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-4 inline-flex h-10 items-center justify-center rounded-md border border-current px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
            <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
            Loading inventory and rollout states...
          </div>
        )}
      </div>
    </LearningLabBody>
  );
}
