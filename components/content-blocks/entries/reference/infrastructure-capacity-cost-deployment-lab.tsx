'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleDollarSign,
  Cloud,
  Gauge,
  Globe2,
  Network,
  Server,
  ShieldCheck,
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

type ShapeId = 'single-zone' | 'multi-zone' | 'dual-region';

type DeploymentShape = {
  id: ShapeId;
  label: string;
  detail: string;
  domains: number;
  domainLabel: string;
  minReplicas: number;
  fixedMonthlyUsd: number;
  failureLabel: string;
  releasePlan: string;
};

const REPLICA_CAPACITY_RPS = 250;
const REPLICA_MONTHLY_USD = 85;

const shapes: DeploymentShape[] = [
  {
    id: 'single-zone',
    label: 'Single-zone pool',
    detail: 'Several processes or hosts in one zone. A zone outage removes the entire service.',
    domains: 1,
    domainLabel: 'zone',
    minReplicas: 2,
    fixedMonthlyUsd: 35,
    failureLabel: 'one zone',
    releasePlan: 'Use a small rolling batch and retain a tested restore path for the zone-level outage.',
  },
  {
    id: 'multi-zone',
    label: 'Three-zone service',
    detail: 'Traffic and replicas span three zones. Size the two surviving zones for the peak.',
    domains: 3,
    domainLabel: 'zone',
    minReplicas: 3,
    fixedMonthlyUsd: 125,
    failureLabel: 'the busiest zone',
    releasePlan: 'Roll one zone at a time and stop promotion when user objectives or dependency health move.',
  },
  {
    id: 'dual-region',
    label: 'Dual-region service',
    detail: 'Two independently operable regions. Each region must carry the peak after its peer fails.',
    domains: 2,
    domainLabel: 'region',
    minReplicas: 4,
    fixedMonthlyUsd: 360,
    failureLabel: 'the busiest region',
    releasePlan: 'Promote by region only after data compatibility, traffic steering, and rollback are verified.',
  },
];

function distributeReplicas(total: number, domains: number) {
  return Array.from({ length: domains }, (_, index) =>
    Math.floor(total / domains) + (index < total % domains ? 1 : 0)
  );
}

function requiredForDomainLoss(peakRps: number, shape: DeploymentShape) {
  if (shape.domains === 1) return null;

  let replicas = shape.minReplicas;
  while ((replicas - Math.ceil(replicas / shape.domains)) * REPLICA_CAPACITY_RPS < peakRps) {
    replicas += 1;
  }
  return replicas;
}

function formatUsd(value: number) {
  return `$${value.toLocaleString()}/mo`;
}

