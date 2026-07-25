'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Eye,
  FileInput,
  Fingerprint,
  Gauge,
  Image,
  KeyRound,
  LockKeyhole,
  Network,
  RefreshCw,
  Route,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Wrench,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Severity = 'high' | 'critical';
type TrustKind = 'untrusted' | 'mixed' | 'probabilistic' | 'decision' | 'effect';

interface PathNode {
  id: string;
  label: string;
  trust: TrustKind;
  detail: string;
}

interface ThreatScenario {
  id: string;
  label: string;
  detail: string;
  attacker: string;
  capability: string;
  entry: string;
  targetAsset: string;
  severity: Severity;
  path: PathNode[];
  requiredControls: string[];
  observables: string[];
  consequence: string;
}

interface ControlSet {
  id: string;
  label: string;
  detail: string;
  covers: string[];
  latencyMs: number;
  utilityCost: 'low' | 'moderate' | 'high';
}

interface ThreatPathModel {
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    controlSetId: string;
  };
  controlLabels: Record<string, string>;
  scenarios: ThreatScenario[];
  controlSets: ControlSet[];
}

const BLOCK_ID = 'genai/adversarial-testing-threat-path-lab';
const DEFAULT_DATA_FILE =
  '/api/content/genai/adversarial-testing/data/threat-path-model.json';

function isThreatPathModel(value: unknown): value is ThreatPathModel {
  if (!value || typeof value !== 'object') return false;
  const model = value as Partial<ThreatPathModel>;
  return Boolean(
    model.blockId === BLOCK_ID
      && model.title
      && model.description
      && model.defaults?.scenarioId
      && model.defaults.controlSetId
      && model.controlLabels
      && typeof model.controlLabels === 'object'
      && Array.isArray(model.scenarios)
      && model.scenarios.length >= 3
      && model.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.attacker === 'string'
        && typeof scenario.capability === 'string'
        && Array.isArray(scenario.path)
        && scenario.path.length >= 4
        && scenario.path.every((node) => (
          typeof node.id === 'string'
          && typeof node.label === 'string'
          && typeof node.detail === 'string'
        ))
        && Array.isArray(scenario.requiredControls)
        && scenario.requiredControls.length > 0
        && Array.isArray(scenario.observables)
      ))
      && Array.isArray(model.controlSets)
      && model.controlSets.length >= 3
      && model.controlSets.every((controlSet) => (
        typeof controlSet.id === 'string'
        && Array.isArray(controlSet.covers)
        && typeof controlSet.latencyMs === 'number'
      )),
  );
}

export default function AdversarialTestingThreatPathLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<ThreatPathModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isThreatPathModel(payload)) {
          throw new Error('The threat-path model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load threat data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Threat-path laboratory"
            title="Trace authority across trust boundaries"
            description="Loading the lesson-owned threat model..."
            icon={Route}
            accent="rose"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <ThreatPathLab model={model} />
      )}
    </div>
  );
}

