'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  Cpu,
  Database,
  Gauge,
  HardDrive,
  Leaf,
  Network,
  RefreshCw,
  TriangleAlert,
  Zap,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bound = { min: number; max: number; step: number };
type ServiceProfile = {
  id: string;
  label: string;
  detail: string;
  outcomeLabel: string;
  suggestedEnergyWhPerThousand: number;
};
type LifecycleModel = {
  title: string;
  description: string;
  defaults: {
    profileId: string;
    monthlyOutcomesMillions: number;
    energyWhPerThousand: number;
    gridIntensityGco2ePerKwh: number;
    annualHardwareKgco2e: number;
    monthlyDataNetworkKgco2e: number;
  };
  bounds: {
    monthlyOutcomesMillions: Bound;
    energyWhPerThousand: Bound;
    gridIntensityGco2ePerKwh: Bound;
    annualHardwareKgco2e: Bound;
    monthlyDataNetworkKgco2e: Bound;
  };
  profiles: ServiceProfile[];
};

type LedgerTermProps = {
  label: string;
  detail: string;
  value: number;
  total: number;
  tone: 'blue' | 'violet' | 'amber';
  icon: typeof Zap;
};

const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/regenerative-ai-systems/data/lifecycle-impact-model.json';

const compact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return typeof candidate.min === 'number'
    && typeof candidate.max === 'number'
    && typeof candidate.step === 'number';
}

function isProfile(value: unknown): value is ServiceProfile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ServiceProfile>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && candidate.outcomeLabel
      && typeof candidate.suggestedEnergyWhPerThousand === 'number',
  );
}

function isLifecycleModel(value: unknown): value is LifecycleModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<LifecycleModel>;
  const defaults = candidate.defaults;
  return Boolean(
    candidate.title
      && candidate.description
      && defaults?.profileId
      && typeof defaults.monthlyOutcomesMillions === 'number'
      && typeof defaults.energyWhPerThousand === 'number'
      && typeof defaults.gridIntensityGco2ePerKwh === 'number'
      && typeof defaults.annualHardwareKgco2e === 'number'
      && typeof defaults.monthlyDataNetworkKgco2e === 'number'
      && isBound(candidate.bounds?.monthlyOutcomesMillions)
      && isBound(candidate.bounds?.energyWhPerThousand)
      && isBound(candidate.bounds?.gridIntensityGco2ePerKwh)
      && isBound(candidate.bounds?.annualHardwareKgco2e)
      && isBound(candidate.bounds?.monthlyDataNetworkKgco2e)
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length >= 3
      && candidate.profiles.every(isProfile),
  );
}

