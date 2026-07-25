'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  CheckCircle2,
  CircleAlert,
  Clock3,
  KeyRound,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/jwt-token-validation-trust-boundary-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/jwt/data/token-validation-trust-boundary.json';

type Choice = {
  id: string;
  label: string;
  detail: string;
};

type ValueChoice = Choice & {
  value: string;
};

type TimeState = Choice & {
  expiresInSeconds: number;
  notBeforeInSeconds: number;
};

type KeyState = Choice & {
  available: boolean;
  issuerBound: boolean;
};

type AttackCondition = Choice & {
  algorithm: string;
  tokenType: string;
  signatureValid: boolean;
  keySourceTrusted: boolean;
  replayed: boolean;
};

type ValidationModel = {
  blockId: string;
  title: string;
  description: string;
  policy: {
    issuer: string;
    audience: string;
    algorithm: string;
    tokenType: string;
  };
  defaults: {
    issuerId: string;
    audienceId: string;
    timeStateId: string;
    keyStateId: string;
    attackConditionId: string;
    replayPolicyId: string;
    clockSkewSeconds: number;
  };
  issuers: ValueChoice[];
  audiences: ValueChoice[];
  timeStates: TimeState[];
  keyStates: KeyState[];
  attackConditions: AttackCondition[];
  replayPolicies: Choice[];
};

type CheckStatus = 'pass' | 'fail' | 'warn';

type ValidationCheck = {
  label: string;
  status: CheckStatus;
  detail: string;
};

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isChoice(value: unknown): value is Choice {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Choice>;
  return isString(candidate.id) && isString(candidate.label) && isString(candidate.detail);
}

function isValidationModel(value: unknown): value is ValidationModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ValidationModel>;

  return Boolean(
    isString(candidate.blockId)
      && isString(candidate.title)
      && isString(candidate.description)
      && isString(candidate.policy?.issuer)
      && isString(candidate.policy?.audience)
      && isString(candidate.policy?.algorithm)
      && isString(candidate.policy?.tokenType)
      && isString(candidate.defaults?.issuerId)
      && isString(candidate.defaults?.audienceId)
      && isString(candidate.defaults?.timeStateId)
      && isString(candidate.defaults?.keyStateId)
      && isString(candidate.defaults?.attackConditionId)
      && isString(candidate.defaults?.replayPolicyId)
      && typeof candidate.defaults?.clockSkewSeconds === 'number'
      && Array.isArray(candidate.issuers)
      && candidate.issuers.length >= 2
      && candidate.issuers.every(
        (item) => isChoice(item) && isString((item as Partial<ValueChoice>).value),
      )
      && Array.isArray(candidate.audiences)
      && candidate.audiences.length >= 2
      && candidate.audiences.every(
        (item) => isChoice(item) && isString((item as Partial<ValueChoice>).value),
      )
      && Array.isArray(candidate.timeStates)
      && candidate.timeStates.length >= 3
      && candidate.timeStates.every(
        (item) => isChoice(item)
          && typeof (item as Partial<TimeState>).expiresInSeconds === 'number'
          && typeof (item as Partial<TimeState>).notBeforeInSeconds === 'number',
      )
      && Array.isArray(candidate.keyStates)
      && candidate.keyStates.length >= 3
      && candidate.keyStates.every(
        (item) => isChoice(item)
          && typeof (item as Partial<KeyState>).available === 'boolean'
          && typeof (item as Partial<KeyState>).issuerBound === 'boolean',
      )
      && Array.isArray(candidate.attackConditions)
      && candidate.attackConditions.length >= 4
      && candidate.attackConditions.every(
        (item) => isChoice(item)
          && isString((item as Partial<AttackCondition>).algorithm)
          && isString((item as Partial<AttackCondition>).tokenType)
          && typeof (item as Partial<AttackCondition>).signatureValid === 'boolean'
          && typeof (item as Partial<AttackCondition>).keySourceTrusted === 'boolean'
          && typeof (item as Partial<AttackCondition>).replayed === 'boolean',
      )
      && Array.isArray(candidate.replayPolicies)
      && candidate.replayPolicies.length >= 2
      && candidate.replayPolicies.every(isChoice),
  );
}

function findById<T extends Choice>(items: T[], id: string): T {
  return items.find((item) => item.id === id) ?? items[0];
}

