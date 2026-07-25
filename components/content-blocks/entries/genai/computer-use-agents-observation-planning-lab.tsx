'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Braces,
  CircleAlert,
  CircleCheck,
  Database,
  Eye,
  Gauge,
  LoaderCircle,
  Monitor,
  Route,
  Search,
  ShieldCheck,
  Workflow,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type ChannelId = 'visual' | 'semantic' | 'programmatic';
type ResultTone = 'healthy' | 'warning' | 'blocked';

interface Channel {
  id: ChannelId;
  label: string;
  detail: string;
}

interface PointLabel {
  label: string;
  x: number;
  y: number;
}

interface Scene {
  id: string;
  label: string;
  task: string;
  surface: string;
  origin: string;
  volatility: number;
  apiAvailable: boolean;
  requiredChannels: ChannelId[];
  target: PointLabel & {
    role: string;
    locator: string;
  };
  distractors: PointLabel[];
  expectedPostcondition: string;
}

interface ObservationStrategy {
  id: string;
  label: string;
  detail: string;
  channels: ChannelId[];
  freshnessMs: number;
}

interface ActionPlan {
  id: string;
  label: string;
  detail: string;
  actionsBeforeVerify: number;
  requiresApi: boolean;
}

interface ObservationPlanningData {
  title: string;
  description: string;
  defaultSceneId: string;
  defaultObservationId: string;
  defaultPlanId: string;
  channels: Channel[];
  scenes: Scene[];
  observations: ObservationStrategy[];
  plans: ActionPlan[];
}

const BLOCK_ID = 'genai/computer-use-agents-observation-planning-lab';

const strategyIcons: Record<string, LucideIcon> = {
  'pixels-only': Eye,
  'semantics-only': Braces,
  hybrid: Search,
};

const planIcons: Record<string, LucideIcon> = {
  bounded: Route,
  macro: Workflow,
  'api-handoff': Database,
};

const channelStyles: Record<ChannelId, string> = {
  visual:
    'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100',
  semantic:
    'border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100',
  programmatic:
    'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100',
};

function isChannelId(value: unknown): value is ChannelId {
  return value === 'visual' || value === 'semantic' || value === 'programmatic';
}

function isObservationPlanningData(value: unknown): value is ObservationPlanningData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ObservationPlanningData>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaultSceneId
      && candidate.defaultObservationId
      && candidate.defaultPlanId
      && Array.isArray(candidate.channels)
      && candidate.channels.length === 3
      && candidate.channels.every((channel) => (
        isChannelId(channel.id)
        && typeof channel.label === 'string'
        && typeof channel.detail === 'string'
      ))
      && Array.isArray(candidate.scenes)
      && candidate.scenes.length > 0
      && candidate.scenes.every((scene) => (
        typeof scene.id === 'string'
        && typeof scene.label === 'string'
        && typeof scene.task === 'string'
        && typeof scene.origin === 'string'
        && typeof scene.volatility === 'number'
        && typeof scene.apiAvailable === 'boolean'
        && Array.isArray(scene.requiredChannels)
        && scene.requiredChannels.every(isChannelId)
        && typeof scene.target?.label === 'string'
        && typeof scene.target?.role === 'string'
        && typeof scene.target?.locator === 'string'
        && typeof scene.target?.x === 'number'
        && typeof scene.target?.y === 'number'
        && Array.isArray(scene.distractors)
      ))
      && Array.isArray(candidate.observations)
      && candidate.observations.length > 0
      && candidate.observations.every((observation) => (
        typeof observation.id === 'string'
        && typeof observation.label === 'string'
        && Array.isArray(observation.channels)
        && observation.channels.every(isChannelId)
        && typeof observation.freshnessMs === 'number'
      ))
      && Array.isArray(candidate.plans)
      && candidate.plans.length > 0
      && candidate.plans.every((plan) => (
        typeof plan.id === 'string'
        && typeof plan.label === 'string'
        && typeof plan.actionsBeforeVerify === 'number'
        && typeof plan.requiresApi === 'boolean'
      )),
  );
}

export default function ComputerUseAgentsObservationPlanningLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ObservationPlanningData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No observation planning model was supplied.');
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
        if (!isObservationPlanningData(payload)) {
          throw new Error('Observation planning data is incomplete.');
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
  return <ObservationPlanningLab data={data} />;
}

