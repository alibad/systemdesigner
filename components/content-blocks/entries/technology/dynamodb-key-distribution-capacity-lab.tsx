'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Boxes,
  CheckCircle2,
  Database,
  Gauge,
  KeyRound,
  LoaderCircle,
  Network,
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

type Bound = {
  min: number;
  max: number;
  step: number;
};

type CapacityMode = 'on-demand' | 'provisioned';

type WorkloadProfile = {
  id: string;
  label: string;
  detail: string;
  totalWritesPerSecond: number;
  itemSizeKb: number;
  hotTrafficPercent: number;
  writeShards: number;
  capacityMode: CapacityMode;
  provisionedWcu: number;
};

type CapacityModel = {
  blockId: string;
  title: string;
  description: string;
  partitionWriteLimitWcu: number;
  bounds: {
    totalWritesPerSecond: Bound;
    itemSizeKb: Bound;
    hotTrafficPercent: Bound;
    provisionedWcu: Bound;
  };
  shardOptions: number[];
  profiles: WorkloadProfile[];
};

type PressureState = 'healthy' | 'thin' | 'hot-key' | 'table-capacity';

const BLOCK_ID = 'technology/dynamodb-key-distribution-capacity-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/dynamodb/data/key-distribution-capacity-model.json';
const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
});

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return isFiniteNumber(candidate.min)
    && isFiniteNumber(candidate.max)
    && isFiniteNumber(candidate.step)
    && candidate.min < candidate.max
    && candidate.step > 0;
}

function isCapacityMode(value: unknown): value is CapacityMode {
  return value === 'on-demand' || value === 'provisioned';
}

function isWorkloadProfile(value: unknown): value is WorkloadProfile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WorkloadProfile>;
  return typeof candidate.id === 'string'
    && typeof candidate.label === 'string'
    && typeof candidate.detail === 'string'
    && isFiniteNumber(candidate.totalWritesPerSecond)
    && isFiniteNumber(candidate.itemSizeKb)
    && isFiniteNumber(candidate.hotTrafficPercent)
    && isFiniteNumber(candidate.writeShards)
    && isCapacityMode(candidate.capacityMode)
    && isFiniteNumber(candidate.provisionedWcu);
}

function isCapacityModel(value: unknown): value is CapacityModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapacityModel>;
  return Boolean(
    candidate.blockId === BLOCK_ID
      && typeof candidate.title === 'string'
      && typeof candidate.description === 'string'
      && isFiniteNumber(candidate.partitionWriteLimitWcu)
      && candidate.partitionWriteLimitWcu > 0
      && candidate.bounds
      && isBound(candidate.bounds.totalWritesPerSecond)
      && isBound(candidate.bounds.itemSizeKb)
      && isBound(candidate.bounds.hotTrafficPercent)
      && isBound(candidate.bounds.provisionedWcu)
      && Array.isArray(candidate.shardOptions)
      && candidate.shardOptions.length >= 3
      && candidate.shardOptions.every(
        (option) => isFiniteNumber(option) && option >= 1,
      )
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length >= 3
      && candidate.profiles.every(isWorkloadProfile),
  );
}

export default function DynamoDBKeyDistributionCapacityLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<CapacityModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [profileId, setProfileId] = useState('');
  const [totalWritesPerSecond, setTotalWritesPerSecond] = useState(2500);
  const [itemSizeKb, setItemSizeKb] = useState(1);
  const [hotTrafficPercent, setHotTrafficPercent] = useState(45);
  const [writeShards, setWriteShards] = useState(1);
  const [capacityMode, setCapacityMode] = useState<CapacityMode>('on-demand');
  const [provisionedWcu, setProvisionedWcu] = useState(5000);

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
        if (!isCapacityModel(payload)) {
          throw new Error('The key-distribution capacity model is incomplete.');
        }
        setModel(payload);
        applyProfile(payload.profiles[0]);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the key-distribution model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  function applyProfile(profile: WorkloadProfile) {
    setProfileId(profile.id);
    setTotalWritesPerSecond(profile.totalWritesPerSecond);
    setItemSizeKb(profile.itemSizeKb);
    setHotTrafficPercent(profile.hotTrafficPercent);
    setWriteShards(profile.writeShards);
    setCapacityMode(profile.capacityMode);
    setProvisionedWcu(profile.provisionedWcu);
  }

  function customize(update: () => void) {
    setProfileId('custom');
    update();
  }

  const result = useMemo(() => {
    const partitionWriteLimitWcu = model?.partitionWriteLimitWcu ?? 1000;
    const writeUnitsPerItem = Math.max(1, Math.ceil(itemSizeKb));
    const totalWcu = totalWritesPerSecond * writeUnitsPerItem;
    const hotFamilyWcu = totalWcu * (hotTrafficPercent / 100);
    const hottestLogicalShardWcu = hotFamilyWcu / writeShards;
    const hotPressure = hottestLogicalShardWcu / partitionWriteLimitWcu;
    const tablePressure = capacityMode === 'provisioned'
      ? totalWcu / provisionedWcu
      : 0;

    let state: PressureState = 'healthy';
    if (hotPressure > 1) {
      state = 'hot-key';
    } else if (capacityMode === 'provisioned' && tablePressure > 1) {
      state = 'table-capacity';
    } else if (hotPressure > 0.75 || tablePressure > 0.8) {
      state = 'thin';
    }

    const title = state === 'healthy'
      ? 'The modeled write path has distribution and capacity headroom'
      : state === 'thin'
        ? 'The design fits, but the operating margin is thin'
        : state === 'hot-key'
          ? 'One logical key family can still exceed a partition ceiling'
          : 'The provisioned table capacity is below aggregate demand';

    const explanation = state === 'healthy'
      ? `The hottest logical shard carries about ${numberFormatter.format(hottestLogicalShardWcu)} WCU/s, below the ${numberFormatter.format(partitionWriteLimitWcu)} WCU/s partition design ceiling. Load-test the real key distribution before release.`
      : state === 'thin'
        ? `The design is below its modeled ceiling, but a traffic-skew or item-size change could remove the remaining margin. Alert on throttling reasons and Contributor Insights hot-key evidence.`
        : state === 'hot-key'
          ? `Aggregate table capacity cannot rescue a key range that asks for ${numberFormatter.format(hottestLogicalShardWcu)} WCU/s. Increase safe write sharding, reduce that key's rate, or change the access model.`
          : `The keys distribute, but ${numberFormatter.format(totalWcu)} WCU/s exceeds the configured ${numberFormatter.format(provisionedWcu)} WCU/s. Raise capacity before the burst or choose a mode that matches the traffic shape.`;

    return {
      explanation,
      hotFamilyWcu,
      hotPressure,
      hottestLogicalShardWcu,
      partitionWriteLimitWcu,
      state,
      tablePressure,
      title,
      totalWcu,
      writeUnitsPerItem,
    };
  }, [
    capacityMode,
    hotTrafficPercent,
    itemSizeKb,
    model,
    provisionedWcu,
    totalWritesPerSecond,
    writeShards,
  ]);

  if (!model) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Key distribution and capacity lab"
            title="Can the hottest key range carry the writes?"
            description="Loading workload profiles, capacity-unit rules, and partition bounds."
            icon={KeyRound}
            accent="blue"
          />
          <LoadState
            error={error}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        </LearningLab>
      </div>
    );
  }

  const stateTone = result.state === 'healthy'
    ? 'emerald'
    : result.state === 'thin'
      ? 'amber'
      : 'rose';
  const StateIcon = result.state === 'healthy' ? CheckCircle2 : TriangleAlert;
  const visibleShardCount = Math.min(writeShards, 8);

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Key distribution and capacity lab"
          title={model.title}
          description={model.description}
          icon={KeyRound}
          accent="blue"
          onReset={() => applyProfile(model.profiles[0])}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Workload shape
                </legend>
                <div className="mt-3 space-y-2">
                  {model.profiles.map((profile) => (
                    <LabChoice
                      key={profile.id}
                      selected={profile.id === profileId}
                      label={profile.label}
                      detail={profile.detail}
                      icon={profile.id === 'distributed-users' ? Network : Activity}
                      accent="blue"
                      onClick={() => applyProfile(profile)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Writes per second"
                value={totalWritesPerSecond}
                output={numberFormatter.format(totalWritesPerSecond)}
                min={model.bounds.totalWritesPerSecond.min}
                max={model.bounds.totalWritesPerSecond.max}
                step={model.bounds.totalWritesPerSecond.step}
                accent="blue"
                lowLabel="Background"
                highLabel="Burst"
                onChange={(value) => customize(() => setTotalWritesPerSecond(value))}
              />

              <LabRange
                label="Item size"
                value={itemSizeKb}
                output={`${numberFormatter.format(itemSizeKb)} KB`}
                min={model.bounds.itemSizeKb.min}
                max={model.bounds.itemSizeKb.max}
                step={model.bounds.itemSizeKb.step}
                accent="violet"
                lowLabel="Compact"
                highLabel="Costly"
                onChange={(value) => customize(() => setItemSizeKb(value))}
              />

              <LabRange
                label="Traffic on one key family"
                value={hotTrafficPercent}
                output={`${hotTrafficPercent}%`}
                min={model.bounds.hotTrafficPercent.min}
                max={model.bounds.hotTrafficPercent.max}
                step={model.bounds.hotTrafficPercent.step}
                accent="amber"
                lowLabel="Distributed"
                highLabel="Concentrated"
                onChange={(value) => customize(() => setHotTrafficPercent(value))}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Write-shard suffixes
                </legend>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {model.shardOptions.map((option) => (
                    <LabChoice
                      key={option}
                      selected={writeShards === option}
                      label={`${option} ${option === 1 ? 'bucket' : 'buckets'}`}
                      detail={option === 1 ? 'No write sharding' : `Suffix 0-${option - 1}`}
                      icon={Boxes}
                      accent="violet"
                      onClick={() => customize(() => setWriteShards(option))}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Table capacity mode
                </legend>
                <div className="mt-3 grid gap-2">
                  <LabChoice
                    selected={capacityMode === 'on-demand'}
                    label="On-demand"
                    detail="No table-level provisioned target in this model; key-range and account limits still apply."
                    icon={Activity}
                    accent="emerald"
                    onClick={() => customize(() => setCapacityMode('on-demand'))}
                  />
                  <LabChoice
                    selected={capacityMode === 'provisioned'}
                    label="Provisioned"
                    detail="Compare aggregate WCU demand with the configured table capacity."
                    icon={Gauge}
                    accent="amber"
                    onClick={() => customize(() => setCapacityMode('provisioned'))}
                  />
                </div>
              </fieldset>

              {capacityMode === 'provisioned' ? (
                <LabRange
                  label="Provisioned write capacity"
                  value={provisionedWcu}
                  output={`${numberFormatter.format(provisionedWcu)} WCU`}
                  min={model.bounds.provisionedWcu.min}
                  max={model.bounds.provisionedWcu.max}
                  step={model.bounds.provisionedWcu.step}
                  accent="amber"
                  lowLabel="Cost bound"
                  highLabel="More headroom"
                  onChange={(value) => customize(() => setProvisionedWcu(value))}
                />
              ) : null}
            </div>
          )}
        >
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Write demand"
                value={`${numberFormatter.format(result.totalWcu)} WCU/s`}
                detail={`${result.writeUnitsPerItem} WCU per item after 1 KB rounding`}
                icon={Activity}
                tone="blue"
              />
              <LabMetric
                label="Hot key family"
                value={`${numberFormatter.format(result.hotFamilyWcu)} WCU/s`}
                detail={`${hotTrafficPercent}% of aggregate write demand`}
                icon={KeyRound}
                tone="violet"
              />
              <LabMetric
                label="Hottest logical shard"
                value={`${numberFormatter.format(result.hottestLogicalShardWcu)} WCU/s`}
                detail={`Compared with ${numberFormatter.format(result.partitionWriteLimitWcu)} WCU/s per-partition design ceiling`}
                icon={Gauge}
                tone={stateTone}
              />
              <LabMetric
                label="Capacity mode"
                value={capacityMode === 'on-demand' ? 'On-demand' : 'Provisioned'}
                detail={capacityMode === 'on-demand'
                  ? 'Pay per request; distribution still matters'
                  : `${Math.round(result.tablePressure * 100)}% of configured WCU`}
                icon={Database}
                tone={capacityMode === 'on-demand' ? 'emerald' : 'amber'}
              />
            </div>

            <section
              className={`rounded-md border p-5 ${
                result.state === 'healthy'
                  ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35'
                  : result.state === 'thin'
                    ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/35'
                    : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35'
              }`}
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                <StateIcon
                  aria-hidden="true"
                  className={`mt-0.5 h-5 w-5 shrink-0 ${
                    result.state === 'healthy'
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : result.state === 'thin'
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-rose-700 dark:text-rose-300'
                  }`}
                />
                <div>
                  <h4 className="font-semibold text-neutral-950 dark:text-white">
                    {result.title}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    {result.explanation}
                  </p>
                </div>
              </div>
            </section>

            <section>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-neutral-950 dark:text-white">
                    See the concentrated load split
                  </h4>
                  <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                    These are application-level suffix buckets. DynamoDB hashes their
                    full partition-key values; they are not a promise of one physical
                    partition per bucket.
                  </p>
                </div>
                <span className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                  {writeShards} logical {writeShards === 1 ? 'bucket' : 'buckets'}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/30">
                  <p className="text-xs font-semibold uppercase text-rose-700 dark:text-rose-300">
                    Before sharding
                  </p>
                  <p className="mt-2 text-xl font-semibold text-rose-950 dark:text-rose-50">
                    {numberFormatter.format(result.hotFamilyWcu)} WCU/s on one key
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-rose-100 dark:bg-rose-950">
                    <div
                      className="h-full rounded-full bg-rose-500 transition-[width] duration-300 motion-reduce:transition-none"
                      style={{
                        width: `${Math.min(
                          100,
                          (result.hotFamilyWcu / result.partitionWriteLimitWcu) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
                  <p className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-300">
                    After sharding
                  </p>
                  <p className="mt-2 text-xl font-semibold text-blue-950 dark:text-blue-50">
                    {numberFormatter.format(result.hottestLogicalShardWcu)} WCU/s per bucket
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-[width] duration-300 motion-reduce:transition-none"
                      style={{
                        width: `${Math.min(100, result.hotPressure * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
                {Array.from({ length: visibleShardCount }, (_, index) => (
                  <div
                    key={index}
                    className="rounded-md border border-neutral-200 bg-white p-3 text-center dark:border-neutral-800 dark:bg-neutral-950"
                  >
                    <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                      suffix {index}
                    </p>
                    <p className="mt-1 text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">
                      {numberFormatter.format(result.hottestLogicalShardWcu)}
                    </p>
                  </div>
                ))}
              </div>
              {writeShards > visibleShardCount ? (
                <p className="mt-2 text-right text-xs text-neutral-500 dark:text-neutral-400">
                  + {writeShards - visibleShardCount} more logical buckets
                </p>
              ) : null}
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-56 items-center justify-center p-6">
      <div className="max-w-md text-center">
        {error ? (
          <TriangleAlert
            aria-hidden="true"
            className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-400"
          />
        ) : (
          <LoaderCircle
            aria-hidden="true"
            className="mx-auto h-7 w-7 animate-spin text-blue-600 motion-reduce:animate-none dark:text-blue-400"
          />
        )}
        <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
          {error ?? 'Loading the DynamoDB workload model.'}
        </p>
        {error ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-white dark:text-neutral-950"
          >
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}
