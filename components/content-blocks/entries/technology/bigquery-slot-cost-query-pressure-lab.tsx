'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Clock3,
  DollarSign,
  Gauge,
  Layers3,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type WorkloadId = 'steady-bi' | 'mixed' | 'transform-burst';

type WorkloadProfile = {
  id: WorkloadId;
  label: string;
  detail: string;
  queriesPerMinute: number;
  slotSecondsPerQuery: number;
  reservedSlots: number;
};

const profiles: WorkloadProfile[] = [
  {
    id: 'steady-bi',
    label: 'Steady BI dashboards',
    detail: 'Frequent, moderate queries with predictable demand.',
    queriesPerMinute: 24,
    slotSecondsPerQuery: 90,
    reservedSlots: 100,
  },
  {
    id: 'mixed',
    label: 'BI plus ad hoc analysis',
    detail: 'Interactive work shares capacity with heavier analyst queries.',
    queriesPerMinute: 45,
    slotSecondsPerQuery: 180,
    reservedSlots: 200,
  },
  {
    id: 'transform-burst',
    label: 'Scheduled transform burst',
    detail: 'Fewer jobs arrive together, but each consumes much more slot time.',
    queriesPerMinute: 18,
    slotSecondsPerQuery: 900,
    reservedSlots: 300,
  },
];

const hoursPerPlanningMonth = 730;

function money(value: number, digits = 0) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: digits,
  });
}