function formatKg(value: number) {
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)} tCO2e`;
  return `${value.toFixed(value >= 100 ? 0 : 1)} kgCO2e`;
}

export default function RegenerativeAISystemsCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LifecycleModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isLifecycleModel(payload)) {
          throw new Error('The lifecycle model does not match the expected contract.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load lifecycle data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />;
  }

  return <LifecycleLedger data={data} />;
}

function LifecycleLedger({ data }: { data: LifecycleModel }) {
  const [profileId, setProfileId] = useState(data.defaults.profileId);
  const [monthlyOutcomesMillions, setMonthlyOutcomesMillions] = useState(
    data.defaults.monthlyOutcomesMillions,
  );
  const [energyWhPerThousand, setEnergyWhPerThousand] = useState(
    data.defaults.energyWhPerThousand,
  );
  const [gridIntensity, setGridIntensity] = useState(
    data.defaults.gridIntensityGco2ePerKwh,
  );
  const [annualHardware, setAnnualHardware] = useState(
    data.defaults.annualHardwareKgco2e,
  );
  const [monthlyDataNetwork, setMonthlyDataNetwork] = useState(
    data.defaults.monthlyDataNetworkKgco2e,
  );

  const profile = data.profiles.find((item) => item.id === profileId) ?? data.profiles[0];
  const result = useMemo(() => {
    const outcomes = monthlyOutcomesMillions * 1_000_000;
    const energyKwh = outcomes / 1_000 * energyWhPerThousand / 1_000;
    const operational = energyKwh * gridIntensity / 1_000;
    const hardware = annualHardware / 12;
    const total = operational + hardware + monthlyDataNetwork;
    const intensity = total * 1_000 / (outcomes / 1_000);
    const operationalShare = total > 0 ? operational / total * 100 : 0;
    const boundaryComplete = annualHardware > 0 && monthlyDataNetwork > 0;

    return {
      boundaryComplete,
      energyKwh,
      hardware,
      intensity,
      operational,
      operationalShare,
      outcomes,
      total,
    };
  }, [annualHardware, energyWhPerThousand, gridIntensity, monthlyDataNetwork, monthlyOutcomesMillions]);

  function chooseProfile(next: ServiceProfile) {
    setProfileId(next.id);
    setEnergyWhPerThousand(next.suggestedEnergyWhPerThousand);
  }

  function reset() {
    setProfileId(data.defaults.profileId);
    setMonthlyOutcomesMillions(data.defaults.monthlyOutcomesMillions);
    setEnergyWhPerThousand(data.defaults.energyWhPerThousand);
    setGridIntensity(data.defaults.gridIntensityGco2ePerKwh);
    setAnnualHardware(data.defaults.annualHardwareKgco2e);
    setMonthlyDataNetwork(data.defaults.monthlyDataNetworkKgco2e);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Lifecycle impact lab"
        title={data.title}
        description={data.description}
        icon={Leaf}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Functional unit
              </legend>
              <div className="mt-3 space-y-2">
                {data.profiles.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === profile.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'sensor-triage' ? Network : item.id === 'vision-inspection' ? Cpu : Database}
                    accent={item.id === 'vision-inspection' ? 'violet' : item.id === 'sensor-triage' ? 'emerald' : 'blue'}
                    onClick={() => chooseProfile(item)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Monthly useful outcomes"
              value={monthlyOutcomesMillions}
              output={`${monthlyOutcomesMillions}M`}
              {...data.bounds.monthlyOutcomesMillions}
              accent="blue"
              lowLabel="1 million"
              highLabel="100 million"
              onChange={setMonthlyOutcomesMillions}
            />
            <LabRange
              label="Measured energy"
              value={energyWhPerThousand}
              output={`${energyWhPerThousand} Wh / 1k`}
              {...data.bounds.energyWhPerThousand}
              accent="cyan"
              lowLabel="efficient path"
              highLabel="compute-heavy path"
              onChange={setEnergyWhPerThousand}
            />
            <LabRange
              label="Electricity carbon intensity"
              value={gridIntensity}
              output={`${gridIntensity} gCO2e / kWh`}
              {...data.bounds.gridIntensityGco2ePerKwh}
              accent="amber"
              lowLabel="lower-carbon supply"
              highLabel="higher-carbon supply"
              onChange={setGridIntensity}
            />
            <LabRange
              label="Annual allocated hardware"
              value={annualHardware}
              output={formatKg(annualHardware)}
              {...data.bounds.annualHardwareKgco2e}
              accent="violet"
              lowLabel="not allocated"
              highLabel="hardware-heavy"
              onChange={setAnnualHardware}
            />
            <LabRange
              label="Monthly data and network"
              value={monthlyDataNetwork}
              output={formatKg(monthlyDataNetwork)}
              {...data.bounds.monthlyDataNetworkKgco2e}
              accent="rose"
              lowLabel="not measured"
              highLabel="data-heavy"
              onChange={setMonthlyDataNetwork}
            />
          </div>
        }
      >
        <div className="space-y-6" aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Monthly footprint"
              value={formatKg(result.total)}
              detail="Absolute total inside this model boundary"
              icon={Gauge}
              tone={result.boundaryComplete ? 'blue' : 'amber'}
            />
            <LabMetric
              label="Impact intensity"
              value={`${result.intensity.toFixed(1)} g`}
              detail={`Per 1,000 ${profile.outcomeLabel}`}
              icon={BarChart3}
              tone="cyan"
            />
            <LabMetric
              label="Operational share"
              value={`${result.operationalShare.toFixed(0)}%`}
              detail={`${compact.format(result.energyKwh)} kWh per month`}
              icon={Zap}
              tone="amber"
            />
            <LabMetric
              label="Annualized total"
              value={formatKg(result.total * 12)}
              detail="Assumes the selected month repeats"
              icon={Activity}
              tone="violet"
            />
          </div>

          <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex items-start gap-3">
              <HardDrive aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" />
              <div>
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">One total, three visible terms</p>
                <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  The bars share one scale. A smaller operational bar does not make hardware, storage, network, or total demand disappear.
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              <LedgerTerm label="Operational electricity" detail={`${compact.format(result.energyKwh)} kWh x ${gridIntensity} gCO2e/kWh`} value={result.operational} total={result.total} tone="blue" icon={Zap} />
              <LedgerTerm label="Allocated hardware" detail="Embodied impact spread across 12 months" value={result.hardware} total={result.total} tone="violet" icon={Cpu} />
              <LedgerTerm label="Data and network" detail="Measured or allocated monthly term" value={monthlyDataNetwork} total={result.total} tone="amber" icon={Network} />
            </div>
          </section>

          <div className={`rounded-md border p-4 ${result.boundaryComplete ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50' : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'}`}>
            <div className="flex items-start gap-3">
              {result.boundaryComplete ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
              <div>
                <p className="text-sm font-semibold">{result.boundaryComplete ? 'The modeled lifecycle boundary is populated' : 'Zero currently means unmeasured, not impact-free'}</p>
                <p className="mt-1 text-sm leading-6 opacity-80">
                  {result.boundaryComplete
                    ? 'Track this absolute total beside the per-outcome intensity. Neither value includes a claimed external environmental benefit.'
                    : 'Allocate hardware and data/network terms before comparing releases or making a lifecycle claim.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function LedgerTerm({ label, detail, value, total, tone, icon: Icon }: LedgerTermProps) {
  const width = total > 0 ? Math.max(2, value / total * 100) : 0;
  const barClass = {
    blue: 'bg-blue-500 dark:bg-blue-400',
    violet: 'bg-violet-500 dark:bg-violet-400',
    amber: 'bg-amber-500 dark:bg-amber-400',
  }[tone];

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-2">
          <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500 dark:text-neutral-400" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
            <p className="mt-0.5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
          </div>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">{formatKg(value)}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-hidden="true">
        <div className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${barClass}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <LearningLab>
      <LearningLabHeader eyebrow="Lifecycle impact lab" title="Build a lifecycle impact ledger" description="Loading the lesson-owned accounting model." icon={Leaf} accent="cyan" />
      <LearningLabBody>
        <div className="flex min-h-64 items-center justify-center text-center">
          {error ? (
            <div className="max-w-md" role="alert">
              <TriangleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
              <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">Lifecycle data could not be loaded</p>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{error}</p>
              <button type="button" onClick={onRetry} className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-500">
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Try again
              </button>
            </div>
          ) : (
            <div role="status">
              <Activity aria-hidden="true" className="mx-auto h-7 w-7 animate-pulse text-cyan-500 motion-reduce:animate-none" />
              <p className="mt-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">Loading lifecycle model...</p>
            </div>
          )}
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
