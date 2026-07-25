'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Clock3,
  DatabaseBackup,
  Gauge,
  Network,
  RotateCcw,
  ServerCrash,
  ShieldCheck,
  Waypoints,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type ControlId = 'sampler' | 'checkpoint' | 'watchdog' | 'telemetry';
type Scenario = {
  id: string;
  label: string;
  detail: string;
  symptom: string;
  rootCause: string;
  requiredControls: ControlId[];
  baseRecoveryMinutes: number;
  lostStepsWithoutCheckpoint: number;
  affectedRanks: number;
};
type Control = {
  id: ControlId;
  label: string;
  detail: string;
};
type DistributedRecoveryData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    topologyId: string;
    enabledControls: ControlId[];
  };
  topologies: Array<{
    id: string;
    label: string;
    detail: string;
    restartPenaltyMinutes: number;
    checkpointPenaltyMinutes: number;
  }>;
  controls: Control[];
  scenarios: Scenario[];
};

const BLOCK_ID = 'technology/pytorch-distributed-recovery-lab';
const DEFAULT_DATA_FILE = '/api/content/technology/pytorch/data/distributed-failure-scenarios.json';

function isDistributedRecoveryData(value: unknown): value is DistributedRecoveryData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DistributedRecoveryData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.scenarioId
      && Array.isArray(candidate.topologies)
      && candidate.topologies.length > 0
      && Array.isArray(candidate.controls)
      && candidate.controls.length > 0
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0,
  );
}

export default function PyTorchDistributedRecoveryLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<DistributedRecoveryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [scenarioId, setScenarioId] = useState('');
  const [topologyId, setTopologyId] = useState('');
  const [enabledControls, setEnabledControls] = useState<ControlId[]>([]);

  function reset(model: DistributedRecoveryData) {
    setScenarioId(model.defaults.scenarioId);
    setTopologyId(model.defaults.topologyId);
    setEnabledControls(model.defaults.enabledControls);
  }

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isDistributedRecoveryData(payload)) {
          throw new Error('The distributed-recovery model is incomplete.');
        }
        setData(payload);
        reset(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load failure data.');
      });
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const scenario = data?.scenarios.find((candidate) => candidate.id === scenarioId)
    ?? data?.scenarios[0]
    ?? null;
  const topology = data?.topologies.find((candidate) => candidate.id === topologyId)
    ?? data?.topologies[0]
    ?? null;

  const result = useMemo(() => {
    if (!scenario || !topology) return null;
    const missing = scenario.requiredControls.filter((control) => !enabledControls.includes(control));
    const detected = enabledControls.includes('telemetry');
    const boundedRestart = enabledControls.includes('watchdog');
    const resumable = enabledControls.includes('checkpoint');
    const dataCorrect = !scenario.requiredControls.includes('sampler') || enabledControls.includes('sampler');
    const detectionMinutes = detected ? 2 : 18;
    const recoveryMinutes = detectionMinutes
      + scenario.baseRecoveryMinutes
      + (boundedRestart ? topology.restartPenaltyMinutes : 20)
      + (resumable ? topology.checkpointPenaltyMinutes : 35);
    const lostSteps = resumable ? Math.ceil(scenario.lostStepsWithoutCheckpoint * 0.08) : scenario.lostStepsWithoutCheckpoint;

    if (missing.length > 0) {
      return {
        dataCorrect,
        detectionMinutes,
        lostSteps,
        missing,
        recoveryMinutes,
        tone: 'rose' as const,
        status: dataCorrect ? 'Recovery contract is incomplete' : 'The run can finish with the wrong sample stream',
        verdict: dataCorrect
          ? `The failure is visible, but ${missing.length} required control${missing.length === 1 ? ' is' : 's are'} absent. A distributed job is one coordinated state machine; restarting one rank alone does not restore a consistent step.`
          : 'Ranks can repeat or omit data because ownership and epoch advancement are not coordinated. Loss may look healthy while the effective training distribution is wrong.',
      };
    }

    return {
      dataCorrect,
      detectionMinutes,
      lostSteps,
      missing,
      recoveryMinutes,
      tone: 'emerald' as const,
      status: 'The selected controls produce a bounded recovery path',
      verdict: `The group fails together, restarts from a complete checkpoint, and preserves sample ownership. The modeled path returns to useful work in about ${recoveryMinutes} minutes with ${lostSteps.toLocaleString()} replayed steps.`,
    };
  }, [enabledControls, scenario, topology]);

  function toggleControl(controlId: ControlId) {
    setEnabledControls((current) => current.includes(controlId)
      ? current.filter((candidate) => candidate !== controlId)
      : [...current, controlId]);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Distributed recovery lab"
          title={data?.title ?? 'Can the training group recover coherently?'}
          description={data?.description ?? 'Loading distributed failure scenarios.'}
          icon={Network}
          accent="rose"
          onReset={data ? () => reset(data) : undefined}
        />

        {!data || !scenario || !topology || !result ? (
          <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Injected failure</legend>
                  <div className="mt-3 space-y-2">
                    {data.scenarios.map((candidate) => (
                      <LabChoice
                        key={candidate.id}
                        selected={candidate.id === scenario.id}
                        label={candidate.label}
                        detail={candidate.detail}
                        icon={ServerCrash}
                        accent="rose"
                        onClick={() => setScenarioId(candidate.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Parallel topology</legend>
                  <div className="mt-3 space-y-2">
                    {data.topologies.map((candidate) => (
                      <LabChoice
                        key={candidate.id}
                        selected={candidate.id === topology.id}
                        label={candidate.label}
                        detail={candidate.detail}
                        icon={Waypoints}
                        accent="violet"
                        onClick={() => setTopologyId(candidate.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Recovery controls</legend>
                  <div className="mt-3 space-y-2">
                    {data.controls.map((control) => (
                      <LabChoice
                        key={control.id}
                        selected={enabledControls.includes(control.id)}
                        label={control.label}
                        detail={control.detail}
                        icon={control.id === 'checkpoint' ? DatabaseBackup : control.id === 'watchdog' ? Clock3 : control.id === 'sampler' ? Waypoints : Activity}
                        accent="emerald"
                        onClick={() => toggleControl(control.id)}
                      />
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
          >
            <div className="min-w-0 space-y-5" aria-live="polite">
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <LabMetric label="Detection" value={`${result.detectionMinutes} min`} detail="Time until the group is declared unhealthy" icon={Gauge} tone={enabledControls.includes('telemetry') ? 'blue' : 'amber'} />
                <LabMetric label="Recovery" value={`${result.recoveryMinutes} min`} detail={`${topology.label} restart and checkpoint path`} icon={RotateCcw} tone={result.tone} />
                <LabMetric label="Replayed work" value={result.lostSteps.toLocaleString()} detail="Steps since the last complete checkpoint" icon={Clock3} tone={enabledControls.includes('checkpoint') ? 'cyan' : 'rose'} />
                <LabMetric label="Sample stream" value={result.dataCorrect ? 'Coherent' : 'Corrupted'} detail="Per-rank ownership and epoch advancement" icon={ShieldCheck} tone={result.dataCorrect ? 'emerald' : 'rose'} />
              </div>

              <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Observed symptom</p>
                <p className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">{scenario.symptom}</p>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300"><strong>Likely cause:</strong> {scenario.rootCause}</p>
              </section>

              <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
                <Stage icon={ServerCrash} eyebrow="Detect" title={enabledControls.includes('telemetry') ? 'Identify the affected rank' : 'Wait for an external timeout'} detail={`${scenario.affectedRanks} rank${scenario.affectedRanks === 1 ? '' : 's'} expose the selected symptom`} tone={enabledControls.includes('telemetry') ? 'blue' : 'rose'} />
                <FlowArrow />
                <Stage icon={RotateCcw} eyebrow="Coordinate" title={enabledControls.includes('watchdog') ? 'Restart the whole process group' : 'State remains ambiguous'} detail="Collectives require every rank to agree on membership and step" tone={enabledControls.includes('watchdog') ? 'violet' : 'rose'} />
                <FlowArrow />
                <Stage icon={DatabaseBackup} eyebrow="Resume" title={enabledControls.includes('checkpoint') ? 'Load one complete checkpoint' : 'Restart from stale state'} detail={enabledControls.includes('sampler') ? 'Sampler epoch and ownership resume coherently' : 'Data ownership can repeat or skip examples'} tone={result.tone === 'emerald' ? 'emerald' : 'rose'} />
              </div>

              <section className={`border-l-4 p-4 ${result.tone === 'emerald' ? 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50' : 'border-rose-500 bg-rose-50 text-rose-950 dark:bg-rose-950/30 dark:text-rose-50'}`}>
                <div className="flex items-start gap-3">
                  {result.tone === 'emerald' ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                  <div>
                    <p className="font-semibold">{result.status}</p>
                    <p className="mt-1 text-sm leading-6 opacity-85">{result.verdict}</p>
                    {result.missing.length > 0 ? <p className="mt-2 text-xs font-semibold uppercase opacity-75">Missing: {result.missing.join(', ')}</p> : null}
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

function Stage({ icon: Icon, eyebrow, title, detail, tone }: { icon: typeof Network; eyebrow: string; title: string; detail: string; tone: 'blue' | 'violet' | 'emerald' | 'rose' }) {
  const styles = {
    blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50',
    violet: 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-50',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
    rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
  };
  return <div className={`min-w-0 rounded-md border p-4 ${styles[tone]}`}><div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75"><Icon aria-hidden="true" className="h-4 w-4 shrink-0" />{eyebrow}</div><p className="mt-2 font-semibold">{title}</p><p className="mt-1 text-xs leading-5 opacity-75">{detail}</p></div>;
}

function FlowArrow() {
  return <div aria-hidden="true" className="hidden items-center text-neutral-300 md:flex dark:text-neutral-700">→</div>;
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return <LearningLabBody><div className="flex min-h-48 items-center justify-center text-center"><div><Network aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" /><p className="mt-3 font-semibold">{error ? 'Failure scenarios could not load' : 'Loading recovery scenarios'}</p><p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{error ?? 'Preparing incidents, controls, and recovery consequences.'}</p>{error ? <button type="button" onClick={onRetry} className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-neutral-700 dark:hover:bg-neutral-900">Retry</button> : null}</div></div></LearningLabBody>;
}
