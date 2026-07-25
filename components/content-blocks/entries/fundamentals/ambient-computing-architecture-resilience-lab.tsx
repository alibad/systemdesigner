'use client';

import { useEffect, useMemo, useState } from 'react';
import { CloudOff, Database, Home, Radio, Route, ShieldAlert } from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

interface Behavior {
  id: string;
  label: string;
  detail: string;
  eventsPerDay: number;
  bytesPerEvent: number;
  essential: boolean;
}

interface Placement {
  id: string;
  label: string;
  detail: string;
  remotePayloadFactor: number;
  rawSignalsRemote: number;
  cloudRequired: boolean;
  localFallback: string;
}

interface ResilienceModel {
  title: string;
  description: string;
  defaults: { behaviorId: string; placementId: string; retentionDays: number; cloudAvailable: boolean };
  behaviors: Behavior[];
  placements: Placement[];
}

const BLOCK_ID = 'fundamentals/ambient-computing-architecture-resilience-lab';

export default function AmbientComputingResilienceLab({ dataFile }: { dataFile?: string }) {
  const [model, setModel] = useState<ResilienceModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [behaviorId, setBehaviorId] = useState('');
  const [placementId, setPlacementId] = useState('');
  const [retentionDays, setRetentionDays] = useState(7);
  const [cloudAvailable, setCloudAvailable] = useState(true);

  useEffect(() => {
    let active = true;
    if (!dataFile) {
      setError('The privacy and resilience model is not configured.');
      return () => { active = false; };
    }
    fetch(dataFile)
      .then((response) => {
        if (!response.ok) throw new Error(`Boundary model returned ${response.status}`);
        return response.json() as Promise<ResilienceModel>;
      })
      .then((next) => {
        if (!active) return;
        setModel(next);
        setBehaviorId(next.defaults.behaviorId);
        setPlacementId(next.defaults.placementId);
        setRetentionDays(next.defaults.retentionDays);
        setCloudAvailable(next.defaults.cloudAvailable);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load boundary evidence.');
      });
    return () => { active = false; };
  }, [dataFile]);

  const behavior = model?.behaviors.find((item) => item.id === behaviorId) ?? model?.behaviors[0];
  const placement = model?.placements.find((item) => item.id === placementId) ?? model?.placements[0];
  const result = useMemo(() => {
    if (!behavior || !placement) return null;
    const dailyRemoteBytes = Math.round(behavior.eventsPerDay * behavior.bytesPerEvent * placement.remotePayloadFactor);
    const retainedBytes = dailyRemoteBytes * retentionDays;
    const available = cloudAvailable || !placement.cloudRequired;
    return {
      dailyRemoteBytes,
      retainedBytes,
      available,
      outcome: available ? 'Behavior available' : behavior.essential ? 'Manual fallback required' : 'Automation paused',
    };
  }, [behavior, cloudAvailable, placement, retentionDays]);

  if (!model || !behavior || !placement || !result) {
    return <div data-content-block={BLOCK_ID}><LearningLab><LearningLabHeader eyebrow="Privacy and outage lab" title="Keep useful behavior inside an explicit boundary" description={error ?? 'Loading the lesson-owned boundary model.'} icon={Route} accent={error ? 'rose' : 'emerald'} /></LearningLab></div>;
  }

  const reset = () => {
    setBehaviorId(model.defaults.behaviorId);
    setPlacementId(model.defaults.placementId);
    setRetentionDays(model.defaults.retentionDays);
    setCloudAvailable(model.defaults.cloudAvailable);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader eyebrow="Privacy and outage lab" title={model.title} description={model.description} icon={Route} accent="emerald" onReset={reset} />
        <LearningLabBody controls={<div className="space-y-7">
          <fieldset><legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Ambient behavior</legend><div className="mt-3 space-y-2">{model.behaviors.map((item) => <LabChoice key={item.id} selected={item.id === behavior.id} label={item.label} detail={item.detail} icon={Home} accent="emerald" onClick={() => setBehaviorId(item.id)} />)}</div></fieldset>
          <fieldset><legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Processing boundary</legend><div className="mt-3 space-y-2">{model.placements.map((item) => <LabChoice key={item.id} selected={item.id === placement.id} label={item.label} detail={item.detail} icon={Database} accent="blue" onClick={() => setPlacementId(item.id)} />)}</div></fieldset>
          <LabRange label="Remote retention" value={retentionDays} output={`${retentionDays} days`} min={1} max={30} lowLabel="1 day" highLabel="30 days" accent="violet" onChange={setRetentionDays} />
          <button type="button" aria-pressed={!cloudAvailable} onClick={() => setCloudAvailable((value) => !value)} className={`w-full rounded-md border p-3 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${cloudAvailable ? 'border-neutral-300 bg-white text-neutral-800 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100' : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'}`}>
            Cloud link {cloudAvailable ? 'available' : 'offline'}
          </button>
        </div>}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Raw signals remote" value={`${placement.rawSignalsRemote}`} detail="Fixture streams crossing the local boundary" icon={Radio} tone={placement.rawSignalsRemote === 0 ? 'emerald' : 'amber'} />
            <LabMetric label="Remote bytes / day" value={formatBytes(result.dailyRemoteBytes)} detail={`${behavior.eventsPerDay.toLocaleString()} events in this fixture`} icon={Database} tone="blue" />
            <LabMetric label="Retained remote data" value={formatBytes(result.retainedBytes)} detail={`${retentionDays}-day policy`} icon={Database} tone="violet" />
            <LabMetric label="Outage result" value={result.outcome} icon={cloudAvailable ? Route : CloudOff} tone={result.available ? 'emerald' : 'rose'} />
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <BoundaryStep label="Sense" detail="Purpose-limited device signals" active />
            <BoundaryStep label={placement.label} detail={placement.rawSignalsRemote === 0 ? 'Raw context stays local' : `${placement.rawSignalsRemote} raw streams cross the boundary`} active={cloudAvailable || !placement.cloudRequired} />
            <BoundaryStep label="Act" detail={result.available ? behavior.label : placement.localFallback} active={result.available} />
          </div>

          <div className={`mt-6 rounded-md border p-5 ${result.available ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50' : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'}`}>
            <div className="flex items-start gap-3"><ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">{result.outcome}</p><p className="mt-2 text-sm leading-6 opacity-80">Fallback: {placement.localFallback}. Retention changes exposure, not the permission to collect a signal.</p></div></div>
          </div>
          <p className="mt-5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">The byte counts are exact arithmetic over this synthetic fixture, not product traffic estimates.</p>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function BoundaryStep({ label, detail, active }: { label: string; detail: string; active: boolean }) {
  return <div className={`rounded-md border p-4 ${active ? 'border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/35 dark:text-cyan-50' : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'}`}><p className="text-sm font-semibold">{label}</p><p className="mt-1 text-xs leading-5 opacity-75">{detail}</p></div>;
}

function formatBytes(bytes: number) {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(2)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}
