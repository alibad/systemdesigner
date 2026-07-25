'use client';

import { useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Gauge,
  Hash,
  KeyRound,
  Network,
  ShieldCheck,
  TriangleAlert,
  UsersRound,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type ShardKey = 'tenant' | 'order' | 'created-at';

const SHARD_CAPACITY = 45_000;
const IDEAL_SHARE = 25;

const keyOptions: Array<{
  id: ShardKey;
  label: string;
  detail: string;
  icon: typeof KeyRound;
  accent: 'cyan' | 'violet' | 'amber';
}> = [
  {
    id: 'tenant',
    label: 'Hash tenant_id',
    detail: 'Keeps a tenant local, but one large tenant remains an indivisible hot key.',
    icon: UsersRound,
    accent: 'cyan',
  },
  {
    id: 'order',
    label: 'Hash order_id',
    detail: 'Spreads writes evenly, but tenant history and policy checks contact every shard.',
    icon: Hash,
    accent: 'violet',
  },
  {
    id: 'created-at',
    label: 'Range by created_at',
    detail: 'Makes time ranges direct, but nearly all current writes land on the newest range.',
    icon: CalendarClock,
    accent: 'amber',
  },
];

function formatQps(value: number) {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value / 1000)}k/s`;
}

export default function DatabaseShardingKeyDistributionLab() {
  const [shardKey, setShardKey] = useState<ShardKey>('tenant');
  const [totalQps, setTotalQps] = useState(120_000);
  const [largestTenantShare, setLargestTenantShare] = useState(24);

  const model = useMemo(() => {
    const tenantBaseShare = (100 - largestTenantShare) / 4;
    const shares =
      shardKey === 'tenant'
        ? [tenantBaseShare, tenantBaseShare + largestTenantShare, tenantBaseShare, tenantBaseShare]
        : shardKey === 'order'
          ? [24, 26, 25, 25]
          : [2, 2, 2, 94];
    const loads = shares.map((share) => Math.round(totalQps * (share / 100)));
    const maxQps = Math.max(...loads);
    const maxShare = Math.max(...shares);
    const maxIndex = loads.indexOf(maxQps);
    const imbalance = maxShare / IDEAL_SHARE;
    const capacityExceeded = maxQps > SHARD_CAPACITY;
    const distributionSkewed = maxShare >= 45;
    const tenantFanout = shardKey === 'tenant' ? 1 : 4;
    const tenantLocality = shardKey === 'tenant' ? 96 : shardKey === 'order' ? 63 : 28;
    const largestTenantQps = Math.round(totalQps * (largestTenantShare / 100));
    const scaleMax = Math.max(SHARD_CAPACITY * 1.15, maxQps * 1.08);

    const result = capacityExceeded
      ? `Shard ${maxIndex + 1} exceeds the ${formatQps(SHARD_CAPACITY)} planning limit. Adding idle shards does not help unless this key can be split or reassigned.`
      : distributionSkewed
        ? `Shard ${maxIndex + 1} carries ${maxShare.toFixed(0)}% of writes. It still fits today, but failover and migration headroom are already concentrated on one owner.`
        : shardKey === 'order'
          ? 'Write load is balanced, but a tenant-scoped read fans out to all four shards. The key traded locality for distribution.'
          : 'The selected key fits the modeled load, but keep measuring the largest key because growth and retries can change the distribution.';

    return {
      capacityExceeded,
      distributionSkewed,
      imbalance,
      largestTenantQps,
      loads,
      maxIndex,
      maxQps,
      maxShare,
      result,
      scaleMax,
      shares,
      tenantFanout,
      tenantLocality,
    };
  }, [largestTenantShare, shardKey, totalQps]);

  const statusTone = model.capacityExceeded ? 'rose' : model.distributionSkewed ? 'amber' : 'emerald';
  const StatusIcon = model.capacityExceeded || model.distributionSkewed ? TriangleAlert : CheckCircle2;

  return (
    <div data-content-block="reference/database-sharding-key-distribution-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Shard-key distribution lab"
          title="Balance load without hiding query fanout"
          description="Model one four-shard order service. Key choice changes placement and tenant locality; demand and skew reveal whether the busiest owner still has operational headroom."
          icon={KeyRound}
          accent="cyan"
          onReset={() => {
            setShardKey('tenant');
            setTotalQps(120_000);
            setLargestTenantShare(24);
          }}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Candidate shard key
                </legend>
                <div className="mt-3 space-y-2">
                  {keyOptions.map((option) => (
                    <LabChoice
                      key={option.id}
                      selected={shardKey === option.id}
                      label={option.label}
                      detail={option.detail}
                      icon={option.icon}
                      accent={option.accent}
                      onClick={() => setShardKey(option.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Peak write demand"
                value={totalQps}
                output={formatQps(totalQps)}
                min={40_000}
                max={180_000}
                step={10_000}
                accent="blue"
                lowLabel="40k/s"
                highLabel="180k/s"
                onChange={setTotalQps}
              />

              <LabRange
                label="Largest tenant share"
                value={largestTenantShare}
                output={`${largestTenantShare}%`}
                min={4}
                max={60}
                step={2}
                accent="amber"
                lowLabel="many similar tenants"
                highLabel="one dominant tenant"
                onChange={setLargestTenantShare}
              />
            </div>
          }
        >
          <div aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Busiest shard"
                value={formatQps(model.maxQps)}
                detail={`Shard ${model.maxIndex + 1} receives ${model.maxShare.toFixed(0)}% of writes.`}
                icon={Gauge}
                tone={statusTone}
              />
              <LabMetric
                label="Load imbalance"
                value={`${model.imbalance.toFixed(2)}x`}
                detail="Maximum share divided by the ideal 25%."
                icon={Network}
                tone={model.imbalance > 1.75 ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Tenant query fanout"
                value={`${model.tenantFanout} shard${model.tenantFanout === 1 ? '' : 's'}`}
                detail={`${model.tenantLocality}% of modeled tenant operations stay local.`}
                icon={UsersRound}
                tone={model.tenantFanout === 1 ? 'emerald' : 'violet'}
              />
              <LabMetric
                label="Largest tenant"
                value={formatQps(model.largestTenantQps)}
                detail={shardKey === 'tenant' ? 'This load cannot be split by adding tenant buckets.' : 'Its orders spread, but tenant reads must merge results.'}
                icon={Hash}
                tone={largestTenantShare >= 40 ? 'amber' : 'blue'}
              />
            </div>

            <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">Per-shard write load</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    The marker shows the {formatQps(SHARD_CAPACITY)} planning limit for replication, failure, and migration headroom.
                  </p>
                </div>
                <span className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                  Total {formatQps(totalQps)}
                </span>
              </div>

              <div className="mt-5 space-y-4">
                {model.loads.map((load, index) => {
                  const loadWidth = Math.max(2, (load / model.scaleMax) * 100);
                  const capacityPosition = (SHARD_CAPACITY / model.scaleMax) * 100;
                  const overloaded = load > SHARD_CAPACITY;
                  return (
                    <div key={`shard-${index + 1}`}>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                        <span className="font-semibold text-neutral-700 dark:text-neutral-200">Shard {index + 1}</span>
                        <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
                          {formatQps(load)} · {model.shares[index].toFixed(0)}%
                        </span>
                      </div>
                      <div
                        className="relative h-7 overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"
                        role="img"
                        aria-label={`Shard ${index + 1}: ${formatQps(load)}, ${model.shares[index].toFixed(0)} percent of writes${overloaded ? ', above planning limit' : ''}`}
                      >
                        <div
                          className={`h-full rounded-sm ${overloaded ? 'bg-rose-500 dark:bg-rose-600' : index === model.maxIndex ? 'bg-amber-400 dark:bg-amber-500' : 'bg-cyan-400 dark:bg-cyan-600'}`}
                          style={{ width: `${Math.min(loadWidth, 100)}%` }}
                        />
                        <div
                          className="absolute inset-y-0 w-0.5 bg-neutral-700 dark:bg-white"
                          style={{ left: `${capacityPosition}%` }}
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className={`mt-5 rounded-md border p-4 ${
                model.capacityExceeded
                  ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
                  : model.distributionSkewed
                    ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <StatusIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">
                    {model.capacityExceeded
                      ? 'The owner is beyond its planning envelope'
                      : model.distributionSkewed
                        ? 'The fleet average hides concentrated pressure'
                        : 'Distribution fits, with a locality trade-off'}
                  </p>
                  <p className="mt-1 text-sm leading-6 opacity-85">{model.result}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              This teaching model assumes four equal physical shards and one fixed write-capacity limit. Real placement decisions also use bytes, CPU, IOPS, locks, replicas, burst duration, and failure headroom.
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
