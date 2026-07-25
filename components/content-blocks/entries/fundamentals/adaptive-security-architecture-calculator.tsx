'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BadgeCheck,
  Ban,
  CheckCircle2,
  CircleAlert,
  Fingerprint,
  KeyRound,
  Laptop,
  LockKeyhole,
  MapPin,
  Radar,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type SignalState = 'healthy' | 'neutral' | 'adverse';
type Decision = 'allow' | 'challenge' | 'deny';

type VerificationMode = {
  id: string;
  label: string;
  detail: string;
  assurance: number;
};

type ResourcePolicy = {
  id: string;
  label: string;
  detail: string;
  classification: string;
  requiredAssurance: number;
  requiresManagedDevice: boolean;
};

type Signal = {
  label: string;
  value: string;
  state: SignalState;
};

type AccessScenario = {
  id: string;
  label: string;
  detail: string;
  subject: string;
  managedDevice: boolean;
  deviceCompliant: boolean;
  contextIsNew: boolean;
  confirmedCompromise: boolean;
  signals: Signal[];
};

type AccessDecisionModel = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    resourceId: string;
    verificationId: string;
  };
  verificationModes: VerificationMode[];
  resources: ResourcePolicy[];
  scenarios: AccessScenario[];
};

type RuleTrace = {
  id: string;
  label: string;
  detail: string;
  state: 'passed' | 'triggered' | 'not-run';
};

const BLOCK_ID = 'fundamentals/adaptive-security-architecture-calculator';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/adaptive-security-architecture/data/access-decision-model.json';

function isAccessDecisionModel(value: unknown): value is AccessDecisionModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AccessDecisionModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.scenarioId
      && candidate.defaults.resourceId
      && candidate.defaults.verificationId
      && Array.isArray(candidate.verificationModes)
      && candidate.verificationModes.length >= 2
      && candidate.verificationModes.every((mode) => (
        typeof mode.id === 'string'
        && typeof mode.label === 'string'
        && typeof mode.detail === 'string'
        && typeof mode.assurance === 'number'
      ))
      && Array.isArray(candidate.resources)
      && candidate.resources.length >= 2
      && candidate.resources.every((resource) => (
        typeof resource.id === 'string'
        && typeof resource.label === 'string'
        && typeof resource.detail === 'string'
        && typeof resource.classification === 'string'
        && typeof resource.requiredAssurance === 'number'
        && typeof resource.requiresManagedDevice === 'boolean'
      ))
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length >= 3
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.detail === 'string'
        && typeof scenario.subject === 'string'
        && typeof scenario.managedDevice === 'boolean'
        && typeof scenario.deviceCompliant === 'boolean'
        && typeof scenario.contextIsNew === 'boolean'
        && typeof scenario.confirmedCompromise === 'boolean'
        && Array.isArray(scenario.signals)
        && scenario.signals.length > 0
        && scenario.signals.every((signal) => (
          typeof signal.label === 'string'
          && typeof signal.value === 'string'
          && ['healthy', 'neutral', 'adverse'].includes(signal.state)
        ))
      )),
  );
}

export default function AdaptiveSecurityArchitectureCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<AccessDecisionModel | null>(null);
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
        if (!isAccessDecisionModel(payload)) {
          throw new Error('The access-decision model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load access policy.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Continuous access decision"
            title="Follow the evidence to an access decision"
            description="Loading the lesson-owned request and policy model."
            icon={Fingerprint}
            accent="violet"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <AccessDecisionLab model={model} />
      )}
    </div>
  );
}

