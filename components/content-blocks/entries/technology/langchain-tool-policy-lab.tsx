'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  CircleAlert,
  EyeOff,
  FileWarning,
  Gauge,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  Repeat2,
  ShieldCheck,
  Siren,
  UserCheck,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Control =
  | 'schema'
  | 'allowlist'
  | 'call-limit'
  | 'approval'
  | 'idempotency'
  | 'reconcile'
  | 'redaction'
  | 'safe-trace';

type Policy = {
  id: string;
  label: string;
  detail: string;
  controls: Control[];
};

type Incident = {
  id: string;
  label: string;
  detail: string;
  failureStage: number;
  requiredControls: Control[];
  retryRisk: boolean;
  safeResult: string;
  unsafeResult: string;
};

type ToolPolicyData = {
  title: string;
  description: string;
  defaults: { incidentId: string; policyId: string; retries: number };
  stages: string[];
  policies: Policy[];
  incidents: Incident[];
};

type StageStatus = 'complete' | 'protected' | 'exposed' | 'blocked';

const BLOCK_ID = 'technology/langchain-tool-policy-lab';
const controlIds: Control[] = [
  'schema',
  'allowlist',
  'call-limit',
  'approval',
  'idempotency',
  'reconcile',
  'redaction',
  'safe-trace',
];

const controlLabels: Record<Control, string> = {
  schema: 'Typed schema',
  allowlist: 'Tool allowlist',
  'call-limit': 'Call budget',
  approval: 'Human approval',
  idempotency: 'Idempotency key',
  reconcile: 'Outcome reconciliation',
  redaction: 'Sensitive-data redaction',
  'safe-trace': 'Metadata-only traces',
};

const incidentIcons: Record<string, LucideIcon> = {
  'ambiguous-refund': Repeat2,
  'retrieval-injection': FileWarning,
  'runaway-search': RefreshCw,
  'pii-trace': EyeOff,
};

const policyIcons: Record<string, LucideIcon> = {
  permissive: Bot,
  'bounded-loop': Gauge,
  'approval-boundary': UserCheck,
  'sensitive-data': KeyRound,
};

function isControl(value: unknown): value is Control {
  return controlIds.includes(value as Control);
}

function isToolPolicyData(value: unknown): value is ToolPolicyData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ToolPolicyData>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.incidentId
      && candidate.defaults.policyId
      && Number.isFinite(candidate.defaults.retries)
      && Array.isArray(candidate.stages)
      && candidate.stages.length === 5
      && candidate.stages.every((item) => typeof item === 'string')
      && Array.isArray(candidate.policies)
      && candidate.policies.length > 0
      && candidate.policies.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && Array.isArray(item.controls)
        && item.controls.every(isControl)
      ))
      && Array.isArray(candidate.incidents)
      && candidate.incidents.length > 0
      && candidate.incidents.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && Number.isInteger(item.failureStage)
        && item.failureStage >= 1
        && item.failureStage <= 5
        && Array.isArray(item.requiredControls)
        && item.requiredControls.every(isControl)
        && typeof item.retryRisk === 'boolean'
        && typeof item.safeResult === 'string'
        && typeof item.unsafeResult === 'string'
      )),
  );
}

export default function LangChainToolPolicyLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ToolPolicyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No tool-policy incident model was supplied.');
      return;
    }

    const controller = new AbortController();
    setError(null);
    setData(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isToolPolicyData(payload)) throw new Error('The tool-policy model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />;
  }

  return <PolicyControlRoom data={data} />;
}