export default function BigQuerySlotCostQueryPressureLab() {
  const [profileId, setProfileId] = useState<WorkloadId>('mixed');
  const [queriesPerMinute, setQueriesPerMinute] = useState(45);
  const [slotSecondsPerQuery, setSlotSecondsPerQuery] = useState(180);
  const [reservedSlots, setReservedSlots] = useState(200);
  const [slotHourRate, setSlotHourRate] = useState(0.04);

  const selectProfile = (profile: WorkloadProfile) => {
    setProfileId(profile.id);
    setQueriesPerMinute(profile.queriesPerMinute);
    setSlotSecondsPerQuery(profile.slotSecondsPerQuery);
    setReservedSlots(profile.reservedSlots);
  };

  const reset = () => {
    const profile = profiles[1];
    setProfileId(profile.id);
    setQueriesPerMinute(profile.queriesPerMinute);
    setSlotSecondsPerQuery(profile.slotSecondsPerQuery);
    setReservedSlots(profile.reservedSlots);
    setSlotHourRate(0.04);
  };

  const model = useMemo(() => {
    const demandedSlots = (queriesPerMinute * slotSecondsPerQuery) / 60;
    const utilization = demandedSlots / reservedSlots;
    const throughputPerMinute = (reservedSlots * 60) / slotSecondsPerQuery;
    const backlogPerMinute = Math.max(0, queriesPerMinute - throughputPerMinute);
    const monthlyCapacityCost = reservedSlots * slotHourRate * hoursPerPlanningMonth;
    const monthlyQueries = queriesPerMinute * 60 * hoursPerPlanningMonth;
    const costPerThousandQueries = monthlyCapacityCost / (monthlyQueries / 1_000);
    const headroomSlots = reservedSlots - demandedSlots;

    if (utilization > 1) {
      return {
        demandedSlots,
        utilization,
        throughputPerMinute,
        backlogPerMinute,
        monthlyCapacityCost,
        costPerThousandQueries,
        headroomSlots,
        status: 'Queue grows',
        verdict: `The workload demands ${Math.ceil(demandedSlots).toLocaleString()} average slots, more than the ${reservedSlots.toLocaleString()}-slot reservation can supply. About ${backlogPerMinute.toFixed(1)} queries join the queue each minute in this steady-state model.`,
        action: 'Reduce slot work per query, move the burst to another reservation or time window, or add capacity before treating latency as a SQL-only problem.',
        tone: 'rose' as const,
      };
    }

    if (utilization > 0.85) {
      return {
        demandedSlots,
        utilization,
        throughputPerMinute,
        backlogPerMinute,
        monthlyCapacityCost,
        costPerThousandQueries,
        headroomSlots,
        status: 'Burst risk',
        verdict: `Average demand fits, but only ${Math.max(0, Math.floor(headroomSlots)).toLocaleString()} slots remain for bursts, skewed stages, or overlapping workloads. Tail latency can rise before the average reaches 100%.`,
        action: 'Inspect wait time and reservation-level demand, then isolate important BI traffic or add measured headroom.',
        tone: 'amber' as const,
      };
    }

    if (utilization < 0.4) {
      return {
        demandedSlots,
        utilization,
        throughputPerMinute,
        backlogPerMinute,
        monthlyCapacityCost,
        costPerThousandQueries,
        headroomSlots,
        status: 'Cost-heavy',
        verdict: `The reservation is lightly loaded: about ${Math.round((1 - utilization) * 100)}% of modeled baseline capacity is unused at this steady demand. That headroom may be intentional, but it has a visible capacity cost.`,
        action: 'Confirm the low utilization persists across business peaks before lowering the baseline or relying more on autoscaling.',
        tone: 'violet' as const,
      };
    }

    return {
      demandedSlots,
      utilization,
      throughputPerMinute,
      backlogPerMinute,
      monthlyCapacityCost,
      costPerThousandQueries,
      headroomSlots,
      status: 'Balanced',
      verdict: `Average demand uses ${Math.round(utilization * 100)}% of the modeled reservation, leaving ${Math.floor(headroomSlots).toLocaleString()} slots of headroom for ordinary variation.`,
      action: 'Validate the model against p95 query latency, wait time, and minute-level slot demand before changing production capacity.',
      tone: 'emerald' as const,
    };
  }, [queriesPerMinute, reservedSlots, slotHourRate, slotSecondsPerQuery]);

  const pressureWidth = Math.min(100, model.utilization * 100);

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Slot, cost, and query-pressure lab"
        title="Turn observed slot time into a capacity decision"
        description="Choose a workload, then change arrival rate, slot work, reservation size, and your planning rate. The model connects query pressure to queue growth and baseline capacity cost."
        icon={Gauge}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Workload shape
              </legend>
              <div className="mt-3 space-y-2">
                {profiles.map((profile) => (
                  <LabChoice
                    key={profile.id}
                    selected={profileId === profile.id}
                    label={profile.label}
                    detail={profile.detail}
                    icon={profile.id === 'steady-bi' ? Activity : profile.id === 'mixed' ? Layers3 : Clock3}
                    accent="cyan"
                    onClick={() => selectProfile(profile)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Query arrivals"
              value={queriesPerMinute}
              output={`${queriesPerMinute} queries/min`}
              min={5}
              max={120}
              step={1}
              accent="blue"
              lowLabel="Quiet"
              highLabel="Concurrent"
              onChange={setQueriesPerMinute}
            />
            <LabRange
              label="Observed slot work"
              value={slotSecondsPerQuery}
              output={`${slotSecondsPerQuery} slot-sec/query`}
              min={30}
              max={1_200}
              step={30}
              accent="violet"
              lowLabel="Pruned query"
              highLabel="Heavy stages"
              onChange={setSlotSecondsPerQuery}
            />
            <LabRange
              label="Reservation baseline"
              value={reservedSlots}
              output={`${reservedSlots} slots`}
              min={50}
              max={1_000}
              step={50}
              accent="emerald"
              lowLabel="Lower cost"
              highLabel="More headroom"
              onChange={setReservedSlots}
            />
            <LabRange
              label="Planning rate"
              value={slotHourRate}
              output={`${money(slotHourRate, 2)}/slot-hour`}
              min={0.02}
              max={0.12}
              step={0.01}
              accent="amber"
              lowLabel="Contract assumption"
              highLabel="Conservative case"
              onChange={setSlotHourRate}
            />

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              Use your own edition, region, and commitment rate. The model assumes steady arrivals and a fixed baseline for 730 hours; it is a planning model, not a billing quote.
            </p>
          </div>
        }
      >
        <div data-content-block="technology/bigquery-slot-cost-query-pressure-lab" className="min-w-0" aria-live="polite">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <LabMetric
              label="Average slot demand"
              value={`${Math.ceil(model.demandedSlots).toLocaleString()} slots`}
              detail={`${queriesPerMinute}/min x ${slotSecondsPerQuery} slot-sec / 60`}
              icon={Activity}
              tone={model.tone}
            />
            <LabMetric
              label="Reservation pressure"
              value={`${Math.round(model.utilization * 100)}%`}
              detail={`${model.throughputPerMinute.toFixed(1)} queries/min modeled capacity`}
              icon={Gauge}
              tone={model.tone}
            />
            <LabMetric
              label="Monthly baseline"
              value={money(model.monthlyCapacityCost)}
              detail={`About ${money(model.costPerThousandQueries, 2)} per 1,000 queries at steady load`}
              icon={DollarSign}
              tone="amber"
            />
            <LabMetric
              label="Capacity verdict"
              value={model.status}
              detail={model.backlogPerMinute > 0 ? `${model.backlogPerMinute.toFixed(1)} queued/min` : `${Math.max(0, Math.floor(model.headroomSlots))} slots headroom`}
              icon={model.utilization > 1 ? CircleAlert : CheckCircle2}
              tone={model.tone}
            />
          </div>

          <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
            <div className="flex items-center justify-between gap-4 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              <span>Average demand against baseline</span>
              <span className="tabular-nums">{Math.ceil(model.demandedSlots)} / {reservedSlots} slots</span>
            </div>
            <div className="mt-3 h-4 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" role="img" aria-label={`Average slot demand is ${Math.round(model.utilization * 100)} percent of reservation capacity`}>
              <div
                className={`h-full rounded-full transition-[width] ${model.utilization > 1 ? 'bg-rose-500' : model.utilization > 0.85 ? 'bg-amber-500' : model.utilization < 0.4 ? 'bg-violet-500' : 'bg-emerald-500'}`}
                style={{ width: `${pressureWidth}%` }}
              />
            </div>
            {model.utilization > 1 ? (
              <p className="mt-2 text-xs font-medium text-rose-700 dark:text-rose-300">
                Demand beyond the right edge becomes queue growth; a full bar does not mean the excess disappeared.
              </p>
            ) : null}
          </section>

          <section className={`mt-5 border-l-4 p-4 ${model.tone === 'rose' ? 'border-rose-500 bg-rose-50 text-rose-950 dark:bg-rose-950/30 dark:text-rose-50' : model.tone === 'amber' ? 'border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-50' : model.tone === 'violet' ? 'border-violet-500 bg-violet-50 text-violet-950 dark:bg-violet-950/30 dark:text-violet-50' : 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50'}`}>
            <p className="text-sm font-semibold">{model.verdict}</p>
            <p className="mt-2 text-sm leading-6 opacity-85">{model.action}</p>
          </section>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
