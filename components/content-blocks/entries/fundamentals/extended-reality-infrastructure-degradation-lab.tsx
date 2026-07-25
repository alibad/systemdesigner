'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Anchor, CheckCircle2, Glasses, Network, Route, ScanLine } from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Status = 'healthy' | 'degraded' | 'failed';

interface Stage { label: string; detail: string; status: Status }
interface Incident {
  id: string;
  label: string;
  detail: string;
  tracking: string;
  transport: string;
  anchors: string;
  requiredPolicyId: string;
  safeResult: string;
  unsafeResult: string;
  stages: Stage[];
}
interface Policy { id: string; label: string; detail: string }
interface DegradationModel {
  title: string;
  description: string;
  defaults: { incidentId: string; policyId: string };
  incidents: Incident[];
  policies: Policy[];
}

const BLOCK_ID = 'fundamentals/extended-reality-infrastructure-degradation-lab';

export default function ExtendedRealityDegradationLab({ dataFile }: { dataFile?: string }) {
  const [model, setModel] = useState<DegradationModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [incidentId, setIncidentId] = useState('');
  const [policyId, setPolicyId] = useState('');

  useEffect(() => {
    let active = true;
    if (!dataFile) {
      setError('The degradation model is not configured.');
      return () => { active = false; };
    }
    fetch(dataFile)
      .then((response) => {
        if (!response.ok) throw new Error(`Degradation model returned ${response.status}`);
        return response.json() as Promise<DegradationModel>;
      })
      .then((next) => {
        if (!active) return;
        setModel(next);
        setIncidentId(next.defaults.incidentId);
        setPolicyId(next.defaults.policyId);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load degradation evidence.');
      });
    return () => { active = false; };
  }, [dataFile]);

  const incident = model?.incidents.find((item) => item.id === incidentId) ?? model?.incidents[0];
  const policy = model?.policies.find((item) => item.id === policyId) ?? model?.policies[0];

  if (!model || !incident || !policy) {
    return <div data-content-block={BLOCK_ID}><LearningLab><LearningLabHeader eyebrow="Tracking degradation lab" title="Preserve spatial safety before visual detail" description={error ?? 'Loading lesson-owned incident evidence.'} icon={ScanLine} accent={error ? 'rose' : 'amber'} /></LearningLab></div>;
  }

  const safe = incident.requiredPolicyId === policy.id;
  const reset = () => {
    setIncidentId(model.defaults.incidentId);
    setPolicyId(model.defaults.policyId);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader eyebrow="Tracking degradation lab" title={model.title} description={model.description} icon={ScanLine} accent="amber" onReset={reset} />
        <LearningLabBody controls={<div className="space-y-7">
          <fieldset><legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Inject an incident</legend><div className="mt-3 space-y-2">{model.incidents.map((item) => <LabChoice key={item.id} selected={item.id === incident.id} label={item.label} detail={item.detail} icon={AlertTriangle} accent="amber" onClick={() => setIncidentId(item.id)} />)}</div></fieldset>
          <fieldset><legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Choose the response</legend><div className="mt-3 space-y-2">{model.policies.map((item) => <LabChoice key={item.id} selected={item.id === policy.id} label={item.label} detail={item.detail} icon={Route} accent="violet" onClick={() => setPolicyId(item.id)} />)}</div></fieldset>
        </div>}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Tracking" value={incident.tracking} icon={Glasses} tone={incident.tracking === 'valid' ? 'emerald' : 'rose'} />
            <LabMetric label="Transport" value={incident.transport} icon={Network} tone={incident.transport === 'stable' ? 'emerald' : 'amber'} />
            <LabMetric label="Anchor state" value={incident.anchors} icon={Anchor} tone={incident.anchors === 'consistent' ? 'emerald' : 'amber'} />
            <LabMetric label="Response verdict" value={safe ? 'Safe degradation' : 'Unsafe response'} icon={safe ? CheckCircle2 : AlertTriangle} tone={safe ? 'emerald' : 'rose'} />
          </div>

          <section className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
            <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">Experience path</h4>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {incident.stages.map((stage) => <StageCard key={stage.label} stage={stage} />)}
            </div>
          </section>

          <div className={`mt-6 rounded-md border p-5 ${safe ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50' : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'}`}>
            <p className="font-semibold">{safe ? incident.safeResult : incident.unsafeResult}</p>
            <p className="mt-2 text-sm leading-6 opacity-80">Selected policy: {policy.label}. A graceful response preserves trustworthy pose, boundaries, and user control before optional detail or remote continuity.</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function StageCard({ stage }: { stage: Stage }) {
  const styles: Record<Status, string> = {
    healthy: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
    degraded: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
    failed: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
  };
  return <div className={`rounded-md border p-4 ${styles[stage.status]}`}><p className="text-xs font-semibold uppercase opacity-75">{stage.status}</p><p className="mt-2 font-semibold">{stage.label}</p><p className="mt-1 text-xs leading-5 opacity-75">{stage.detail}</p></div>;
}
