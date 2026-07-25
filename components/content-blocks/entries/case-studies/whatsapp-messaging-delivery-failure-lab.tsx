'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  CopyCheck,
  Database,
  KeyRound,
  ListRestart,
  LockKeyhole,
  MessageSquareWarning,
  RadioTower,
  Server,
  ShieldCheck,
  Smartphone,
  WifiOff,
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

type StageState = 'active' | 'degraded' | 'failed' | 'idle';
type QueueScope = 'device' | 'user';
type KeyAction = 'repair-session' | 'drop-device' | 'plaintext';

interface RangeData {
  default: number;
  min: number;
  max: number;
  step: number;
}

interface StageData {
  id: string;
  label: string;
  role: string;
}

interface ScenarioData {
  id: string;
  label: string;
  detail: string;
  event: string;
  userImpact: string;
  retryBehavior: string;
  dedupeBehavior: string;
  queueBehavior: string;
  keyBehavior: string;
  recovery: string[];
  stageStates: Record<string, StageState>;
  requirements: string[];
}

interface PolicyData {
  id: string;
  label: string;
  detail: string;
  preservesMessageId: boolean;
  queueScope: QueueScope;
  keyAction: KeyAction;
}

interface FailureLabData {
  title: string;
  description: string;
  retryAttempts: RangeData;
  stages: StageData[];
  scenarios: ScenarioData[];
  policies: PolicyData[];
}

const stageIcons: Record<string, LucideIcon> = {
  sender: Smartphone,
  router: Server,
  queue: Database,
  recipient: LockKeyhole,
  ack: CopyCheck,
};

const stateStyles: Record<StageState, string> = {
  active:
    'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50',
  degraded:
    'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50',
  failed:
    'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50',
  idle: 'border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300',
};

const stateLabels: Record<StageState, string> = {
  active: 'Active',
  degraded: 'Waiting',
  failed: 'Blocked',
  idle: 'Not reached',
};

function isRangeData(value: unknown): value is RangeData {
  if (!value || typeof value !== 'object') return false;
  const range = value as Partial<RangeData>;
  return (
    typeof range.default === 'number' &&
    typeof range.min === 'number' &&
    typeof range.max === 'number' &&
    typeof range.step === 'number' &&
    range.min < range.max &&
    range.step > 0 &&
    range.default >= range.min &&
    range.default <= range.max
  );
}

function isFailureLabData(value: unknown): value is FailureLabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<FailureLabData>;
  return (
    typeof data.title === 'string' &&
    typeof data.description === 'string' &&
    isRangeData(data.retryAttempts) &&
    Array.isArray(data.stages) &&
    data.stages.length >= 3 &&
    data.stages.every(
      (stage) =>
        typeof stage.id === 'string' &&
        typeof stage.label === 'string' &&
        typeof stage.role === 'string',
    ) &&
    Array.isArray(data.scenarios) &&
    data.scenarios.length > 0 &&
    data.scenarios.every(
      (scenario) =>
        typeof scenario.id === 'string' &&
        typeof scenario.label === 'string' &&
        typeof scenario.detail === 'string' &&
        typeof scenario.event === 'string' &&
        typeof scenario.userImpact === 'string' &&
        typeof scenario.retryBehavior === 'string' &&
        typeof scenario.dedupeBehavior === 'string' &&
        typeof scenario.queueBehavior === 'string' &&
        typeof scenario.keyBehavior === 'string' &&
        Array.isArray(scenario.recovery) &&
        scenario.recovery.every((step) => typeof step === 'string') &&
        scenario.stageStates &&
        typeof scenario.stageStates === 'object' &&
        Array.isArray(scenario.requirements)
    ) &&
    Array.isArray(data.policies) &&
    data.policies.length > 0 &&
    data.policies.every(
      (policy) =>
        typeof policy.id === 'string' &&
        typeof policy.label === 'string' &&
        typeof policy.detail === 'string' &&
        typeof policy.preservesMessageId === 'boolean' &&
        (policy.queueScope === 'device' || policy.queueScope === 'user') &&
        (policy.keyAction === 'repair-session' ||
          policy.keyAction === 'drop-device' ||
          policy.keyAction === 'plaintext'),
    )
  );
}

