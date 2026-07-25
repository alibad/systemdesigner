'use client';

import { useMemo, useState } from 'react';
import { Boxes, Cloud, Gauge, Network, Server, ShieldCheck, TriangleAlert, WalletCards } from 'lucide-react';

import { LabChoice, LabMetric, LabRange, LearningLab, LearningLabBody, LearningLabHeader } from '@/components/content-blocks/learning/LearningLab';

type WorkloadId = 'api' | 'media' | 'worker';
const BLOCK_ID = 'technology/aws-cost';
const workloads: Array<{ id: WorkloadId; label: string; detail: string; capacity: number; baseIndex: number }> = [
  { id: 'api', label: 'Stateless request API', detail: 'CPU-bound synchronous requests behind a regional load balancer.', capacity: 420, baseIndex: 100 },
  { id: 'media', label: 'Media origin service', detail: 'Moderate request rate with high cache-miss and internet-transfer pressure.', capacity: 160, baseIndex: 140 },
  { id: 'worker', label: 'Queue-backed workers', detail: 'Asynchronous jobs where backlog age matters more than request latency.', capacity: 55, baseIndex: 85 },
];

export default function AwsCost() {
  const [workloadId, setWorkloadId] = useState<WorkloadId>('api');
  const [peakRate, setPeakRate] = useState(8_000);
  const [zones, setZones] = useState(3);
  const [targetUtilization, setTargetUtilization] = useState(60);
  const [capacityFactor, setCapacityFactor] = useState(100);
  const [internetEgressTiB, setInternetEgressTiB] = useState(6);
  const [crossZonePct, setCrossZonePct] = useState(20);
  const workload = workloads.find((item) => item.id === workloadId) ?? workloads[0];

  const result = useMemo(() => {
    const perInstance = workload.capacity * capacityFactor / 100;
    const instances = Math.ceil(peakRate / (perInstance * targetUtilization / 100));
    const perZone = Math.ceil(instances / zones);
    const provisioned = perZone * zones;
    const survivingInstances = zones > 1 ? provisioned - perZone : 0;
    const survivingRate = survivingInstances * perInstance * targetUtilization / 100;
    const survivesZone = survivingRate >= peakRate;
    const crossZoneRate = peakRate * crossZonePct / 100;
    const spendIndex = provisioned * workload.baseIndex + internetEgressTiB * 90 + crossZoneRate / 100;
    const headroomPct = Math.max(0, (provisioned * perInstance * targetUtilization / 100 - peakRate) / peakRate * 100);
    return { crossZoneRate, headroomPct, instances, perInstance, perZone, provisioned, spendIndex, survivesZone, survivingRate };
  }, [capacityFactor, crossZonePct, internetEgressTiB, peakRate, targetUtilization, workload, zones]);

  const reset = () => { setWorkloadId('api'); setPeakRate(8_000); setZones(3); setTargetUtilization(60); setCapacityFactor(100); setInternetEgressTiB(6); setCrossZonePct(20); };

  return <div data-content-block={BLOCK_ID}><LearningLab><LearningLabHeader eyebrow="AWS workload envelope" title="Size capacity, failure headroom, and transfer pressure" description="This is a relative planning model, not a price quote. Change the workload and deployment assumptions to expose which resource or failure boundary controls the design." icon={Cloud} accent="amber" onReset={reset} /><LearningLabBody controls={<div className="space-y-7"><fieldset><legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Workload shape</legend><div className="mt-3 grid gap-2">{workloads.map((item) => <LabChoice key={item.id} selected={item.id === workload.id} label={item.label} detail={item.detail} icon={item.id === 'worker' ? Boxes : Server} accent={item.id === 'media' ? 'violet' : 'blue'} onClick={() => setWorkloadId(item.id)} />)}</div></fieldset><LabRange label="Peak demand" value={peakRate} output={`${peakRate.toLocaleString()}/s`} min={500} max={50_000} step={500} accent="blue" lowLabel="Small service" highLabel="Traffic event" onChange={setPeakRate} /><LabRange label="Availability Zones" value={zones} output={`${zones} AZs`} min={1} max={4} step={1} accent="emerald" lowLabel="One failure domain" highLabel="More distribution" onChange={setZones} /><LabRange label="Target utilization" value={targetUtilization} output={`${targetUtilization}%`} min={30} max={85} step={5} accent="amber" lowLabel="More reserve" highLabel="Less reserve" onChange={setTargetUtilization} /><LabRange label="Instance efficiency" value={capacityFactor} output={`${capacityFactor}% baseline`} min={50} max={180} step={10} accent="cyan" lowLabel="Smaller or slower" highLabel="More work per node" onChange={setCapacityFactor} /><LabRange label="Internet egress" value={internetEgressTiB} output={`${internetEgressTiB} TiB/mo`} min={0} max={100} step={2} accent="violet" lowLabel="Internal service" highLabel="Data-heavy" onChange={setInternetEgressTiB} /><LabRange label="Cross-zone traffic" value={crossZonePct} output={`${crossZonePct}%`} min={0} max={100} step={5} accent="rose" lowLabel="Zone-local" highLabel="Chatty across AZs" onChange={setCrossZonePct} /></div>}><div className="space-y-6"><div className={`rounded-md border p-5 ${result.survivesZone ? healthyClass : warningClass}`}><div className="flex items-start gap-3">{result.survivesZone ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}<div><p className="text-xs font-semibold uppercase opacity-75">Capacity verdict</p><h4 className="mt-1 text-xl font-semibold">{result.survivesZone ? 'Provisioned capacity survives one Availability Zone loss' : 'Healthy capacity disappears with one Availability Zone'}</h4><p className="mt-2 text-sm leading-6 opacity-80">{result.survivesZone ? `${result.survivingRate.toLocaleString(undefined, { maximumFractionDigits: 0 })}/s remains after removing ${result.perZone} instances with the failed zone.` : 'Distributing the current minimum across zones improves placement but does not create failure reserve. Lower utilization or add capacity.'}</p></div></div></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><LabMetric label="Provisioned fleet" value={`${result.provisioned}`} detail={`${result.perZone} instances per AZ`} icon={Server} tone="blue" /><LabMetric label="Healthy headroom" value={`${result.headroomPct.toFixed(0)}%`} detail={`${result.perInstance.toFixed(0)} modeled requests/s per node`} icon={Gauge} tone={result.headroomPct < 15 ? 'amber' : 'emerald'} /><LabMetric label="Cross-zone path" value={`${result.crossZoneRate.toLocaleString()}/s`} detail="Requests crossing an AZ boundary" icon={Network} tone={crossZonePct > 50 ? 'rose' : 'cyan'} /><LabMetric label="Relative spend index" value={result.spendIndex.toLocaleString(undefined, { maximumFractionDigits: 0 })} detail="Compute plus transfer pressure; not currency" icon={WalletCards} tone="violet" /></div><section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60"><p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Architecture path</p><div className="mt-4 grid gap-3 md:grid-cols-4"><PathCard label="Route" value={`${peakRate.toLocaleString()}/s`} detail="Regional demand and health checks" /><PathCard label="Balance" value={`${zones} AZs`} detail="Even placement is not reserve capacity" /><PathCard label="Serve" value={`${result.provisioned} nodes`} detail={`${targetUtilization}% target utilization`} /><PathCard label="Transfer" value={`${internetEgressTiB} TiB`} detail="Classify internet, cross-AZ, and service paths" /></div></section><p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">Validate any real design with current AWS quotas, service behavior, region availability, commitments, data-transfer rules, and the official pricing calculator.</p></div></LearningLabBody></LearningLab></div>;
}

function PathCard({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"><p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p><p className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">{value}</p><p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p></div>; }
const healthyClass = 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50';
const warningClass = 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50';
