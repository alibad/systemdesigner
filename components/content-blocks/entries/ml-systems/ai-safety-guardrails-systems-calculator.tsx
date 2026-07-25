'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  Check,
  CircleOff,
  FileInput,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/ai-safety-guardrails-systems/data/runtime-guardrail-scenarios.json';
const BLOCK_ID = 'ml-systems/ai-safety-guardrails-systems-calculator';

type Authority = 'none' | 'read' | 'write';
type InputTrust = 'trusted' | 'untrusted';
type PolicyDecision = 'allow' | 'deny';
type OutputClass = 'ordinary' | 'sensitive';

type AuthorityMode = {
  id: string;
  label: string;
  detail: string;
  maximumAuthority: Authority;
};

type Scenario = {
  id: string;
  label: string;
  summary: string;
  action: string;
  inputTrust: InputTrust;
  requiredAuthority: Authority;
  policyDecision: PolicyDecision;
  policyReason: string;
  outputClass: OutputClass;
  requiresApproval: boolean;
  safeAlternative: string;
};

type RuntimeLabData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    authorityId: string;
    humanApproval: boolean;
    policyAvailable: boolean;
  };
  authorityModes: AuthorityMode[];
  scenarios: Scenario[];
};

type TraceTone = 'pass' | 'warn' | 'fail' | 'idle';

type TraceStep = {
  title: string;
  label: string;
  detail: string;
  tone: TraceTone;
};

const authorityRank: Record<Authority, number> = {
  none: 0,
  read: 1,
  write: 2,
};

function isRuntimeLabData(value: unknown): value is RuntimeLabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<RuntimeLabData>;
  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && data.defaults
      && typeof data.defaults.scenarioId === 'string'
      && typeof data.defaults.authorityId === 'string'
      && typeof data.defaults.humanApproval === 'boolean'
      && typeof data.defaults.policyAvailable === 'boolean'
      && Array.isArray(data.authorityModes)
      && data.authorityModes.length === 3
      && data.authorityModes.every((mode) => (
        typeof mode.id === 'string'
        && typeof mode.label === 'string'
        && typeof mode.detail === 'string'
        && ['none', 'read', 'write'].includes(mode.maximumAuthority)
      ))
      && Array.isArray(data.scenarios)
      && data.scenarios.length >= 4
      && data.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.summary === 'string'
        && typeof scenario.action === 'string'
        && ['trusted', 'untrusted'].includes(scenario.inputTrust)
        && ['none', 'read', 'write'].includes(scenario.requiredAuthority)
        && ['allow', 'deny'].includes(scenario.policyDecision)
        && typeof scenario.policyReason === 'string'
        && ['ordinary', 'sensitive'].includes(scenario.outputClass)
        && typeof scenario.requiresApproval === 'boolean'
        && typeof scenario.safeAlternative === 'string'
      )),
  );
}

function traceToneClasses(tone: TraceTone) {
  if (tone === 'pass') {
    return 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-100';
  }
  if (tone === 'warn') {
    return 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-100';
  }
  if (tone === 'fail') {
    return 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-100';
  }
  return 'border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300';
}

