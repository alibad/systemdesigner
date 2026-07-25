'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Database,
  Gauge,
  Layers3,
  type LucideIcon,
} from 'lucide-react';
import {
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

const SECONDS_PER_DAY = 86_400;
const PROVIDER_CAPACITY_PER_SECOND = 90_000;
const LEDGER_CAPACITY_PER_SECOND = 240_000;
const CAPTURE_RATE = 0.85;
const REFUND_RATE = 0.03;
const TARGET_UTILIZATION = 70;

type CapacityStatus = 'healthy' | 'tight' | 'overloaded';

function compact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString();
}

function CapacityBar({
  label,
  load,
  capacity,
  utilization,
  icon: Icon,
}: {
  label: string;
  load: number;
  capacity: number;
  utilization: number;
  icon: LucideIcon;
}) {
  const overloaded = utilization > 100;
  const tight = utilization > TARGET_UTILIZATION;
  const barClass = overloaded
    ? 'bg-rose-600 dark:bg-rose-400'
    : tight
      ? 'bg-amber-500 dark:bg-amber-400'
      : 'bg-emerald-600 dark:bg-emerald-400';
  const status = overloaded ? 'Overloaded' : tight ? 'Tight' : 'Healthy';

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-white">
          <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-neutral-500 dark:text-neutral-400" />
          {label}
        </span>
        <span className="text-xs font-semibold tabular-nums text-neutral-600 dark:text-neutral-300">
          {status}: {utilization.toFixed(0)}%
        </span>
      </div>
      <div
        className="mt-3 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
        role="progressbar"
        aria-label={`${label} utilization`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, Math.round(utilization))}
        aria-valuetext={`${utilization.toFixed(0)} percent, ${status.toLowerCase()}`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${barClass}`}
          style={{ width: `${Math.min(100, utilization)}%` }}
        />
      </div>
      <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
        {compact(load)}/s modeled load against {compact(capacity)}/s provisioned capacity.
      </p>
    </div>
  );
}

export default function PaymentSystemCapacityLab() {
  const [dailyAttemptsMillions, setDailyAttemptsMillions] = useState(100);
  const [peakMultiplier, setPeakMultiplier] = useState(10);
  const [providerRetryPercent, setProviderRetryPercent] = useState(5);
  const [eventDeliveries, setEventDeliveries] = useState(4);
  const [eventCapacity, setEventCapacity] = useState(60_000);

  const model = useMemo(() => {
    const dailyAttempts = dailyAttemptsMillions * 1_000_000;
    const averageAttempts = dailyAttempts / SECONDS_PER_DAY;
    const peakAttempts = averageAttempts * peakMultiplier;
    const providerCalls = peakAttempts * (1 + providerRetryPercent / 100);
    const captureRows = peakAttempts * CAPTURE_RATE * 2;
    const refundRows = peakAttempts * CAPTURE_RATE * REFUND_RATE * 2;
    const ledgerRows = captureRows + refundRows;
    const eventIngress = peakAttempts * eventDeliveries;
    const queueGrowthPerSecond = Math.max(0, eventIngress - eventCapacity);
    const queueAfterFiveMinutes = queueGrowthPerSecond * 300;
    const providerUtilization = (providerCalls / PROVIDER_CAPACITY_PER_SECOND) * 100;
    const ledgerUtilization = (ledgerRows / LEDGER_CAPACITY_PER_SECOND) * 100;
    const eventUtilization = (eventIngress / eventCapacity) * 100;
    const providerConcurrency = providerCalls * 0.8;
    const stages = [
      { label: 'provider adapter', utilization: providerUtilization },
      { label: 'ledger writer', utilization: ledgerUtilization },
      { label: 'event consumers', utilization: eventUtilization },
    ];
    const bottleneck = stages.reduce((highest, stage) => (
      stage.utilization > highest.utilization ? stage : highest
    ));
    const highestUtilization = bottleneck.utilization;
    const status: CapacityStatus = highestUtilization > 100
      ? 'overloaded'
      : highestUtilization > TARGET_UTILIZATION
        ? 'tight'
        : 'healthy';

    return {
      averageAttempts,
      peakAttempts,
      providerCalls,
      ledgerRows,
      eventIngress,
      queueAfterFiveMinutes,
      providerUtilization,
      ledgerUtilization,
      eventUtilization,
      providerConcurrency,
      bottleneck,
      status,
    };
  }, [dailyAttemptsMillions, eventCapacity, eventDeliveries, peakMultiplier, providerRetryPercent]);

  const reset = () => {
    setDailyAttemptsMillions(100);
    setPeakMultiplier(10);
    setProviderRetryPercent(5);
    setEventDeliveries(4);
    setEventCapacity(60_000);
  };

  const statusStyle = model.status === 'healthy'
    ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
    : model.status === 'tight'
      ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
      : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40';
  const StatusIcon = model.status === 'healthy' ? CheckCircle2 : AlertTriangle;

  return (
    <div data-content-block="practice/payment-system-capacity-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Payment capacity lab"
          title="Find the first bottleneck across three kinds of work"
          description="Change business volume, peak skew, retry amplification, and asynchronous fanout. Provider calls, ledger rows, and event deliveries respond differently even though they begin with the same payment attempt."
          icon={Gauge}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <LabRange
                label="Daily payment attempts"
                value={dailyAttemptsMillions}
                output={`${dailyAttemptsMillions}M`}
                min={20}
                max={1_000}
                step={20}
                lowLabel="20M"
                highLabel="1B"
                accent="cyan"
                onChange={setDailyAttemptsMillions}
              />
              <LabRange
                label="Peak-to-average multiplier"
                value={peakMultiplier}
                output={`${peakMultiplier.toFixed(1)}x`}
                min={2}
                max={15}
                step={0.5}
                lowLabel="2x"
                highLabel="15x"
                accent="blue"
                onChange={setPeakMultiplier}
              />
              <LabRange
                label="Extra provider calls"
                value={providerRetryPercent}
                output={`${providerRetryPercent}%`}
                min={0}
                max={30}
                step={1}
                lowLabel="No retries"
                highLabel="Retry pressure"
                accent="rose"
                onChange={setProviderRetryPercent}
              />
              <LabRange
                label="Async deliveries per attempt"
                value={eventDeliveries}
                output={eventDeliveries.toFixed(0)}
                min={2}
                max={8}
                step={1}
                lowLabel="Core events"
                highLabel="Wide fanout"
                accent="violet"
                onChange={setEventDeliveries}
              />
              <LabRange
                label="Provisioned event capacity"
                value={eventCapacity}
                output={`${compact(eventCapacity)}/s`}
                min={20_000}
                max={250_000}
                step={10_000}
                lowLabel="20K/s"
                highLabel="250K/s"
                accent="emerald"
                onChange={setEventCapacity}
              />
            </div>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Peak attempts"
              value={`${compact(model.peakAttempts)}/s`}
              detail={`${compact(model.averageAttempts)}/s daily average`}
              icon={CreditCard}
              tone="blue"
            />
            <LabMetric
              label="Provider calls"
              value={`${compact(model.providerCalls)}/s`}
              detail={`${compact(model.providerConcurrency)} in flight at 800 ms average`}
              icon={Activity}
              tone="rose"
            />
            <LabMetric
              label="Ledger rows"
              value={`${compact(model.ledgerRows)}/s`}
              detail="Capture pairs plus modeled refund reversals"
              icon={Database}
              tone="emerald"
            />
            <LabMetric
              label="Event deliveries"
              value={`${compact(model.eventIngress)}/s`}
              detail={`${eventDeliveries} downstream deliveries per attempt`}
              icon={Layers3}
              tone="violet"
            />
          </div>

          <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Stage utilization
                </p>
                <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                  Green protects the 70% operating target; amber consumes failure headroom; red exceeds modeled capacity.
                </p>
              </div>
              <p className="shrink-0 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                Capacity is measured per second
              </p>
            </div>
            <div className="mt-4 grid gap-3">
              <CapacityBar
                label="Provider adapter"
                load={model.providerCalls}
                capacity={PROVIDER_CAPACITY_PER_SECOND}
                utilization={model.providerUtilization}
                icon={CreditCard}
              />
              <CapacityBar
                label="Ledger writer"
                load={model.ledgerRows}
                capacity={LEDGER_CAPACITY_PER_SECOND}
                utilization={model.ledgerUtilization}
                icon={Database}
              />
              <CapacityBar
                label="Event consumers"
                load={model.eventIngress}
                capacity={eventCapacity}
                utilization={model.eventUtilization}
                icon={Layers3}
              />
            </div>
          </div>

          <div className={`mt-5 rounded-md border p-4 ${statusStyle}`} aria-live="polite">
            <div className="flex items-start gap-3">
              <StatusIcon
                aria-hidden="true"
                className={`mt-0.5 h-5 w-5 shrink-0 ${
                  model.status === 'healthy'
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : model.status === 'tight'
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-rose-700 dark:text-rose-300'
                }`}
              />
              <div className="min-w-0">
                <p className="font-semibold text-neutral-950 dark:text-white">
                  {model.status === 'healthy'
                    ? 'Failure headroom is protected'
                    : model.status === 'tight'
                      ? `The ${model.bottleneck.label} is inside capacity but too tight`
                      : `The ${model.bottleneck.label} is overloaded`}
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                  {model.queueAfterFiveMinutes > 0
                    ? `Event consumers add ${compact(model.queueAfterFiveMinutes)} queued deliveries in five minutes. Raise sustained consumer capacity above live ingress before relying on catch-up.`
                    : `Event consumers keep up with live ingress. The ${model.bottleneck.label} is still the highest-utilized stage at ${model.bottleneck.utilization.toFixed(0)}%.`}
                </p>
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            Model assumptions: 85% of attempts capture, 3% of captures refund, each capture or refund posts two ledger rows, and provider calls average 800 ms. Validate every constant with production traces and load tests.
          </p>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
