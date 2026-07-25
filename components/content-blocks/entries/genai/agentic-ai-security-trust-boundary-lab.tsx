'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  BadgeCheck,
  Ban,
  CheckCircle2,
  CircleAlert,
  Database,
  FileWarning,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Route,
  ShieldCheck,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type StageId = 'principal' | 'context' | 'planner' | 'gateway' | 'effect';
type OutcomeStatus = 'contained' | 'compromised';
type TraceState = 'clean' | 'influenced' | 'blocked' | 'not-reached';

interface TrustStage {
  id: StageId;
  label: string;
  eyebrow: string;
  detail: string;
}

interface ControlPosture {
  id: string;
  label: string;
  detail: string;
  controls: string[];
}

interface BoundaryOutcome {
  reachStageId: StageId;
  status: OutcomeStatus;
  verdict: string;
  actionAuthority: string;
  consequence: string;
  failedBoundaries: string[];
}

interface ThreatScenario {
  id: string;
  label: string;
  brief: string;
  attack: string;
  proposedAction: string;
  outcomes: Record<string, BoundaryOutcome>;
}

interface TrustBoundaryData {
  title: string;
  description: string;
  defaultScenarioId: string;
  defaultPostureId: string;
  stages: TrustStage[];
  postures: ControlPosture[];
  scenarios: ThreatScenario[];
}

const BLOCK_ID = 'genai/agentic-ai-security-trust-boundary-lab';

const stageIcons: Record<StageId, LucideIcon> = {
  principal: KeyRound,
  context: Database,
  planner: Workflow,
  gateway: ShieldCheck,
  effect: LockKeyhole,
};

const traceStyles: Record<TraceState, string> = {
  clean:
    'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100',
  influenced:
    'border-rose-300 bg-rose-50 text-rose-950 ring-1 ring-rose-200 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100 dark:ring-rose-900',
  blocked:
    'border-emerald-300 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-200 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100 dark:ring-emerald-900',
  'not-reached':
    'border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400',
};

function isStageId(value: unknown): value is StageId {
  return value === 'principal'
    || value === 'context'
    || value === 'planner'
    || value === 'gateway'
    || value === 'effect';
}

function isOutcome(value: unknown): value is BoundaryOutcome {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BoundaryOutcome>;
  return Boolean(
    isStageId(candidate.reachStageId)
      && (candidate.status === 'contained' || candidate.status === 'compromised')
      && typeof candidate.verdict === 'string'
      && typeof candidate.actionAuthority === 'string'
      && typeof candidate.consequence === 'string'
      && Array.isArray(candidate.failedBoundaries)
      && candidate.failedBoundaries.every((item) => typeof item === 'string'),
  );
}

function isTrustBoundaryData(value: unknown): value is TrustBoundaryData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TrustBoundaryData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaultScenarioId
      && candidate.defaultPostureId
      && Array.isArray(candidate.stages)
      && candidate.stages.length === 5
      && candidate.stages.every((stage) => (
        isStageId(stage.id)
        && typeof stage.label === 'string'
        && typeof stage.eyebrow === 'string'
        && typeof stage.detail === 'string'
      ))
      && Array.isArray(candidate.postures)
      && candidate.postures.length > 0
      && candidate.postures.every((posture) => (
        typeof posture.id === 'string'
        && typeof posture.label === 'string'
        && typeof posture.detail === 'string'
        && Array.isArray(posture.controls)
        && posture.controls.every((item) => typeof item === 'string')
      ))
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.brief === 'string'
        && typeof scenario.attack === 'string'
        && typeof scenario.proposedAction === 'string'
        && scenario.outcomes
        && typeof scenario.outcomes === 'object'
        && Object.values(scenario.outcomes).every(isOutcome)
      )),
  );
}