export default function AISafetyGuardrailsSystemsRuntimeLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<RuntimeLabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState('');
  const [authorityId, setAuthorityId] = useState('');
  const [humanApproval, setHumanApproval] = useState(false);
  const [policyAvailable, setPolicyAvailable] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load runtime scenarios (${response.status}).`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isRuntimeLabData(payload)) {
          throw new Error('Runtime scenario data does not match the expected contract.');
        }
        setData(payload);
        setScenarioId(payload.defaults.scenarioId);
        setAuthorityId(payload.defaults.authorityId);
        setHumanApproval(payload.defaults.humanApproval);
        setPolicyAvailable(payload.defaults.policyAvailable);
      })
      .catch((loadError: unknown) => {
        if ((loadError as { name?: string }).name !== 'AbortError') {
          setError(loadError instanceof Error ? loadError.message : 'Could not load runtime data.');
        }
      });

    return () => controller.abort();
  }, [dataFile]);

  const scenario = data?.scenarios.find((item) => item.id === scenarioId)
    ?? data?.scenarios[0];
  const authority = data?.authorityModes.find((item) => item.id === authorityId)
    ?? data?.authorityModes[0];

  const result = useMemo(() => {
    if (!scenario || !authority) return null;

    const policyOutageBlocks = !policyAvailable
      && (scenario.requiredAuthority !== 'none' || scenario.outputClass === 'sensitive');
    const policyDenies = scenario.policyDecision === 'deny';
    const outputBlocks = scenario.outputClass === 'sensitive';
    const authorityBlocks =
      authorityRank[authority.maximumAuthority] < authorityRank[scenario.requiredAuthority];
    const approvalHolds = scenario.requiresApproval && !humanApproval;

    let decision: 'allow' | 'hold' | 'block' = 'allow';
    let title = scenario.requiredAuthority === 'none'
      ? 'Return a bounded answer'
      : 'Execute through the tool gateway';
    let detail = scenario.policyReason;

    if (policyOutageBlocks) {
      decision = 'block';
      title = 'Fail closed';
      detail = 'Required policy evidence is unavailable, so the high-risk path cannot proceed.';
    } else if (policyDenies) {
      decision = 'block';
      title = 'Block the requested consequence';
      detail = scenario.policyReason;
    } else if (outputBlocks) {
      decision = 'block';
      title = 'Block sensitive output';
      detail = 'The output boundary detected data that cannot cross the current tenant scope.';
    } else if (authorityBlocks) {
      decision = 'block';
      title = 'Capability denied';
      detail = `This request needs ${scenario.requiredAuthority} authority, but the runtime is limited to ${authority.maximumAuthority}.`;
    } else if (approvalHolds) {
      decision = 'hold';
      title = 'Prepare, then require approval';
      detail = 'The action is policy-eligible, but a named person must approve the side effect.';
    }

    const policyStops = policyOutageBlocks || policyDenies;
    const outputReached = !policyStops;
    const capabilityReached = outputReached && !outputBlocks;
    const approvalReached = capabilityReached && !authorityBlocks;

    const trace: TraceStep[] = [
      {
        title: 'Context boundary',
        label: scenario.inputTrust === 'untrusted' ? 'Untrusted content isolated' : 'Caller context verified',
        detail: scenario.inputTrust === 'untrusted'
          ? 'External text remains data; it does not become application authority.'
          : 'Identity and tenant scope travel with the request.',
        tone: scenario.inputTrust === 'untrusted' ? 'warn' : 'pass',
      },
      {
        title: 'Policy boundary',
        label: !policyAvailable
          ? 'Policy unavailable'
          : policyDenies
            ? 'Policy denies action'
            : 'Policy allows path',
        detail: !policyAvailable
          ? policyOutageBlocks
            ? 'The path stops because required evidence is missing.'
            : 'The runtime can only return a non-actioning fallback.'
          : scenario.policyReason,
        tone: policyStops ? 'fail' : !policyAvailable ? 'warn' : 'pass',
      },
      {
        title: outputReached ? 'Output and capability' : 'Output and capability',
        label: !outputReached
          ? 'Not reached'
          : outputBlocks
            ? 'Sensitive data blocked'
            : authorityBlocks
              ? 'Tool scope denied'
              : 'Boundary satisfied',
        detail: !outputReached
          ? 'An earlier deterministic control ended the path.'
          : outputBlocks
            ? 'Content safety and tenant authorization are separate checks.'
            : authorityBlocks
              ? `Configured maximum: ${authority.maximumAuthority}. Required: ${scenario.requiredAuthority}.`
              : `The ${authority.label.toLowerCase()} envelope can support this request.`,
        tone: !outputReached ? 'idle' : outputBlocks || authorityBlocks ? 'fail' : 'pass',
      },
      {
        title: 'Human authority',
        label: !approvalReached
          ? 'Not reached'
          : !scenario.requiresApproval
            ? 'Not required'
            : humanApproval
              ? 'Approval recorded'
              : 'Approval required',
        detail: !approvalReached
          ? 'The action was already contained.'
          : !scenario.requiresApproval
            ? 'The declared policy does not require a human for this consequence.'
            : humanApproval
              ? 'The approver remains accountable for this exact action.'
              : 'The model may prepare the action but cannot commit it.',
        tone: !approvalReached
          ? 'idle'
          : !scenario.requiresApproval || humanApproval
            ? 'pass'
            : 'warn',
      },
    ];

    return {
      approvalHolds,
      authorityBlocks,
      decision,
      detail,
      policyOutageBlocks,
      title,
      trace,
    };
  }, [authority, humanApproval, policyAvailable, scenario]);

  function reset() {
    if (!data) return;
    setScenarioId(data.defaults.scenarioId);
    setAuthorityId(data.defaults.authorityId);
    setHumanApproval(data.defaults.humanApproval);
    setPolicyAvailable(data.defaults.policyAvailable);
  }

  if (!data || !scenario || !authority || !result) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className={`not-prose my-7 min-h-96 rounded-lg border p-5 text-sm ${
          error
            ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100'
            : 'animate-pulse border-neutral-200 bg-neutral-50 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900'
        }`}
        role={error ? 'alert' : undefined}
        aria-label={error ? undefined : 'Loading runtime guardrail lab'}
      >
        {error}
      </div>
    );
  }

  const DecisionIcon = result.decision === 'allow'
    ? BadgeCheck
    : result.decision === 'hold'
      ? UserCheck
      : Ban;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Runtime consequence lab"
          title={data.title}
          description={data.description}
          icon={ShieldCheck}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose the request
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.summary}
                      icon={FileInput}
                      accent="cyan"
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Bound model authority
                </legend>
                <div className="mt-3 space-y-2">
                  {data.authorityModes.map((mode) => (
                    <LabChoice
                      key={mode.id}
                      selected={mode.id === authority.id}
                      label={mode.label}
                      detail={mode.detail}
                      icon={KeyRound}
                      accent="violet"
                      onClick={() => setAuthorityId(mode.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Challenge the control plane
                </legend>
                <div className="mt-3 grid gap-2">
                  <button
                    type="button"
                    aria-pressed={humanApproval}
                    onClick={() => setHumanApproval((current) => !current)}
                    className={`min-h-12 rounded-md border px-3 py-2 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                      humanApproval
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100'
                        : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {humanApproval
                        ? <Check aria-hidden="true" className="h-4 w-4" />
                        : <CircleOff aria-hidden="true" className="h-4 w-4" />}
                      Human approval {humanApproval ? 'recorded' : 'absent'}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={!policyAvailable}
                    onClick={() => setPolicyAvailable((current) => !current)}
                    className={`min-h-12 rounded-md border px-3 py-2 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                      policyAvailable
                        ? 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'
                        : 'border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {policyAvailable
                        ? <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                        : <AlertTriangle aria-hidden="true" className="h-4 w-4" />}
                      Policy service {policyAvailable ? 'available' : 'unavailable'}
                    </span>
                  </button>
                </div>
              </fieldset>
            </div>
          )}
        >
          <div aria-live="polite" className="space-y-6">
            <div
              className={`rounded-md border p-5 ${
                result.decision === 'allow'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-100'
                  : result.decision === 'hold'
                    ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-100'
                    : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-100'
              }`}
            >
              <div className="flex items-start gap-3">
                <DecisionIcon aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-70">
                    {result.decision === 'allow' ? 'Allowed consequence' : result.decision === 'hold' ? 'Held consequence' : 'Blocked consequence'}
                  </p>
                  <h4 className="mt-1 text-xl font-semibold">{result.title}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">{result.detail}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Requested action"
                value={scenario.action}
                detail={`Requires ${scenario.requiredAuthority} authority`}
                icon={FileInput}
                tone="blue"
              />
              <LabMetric
                label="Authority envelope"
                value={authority.label}
                detail={`Maximum: ${authority.maximumAuthority}`}
                icon={LockKeyhole}
                tone={result.authorityBlocks ? 'rose' : 'violet'}
              />
              <LabMetric
                label="Safe fallback"
                value={result.decision === 'allow' ? 'Not needed' : 'Available'}
                detail={scenario.safeAlternative}
                icon={ShieldCheck}
                tone={result.decision === 'allow' ? 'neutral' : 'emerald'}
              />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Decision trace
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {result.trace.map((step, index) => (
                  <div
                    key={step.title}
                    className={`min-h-40 rounded-md border p-4 ${traceToneClasses(step.tone)}`}
                  >
                    <span className="text-xs font-semibold uppercase opacity-65">
                      {index + 1}. {step.title}
                    </span>
                    <p className="mt-2 text-sm font-semibold">{step.label}</p>
                    <p className="mt-2 text-xs leading-5 opacity-75">{step.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
