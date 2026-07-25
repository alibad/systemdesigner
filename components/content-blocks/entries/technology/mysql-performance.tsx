'use client';

import { useState, type ComponentType } from 'react';
import {
  Activity,
  ChevronDown,
  CircleCheck,
  Database,
  Gauge,
  HardDrive,
  Info,
  MemoryStick,
  Server,
  SlidersHorizontal,
  TriangleAlert,
  Zap,
  type LucideProps,
} from 'lucide-react';

type QueryComplexity = 'simple' | 'medium' | 'complex' | 'reports';
type StorageEngine = 'innodb' | 'myisam';
type ResourceTone = 'blue' | 'green' | 'violet' | 'amber';

const QUERY_OPTIONS: Array<{ value: QueryComplexity; label: string; detail: string }> = [
  { value: 'simple', label: 'Simple lookups', detail: 'Indexed SELECT and INSERT' },
  { value: 'medium', label: 'Relational joins', detail: 'JOIN, GROUP BY, aggregation' },
  { value: 'complex', label: 'Complex queries', detail: 'Subqueries and analytical access' },
  { value: 'reports', label: 'Heavy reports', detail: 'Large scans and long aggregations' },
];

const RESOURCE_STYLES: Record<ResourceTone, { icon: string; fill: string; value: string }> = {
  blue: {
    icon: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    fill: 'bg-blue-600 dark:bg-blue-400',
    value: 'text-blue-700 dark:text-blue-300',
  },
  green: {
    icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
    fill: 'bg-emerald-600 dark:bg-emerald-400',
    value: 'text-emerald-700 dark:text-emerald-300',
  },
  violet: {
    icon: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
    fill: 'bg-violet-600 dark:bg-violet-400',
    value: 'text-violet-700 dark:text-violet-300',
  },
  amber: {
    icon: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    fill: 'bg-amber-500 dark:bg-amber-400',
    value: 'text-amber-700 dark:text-amber-300',
  },
};

function formatMemory(megabytes: number) {
  return megabytes >= 1024 ? `${(megabytes / 1024).toFixed(1)} GB` : `${megabytes} MB`;
}