export default function InfrastructureCapacityCostDeploymentLab() {
  const [shapeId, setShapeId] = useState<ShapeId>('multi-zone');
  const [peakRps, setPeakRps] = useState(1200);
  const [headroomPercent, setHeadroomPercent] = useState(30);

  const model = useMemo(() => {
    const shape = shapes.find((item) => item.id === shapeId) ?? shapes[1];
    const targetUtilization = (100 - headroomPercent) / 100;
    const replicas = Math.max(
      shape.minReplicas,
      Math.ceil(peakRps / (REPLICA_CAPACITY_RPS * targetUtilization))
    );
    const domainCounts = distributeReplicas(replicas, shape.domains);
    const largestDomain = Math.max(...domainCounts);
    const survivingReplicas = shape.domains === 1 ? 0 : replicas - largestDomain;
    const normalCapacityRps = replicas * REPLICA_CAPACITY_RPS;
    const failureCapacityRps = survivingReplicas * REPLICA_CAPACITY_RPS;
    const survivesDomainLoss = failureCapacityRps >= peakRps;
    const failureReadyReplicas = requiredForDomainLoss(peakRps, shape);
    const monthlyUsd = replicas * REPLICA_MONTHLY_USD + shape.fixedMonthlyUsd;
    const normalUtilization = (peakRps / normalCapacityRps) * 100;

    return {
      domainCounts,
      failureCapacityRps,
      failureReadyReplicas,
      monthlyUsd,
      normalCapacityRps,
      normalUtilization,
      replicas,
      shape,
      survivesDomainLoss,
      survivingReplicas,
      targetUtilization,
    };
  }, [headroomPercent, peakRps, shapeId]);

  const consequence = model.shape.domains === 1
    ? 'This shape can absorb a process or host replacement, but a zone outage removes every replica.'
    : model.survivesDomainLoss
      ? `The remaining ${model.survivingReplicas} replicas can carry the selected peak after losing ${model.shape.failureLabel}.`
      : `The remaining ${model.survivingReplicas} replicas provide ${model.failureCapacityRps.toLocaleString()} requests/second, below the selected peak.`;

  const recommendation = model.shape.domains === 1
    ? 'Use this only when the documented recovery objective permits a zone interruption. More replicas inside the same zone do not change that boundary.'
    : model.survivesDomainLoss
      ? `${model.shape.releasePlan} The model meets the selected fault objective, but data and dependency capacity need the same test.`
      : `Provision at least ${model.failureReadyReplicas} total replicas for raw post-failure capacity, or narrow the fault promise. Then load-test the degraded shape.`;

  return (
    <div data-content-block="reference/infrastructure-capacity-cost-deployment-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Capacity and cost model"
          title="Price the deployment shape after a fault"
          description="Change peak traffic, spare headroom, and fault-domain shape. The model recomputes steady capacity, modeled cost, placement, and what remains after the busiest domain is lost."
          icon={Gauge}
          accent="emerald"
          onReset={() => {
            setShapeId('multi-zone');
            setPeakRps(1200);
            setHeadroomPercent(30);
          }}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Deployment shape
                </legend>
                <div className="mt-3 space-y-2">
                  {shapes.map((shape) => (
                    <LabChoice
                      key={shape.id}
                      selected={shapeId === shape.id}
                      label={shape.label}
                      detail={shape.detail}
                      icon={shape.id === 'single-zone' ? Server : shape.id === 'multi-zone' ? Network : Globe2}
                      accent={shape.id === 'single-zone' ? 'emerald' : shape.id === 'multi-zone' ? 'blue' : 'violet'}
                      onClick={() => setShapeId(shape.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Peak request rate"
                value={peakRps}
                output={`${peakRps.toLocaleString()} req/s`}
                min={250}
                max={5000}
                step={250}
                accent="cyan"
                lowLabel="small service"
                highLabel="higher peak"
                onChange={setPeakRps}
              />

              <LabRange
                label="Spare headroom"
                value={headroomPercent}
                output={`${headroomPercent}%`}
                min={10}
                max={60}
                step={5}
                accent="amber"
                lowLabel="efficient"
                highLabel="more reserve"
                onChange={setHeadroomPercent}
              />
            </div>
          }
        >
          <div aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Steady replicas"
                value={model.replicas.toLocaleString()}
                detail={`${model.normalCapacityRps.toLocaleString()} req/s raw capacity at ${model.normalUtilization.toFixed(0)}% peak utilization`}
                icon={Server}
                tone="cyan"
              />
              <LabMetric
                label="Modeled monthly cost"
                value={formatUsd(model.monthlyUsd)}
                detail={`$${REPLICA_MONTHLY_USD}/replica plus fixed shape services`}
                icon={CircleDollarSign}
                tone="amber"
              />
              <LabMetric
                label="Capacity after loss"
                value={`${model.failureCapacityRps.toLocaleString()} req/s`}
                detail={`After losing ${model.shape.failureLabel}`}
                icon={Activity}
                tone={model.survivesDomainLoss ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Fault objective"
                value={model.survivesDomainLoss ? 'Carries peak' : 'Does not carry peak'}
                detail={`${model.survivingReplicas} of ${model.replicas} replicas remain`}
                icon={model.survivesDomainLoss ? ShieldCheck : TriangleAlert}
                tone={model.survivesDomainLoss ? 'emerald' : 'rose'}
              />
            </div>

            <section className="mt-5 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">Replica placement</p>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  Replicas are spread as evenly as possible. The failure model removes the busiest {model.shape.domainLabel}.
                </p>
              </div>
              <ol
                className={`grid gap-3 p-4 ${model.shape.domains === 1 ? 'grid-cols-1' : model.shape.domains === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}
              >
                {model.domainCounts.map((count, index) => (
                  <li
                    key={`${model.shape.id}-${index}`}
                    className={`min-h-32 rounded-md border p-4 ${
                      index === 0
                        ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
                        : 'border-neutral-200 bg-white text-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase opacity-70">
                          {model.shape.domainLabel} {String.fromCharCode(65 + index)}
                        </p>
                        <p className="mt-2 text-2xl font-semibold tabular-nums">{count}</p>
                        <p className="mt-1 text-xs opacity-75">replicas</p>
                      </div>
                      {index === 0 ? (
                        <span className="rounded-md border border-current px-2 py-1 text-[10px] font-semibold uppercase">
                          Modeled loss
                        </span>
                      ) : (
                        <Cloud aria-hidden="true" className="h-5 w-5 opacity-60" />
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section
              className={`mt-5 rounded-md border p-4 ${
                model.survivesDomainLoss
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {model.survivesDomainLoss ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Decision consequence</p>
                  <p className="mt-2 text-sm font-semibold leading-6">{consequence}</p>
                  <p className="mt-2 text-sm leading-6 opacity-90">{recommendation}</p>
                </div>
              </div>
            </section>

            <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              Planning assumptions: each replica sustains {REPLICA_CAPACITY_RPS} requests/second at the latency target and costs ${REPLICA_MONTHLY_USD} per month including a small telemetry allowance. Fixed shape cost approximates traffic entry and regional services. Storage, support, engineering time, and data transfer are excluded.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