function PolicyControlRoom({ data }: { data: ToolPolicyData }) {
  const [incidentId, setIncidentId] = useState(data.defaults.incidentId);
  const [policyId, setPolicyId] = useState(data.defaults.policyId);
  const [retries, setRetries] = useState(data.defaults.retries);

  const incident = data.incidents.find((item) => item.id === incidentId) ?? data.incidents[0];
  const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];

  const result = useMemo(() => {
    const active = new Set(policy.controls);
    const missing = incident.requiredControls.filter((control) => !active.has(control));
    const retryProtected = incident.id === 'ambiguous-refund'
      ? active.has('idempotency') && active.has('reconcile')
      : incident.id === 'runaway-search'
        ? active.has('call-limit')
        : true;
    const retrySafe = retries === 0 || !incident.retryRisk || retryProtected;
    const safe = missing.length === 0 && retrySafe;
    const stageStatuses = data.stages.map((_, index): StageStatus => {
      const stage = index + 1;
      if (stage < incident.failureStage) return 'complete';
      if (stage === incident.failureStage) return safe ? 'protected' : 'exposed';
      return safe ? 'complete' : 'blocked';
    });
    const posture = safe ? 'Contained' : missing.length > 0 ? 'Control gap' : 'Unsafe retry';
    const attemptCount = 1 + retries;
    const costMultiplier = incident.id === 'runaway-search' ? attemptCount * 6 : attemptCount;

    return {
      active,
      attemptCount,
      costMultiplier,
      missing,
      posture,
      retrySafe,
      safe,
      stageStatuses,
    };
  }, [data.stages, incident, policy.controls, retries]);

  function reset() {
    setIncidentId(data.defaults.incidentId);
    setPolicyId(data.defaults.policyId);
    setRetries(data.defaults.retries);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Agent policy control room"
          title={data.title}
          description={data.description}
          icon={Siren}
          accent="rose"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Inject an incident
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.incidents.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === incident.id}
                      label={item.label}
                      detail={item.detail}
                      icon={incidentIcons[item.id] ?? AlertTriangle}
                      accent="rose"
                      onClick={() => setIncidentId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Application policy
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.policies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === policy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={policyIcons[item.id] ?? ShieldCheck}
                      accent={item.id === 'permissive' ? 'amber' : item.id === 'approval-boundary' ? 'emerald' : 'blue'}
                      onClick={() => setPolicyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Automatic retries"
                value={retries}
                output={`${retries}`}
                min={0}
                max={3}
                step={1}
                accent="amber"
                lowLabel="Stop and inspect"
                highLabel="Three retries"
                onChange={setRetries}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Incident posture"
                value={result.posture}
                detail={result.safe ? 'The required policy boundary is present.' : 'The selected policy cannot preserve the invariant.'}
                icon={result.safe ? CheckCircle2 : XCircle}
                tone={result.safe ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Missing controls"
                value={`${result.missing.length}`}
                detail={result.missing.length ? result.missing.map((item) => controlLabels[item]).join(', ') : 'No required controls missing'}
                icon={ShieldCheck}
                tone={result.missing.length ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Tool attempts"
                value={`${result.attemptCount}`}
                detail={result.retrySafe ? 'Retry boundary is controlled.' : 'A retry can repeat the failure or side effect.'}
                icon={Repeat2}
                tone={result.retrySafe ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Relative work"
                value={`${result.costMultiplier}x`}
                detail={incident.id === 'runaway-search' ? 'Assumes six tool calls per attempt' : 'One tool execution per attempt'}
                icon={Gauge}
                tone={result.costMultiplier > 3 ? 'amber' : 'neutral'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Tool-call tape
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">{incident.label}</h4>
                </div>
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Pressure appears at step {incident.failureStage}
                </span>
              </div>
              <ol className="mt-4 grid gap-2 sm:grid-cols-5">
                {data.stages.map((stage, index) => {
                  const status = result.stageStatuses[index];
                  const styles = stageStyles[status];
                  const Icon = status === 'complete'
                    ? CheckCircle2
                    : status === 'protected'
                      ? ShieldCheck
                      : status === 'exposed'
                        ? AlertTriangle
                        : XCircle;
                  return (
                    <li key={stage} className={`min-w-0 rounded-md border p-3 ${styles.container}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${styles.badge}`}>
                          {index + 1}
                        </span>
                        <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${styles.icon}`} />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{stage}</p>
                      <p className="mt-1 text-xs capitalize text-neutral-600 dark:text-neutral-300">{status}</p>
                    </li>
                  );
                })}
              </ol>
            </section>

            <div className="grid gap-3 md:grid-cols-2">
              <section className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Controls in this policy
                </p>
                {policy.controls.length ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {policy.controls.map((control) => (
                      <li key={control} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${incident.requiredControls.includes(control) ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100' : 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200'}`}>
                        {controlLabels[control]}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-rose-700 dark:text-rose-300">No application controls wrap the loop.</p>
                )}
              </section>

              <section className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Required for this incident
                </p>
                <ul className="mt-3 space-y-2">
                  {incident.requiredControls.map((control) => {
                    const present = result.active.has(control);
                    return (
                      <li key={control} className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-200">
                        {present
                          ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          : <XCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />}
                        <span>{controlLabels[control]}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>

            <div className={`rounded-md border p-4 ${result.safe ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'}`}>
              <div className="flex items-start gap-3">
                {result.safe
                  ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />}
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">Observed consequence</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                    {result.safe ? incident.safeResult : incident.unsafeResult}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

const stageStyles: Record<StageStatus, { container: string; badge: string; icon: string }> = {
  complete: {
    container: 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-950',
    badge: 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  protected: {
    container: 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35',
    badge: 'bg-emerald-700 text-white dark:bg-emerald-300 dark:text-emerald-950',
    icon: 'text-emerald-700 dark:text-emerald-300',
  },
  exposed: {
    container: 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35',
    badge: 'bg-rose-700 text-white dark:bg-rose-300 dark:text-rose-950',
    icon: 'text-rose-700 dark:text-rose-300',
  },
  blocked: {
    container: 'border-neutral-200 bg-neutral-100 opacity-70 dark:border-neutral-800 dark:bg-neutral-900',
    badge: 'bg-neutral-400 text-white dark:bg-neutral-700',
    icon: 'text-neutral-500 dark:text-neutral-400',
  },
};

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Agent policy control room"
          title="Loading the incident model"
          description="The lab is reading its failure and policy contracts."
          icon={Siren}
          accent="rose"
        />
        <LearningLabBody>
          <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-neutral-300 p-6 text-center dark:border-neutral-700">
            {error ? (
              <div>
                <CircleAlert aria-hidden="true" className="mx-auto h-6 w-6 text-rose-600 dark:text-rose-400" />
                <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">Unable to load the lab</p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
                <button type="button" onClick={onRetry} className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-neutral-700 dark:text-white">
                  Retry
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
                <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
                Loading policy incidents
              </div>
            )}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