function StageNode({ stage, state }: { stage: StageData; state: StageState }) {
  const Icon = stageIcons[stage.id] ?? RadioTower;
  const StateIcon =
    state === 'active'
      ? CheckCircle2
      : state === 'idle'
        ? CircleDashed
        : state === 'failed'
          ? CircleAlert
          : WifiOff;

  return (
    <div className={`min-w-0 flex-1 rounded-md border p-3 ${stateStyles[state]}`}>
      <div className="flex items-start justify-between gap-2">
        <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
        <span className="flex items-center gap-1 text-xs font-semibold">
          <StateIcon aria-hidden="true" className="h-3.5 w-3.5" />
          {stateLabels[state]}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold">{stage.label}</p>
      <p className="mt-1 text-xs leading-5 opacity-80">{stage.role}</p>
    </div>
  );
}

export default function WhatsappMessagingDeliveryFailureLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<FailureLabData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [scenarioId, setScenarioId] = useState('');
  const [policyId, setPolicyId] = useState('');
  const [retryAttempts, setRetryAttempts] = useState(1);

  useEffect(() => {
    if (!dataFile) {
      setLoadError(true);
      return;
    }

    const controller = new AbortController();
    setLoadError(false);
    setData(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Failure model request failed: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isFailureLabData(payload)) throw new Error('Failure model data is invalid');
        setData(payload);
        setScenarioId(payload.scenarios[0].id);
        setPolicyId(payload.policies[0].id);
        setRetryAttempts(payload.retryAttempts.default);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(true);
      });

    return () => controller.abort();
  }, [dataFile]);

  const model = useMemo(() => {
    if (!data) return null;
    const scenario = data.scenarios.find((candidate) => candidate.id === scenarioId);
    const policy = data.policies.find((candidate) => candidate.id === policyId);
    if (!scenario || !policy) return null;

    const violations: string[] = [];
    if (!policy.preservesMessageId) {
      violations.push(
        'Retries use new logical IDs, so the recipient cannot prove that repeated attempts are the same message.',
      );
    }
    if (scenario.requirements.includes('per-device-queue') && policy.queueScope !== 'device') {
      violations.push(
        'A successful tablet ACK clears user-level work while the offline phone still has no delivery.',
      );
    }
    if (scenario.requirements.includes('session-repair')) {
      if (policy.keyAction === 'drop-device') {
        violations.push('The affected device remains missing instead of repairing its encrypted session.');
      }
      if (policy.keyAction === 'plaintext') {
        violations.push(
          'Server plaintext fallback breaks the end-to-end encryption boundary and must be rejected.',
        );
      }
    } else if (policy.keyAction === 'plaintext') {
      violations.push(
        'This failure does not need key repair, but the selected contract still contains an unacceptable plaintext fallback.',
      );
    }

    const privacyViolation = policy.keyAction === 'plaintext';
    const visibleCopies = policy.preservesMessageId ? 1 : retryAttempts;
    const suppressedCopies = policy.preservesMessageId ? Math.max(0, retryAttempts - 1) : 0;

    return {
      scenario,
      policy,
      violations,
      privacyViolation,
      visibleCopies,
      suppressedCopies,
      safe: violations.length === 0,
    };
  }, [data, policyId, retryAttempts, scenarioId]);

  return (
    <div data-content-block="case-studies/whatsapp-messaging-delivery-failure-lab">
      {loadError ? (
        <div
          role="alert"
          className="min-h-40 rounded-md border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
        >
          The offline delivery failure model could not be loaded.
        </div>
      ) : !data || !model ? (
        <div
          aria-busy="true"
          aria-label="Loading offline delivery failure model"
          className="min-h-[900px] animate-pulse rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
        />
      ) : (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Offline delivery, acknowledgement, and encryption lab"
            title={data.title}
            description={data.description}
            icon={MessageSquareWarning}
            accent="rose"
            onReset={() => {
              setScenarioId(data.scenarios[0].id);
              setPolicyId(data.policies[0].id);
              setRetryAttempts(data.retryAttempts.default);
            }}
          />
          <LearningLabBody
            controls={
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Inject a failure
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.scenarios.map((scenario) => (
                      <LabChoice
                        key={scenario.id}
                        selected={scenario.id === model.scenario.id}
                        label={scenario.label}
                        detail={scenario.detail}
                        icon={WifiOff}
                        accent="amber"
                        onClick={() => setScenarioId(scenario.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Choose a recovery contract
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.policies.map((policy) => (
                      <LabChoice
                        key={policy.id}
                        selected={policy.id === model.policy.id}
                        label={policy.label}
                        detail={policy.detail}
                        icon={policy.keyAction === 'plaintext' ? CircleAlert : ShieldCheck}
                        accent={policy.id === 'bounded-per-device' ? 'emerald' : 'violet'}
                        onClick={() => setPolicyId(policy.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="Delivery attempts"
                  value={retryAttempts}
                  output={retryAttempts.toString()}
                  min={data.retryAttempts.min}
                  max={data.retryAttempts.max}
                  step={data.retryAttempts.step}
                  accent="rose"
                  lowLabel="First attempt"
                  highLabel="Repeated uncertainty"
                  onChange={setRetryAttempts}
                />
              </div>
            }
          >
            <div className="flex flex-col items-stretch gap-2 lg:flex-row lg:items-stretch">
              {data.stages.map((stage, index) => {
                const state = model.scenario.stageStates[stage.id] ?? 'idle';
                return (
                  <div key={stage.id} className="contents">
                    <StageNode stage={stage} state={state} />
                    {index < data.stages.length - 1 ? (
                      <div className="flex shrink-0 items-center justify-center text-neutral-400 dark:text-neutral-600">
                        <ArrowDown aria-hidden="true" className="h-5 w-5 lg:hidden" />
                        <ArrowRight aria-hidden="true" className="hidden h-5 w-5 lg:block" />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Retry attempts"
                value={retryAttempts.toString()}
                detail="Same uncertainty, repeated delivery work"
                icon={ListRestart}
                tone="amber"
              />
              <LabMetric
                label="Visible copies"
                value={model.visibleCopies.toString()}
                detail={
                  model.policy.preservesMessageId
                    ? `${model.suppressedCopies} duplicate attempts suppressed`
                    : 'Each retry looks like a new message'
                }
                icon={CopyCheck}
                tone={model.policy.preservesMessageId ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Queue ownership"
                value={model.policy.queueScope === 'device' ? 'Per device' : 'Per user'}
                detail={
                  model.policy.queueScope === 'device'
                    ? 'Each device ACK advances independently'
                    : 'First device success can hide another miss'
                }
                icon={Database}
                tone={model.policy.queueScope === 'device' ? 'blue' : 'amber'}
              />
              <LabMetric
                label="Key response"
                value={
                  model.policy.keyAction === 'repair-session'
                    ? 'Client repair'
                    : model.policy.keyAction === 'drop-device'
                      ? 'Drop device'
                      : 'Plaintext'
                }
                detail={
                  model.policy.keyAction === 'repair-session'
                    ? 'Re-establish and encrypt at the endpoint'
                    : model.policy.keyAction === 'drop-device'
                      ? 'Availability is reduced'
                      : 'Privacy invariant is broken'
                }
                icon={KeyRound}
                tone={
                  model.policy.keyAction === 'repair-session'
                    ? 'emerald'
                    : model.policy.keyAction === 'drop-device'
                      ? 'amber'
                      : 'rose'
                }
              />
            </div>

            <div
              className={`mt-6 border-l-4 p-4 ${
                model.safe
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                  : model.privacyViolation
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30'
                    : 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
              }`}
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                {model.safe ? (
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300"
                  />
                ) : (
                  <CircleAlert
                    aria-hidden="true"
                    className={`mt-0.5 h-5 w-5 shrink-0 ${
                      model.privacyViolation
                        ? 'text-rose-600 dark:text-rose-300'
                        : 'text-amber-600 dark:text-amber-300'
                    }`}
                  />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    User-visible result
                  </p>
                  <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                    {model.safe
                      ? 'Recovery preserves identity, device progress, and encryption'
                      : model.privacyViolation
                        ? 'Recovery is blocked because privacy would be weakened'
                        : 'Recovery completes with a correctness or availability gap'}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    {model.scenario.userImpact}
                  </p>
                  {model.violations.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                      {model.violations.map((violation) => (
                        <li key={violation}>{violation}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                      The service retries bounded ciphertext work while endpoints own decryption and
                      session repair.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-neutral-200 pt-6 dark:border-neutral-800">
              <h4 className="text-base font-semibold text-neutral-950 dark:text-white">
                What changed in this failure
              </h4>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                {model.scenario.event}
              </p>
              <dl className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Retry rule
                  </dt>
                  <dd className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    {model.scenario.retryBehavior}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Duplicate suppression
                  </dt>
                  <dd className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    {model.scenario.dedupeBehavior}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Per-device state
                  </dt>
                  <dd className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    {model.scenario.queueBehavior}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Encryption state
                  </dt>
                  <dd className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    {model.scenario.keyBehavior}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="mt-6 border-t border-neutral-200 pt-6 dark:border-neutral-800">
              <h4 className="text-base font-semibold text-neutral-950 dark:text-white">Safe recovery order</h4>
              <ol className="mt-3 space-y-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                {model.scenario.recovery.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white dark:bg-neutral-100 dark:text-neutral-950">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </LearningLabBody>
        </LearningLab>
      )}
    </div>
  );
}