function ThreatPathLab({ model }: { model: ThreatPathModel }) {
  const [scenarioId, setScenarioId] = useState(model.defaults.scenarioId);
  const [controlSetId, setControlSetId] = useState(model.defaults.controlSetId);
  const scenario = model.scenarios.find((item) => item.id === scenarioId)
    ?? model.scenarios[0];
  const controlSet = model.controlSets.find((item) => item.id === controlSetId)
    ?? model.controlSets[0];

  const result = useMemo(() => {
    const covered = scenario.requiredControls.filter((control) => (
      controlSet.covers.includes(control)
    ));
    const missing = scenario.requiredControls.filter((control) => (
      !controlSet.covers.includes(control)
    ));
    const coverage = Math.round(covered.length / scenario.requiredControls.length * 100);
    const contained = missing.length === 0;
    const highFriction = contained && controlSet.utilityCost === 'high';
    const title = !contained
      ? `${missing.length} control ${missing.length === 1 ? 'gap remains' : 'gaps remain'}`
      : highFriction
        ? 'Contained, but every action waits'
        : 'The modeled path is contained';
    const tone = !contained ? 'rose' : highFriction ? 'amber' : 'emerald';

    return { contained, coverage, covered, highFriction, missing, title, tone };
  }, [controlSet, scenario]);

  function reset() {
    setScenarioId(model.defaults.scenarioId);
    setControlSetId(model.defaults.controlSetId);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Threat-path laboratory"
        title={model.title}
        description={model.description}
        icon={Route}
        accent="rose"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Credible entry path
              </legend>
              <div className="mt-3 grid gap-2">
                {model.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.detail}
                    icon={scenarioIcon(item.id)}
                    accent={item.severity === 'critical' ? 'rose' : 'amber'}
                    onClick={() => setScenarioId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Control posture
              </legend>
              <div className="mt-3 grid gap-2">
                {model.controlSets.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === controlSet.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'prompt-guard-only' ? ShieldAlert : item.id === 'trusted-context' ? Fingerprint : item.id === 'bounded-agent' ? LockKeyhole : UserRound}
                    accent={item.id === 'prompt-guard-only' ? 'rose' : item.id === 'bounded-agent' ? 'emerald' : 'blue'}
                    onClick={() => setControlSetId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="space-y-6" aria-live="polite">
          <Outcome result={result} scenario={scenario} />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Severity"
              value={scenario.severity}
              detail={`Target: ${scenario.targetAsset}`}
              icon={AlertTriangle}
              tone={scenario.severity === 'critical' ? 'rose' : 'amber'}
            />
            <LabMetric
              label="Controls covered"
              value={`${result.coverage}%`}
              detail={`${result.covered.length} of ${scenario.requiredControls.length} required`}
              icon={ShieldCheck}
              tone={result.contained ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Added latency"
              value={`~${controlSet.latencyMs}ms`}
              detail="Illustrative control-path overhead"
              icon={Clock3}
              tone="blue"
            />
            <LabMetric
              label="Utility cost"
              value={controlSet.utilityCost}
              detail={result.highFriction ? 'Broad review burden' : 'Modeled workflow impact'}
              icon={Gauge}
              tone={result.highFriction ? 'amber' : 'neutral'}
            />
          </div>

          <section>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Attack path
                </p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  {scenario.entry} to {scenario.targetAsset}
                </h4>
              </div>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Relevant is not the same as trusted
              </span>
            </div>
            <PathDiagram nodes={scenario.path} />
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-start gap-3">
                <KeyRound aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Attacker capability
                  </p>
                  <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">
                    {scenario.attacker}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    {scenario.capability}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-start gap-3">
                <Eye aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-cyan-600 dark:text-cyan-300" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Evidence to preserve
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-neutral-700 dark:text-neutral-300">
                    {scenario.observables.map((observable) => (
                      <li key={observable} className="flex gap-2">
                        <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500" />
                        <span>{observable}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          </div>

          <section className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Required controls
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {scenario.requiredControls.map((control) => {
                const active = controlSet.covers.includes(control);
                return (
                  <div
                    key={control}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                      active
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                        : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
                    }`}
                  >
                    {active
                      ? <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
                      : <CircleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />}
                    <span>{model.controlLabels[control] ?? control}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function Outcome({
  result,
  scenario,
}: {
  result: {
    contained: boolean;
    highFriction: boolean;
    missing: string[];
    title: string;
    tone: string;
  };
  scenario: ThreatScenario;
}) {
  const styles = result.tone === 'emerald'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
    : result.tone === 'amber'
      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'
      : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50';
  const Icon = result.tone === 'emerald' ? CheckCircle2 : result.tone === 'amber' ? CircleAlert : AlertTriangle;

  return (
    <div className={`rounded-md border p-5 ${styles}`}>
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase opacity-75">Modeled outcome</p>
          <h4 className="mt-1 text-xl font-semibold">{result.title}</h4>
          <p className="mt-2 text-sm leading-6 opacity-85">
            {!result.contained
              ? scenario.consequence
              : result.highFriction
                ? 'The required controls are present, but the review posture can deny timely legitimate work. Match approval strength to consequence and reversibility.'
                : 'Every required boundary has an independent control. This contains the modeled path; it does not prove the absence of unmodeled attacks.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function PathDiagram({ nodes }: { nodes: PathNode[] }) {
  return (
    <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="hidden items-stretch gap-2 lg:flex">
        {nodes.map((node, index) => (
          <div key={node.id} className="contents">
            <PathCard node={node} />
            {index < nodes.length - 1 ? (
              <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 self-center text-neutral-400" />
            ) : null}
          </div>
        ))}
      </div>
      <div className="space-y-2 lg:hidden">
        {nodes.map((node, index) => (
          <div key={node.id}>
            <PathCard node={node} />
            {index < nodes.length - 1 ? (
              <ArrowDown aria-hidden="true" className="mx-auto my-2 h-5 w-5 text-neutral-400" />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function PathCard({ node }: { node: PathNode }) {
  const styles: Record<TrustKind, string> = {
    untrusted: 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35',
    mixed: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/35',
    probabilistic: 'border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/35',
    decision: 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/35',
    effect: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35',
  };
  const Icon = node.trust === 'untrusted'
    ? FileInput
    : node.trust === 'mixed'
      ? Network
      : node.trust === 'probabilistic'
        ? Bot
        : node.trust === 'decision'
          ? ShieldCheck
          : Wrench;

  return (
    <div className={`min-w-0 flex-1 rounded-md border p-3 ${styles[node.trust]}`}>
      <Icon aria-hidden="true" className="h-4 w-4 text-neutral-700 dark:text-neutral-200" />
      <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">{node.label}</p>
      <p className="mt-1 text-xs uppercase text-neutral-500 dark:text-neutral-400">{node.trust}</p>
      <p className="mt-2 text-xs leading-5 text-neutral-700 dark:text-neutral-300">{node.detail}</p>
    </div>
  );
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="p-5 md:p-6">
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-start gap-3">
          {error
            ? <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />
            : <ScanSearch aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 animate-pulse text-violet-600 dark:text-violet-300" />}
          <div>
            <p className="font-semibold text-neutral-950 dark:text-white">
              {error ? 'Threat model unavailable' : 'Loading threat paths'}
            </p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
              {error ?? 'Preparing scenarios, boundaries, and control consequences.'}
            </p>
            {error ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-white"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Retry
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function scenarioIcon(id: string) {
  if (id === 'multimodal-attachment') return Image;
  if (id === 'behavior-extraction') return Fingerprint;
  if (id === 'direct-user-injection') return UserRound;
  if (id === 'tool-result-injection') return Wrench;
  return FileInput;
}
