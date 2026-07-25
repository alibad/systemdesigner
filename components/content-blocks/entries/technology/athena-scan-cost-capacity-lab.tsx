'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  CircleDollarSign,
  Database,
  Gauge,
  ShieldCheck,
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
type Profile = {
  id: string;
  label: string;
  detail: string;
  logicalInputGb: number;
  scanReductionPct: number;
  queriesPerDay: number;
  peakConcurrency: number;
  dpuPerQuery: number;
  scanCutoffGb: number;
  reservedDpu: number;
  capacityHoursPerDay: number;
};
type ScanCostModel = {
  assumptions: {
    onDemandUsdPerTb: number;
    capacityUsdPerDpuHour: number;
    daysPerMonth: number;
  };
  bounds: {
    logicalInputGb: Bound;
    scanReductionPct: Bound;
    queriesPerDay: Bound;
    peakConcurrency: Bound;
    scanCutoffGb: Bound;
    reservedDpu: Bound;
    capacityHoursPerDay: Bound;
  };
  profiles: Profile[];
};

const DEFAULT_DATA_FILE =
  '/api/content/technology/athena/data/scan-cost-capacity-model.json';

function money(value: number, maximumFractionDigits = 0) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits,
  });
}

function isScanCostModel(value: unknown): value is ScanCostModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ScanCostModel>;
  return Boolean(
    candidate.assumptions
      && candidate.bounds
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length > 0,
  );
}

export default function AthenaScanCostCapacityLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ScanCostModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [profileId, setProfileId] = useState('');
  const [logicalInputGb, setLogicalInputGb] = useState(600);
  const [scanReductionPct, setScanReductionPct] = useState(96);
  const [queriesPerDay, setQueriesPerDay] = useState(1600);
  const [peakConcurrency, setPeakConcurrency] = useState(24);
  const [dpuPerQuery, setDpuPerQuery] = useState(6);
  const [scanCutoffGb, setScanCutoffGb] = useState(50);
  const [reservedDpu, setReservedDpu] = useState(160);
  const [capacityHoursPerDay, setCapacityHoursPerDay] = useState(10);

  useEffect(() => {
    let active = true;

    async function load() {
      setError(null);
      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isScanCostModel(payload)) throw new Error('The scan planning model is incomplete.');
        if (!active) return;
        setData(payload);
        applyProfile(payload.profiles[1] ?? payload.profiles[0]);
      } catch (loadError) {
        if (!active) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the scan model.');
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  function applyProfile(profile: Profile) {
    setProfileId(profile.id);
    setLogicalInputGb(profile.logicalInputGb);
    setScanReductionPct(profile.scanReductionPct);
    setQueriesPerDay(profile.queriesPerDay);
    setPeakConcurrency(profile.peakConcurrency);
    setDpuPerQuery(profile.dpuPerQuery);
    setScanCutoffGb(profile.scanCutoffGb);
    setReservedDpu(profile.reservedDpu);
    setCapacityHoursPerDay(profile.capacityHoursPerDay);
  }

  const result = useMemo(() => {
    if (!data) return null;
    const scannedGbPerQuery = logicalInputGb * (1 - scanReductionPct / 100);
    const costPerQuery = (scannedGbPerQuery / 1000) * data.assumptions.onDemandUsdPerTb;
    const monthlyScannedTb =
      (scannedGbPerQuery / 1000) * queriesPerDay * data.assumptions.daysPerMonth;
    const monthlyOnDemandCost = monthlyScannedTb * data.assumptions.onDemandUsdPerTb;
    const peakDpuDemand = peakConcurrency * dpuPerQuery;
    const reservationPressure = peakDpuDemand / reservedDpu;
    const monthlyReservationBaseline =
      reservedDpu
      * capacityHoursPerDay
      * data.assumptions.daysPerMonth
      * data.assumptions.capacityUsdPerDpuHour;
    const cutoffExceeded = scannedGbPerQuery > scanCutoffGb;

    if (cutoffExceeded) {
      return {
        scannedGbPerQuery,
        costPerQuery,
        monthlyScannedTb,
        monthlyOnDemandCost,
        peakDpuDemand,
        reservationPressure,
        monthlyReservationBaseline,
        cutoffExceeded,
        status: 'Query canceled',
        tone: 'rose' as const,
        verdict: `The modeled scan is ${Math.round(scannedGbPerQuery - scanCutoffGb).toLocaleString()} GB above the workgroup cutoff. The guardrail stops this query, so the SQL or physical layout must narrow before it can run.`,
      };
    }

    if (reservationPressure > 1) {
      return {
        scannedGbPerQuery,
        costPerQuery,
        monthlyScannedTb,
        monthlyOnDemandCost,
        peakDpuDemand,
        reservationPressure,
        monthlyReservationBaseline,
        cutoffExceeded,
        status: 'Peak queues',
        tone: 'rose' as const,
        verdict: `The peak asks for ${peakDpuDemand} DPU while the reservation provides ${reservedDpu}. Admission control, schedule isolation, less work per query, or more measured capacity must absorb the excess.`,
      };
    }

    if (reservationPressure > 0.85) {
      return {
        scannedGbPerQuery,
        costPerQuery,
        monthlyScannedTb,
        monthlyOnDemandCost,
        peakDpuDemand,
        reservationPressure,
        monthlyReservationBaseline,
        cutoffExceeded,
        status: 'Thin headroom',
        tone: 'amber' as const,
        verdict: `Peak demand fits, but only ${reservedDpu - peakDpuDemand} DPU remain for skew, overlap, or slower queries. Validate queue time and p95 runtime before calling this capacity healthy.`,
      };
    }

    return {
      scannedGbPerQuery,
      costPerQuery,
      monthlyScannedTb,
      monthlyOnDemandCost,
      peakDpuDemand,
      reservationPressure,
      monthlyReservationBaseline,
      cutoffExceeded,
      status: reservationPressure < 0.4 ? 'Capacity-heavy' : 'Within bounds',
      tone: reservationPressure < 0.4 ? ('violet' as const) : ('emerald' as const),
      verdict: reservationPressure < 0.4
        ? `The peak uses only ${Math.round(reservationPressure * 100)}% of the modeled reservation. That may be deliberate headroom, but the capacity baseline makes its cost visible.`
        : `The scan stays below the workgroup cutoff and modeled peak demand uses ${Math.round(reservationPressure * 100)}% of reserved capacity. Verify both estimates against execution statistics.`,
    };
  }, [
    capacityHoursPerDay,
    data,
    dpuPerQuery,
    logicalInputGb,
    peakConcurrency,
    queriesPerDay,
    reservedDpu,
    scanCutoffGb,
    scanReductionPct,
  ]);

  return (
    <div data-content-block="technology/athena-scan-cost-capacity-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Scan economics and peak capacity lab"
          title="Bound each query, then size the peak"
          description="Start from logical input, apply measured scan reduction, and set a workgroup cutoff. Then compare peak DPU demand with a capacity reservation and its active-hours baseline."
          icon={CircleDollarSign}
          accent="amber"
          onReset={data ? () => applyProfile(data.profiles[1] ?? data.profiles[0]) : undefined}
        />

        {!data || !result ? (
          <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Workload shape
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.profiles.map((profile) => (
                      <LabChoice
                        key={profile.id}
                        selected={profile.id === profileId}
                        label={profile.label}
                        detail={profile.detail}
                        icon={profile.id === 'bi-dashboards' ? Activity : Database}
                        accent="amber"
                        onClick={() => applyProfile(profile)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="Logical input per query"
                  value={logicalInputGb}
                  output={`${logicalInputGb.toLocaleString()} GB`}
                  {...data.bounds.logicalInputGb}
                  accent="blue"
                  lowLabel="Narrow source"
                  highLabel="Large retention scan"
                  onChange={(value) => { setProfileId('custom'); setLogicalInputGb(value); }}
                />
                <LabRange
                  label="Pruning and format reduction"
                  value={scanReductionPct}
                  output={`${scanReductionPct}%`}
                  {...data.bounds.scanReductionPct}
                  accent="emerald"
                  lowLabel="Broad row scan"
                  highLabel="Measured narrow scan"
                  onChange={(value) => { setProfileId('custom'); setScanReductionPct(value); }}
                />
                <LabRange
                  label="Queries per day"
                  value={queriesPerDay}
                  output={queriesPerDay.toLocaleString()}
                  {...data.bounds.queriesPerDay}
                  accent="violet"
                  lowLabel="Occasional"
                  highLabel="Repeated"
                  onChange={(value) => { setProfileId('custom'); setQueriesPerDay(value); }}
                />
                <LabRange
                  label="Peak concurrency"
                  value={peakConcurrency}
                  output={`${peakConcurrency} queries`}
                  {...data.bounds.peakConcurrency}
                  accent="cyan"
                  lowLabel="Serial"
                  highLabel="Burst"
                  onChange={(value) => { setProfileId('custom'); setPeakConcurrency(value); }}
                />
                <LabRange
                  label="Workgroup scan cutoff"
                  value={scanCutoffGb}
                  output={`${scanCutoffGb.toLocaleString()} GB`}
                  {...data.bounds.scanCutoffGb}
                  accent="rose"
                  lowLabel="Strict"
                  highLabel="Permissive"
                  onChange={(value) => { setProfileId('custom'); setScanCutoffGb(value); }}
                />
                <LabRange
                  label="Reserved capacity"
                  value={reservedDpu}
                  output={`${reservedDpu} DPU`}
                  {...data.bounds.reservedDpu}
                  accent="blue"
                  lowLabel="Lower baseline"
                  highLabel="More peak capacity"
                  onChange={(value) => { setProfileId('custom'); setReservedDpu(value); }}
                />
                <LabRange
                  label="Reservation active each day"
                  value={capacityHoursPerDay}
                  output={`${capacityHoursPerDay} hours`}
                  {...data.bounds.capacityHoursPerDay}
                  accent="amber"
                  lowLabel="Short window"
                  highLabel="Always active"
                  onChange={(value) => { setProfileId('custom'); setCapacityHoursPerDay(value); }}
                />
              </div>
            )}
          >
            <div className="min-w-0" aria-live="polite">
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <LabMetric
                  label="Scan per query"
                  value={`${result.scannedGbPerQuery.toFixed(result.scannedGbPerQuery < 10 ? 1 : 0)} GB`}
                  detail={`${scanReductionPct}% less than ${logicalInputGb.toLocaleString()} GB logical input`}
                  icon={Database}
                  tone={result.cutoffExceeded ? 'rose' : 'blue'}
                />
                <LabMetric
                  label="On-demand estimate"
                  value={`${money(result.costPerQuery, 2)} / query`}
                  detail={`${result.monthlyScannedTb.toLocaleString('en-US', { maximumFractionDigits: 1 })} TB and ${money(result.monthlyOnDemandCost)} per ${data.assumptions.daysPerMonth}-day month`}
                  icon={CircleDollarSign}
                  tone="amber"
                />
                <LabMetric
                  label="Peak capacity pressure"
                  value={`${Math.round(result.reservationPressure * 100)}%`}
                  detail={`${result.peakDpuDemand} demanded / ${reservedDpu} reserved DPU`}
                  icon={Gauge}
                  tone={result.tone}
                />
                <LabMetric
                  label="Planning verdict"
                  value={result.status}
                  detail={`${money(result.monthlyReservationBaseline)} reservation baseline at ${capacityHoursPerDay} hours/day`}
                  icon={result.tone === 'rose' ? CircleAlert : CheckCircle2}
                  tone={result.tone}
                />
              </div>

              <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
                <div className="flex items-center justify-between gap-4 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  <span>Modeled scan against workgroup cutoff</span>
                  <span className="text-right tabular-nums">
                    {result.scannedGbPerQuery.toFixed(1)} / {scanCutoffGb.toLocaleString()} GB
                  </span>
                </div>
                <div
                  className="mt-3 h-4 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
                  role="img"
                  aria-label={`The query scans ${result.scannedGbPerQuery.toFixed(1)} gigabytes against a ${scanCutoffGb} gigabyte cutoff`}
                >
                  <div
                    className={`h-full rounded-full transition-[width] ${result.cutoffExceeded ? 'bg-rose-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, (result.scannedGbPerQuery / scanCutoffGb) * 100)}%` }}
                  />
                </div>
              </section>

              <section className={`mt-5 border-l-4 p-4 ${result.tone === 'rose' ? 'border-rose-500 bg-rose-50 text-rose-950 dark:bg-rose-950/30 dark:text-rose-50' : result.tone === 'amber' ? 'border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-50' : result.tone === 'violet' ? 'border-violet-500 bg-violet-50 text-violet-950 dark:bg-violet-950/30 dark:text-violet-50' : 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50'}`}>
                <div className="flex items-start gap-3">
                  {result.tone === 'rose' ? <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                  <div>
                    <p className="text-sm font-semibold">{result.verdict}</p>
                    <p className="mt-2 text-xs leading-5 opacity-80">
                      This model uses {money(data.assumptions.onDemandUsdPerTb, 2)}/TB and {money(data.assumptions.capacityUsdPerDpuHour, 2)}/DPU-hour as editable-source planning assumptions. S3, Glue, Lambda, transfer, and result-storage charges are outside the comparison.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  if (!error) {
    return <div className="min-h-[520px] animate-pulse bg-neutral-100 dark:bg-neutral-900" aria-label="Loading Athena scan model" />;
  }

  return (
    <div className="p-5 md:p-6" role="alert">
      <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50">
        <p className="text-sm font-semibold">Scan planning model unavailable</p>
        <p className="mt-2 text-xs leading-5 opacity-80">{error}</p>
        <button type="button" onClick={onRetry} className="mt-4 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400">
          Retry
        </button>
      </div>
    </div>
  );
}