export default function AgenticAiSecurityTrustBoundaryLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<TrustBoundaryData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No trust-boundary scenario file was supplied.');
      return;
    }

    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isTrustBoundaryData(payload)) {
          throw new Error('Trust-boundary data is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LabError detail={error} />;
  if (!data) return <LabLoading />;
  return <TrustBoundaryLab data={data} />;
}

function TrustBoundaryLab({ data }: { data: TrustBoundaryData }) {
  const initialScenario = data.scenarios.find((item) => item.id === data.defaultScenarioId)
    ?? data.scenarios[0];
  const initialPosture = data.postures.find((item) => item.id === data.defaultPostureId)
    ?? data.postures[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [postureId, setPostureId] = useState(initialPosture.id);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const posture = data.postures.find((item) => item.id === postureId) ?? data.postures[0];
  const outcome = scenario.outcomes[posture.id] ?? Object.values(scenario.outcomes)[0];

  const trace = useMemo(() => {
    const reachIndex = data.stages.findIndex((stage) => stage.id === outcome.reachStageId);
    return data.stages.map((stage, index) => {
      let state: TraceState = 'clean';
      if (stage.id === 'principal') {
        state = 'clean';
      } else if (outcome.status === 'contained' && index === reachIndex) {
        state = 'blocked';
      } else if (index <= reachIndex) {
        state = 'influenced';
      } else {
        state = 'not-reached';
      }
      return { ...stage, state };
    });
  }, [data.stages, outcome]);

  const reachCount = data.stages.findIndex((stage) => stage.id === outcome.reachStageId) + 1;
  const contained = outcome.status === 'contained';
  const OutcomeIcon = contained ? CheckCircle2 : CircleAlert;

  function reset() {
    setScenarioId(initialScenario.id);
    setPostureId(initialPosture.id);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Trust-boundary threat model"
          title={data.title}
          description={data.description}
          icon={Route}
          accent="rose"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Hostile context
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.brief}
                      icon={FileWarning}
                      accent="rose"
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Enforcement posture
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.postures.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === posture.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'bounded-authority' ? ShieldCheck : item.id === 'schema-only' ? BadgeCheck : CircleAlert}
                      accent={item.id === 'bounded-authority' ? 'emerald' : item.id === 'schema-only' ? 'amber' : 'rose'}
                      onClick={() => setPostureId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <section className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <h4 className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Controls actually enforced
                </h4>
                <ul className="mt-3 space-y-2">
                  {posture.controls.map((control) => (
                    <li key={control} className="flex gap-2 text-sm leading-5 text-neutral-700 dark:text-neutral-300">
                      <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                      <span>{control}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}
        >
          <div aria-live="polite" className="min-w-0">
            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Attacker reach"
                value={`${reachCount} / ${data.stages.length}`}
                detail={contained ? `Stopped at ${outcome.reachStageId}.` : 'The influence reaches a real side effect.'}
                icon={Route}
                tone={contained ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Action authority"
                value={outcome.actionAuthority}
                detail="Who or what the runtime treats as permission to execute."
                icon={KeyRound}
                tone={contained ? 'blue' : 'amber'}
              />
              <LabMetric
                label="Boundary verdict"
                value={contained ? 'Contained' : 'Compromised'}
                detail={outcome.verdict}
                icon={OutcomeIcon}
                tone={contained ? 'emerald' : 'rose'}
              />
            </div>

            <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Attack entering the trajectory
                  </p>
                  <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    {scenario.attack}
                  </p>
                </div>
                <code className="max-w-full shrink-0 overflow-x-auto rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-800 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 sm:max-w-[46%]">
                  {scenario.proposedAction}
                </code>
              </div>

              <ol className="mt-5 grid gap-2 xl:grid-cols-5">
                {trace.map((stage, index) => (
                  <li key={stage.id} className="min-w-0">
                    <TraceStage stage={stage} />
                    {index < trace.length - 1 ? (
                      <div className="flex h-7 items-center justify-center text-neutral-400 xl:hidden">
                        <ArrowDown aria-hidden="true" className="h-4 w-4" />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>

            <section className={`mt-5 rounded-md border p-5 ${contained
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
              : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'}`}>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
                <OutcomeIcon aria-hidden="true" className="h-4 w-4" />
                {outcome.verdict}
              </div>
              <p className="mt-3 text-sm leading-6">{outcome.consequence}</p>
              {outcome.failedBoundaries.length ? (
                <div className="mt-4 border-t border-current/20 pt-4">
                  <p className="text-xs font-semibold uppercase opacity-75">Missing boundaries</p>
                  <ul className="mt-2 space-y-2">
                    {outcome.failedBoundaries.map((failure) => (
                      <li key={failure} className="flex gap-2 text-sm leading-5">
                        <Ban aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{failure}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="mt-4 flex gap-2 border-t border-current/20 pt-4 text-sm leading-5">
                  <BadgeCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <span>The hostile content can inform a proposal, but it cannot expand identity, purpose, resource scope, or approval.</span>
                </div>
              )}
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function TraceStage({ stage }: { stage: TrustStage & { state: TraceState } }) {
  const Icon = stageIcons[stage.id];
  const stateLabel: Record<TraceState, string> = {
    clean: 'Authority anchored',
    influenced: 'Attacker influence',
    blocked: 'Influence blocked',
    'not-reached': 'Not reached',
  };

  return (
    <div className={`h-full min-h-40 rounded-md border p-3 ${traceStyles[stage.state]}`}>
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/80 shadow-sm dark:bg-neutral-950/70">
          <Icon aria-hidden="true" className="h-4 w-4" />
        </span>
        <span className="text-[11px] font-semibold uppercase opacity-75">{stateLabel[stage.state]}</span>
      </div>
      <p className="mt-3 text-sm font-semibold">{stage.label}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase opacity-65">{stage.eyebrow}</p>
      <p className="mt-2 text-xs leading-5 opacity-80">{stage.detail}</p>
    </div>
  );
}

function LabLoading() {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div role="status" className="flex min-h-[520px] items-center justify-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
            <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
            Loading trust-boundary threat model...
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LabError({ detail }: { detail: string }) {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
      role="alert"
    >
      <p className="font-semibold">Trust-boundary lab unavailable</p>
      <p className="mt-2 opacity-80">{detail}</p>
    </div>
  );
}