function ObservationPlanningLab({ data }: { data: ObservationPlanningData }) {
  const initialScene = data.scenes.find((item) => item.id === data.defaultSceneId) ?? data.scenes[0];
  const initialObservation = data.observations.find(
    (item) => item.id === data.defaultObservationId,
  ) ?? data.observations[0];
  const initialPlan = data.plans.find((item) => item.id === data.defaultPlanId) ?? data.plans[0];

  const [sceneId, setSceneId] = useState(initialScene.id);
  const [observationId, setObservationId] = useState(initialObservation.id);
  const [planId, setPlanId] = useState(initialPlan.id);

  const scene = data.scenes.find((item) => item.id === sceneId) ?? data.scenes[0];
  const observation = data.observations.find((item) => item.id === observationId)
    ?? data.observations[0];
  const plan = data.plans.find((item) => item.id === planId) ?? data.plans[0];

  const model = useMemo(() => {
    const coveredChannels = scene.requiredChannels.filter((channel) => (
      observation.channels.includes(channel)
    ));
    const evidenceCoverage = scene.requiredChannels.length === 0
      ? 100
      : Math.round((coveredChannels.length / scene.requiredChannels.length) * 100);
    const missingChannels = scene.requiredChannels.filter((channel) => (
      !observation.channels.includes(channel)
    ));
    const apiBlocked = plan.requiresApi && !scene.apiAvailable;
    const macroDrift = !plan.requiresApi
      && plan.actionsBeforeVerify > 1
      && scene.volatility > 0;
    const evidenceIncomplete = !plan.requiresApi && missingChannels.length > 0;

    let tone: ResultTone = 'healthy';
    let verdict = 'Grounded for one bounded action';
    let explanation = `Resolve ${scene.target.label}, execute once, then verify: ${scene.expectedPostcondition}`;

    if (apiBlocked) {
      tone = 'blocked';
      verdict = 'No application contract exists';
      explanation = 'Return to UI planning or stop. An imagined API is not a valid execution path.';
    } else if (evidenceIncomplete) {
      tone = 'blocked';
      verdict = 'Target evidence is incomplete';
      explanation = `Add ${missingChannels.map((item) => data.channels.find((channel) => channel.id === item)?.label ?? item).join(' and ')} before acting.`;
    } else if (macroDrift) {
      tone = 'warning';
      verdict = 'The plan becomes stale before verification';
      explanation = `This surface can change during ${plan.actionsBeforeVerify} queued actions. Execute one action and re-observe.`;
    } else if (plan.requiresApi) {
      verdict = 'Prefer the structured application contract';
      explanation = 'Use the authorized API, then verify the UI only when the user-facing state also matters.';
    }

    const baseConfidence = plan.requiresApi && scene.apiAvailable
      ? 96
      : 40 + (evidenceCoverage * 0.5);
    const driftPenalty = macroDrift ? scene.volatility * plan.actionsBeforeVerify * 8 : 0;
    const confidence = Math.max(18, Math.min(98, Math.round(baseConfidence - driftPenalty)));

    return {
      confidence,
      coveredChannels,
      evidenceCoverage,
      explanation,
      missingChannels,
      tone,
      verdict,
    };
  }, [data.channels, observation.channels, plan, scene]);

  function reset() {
    setSceneId(initialScene.id);
    setObservationId(initialObservation.id);
    setPlanId(initialPlan.id);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Observation and action workspace"
          title={data.title}
          description={data.description}
          icon={Search}
          accent="blue"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup label="1. Interface scene">
                {data.scenes.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scene.id}
                    label={item.label}
                    detail={item.surface}
                    icon={Monitor}
                    accent={item.volatility > 1 ? 'amber' : 'blue'}
                    onClick={() => setSceneId(item.id)}
                  />
                ))}
              </ChoiceGroup>

              <ChoiceGroup label="2. Observation bundle">
                {data.observations.map((item) => {
                  const Icon = strategyIcons[item.id] ?? Eye;
                  return (
                    <LabChoice
                      key={item.id}
                      selected={item.id === observation.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Icon}
                      accent={item.id === 'hybrid' ? 'emerald' : item.id === 'pixels-only' ? 'blue' : 'violet'}
                      onClick={() => setObservationId(item.id)}
                    />
                  );
                })}
              </ChoiceGroup>

              <ChoiceGroup label="3. Action horizon">
                {data.plans.map((item) => {
                  const Icon = planIcons[item.id] ?? Route;
                  return (
                    <LabChoice
                      key={item.id}
                      selected={item.id === plan.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Icon}
                      accent={item.id === 'macro' ? 'rose' : item.id === 'api-handoff' ? 'emerald' : 'cyan'}
                      onClick={() => setPlanId(item.id)}
                    />
                  );
                })}
              </ChoiceGroup>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Evidence coverage"
                value={`${model.evidenceCoverage}%`}
                detail={`${model.coveredChannels.length} of ${scene.requiredChannels.length} required channels`}
                icon={Eye}
                tone={model.evidenceCoverage === 100 ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Target confidence"
                value={`${model.confidence}%`}
                detail="Modeled from coverage and plan drift"
                icon={Gauge}
                tone={model.confidence >= 80 ? 'blue' : model.confidence >= 60 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Verify after"
                value={plan.requiresApi ? 'API result' : `${plan.actionsBeforeVerify} action${plan.actionsBeforeVerify === 1 ? '' : 's'}`}
                detail={scene.volatility === 0 ? 'Stable surface' : `Volatility level ${scene.volatility}`}
                icon={ShieldCheck}
                tone={model.tone === 'healthy' ? 'emerald' : model.tone === 'warning' ? 'amber' : 'rose'}
              />
            </div>

            <InterfaceWorkspace scene={scene} observation={observation} model={model} />

            <ActionTrace scene={scene} plan={plan} tone={model.tone} />

            <section className={`rounded-md border p-4 ${resultStyle(model.tone)}`}>
              <div className="flex items-start gap-3">
                {model.tone === 'healthy' ? (
                  <CircleCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : model.tone === 'warning' ? (
                  <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <XCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-75">Planner decision</p>
                  <h4 className="mt-1 text-base font-semibold">{model.verdict}</h4>
                  <p className="mt-2 text-sm leading-6">{model.explanation}</p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ChoiceGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </legend>
      <div className="mt-3 grid gap-2">{children}</div>
    </fieldset>
  );
}

function InterfaceWorkspace({
  scene,
  observation,
  model,
}: {
  scene: Scene;
  observation: ObservationStrategy;
  model: {
    coveredChannels: ChannelId[];
    missingChannels: ChannelId[];
    tone: ResultTone;
  };
}) {
  const targetStyle = model.tone === 'blocked'
    ? 'border-rose-500 bg-rose-100 text-rose-950 dark:bg-rose-950 dark:text-rose-50'
    : 'border-emerald-500 bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50';

  return (
    <section className="overflow-hidden rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex min-w-0 items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex gap-1" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </div>
        <div className="min-w-0 flex-1 truncate rounded border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
          {scene.origin}
        </div>
        <span className="shrink-0 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
          obs {observation.freshnessMs} ms
        </span>
      </div>

      <div className="grid min-w-0 gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_220px]">
        <div className="relative min-h-[290px] overflow-hidden rounded-md border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-950">
          <div className="absolute inset-x-0 top-0 border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Current task
            </p>
            <p className="mt-1 text-sm font-medium text-neutral-950 dark:text-white">{scene.task}</p>
          </div>

          {scene.distractors.map((item) => (
            <div
              key={item.label}
              className="absolute max-w-[120px] -translate-x-1/2 -translate-y-1/2 rounded border border-neutral-300 bg-neutral-100 px-2 py-1.5 text-center text-[11px] font-medium text-neutral-600 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
              style={{ left: `${item.x}%`, top: `${item.y}%` }}
            >
              {item.label}
            </div>
          ))}

          <div
            className={`absolute max-w-[150px] -translate-x-1/2 -translate-y-1/2 rounded-md border-2 px-3 py-2 text-center text-xs font-semibold shadow-md ${targetStyle}`}
            style={{ left: `${scene.target.x}%`, top: `${scene.target.y}%` }}
          >
            <span className="block">{scene.target.label}</span>
            <span className="mt-1 block text-[10px] font-medium opacity-75">{scene.target.role}</span>
          </div>

          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2">
            {observation.channels.map((channel) => (
              <span
                key={channel}
                className={`rounded border px-2 py-1 text-[11px] font-semibold ${channelStyles[channel]}`}
              >
                {channel}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Evidence overlay
            </p>
            <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">
              {scene.target.locator}
            </p>
          </div>
          {(['visual', 'semantic', 'programmatic'] as ChannelId[]).map((channel) => {
            const active = observation.channels.includes(channel);
            const required = scene.requiredChannels.includes(channel);
            return (
              <div
                key={channel}
                className={`rounded-md border p-3 ${active ? channelStyles[channel] : 'border-neutral-200 bg-white text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold capitalize">{channel}</span>
                  <span className="text-[10px] font-semibold uppercase">
                    {active ? 'captured' : required ? 'missing' : 'optional'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ActionTrace({ scene, plan, tone }: { scene: Scene; plan: ActionPlan; tone: ResultTone }) {
  const steps = plan.requiresApi
    ? ['Call authorized contract', 'Read typed result', 'Verify user-facing state']
    : Array.from({ length: plan.actionsBeforeVerify }, (_, index) => (
      index === 0 ? `Target ${scene.target.label}` : `Queued UI action ${index + 1}`
    )).concat('Capture fresh observation');

  return (
    <section className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            Proposed trace
          </p>
          <h4 className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">{plan.label}</h4>
        </div>
        <span className={`rounded border px-2 py-1 text-[11px] font-semibold uppercase ${resultStyle(tone)}`}>
          {tone}
        </span>
      </div>
      <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-stretch">
        {steps.map((step, index) => (
          <div key={`${step}-${index}`} className="flex min-w-0 flex-1 items-center gap-2">
            {index > 0 ? (
              <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 rotate-90 text-neutral-400 lg:rotate-0" />
            ) : null}
            <div className="flex min-h-14 min-w-0 flex-1 items-center rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
              {step}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function resultStyle(tone: ResultTone) {
  if (tone === 'healthy') {
    return 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100';
  }
  if (tone === 'warning') {
    return 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100';
  }
  return 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100';
}

function LabLoading() {
  return (
    <LearningLab>
      <div className="flex min-h-56 items-center justify-center gap-3 p-6 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
        Loading observation workspace...
      </div>
    </LearningLab>
  );
}

function LabError({ detail }: { detail: string }) {
  return (
    <LearningLab>
      <div className="flex min-h-48 items-start gap-3 p-6 text-rose-800 dark:text-rose-200">
        <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Observation workspace unavailable</p>
          <p className="mt-1 text-sm leading-6">{detail}</p>
        </div>
      </div>
    </LearningLab>
  );
}