export default function JwtTokenValidationLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<ValidationModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isValidationModel(payload) || payload.blockId !== BLOCK_ID) {
          throw new Error('The JWT validation model is incomplete or has the wrong block ID.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <LabLoadState
        title="Load the token validation model"
        detail={error ?? 'Loading claims, trust policy, key states, and attack conditions.'}
        error={Boolean(error)}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  return <ValidationWorkbench model={model} />;
}

function ValidationWorkbench({ model }: { model: ValidationModel }) {
  const [issuerId, setIssuerId] = useState(model.defaults.issuerId);
  const [audienceId, setAudienceId] = useState(model.defaults.audienceId);
  const [timeStateId, setTimeStateId] = useState(model.defaults.timeStateId);
  const [keyStateId, setKeyStateId] = useState(model.defaults.keyStateId);
  const [attackConditionId, setAttackConditionId] = useState(
    model.defaults.attackConditionId,
  );
  const [replayPolicyId, setReplayPolicyId] = useState(model.defaults.replayPolicyId);
  const [clockSkewSeconds, setClockSkewSeconds] = useState(
    model.defaults.clockSkewSeconds,
  );

  const issuer = findById(model.issuers, issuerId);
  const audience = findById(model.audiences, audienceId);
  const timeState = findById(model.timeStates, timeStateId);
  const keyState = findById(model.keyStates, keyStateId);
  const attack = findById(model.attackConditions, attackConditionId);
  const replayPolicy = findById(model.replayPolicies, replayPolicyId);

  const result = useMemo(() => {
    const algorithmMatches = attack.algorithm === model.policy.algorithm;
    const typeMatches = attack.tokenType.toLowerCase() === model.policy.tokenType.toLowerCase();
    const issuerMatches = issuer.value === model.policy.issuer;
    const keyTrusted = keyState.available
      && keyState.issuerBound
      && attack.keySourceTrusted;
    const signatureValid = algorithmMatches && keyTrusted && attack.signatureValid;
    const audienceMatches = audience.value === model.policy.audience;
    const expirationValid = timeState.expiresInSeconds + clockSkewSeconds > 0;
    const notBeforeValid = timeState.notBeforeInSeconds <= clockSkewSeconds;
    const timeValid = expirationValid && notBeforeValid;
    const oneTimeBoundary = replayPolicy.id === 'one-time-jti';
    const replayRejected = attack.replayed && oneTimeBoundary;
    const replayWarning = attack.replayed && !oneTimeBoundary;

    const checks: ValidationCheck[] = [
      {
        label: 'Algorithm allowlist',
        status: algorithmMatches ? 'pass' : 'fail',
        detail: algorithmMatches
          ? `The protected header uses the configured ${model.policy.algorithm} algorithm.`
          : `The token requests ${attack.algorithm}; this recipient only permits ${model.policy.algorithm}.`,
      },
      {
        label: 'Explicit token type',
        status: typeMatches ? 'pass' : 'fail',
        detail: typeMatches
          ? `The protected header identifies this profile as ${model.policy.tokenType}.`
          : `${attack.tokenType} is not accepted by the access-token validation profile.`,
      },
      {
        label: 'Issuer and key binding',
        status: issuerMatches && keyTrusted ? 'pass' : 'fail',
        detail: !issuerMatches
          ? `The claimed issuer ${issuer.value} is not the configured issuer.`
          : !keyState.available
            ? 'The referenced key is not in the recipient cache or trusted JWKS.'
            : !keyState.issuerBound || !attack.keySourceTrusted
              ? 'The key source is not bound to the configured issuer; token-supplied key URLs are not trusted.'
              : 'The selected key is available from the key set configured for this issuer.',
      },
      {
        label: 'Cryptographic verification',
        status: signatureValid ? 'pass' : 'fail',
        detail: signatureValid
          ? 'The complete JWS verifies with the issuer-bound key and allowed algorithm.'
          : 'The complete JWS cannot be accepted under the configured key and algorithm policy.',
      },
      {
        label: 'Audience restriction',
        status: audienceMatches ? 'pass' : 'fail',
        detail: audienceMatches
          ? `The token names this resource server: ${model.policy.audience}.`
          : `The token is intended for ${audience.value}, not this resource server.`,
      },
      {
        label: 'Time window',
        status: timeValid ? 'pass' : 'fail',
        detail: !expirationValid
          ? `The token expired ${Math.abs(timeState.expiresInSeconds)} seconds ago, beyond the ${clockSkewSeconds}-second tolerance.`
          : !notBeforeValid
            ? `The token is not valid for another ${timeState.notBeforeInSeconds} seconds; tolerance is ${clockSkewSeconds} seconds.`
            : `The exp and nbf checks pass with ${clockSkewSeconds} seconds of configured clock tolerance.`,
      },
      {
        label: 'Replay boundary',
        status: replayRejected ? 'fail' : replayWarning ? 'warn' : 'pass',
        detail: replayRejected
          ? 'This one-time endpoint has already consumed the jti, so the replay is rejected.'
          : replayWarning
            ? 'Signature and claim validation cannot distinguish this copied bearer token; it remains usable until another control stops it.'
            : oneTimeBoundary
              ? 'The endpoint records the jti after first use and rejects a duplicate within the token lifetime.'
              : 'No replay is observed, but an ordinary bearer token remains copyable until expiry or revocation.',
      },
    ];

    const failures = checks.filter((check) => check.status === 'fail');
    const warnings = checks.filter((check) => check.status === 'warn');

    return {
      checks,
      failures,
      warnings,
      accepted: failures.length === 0,
      temporalLabel: timeState.notBeforeInSeconds > 0
        ? `nbf +${timeState.notBeforeInSeconds}s`
        : timeState.expiresInSeconds < 0
          ? `exp ${timeState.expiresInSeconds}s`
          : `exp +${timeState.expiresInSeconds}s`,
    };
  }, [
    attack,
    audience,
    clockSkewSeconds,
    issuer,
    keyState,
    model.policy,
    replayPolicy.id,
    timeState,
  ]);

  function reset() {
    setIssuerId(model.defaults.issuerId);
    setAudienceId(model.defaults.audienceId);
    setTimeStateId(model.defaults.timeStateId);
    setKeyStateId(model.defaults.keyStateId);
    setAttackConditionId(model.defaults.attackConditionId);
    setReplayPolicyId(model.defaults.replayPolicyId);
    setClockSkewSeconds(model.defaults.clockSkewSeconds);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Trust-boundary lab"
          title={model.title}
          description={model.description}
          icon={ScanSearch}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Attack condition
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.attackConditions.map((condition) => (
                    <LabChoice
                      key={condition.id}
                      selected={condition.id === attack.id}
                      label={condition.label}
                      detail={condition.detail}
                      icon={condition.id === 'baseline' ? ShieldCheck : AlertTriangle}
                      accent="cyan"
                      onClick={() => setAttackConditionId(condition.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-4">
                <SelectControl
                  label="Claimed issuer"
                  value={issuer.id}
                  options={model.issuers}
                  onChange={setIssuerId}
                />
                <SelectControl
                  label="Claimed audience"
                  value={audience.id}
                  options={model.audiences}
                  onChange={setAudienceId}
                />
                <SelectControl
                  label="Token time"
                  value={timeState.id}
                  options={model.timeStates}
                  onChange={setTimeStateId}
                />
                <SelectControl
                  label="Verification key state"
                  value={keyState.id}
                  options={model.keyStates}
                  onChange={setKeyStateId}
                />
                <SelectControl
                  label="Replay policy"
                  value={replayPolicy.id}
                  options={model.replayPolicies}
                  onChange={setReplayPolicyId}
                />
              </div>

              <LabRange
                label="Clock tolerance"
                value={clockSkewSeconds}
                output={`${clockSkewSeconds}s`}
                min={0}
                max={120}
                step={15}
                lowLabel="Strict clock"
                highLabel="Wider acceptance"
                accent="cyan"
                onChange={setClockSkewSeconds}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <ValidationVerdict result={result} />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Decision"
                value={result.accepted ? 'Accept' : 'Reject'}
                detail={result.accepted
                  ? result.warnings.length > 0
                    ? 'Cryptographically valid, but replay exposure remains.'
                    : 'Every configured validation gate passed.'
                  : `${result.failures.length} required gate${result.failures.length === 1 ? '' : 's'} failed.`}
                icon={result.accepted ? BadgeCheck : ShieldX}
                tone={result.accepted && result.warnings.length === 0 ? 'emerald' : result.accepted ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Header alg"
                value={attack.algorithm}
                detail={`Allowlist: ${model.policy.algorithm} only`}
                icon={KeyRound}
                tone={attack.algorithm === model.policy.algorithm ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Token time"
                value={result.temporalLabel}
                detail={`Clock tolerance: ${clockSkewSeconds}s`}
                icon={Clock3}
                tone="neutral"
              />
              <LabMetric
                label="Replay policy"
                value={replayPolicy.label}
                detail={replayPolicy.detail}
                icon={RefreshCw}
                tone={attack.replayed && replayPolicy.id !== 'one-time-jti' ? 'amber' : 'violet'}
              />
            </div>

            <TokenSnapshot
              attack={attack}
              issuer={issuer}
              audience={audience}
              timeState={timeState}
              keyState={keyState}
            />

            <section className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                Validation trace
              </h4>
              <ol className="mt-4 grid gap-3">
                {result.checks.map((check, index) => (
                  <ValidationCheckRow key={check.label} check={check} index={index} />
                ))}
              </ol>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function SelectControl<T extends Choice>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: T[];
  onChange: (value: string) => void;
}) {
  const selected = findById(options, value);

  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        {selected.detail}
      </span>
    </label>
  );
}

function ValidationVerdict({
  result,
}: {
  result: {
    accepted: boolean;
    failures: ValidationCheck[];
    warnings: ValidationCheck[];
  };
}) {
  const warning = result.accepted && result.warnings.length > 0;
  const VerdictIcon = result.accepted
    ? warning
      ? AlertTriangle
      : CheckCircle2
    : Ban;

  return (
    <section
      className={`rounded-md border p-5 ${
        result.accepted
          ? warning
            ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-50'
            : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-50'
          : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <VerdictIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase opacity-75">
            Resource-server decision
          </p>
          <h4 className="mt-1 text-lg font-semibold">
            {!result.accepted
              ? 'Reject before application authorization'
              : warning
                ? 'Accepts as a bearer token, with replay exposure'
                : 'Accept for application authorization'}
          </h4>
          <p className="mt-2 text-sm leading-6 opacity-80">
            {!result.accepted
              ? result.failures[0].detail
              : warning
                ? result.warnings[0].detail
                : 'The token crossed every configured verification boundary. The application must still enforce scopes, tenant ownership, and object policy.'}
          </p>
        </div>
      </div>
    </section>
  );
}

function TokenSnapshot({
  attack,
  issuer,
  audience,
  timeState,
  keyState,
}: {
  attack: AttackCondition;
  issuer: ValueChoice;
  audience: ValueChoice;
  timeState: TimeState;
  keyState: KeyState;
}) {
  return (
    <section className="overflow-hidden rounded-md border border-neutral-200 bg-neutral-950 text-neutral-100 dark:border-neutral-800">
      <div className="border-b border-neutral-800 px-4 py-3">
        <h4 className="text-sm font-semibold">Token presented to the resource server</h4>
      </div>
      <dl className="grid min-w-0 gap-x-5 gap-y-3 p-4 text-xs sm:grid-cols-2">
        <SnapshotValue label="alg / typ" value={`${attack.algorithm} / ${attack.tokenType}`} />
        <SnapshotValue label="kid state" value={keyState.label} />
        <SnapshotValue label="iss" value={issuer.value} />
        <SnapshotValue label="aud" value={audience.value} />
        <SnapshotValue
          label="exp"
          value={`${timeState.expiresInSeconds >= 0 ? '+' : ''}${timeState.expiresInSeconds}s from verifier clock`}
        />
        <SnapshotValue
          label="nbf"
          value={timeState.notBeforeInSeconds > 0
            ? `+${timeState.notBeforeInSeconds}s from verifier clock`
            : 'already active'}
        />
        <SnapshotValue label="sub" value="user-7f3a" />
        <SnapshotValue label="jti" value="token-4c91" />
      </dl>
    </section>
  );
}

function SnapshotValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-semibold uppercase text-neutral-500">{label}</dt>
      <dd className="mt-1 break-all font-mono text-neutral-200">{value}</dd>
    </div>
  );
}

function ValidationCheckRow({
  check,
  index,
}: {
  check: ValidationCheck;
  index: number;
}) {
  const CheckIcon = check.status === 'pass'
    ? CheckCircle2
    : check.status === 'warn'
      ? AlertTriangle
      : CircleAlert;
  const styles = check.status === 'pass'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
    : check.status === 'warn'
      ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'
      : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50';

  return (
    <li className={`flex items-start gap-3 rounded-md border p-3 ${styles}`}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-semibold">
        {index + 1}
      </span>
      <CheckIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{check.label}</p>
        <p className="mt-1 text-xs leading-5 opacity-80">{check.detail}</p>
      </div>
    </li>
  );
}

function LabLoadState({
  title,
  detail,
  error,
  onRetry,
}: {
  title: string;
  detail: string;
  error: boolean;
  onRetry: () => void;
}) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Trust-boundary lab"
          title={title}
          description="The lesson-owned validation policy is loaded from co-located JSON."
          icon={ScanSearch}
          accent="cyan"
        />
        <LearningLabBody>
          <div
            className={`flex min-h-72 flex-col items-center justify-center rounded-md border px-6 text-center ${
              error
                ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
                : 'animate-pulse border-neutral-200 bg-neutral-50 text-neutral-700 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200'
            }`}
            role={error ? 'alert' : 'status'}
          >
            {error ? (
              <CircleAlert aria-hidden="true" className="h-7 w-7" />
            ) : (
              <ShieldCheck aria-hidden="true" className="h-7 w-7" />
            )}
            <p className="mt-3 text-sm font-semibold">{error ? 'Validation model unavailable' : title}</p>
            <p className="mt-2 max-w-xl text-sm leading-6 opacity-80">{detail}</p>
            {error ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-current px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Retry
              </button>
            ) : null}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