function SliderControl({
  id,
  label,
  value,
  valueLabel,
  min,
  max,
  step,
  minLabel,
  maxLabel,
  tone,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  valueLabel: string;
  min: number;
  max: number;
  step: number;
  minLabel: string;
  maxLabel: string;
  tone: 'blue' | 'green';
  onChange: (value: number) => void;
}) {
  const percentage = ((value - min) / (max - min)) * 100;
  const fillClass = tone === 'blue' ? 'bg-blue-600' : 'bg-emerald-600';
  const thumbClass =
    tone === 'blue'
      ? '[&::-webkit-slider-thumb]:border-blue-600 [&::-moz-range-thumb]:border-blue-600'
      : '[&::-webkit-slider-thumb]:border-emerald-600 [&::-moz-range-thumb]:border-emerald-600';

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-4">
        <label htmlFor={id} className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
          {label}
        </label>
        <output className="text-lg font-semibold text-neutral-950 dark:text-white">{valueLabel}</output>
      </div>
      <div className="relative flex h-6 items-center">
        <div className="absolute h-2 w-full rounded-full bg-neutral-200 dark:bg-neutral-700" />
        <div className={`absolute h-2 rounded-full ${fillClass}`} style={{ width: `${percentage}%` }} />
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className={`absolute inset-x-0 h-6 w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
            [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:bg-transparent
            [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm
            [&::-moz-range-track]:h-2 [&::-moz-range-track]:bg-transparent
            [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-4 [&::-moz-range-thumb]:bg-white ${thumbClass}`}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

function ResourceBar({
  icon: Icon,
  label,
  value,
  detail,
  percentage,
  tone,
}: {
  icon: ComponentType<LucideProps>;
  label: string;
  value: string;
  detail: string;
  percentage: number;
  tone: ResourceTone;
}) {
  const style = RESOURCE_STYLES[tone];

  return (
    <div className="border-t border-neutral-200 py-4 first:border-t-0 first:pt-0 last:pb-0 dark:border-neutral-800">
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${style.icon}`}>
          <Icon aria-hidden="true" className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{label}</p>
            <output className={`shrink-0 text-base font-semibold ${style.value}`}>{value}</output>
          </div>
          <p className="mt-0.5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700"
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(percentage)}
          >
            <div className={`h-full rounded-full ${style.fill}`} style={{ width: `${Math.min(100, percentage)}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SummarySignal({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: ComponentType<LucideProps>;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex min-w-0 gap-3 px-5 py-4 first:pl-0 last:pr-0 md:border-l md:border-neutral-200 md:first:border-l-0 dark:md:border-neutral-800">
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500 dark:text-neutral-400" />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
        <p className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">{value}</p>
        <p className="mt-0.5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
      </div>
    </div>
  );
}

export default function MySQLPerformance() {
  const [connections, setConnections] = useState(1000);
  const [dataSize, setDataSize] = useState(100);
  const [queryComplexity, setQueryComplexity] = useState<QueryComplexity>('simple');
  const [storageEngine, setStorageEngine] = useState<StorageEngine>('innodb');

  const baseMemory = 2048;
  const memoryPerConnection = 2;
  const bufferPoolRatio = storageEngine === 'innodb' ? 0.7 : 0.3;
  const totalMemory = Math.round(baseMemory + connections * memoryPerConnection);
  const bufferPoolSize = Math.round(totalMemory * bufferPoolRatio);

  const baseQPS = storageEngine === 'innodb' ? 5000 : 3000;
  const complexityMultiplier =
    queryComplexity === 'simple'
      ? 1
      : queryComplexity === 'medium'
        ? 0.6
        : queryComplexity === 'complex'
          ? 0.3
          : 0.1;
  const maxQPS = Math.round(baseQPS * complexityMultiplier * (connections / 1000));

  const indexRatio = storageEngine === 'innodb' ? 0.25 : 0.15;
  const totalStorageNeeded = Math.round(dataSize * (1 + indexRatio));
  const connectionEfficiency = Math.round(Math.max(60, 100 - connections / 100));
  const replicationLag = dataSize > 500 ? Math.round(dataSize / 100) : 1;

  const ioMultiplier =
    queryComplexity === 'simple'
      ? 1
      : queryComplexity === 'medium'
        ? 2
        : queryComplexity === 'complex'
          ? 4
          : 6;
  const estimatedIOPS = Math.round(1000 * ioMultiplier * (connections / 1000));

  const health =
    connectionEfficiency >= 85 && replicationLag <= 2
      ? {
          label: 'Balanced envelope',
          icon: CircleCheck,
          className: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300',
        }
      : connectionEfficiency >= 70 && replicationLag <= 5
        ? {
            label: 'Review headroom',
            icon: TriangleAlert,
            className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300',
          }
        : {
            label: 'High pressure',
            icon: TriangleAlert,
            className: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300',
          };
  const HealthIcon = health.icon;
  const selectedQuery = QUERY_OPTIONS.find((option) => option.value === queryComplexity)!;

  return (
    <section className="not-prose my-9 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <header className="flex flex-col gap-4 bg-neutral-950 px-6 py-5 text-white sm:flex-row sm:items-center sm:justify-between dark:bg-black">
        <div className="flex items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-blue-500 text-white">
            <Database aria-hidden="true" className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-white">MySQL performance planner</h2>
            <p className="mt-1 text-sm text-neutral-400">Single-node workload and resource estimate</p>
          </div>
        </div>
        <div className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${health.className}`}>
          <HealthIcon aria-hidden="true" className="h-4 w-4" />
          {health.label}
        </div>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="p-6 md:p-7 lg:border-r lg:border-neutral-200 dark:lg:border-neutral-800">
          <div className="mb-7 flex items-center gap-2">
            <SlidersHorizontal aria-hidden="true" className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-base font-semibold text-neutral-950 dark:text-white">Workload profile</h3>
          </div>

          <div className="space-y-7">
            <SliderControl
              id="mysql-connections"
              label="Concurrent connections"
              value={connections}
              valueLabel={connections.toLocaleString()}
              min={100}
              max={10000}
              step={100}
              minLabel="100"
              maxLabel="10,000"
              tone="blue"
              onChange={setConnections}
            />

            <SliderControl
              id="mysql-data-size"
              label="Primary dataset"
              value={dataSize}
              valueLabel={`${dataSize.toLocaleString()} GB`}
              min={1}
              max={1000}
              step={10}
              minLabel="1 GB"
              maxLabel="1 TB"
              tone="green"
              onChange={setDataSize}
            />

            <div>
              <label htmlFor="mysql-query-complexity" className="mb-2 block text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                Query profile
              </label>
              <div className="relative">
                <select
                  id="mysql-query-complexity"
                  value={queryComplexity}
                  onChange={(event) => setQueryComplexity(event.target.value as QueryComplexity)}
                  className="min-h-11 w-full appearance-none rounded-md border border-neutral-300 bg-white px-3 py-2 pr-10 text-sm font-medium text-neutral-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                >
                  {QUERY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              </div>
              <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{selectedQuery.detail}</p>
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200">Storage engine</legend>
              <div className="grid grid-cols-2 overflow-hidden rounded-md border border-neutral-300 dark:border-neutral-700">
                {([
                  { value: 'innodb' as const, label: 'InnoDB', detail: 'Transactions' },
                  { value: 'myisam' as const, label: 'MyISAM', detail: 'Legacy reads' },
                ]).map((option) => {
                  const active = storageEngine === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setStorageEngine(option.value)}
                      className={`min-h-14 px-3 py-2 text-left transition-colors first:border-r first:border-neutral-300 dark:first:border-neutral-700 ${
                        active
                          ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200'
                          : 'bg-white text-neutral-600 hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <span className="block text-sm font-semibold">{option.label}</span>
                      <span className="mt-0.5 block text-xs opacity-75">{option.detail}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>
        </div>

        <div className="bg-neutral-50 p-6 md:p-7 dark:bg-neutral-900/50">
          <div className="mb-6 border-b border-neutral-200 pb-6 dark:border-neutral-800">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              <Gauge aria-hidden="true" className="h-4 w-4" />
              Modeled query capacity
            </div>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <output className="text-5xl font-semibold text-blue-700 dark:text-blue-300">
                {maxQPS.toLocaleString()}
              </output>
              <span className="text-base font-medium text-neutral-600 dark:text-neutral-300">queries / second</span>
            </div>
            <div
              className="mt-5 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700"
              role="progressbar"
              aria-label="Modeled query capacity"
              aria-valuemin={0}
              aria-valuemax={50000}
              aria-valuenow={maxQPS}
            >
              <div className="h-full rounded-full bg-blue-600 dark:bg-blue-400" style={{ width: `${Math.min(100, (maxQPS / 50000) * 100)}%` }} />
            </div>
            <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {storageEngine === 'innodb' ? 'InnoDB' : 'MyISAM'} with {selectedQuery.label.toLowerCase()} at {connections.toLocaleString()} concurrent connections
            </p>
          </div>

          <ResourceBar
            icon={MemoryStick}
            label="Memory envelope"
            value={formatMemory(totalMemory)}
            detail={`${totalMemory.toLocaleString()} MB including a 2 GB base and connection overhead`}
            percentage={(totalMemory / 32768) * 100}
            tone="green"
          />
          <ResourceBar
            icon={Database}
            label="Buffer pool target"
            value={formatMemory(bufferPoolSize)}
            detail={`${Math.round(bufferPoolRatio * 100)}% of modeled memory for ${storageEngine === 'innodb' ? 'InnoDB pages and indexes' : 'key and table caches'}`}
            percentage={bufferPoolRatio * 100}
            tone="violet"
          />
          <ResourceBar
            icon={Zap}
            label="Storage I/O demand"
            value={`${estimatedIOPS.toLocaleString()} IOPS`}
            detail={`${ioMultiplier}x I/O factor for the selected query profile`}
            percentage={(estimatedIOPS / 60000) * 100}
            tone="amber"
          />
        </div>
      </div>

      <div className="border-t border-neutral-200 px-6 dark:border-neutral-800">
        <div className="grid md:grid-cols-3">
          <SummarySignal
            icon={HardDrive}
            label="Storage footprint"
            value={`${totalStorageNeeded.toLocaleString()} GB`}
            detail={`${Math.round(dataSize * indexRatio).toLocaleString()} GB estimated index overhead`}
          />
          <SummarySignal
            icon={Server}
            label="Connection efficiency"
            value={`${connectionEfficiency}%`}
            detail={`${connections.toLocaleString()} active connections modeled`}
          />
          <SummarySignal
            icon={Activity}
            label="Replication lag"
            value={`~${replicationLag}s`}
            detail="Directional estimate from dataset size"
          />
        </div>
      </div>

      <div className="flex gap-3 border-t border-neutral-200 bg-blue-50 px-6 py-4 text-sm leading-6 text-blue-900 dark:border-neutral-800 dark:bg-blue-950/30 dark:text-blue-200">
        <Info aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />
        <p>Planning model only. Validate memory, throughput, and I/O with production-like data, query plans, and load tests.</p>
      </div>
    </section>
  );
}