function AccessDecisionLab({ model }: { model: AccessDecisionModel }) {
  const [scenarioId, setScenarioId] = useState(model.defaults.scenarioId);
  const [resourceId, setResourceId] = useState(model.defaults.resourceId);
  const [verificationId, setVerificationId] = useState(model.defaults.verificationId);

  const scenario = model.scenarios.find((item) => item.id === scenarioId) ?? model.scenarios[0];
  const resource = model.resources.find((item) => item.id === resourceId) ?? model.resources[0];
  const verification = model.verificationModes.find((item) => item.id === verificationId)
    ?? model.verificationModes[0];

  const result = useMemo(() => {
    const ruleDefinitions: Array<Omit<RuleTrace, 'state'> & {
      violated: boolean;
      decision: Decision;
    }> = [
      {
        id: 'compromise',
        label: 'Confirmed compromise',
        detail: scenario.confirmedCompromise
          ? 'Current evidence confirms this credential boundary is compromised.'
          : 'No confirmed credential compromise is attached to this request.',
        violated: scenario.confirmedCompromise,
        decision: 'deny',
      },
      {
        id: 'device',
        label: 'Device requirement',
        detail: resource.requiresManagedDevice
          ? scenario.managedDevice && scenario.deviceCompliant
            ? 'The resource requires a compliant managed device, and this request has one.'
            : 'The resource requires a compliant managed device, but current evidence does not prove one.'
          : 'This resource does not require a managed device in the illustrative policy.',
        violated: resource.requiresManagedDevice
          && (!scenario.managedDevice || !scenario.deviceCompliant),
        decision: 'deny',
      },
      {
        id: 'assurance',
        label: 'Authentication assurance',
        detail: verification.assurance >= resource.requiredAssurance
          ? 'The presented verification meets this resource requirement.'
          : 'The request needs fresh phishing-resistant verification before access can be issued.',
        violated: verification.assurance < resource.requiredAssurance,
        decision: 'challenge',
      },
      {
        id: 'context',
        label: 'New-context policy',
        detail: scenario.contextIsNew && verification.assurance < 2
          ? 'A new context using only the current session requires fresh verification.'
          : 'The context rule is satisfied by familiar context or fresh verification.',
        violated: scenario.contextIsNew && verification.assurance < 2,
        decision: 'challenge',
      },
    ];

    const triggerIndex = ruleDefinitions.findIndex((rule) => rule.violated);
    const decision = triggerIndex === -1 ? 'allow' : ruleDefinitions[triggerIndex].decision;
    const trace: RuleTrace[] = ruleDefinitions.map((rule, index) => ({
      id: rule.id,
      label: rule.label,
      detail: rule.detail,
      state: triggerIndex === -1 || index < triggerIndex
        ? 'passed'
        : index === triggerIndex
          ? 'triggered'
          : 'not-run',
    }));

    const reason = decision === 'deny'
      ? triggerIndex === 0
        ? 'Deny and revoke the compromised session boundary.'
        : 'Deny until the resource device requirement is satisfied.'
      : decision === 'challenge'
        ? 'Pause access and require fresh phishing-resistant verification.'
        : 'Issue short-lived, resource-scoped access and retain the decision trace.';
    const next = decision === 'deny'
      ? scenario.confirmedCompromise
        ? 'Revoke sessions, preserve evidence, and open an incident.'
        : 'Move the request to a compliant managed device.'
      : decision === 'challenge'
        ? 'Complete the requested verification, then evaluate the request again.'
        : 'Continue monitoring; re-evaluate when evidence or requested action changes.';

    return { decision, next, reason, trace };
  }, [resource, scenario, verification]);

  const decisionStyle = result.decision === 'allow'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
    : result.decision === 'challenge'
      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'
      : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50';
  const DecisionIcon = result.decision === 'allow'
    ? CheckCircle2
    : result.decision === 'challenge'
      ? KeyRound
      : Ban;

  function reset() {
    setScenarioId(model.defaults.scenarioId);
    setResourceId(model.defaults.resourceId);
    setVerificationId(model.defaults.verificationId);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Continuous access decision"
        title={model.title}
        description={model.description}
        icon={Fingerprint}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Request evidence
              </legend>
              <div className="mt-3 grid gap-2">
                {model.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'stolen-session' ? TriangleAlert : MapPin}
                    accent={item.id === 'stolen-session' ? 'rose' : 'cyan'}
                    onClick={() => setScenarioId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Protected resource
              </legend>
              <div className="mt-3 grid gap-2">
                {model.resources.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === resource.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'engineering-wiki' ? Laptop : LockKeyhole}
                    accent={item.id === 'engineering-wiki' ? 'blue' : 'violet'}
                    onClick={() => setResourceId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Verification presented now
              </legend>
              <div className="mt-3 grid gap-2">
                {model.verificationModes.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === verification.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.assurance > 1 ? BadgeCheck : KeyRound}
                    accent={item.assurance > 1 ? 'emerald' : 'amber'}
                    onClick={() => setVerificationId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="space-y-6" aria-live="polite">
          <div className={`rounded-md border p-5 ${decisionStyle}`}>
            <div className="flex items-start gap-3">
              <DecisionIcon aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase opacity-75">Policy decision</p>
                <h4 className="mt-1 text-xl font-semibold capitalize">{result.decision}</h4>
                <p className="mt-2 text-sm leading-6 opacity-85">{result.reason}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {scenario.signals.map((signal) => (
              <SignalCard key={signal.label} signal={signal} />
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Subject"
              value={scenario.subject}
              detail="The authenticated subject remains bound to the request."
              icon={Fingerprint}
              tone="blue"
            />
            <LabMetric
              label="Classification"
              value={resource.classification}
              detail={resource.requiresManagedDevice ? 'Compliant managed device required' : 'Managed device not required'}
              icon={LockKeyhole}
              tone="violet"
            />
            <LabMetric
              label="Presented assurance"
              value={verification.assurance > 1 ? 'Fresh resistant auth' : 'Current session'}
              detail={`Resource requirement: level ${resource.requiredAssurance} in this example policy`}
              icon={ShieldCheck}
              tone={verification.assurance >= resource.requiredAssurance ? 'emerald' : 'amber'}
            />
          </div>

          <section className="overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Ordered policy trace
              </p>
            </header>
            <ol className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {result.trace.map((rule, index) => (
                <RuleStep key={rule.id} index={index} rule={rule} />
              ))}
            </ol>
          </section>

          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Next control</p>
            <p className="mt-2 text-sm font-medium leading-6 text-neutral-900 dark:text-neutral-100">{result.next}</p>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function SignalCard({ signal }: { signal: Signal }) {
  const style = signal.state === 'healthy'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
    : signal.state === 'adverse'
      ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
      : 'border-neutral-200 bg-neutral-50 text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100';
  const Icon = signal.state === 'healthy' ? CheckCircle2 : signal.state === 'adverse' ? CircleAlert : Activity;

  return (
    <div className={`rounded-md border p-3 ${style}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {signal.label}
      </div>
      <p className="mt-2 text-sm font-semibold leading-5">{signal.value}</p>
    </div>
  );
}

function RuleStep({ index, rule }: { index: number; rule: RuleTrace }) {
  const Icon = rule.state === 'passed' ? CheckCircle2 : rule.state === 'triggered' ? CircleAlert : Activity;
  const iconStyle = rule.state === 'passed'
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
    : rule.state === 'triggered'
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
      : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400';

  return (
    <li className={`flex gap-3 px-4 py-4 ${rule.state === 'not-run' ? 'opacity-55' : ''}`}>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconStyle}`}>
        <Icon aria-hidden="true" className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-neutral-950 dark:text-white">
            {index + 1}. {rule.label}
          </p>
          <span className="rounded-sm border border-current px-1.5 py-0.5 text-[10px] font-semibold uppercase opacity-70">
            {rule.state === 'not-run' ? 'not evaluated' : rule.state}
          </span>
        </div>
        <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{rule.detail}</p>
      </div>
    </li>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="flex min-h-[280px] items-center justify-center p-6">
      {error ? (
        <div className="max-w-md text-center" role="alert">
          <TriangleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
          <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">Access model could not be loaded</p>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-500"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Try again
          </button>
        </div>
      ) : (
        <div className="text-center" role="status">
          <Radar aria-hidden="true" className="mx-auto h-7 w-7 animate-pulse text-violet-500 motion-reduce:animate-none" />
          <p className="mt-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">Loading access policy...</p>
        </div>
      )}
    </div>
  );
}
