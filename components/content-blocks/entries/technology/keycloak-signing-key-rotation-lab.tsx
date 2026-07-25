'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  TimerReset,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/keycloak-signing-key-rotation-lab';
const DEFAULT_DATA_FILE = '/api/content/technology/keycloak/data/signing-key-rotation-model.json';

type IncidentId = 'planned' | 'compromised';
type StageId = 'before' | 'overlap' | 'retired';
type KeyStatus = 'absent' | 'active' | 'passive' | 'disabled';

type Incident = {
  id: IncidentId;
  label: string;
  summary: string;
  target: string;
};

type RotationStage = {
  id: StageId;
  step: number;
  label: string;
  summary: string;
  oldKey: KeyStatus;
  newKey: KeyStatus;
};

type RotationModel = {
  title: string;
  description: string;
  defaults: {
    incidentId: IncidentId;
    stageId: StageId;
    longestTokenHours: number;
    elapsedHours: number;
  };
  incidents: Incident[];
  stages: RotationStage[];
};

function isIncidentId(value: unknown): value is IncidentId {
  return value === 'planned' || value === 'compromised';
}

function isStageId(value: unknown): value is StageId {
  return value === 'before' || value === 'overlap' || value === 'retired';
}

function isKeyStatus(value: unknown): value is KeyStatus {
  return value === 'absent'
    || value === 'active'
    || value === 'passive'
    || value === 'disabled';
}

function isRotationModel(value: unknown): value is RotationModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RotationModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && isIncidentId(candidate.defaults?.incidentId)
      && isStageId(candidate.defaults.stageId)
      && typeof candidate.defaults.longestTokenHours === 'number'
      && typeof candidate.defaults.elapsedHours === 'number'
      && Array.isArray(candidate.incidents)
      && candidate.incidents.length === 2
      && candidate.incidents.every((incident) => (
        isIncidentId(incident.id)
        && typeof incident.label === 'string'
        && typeof incident.summary === 'string'
        && typeof incident.target === 'string'
      ))
      && Array.isArray(candidate.stages)
      && candidate.stages.length === 3
      && candidate.stages.every((stage) => (
        isStageId(stage.id)
        && typeof stage.step === 'number'
        && typeof stage.label === 'string'
        && typeof stage.summary === 'string'
        && isKeyStatus(stage.oldKey)
        && isKeyStatus(stage.newKey)
      )),
  );
}

export default function KeycloakSigningKeyRotationLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<RotationModel | null>(null);
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
        if (!isRotationModel(payload)) {
          throw new Error('The signing-key rotation model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Signing-key lifecycle lab"
            title="Load the realm-key model"
            description="The lesson-owned rotation stages and incident modes are loading."
            icon={KeyRound}
            accent="rose"
          />
          <LoadState
            error={error}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        </LearningLab>
      ) : (
        <SigningKeyLab model={model} />
      )}
    </div>
  );
}

function SigningKeyLab({ model }: { model: RotationModel }) {
  const [incidentId, setIncidentId] = useState<IncidentId>(model.defaults.incidentId);
  const [stageId, setStageId] = useState<StageId>(model.defaults.stageId);
  const [longestTokenHours, setLongestTokenHours] = useState(
    model.defaults.longestTokenHours,
  );
  const [elapsedHours, setElapsedHours] = useState(model.defaults.elapsedHours);

  const incident = model.incidents.find((item) => item.id === incidentId)
    ?? model.incidents[0];
  const stage = model.stages.find((item) => item.id === stageId)
    ?? model.stages[0];
  const remainingHours = Math.max(0, longestTokenHours - elapsedHours);

  const outcome = useMemo(
    () => describeOutcome(incident.id, stage.id, remainingHours),
    [incident.id, remainingHours, stage.id],
  );

  function reset() {
    setIncidentId(model.defaults.incidentId);
    setStageId(model.defaults.stageId);
    setLongestTokenHours(model.defaults.longestTokenHours);
    setElapsedHours(model.defaults.elapsedHours);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Signing-key lifecycle lab"
        title={model.title}
        description={model.description}
        icon={KeyRound}
        accent="rose"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Rotation trigger
              </legend>
              <div className="mt-3 grid gap-2">
                {model.incidents.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === incident.id}
                    label={item.label}
                    detail={item.summary}
                    icon={item.id === 'planned' ? TimerReset : ShieldAlert}
                    accent={item.id === 'planned' ? 'blue' : 'rose'}
                    onClick={() => setIncidentId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <div className="space-y-6">
              <LabRange
                label="Longest accepted old token"
                value={longestTokenHours}
                output={`${longestTokenHours}h`}
                min={1}
                max={24}
                step={1}
                accent="amber"
                lowLabel="1 hour"
                highLabel="24 hours"
                onChange={setLongestTokenHours}
              />
              <LabRange
                label="Elapsed overlap"
                value={elapsedHours}
                output={`${elapsedHours}h`}
                min={0}
                max={24}
                step={1}
                accent="cyan"
                lowLabel="Just activated"
                highLabel="24 hours"
                onChange={setElapsedHours}
              />
            </div>

            <div className="rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
              <p className="font-semibold">Visible assumption</p>
              <p className="mt-1 leading-6">
                max(0, {longestTokenHours}h - {elapsedHours}h) ={' '}
                <strong>{remainingHours}h remaining</strong>
              </p>
            </div>
          </div>
        )}
      >
        <div className="min-w-0 space-y-6">
          <StageSelector stages={model.stages} stage={stage} onChange={setStageId} />
          <RotationOutcome
            incident={incident}
            stage={stage}
            remainingHours={remainingHours}
            outcome={outcome}
          />
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function StageSelector({
  stages,
  stage,
  onChange,
}: {
  stages: RotationStage[];
  stage: RotationStage;
  onChange: (value: StageId) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        2. Key lifecycle stage
      </legend>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
        {stages.map((item, index) => (
          <div key={item.id} className="contents">
            <button
              type="button"
              aria-pressed={item.id === stage.id}
              onClick={() => onChange(item.id)}
              className={`min-h-32 rounded-md border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                item.id === stage.id
                  ? 'border-rose-500 bg-rose-50 text-rose-950 ring-1 ring-rose-500 dark:border-rose-400 dark:bg-rose-950/40 dark:text-rose-50 dark:ring-rose-400'
                  : 'border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase opacity-70">
                  Stage {item.step}
                </span>
                {item.id === stage.id ? (
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
                ) : null}
              </span>
              <span className="mt-2 block text-sm font-semibold">{item.label}</span>
              <span className="mt-1 block text-xs leading-5 opacity-75">
                {item.summary}
              </span>
            </button>
            {index < stages.length - 1 ? <FlowArrow /> : null}
          </div>
        ))}
      </div>
    </fieldset>
  );
}

type Outcome = {
  status: 'ready' | 'wait' | 'danger' | 'incomplete';
  title: string;
  detail: string;
};

function describeOutcome(
  incident: IncidentId,
  stage: StageId,
  remainingHours: number,
): Outcome {
  if (stage === 'before') {
    return incident === 'compromised'
      ? {
        status: 'danger',
        title: 'The suspected key is still fully trusted',
        detail: 'Create a replacement and remove the compromised provider immediately. Waiting at this stage preserves the attacker’s signing path.',
      }
      : {
        status: 'incomplete',
        title: 'No replacement is signing yet',
        detail: 'Create a higher-priority active key before changing the old provider. New tokens still depend on the old key.',
      };
  }

  if (stage === 'overlap') {
    if (incident === 'compromised') {
      return {
        status: 'danger',
        title: 'Passive is not safe for a compromised key',
        detail: 'A passive key can still verify signatures. Remove it now and handle token invalidation and reauthentication as an incident.',
      };
    }
    return remainingHours === 0
      ? {
        status: 'ready',
        title: 'The planned overlap bound is satisfied',
        detail: 'The configured planning window has elapsed. Confirm actual token types, clocks, client key caches, and rollback readiness before disabling the old provider.',
      }
      : {
        status: 'wait',
        title: `Keep the old key passive for ${remainingHours} more hour${remainingHours === 1 ? '' : 's'}`,
        detail: 'The new key should sign new tokens while the old public key remains available to validate tokens issued before activation.',
      };
  }

  if (incident === 'compromised') {
    return {
      status: 'ready',
      title: 'The compromised verification path is removed',
      detail: 'Old tokens now fail by design. Complete the not-before, session, credential, audit, and user-communication parts of the incident runbook.',
    };
  }

  return remainingHours === 0
    ? {
      status: 'ready',
      title: 'Old tokens are outside the stated planning window',
      detail: 'The old provider can remain disabled if real token lifetimes and client key refresh behavior match the tested assumptions.',
    }
    : {
      status: 'danger',
      title: 'This retirement breaks still-valid old tokens',
      detail: `${remainingHours} hour${remainingHours === 1 ? '' : 's'} remain in the stated acceptance window. Restore the old key as passive or accept explicit reauthentication.`,
    };
}

function RotationOutcome({
  incident,
  stage,
  remainingHours,
  outcome,
}: {
  incident: Incident;
  stage: RotationStage;
  remainingHours: number;
  outcome: Outcome;
}) {
  const tone = outcome.status === 'ready'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-50'
    : outcome.status === 'wait'
      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-50'
      : outcome.status === 'danger'
        ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-50'
        : 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/35 dark:text-blue-50';
  const OutcomeIcon = outcome.status === 'ready'
    ? ShieldCheck
    : outcome.status === 'wait'
      ? Clock3
      : outcome.status === 'danger'
        ? TriangleAlert
        : KeyRound;

  const oldTokenValid = stage.oldKey === 'active' || stage.oldKey === 'passive';
  const newTokenIssued = stage.newKey === 'active';

  return (
    <div className="space-y-5" aria-live="polite">
      <section className={`rounded-md border p-5 ${tone}`}>
        <div className="flex items-start gap-3">
          <OutcomeIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="text-xs font-semibold uppercase opacity-70">
              {incident.label} verdict
            </p>
            <h4 className="mt-1 text-xl font-semibold">{outcome.title}</h4>
            <p className="mt-2 text-sm leading-6 opacity-80">{outcome.detail}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <LabMetric
          label="Old token window"
          value={`${remainingHours}h`}
          detail="max(0, accepted lifetime - elapsed overlap)"
          icon={Clock3}
          tone={remainingHours === 0 ? 'emerald' : 'amber'}
        />
        <LabMetric
          label="Old key"
          value={stage.oldKey}
          detail={stage.oldKey === 'passive' ? 'Verifies but does not sign new tokens' : 'Current provider state'}
          icon={KeyRound}
          tone={stage.oldKey === 'disabled' ? 'neutral' : stage.oldKey === 'passive' ? 'amber' : 'rose'}
        />
        <LabMetric
          label="New key"
          value={stage.newKey}
          detail={stage.newKey === 'active' ? 'Signs new tokens' : 'Not yet issuing'}
          icon={ShieldCheck}
          tone={stage.newKey === 'active' ? 'emerald' : 'neutral'}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <TokenCard
          title="Token signed before activation"
          kid="kid: old-2026-01"
          valid={oldTokenValid}
          detail={oldTokenValid
            ? 'The old public key is still enabled for verification.'
            : 'The old provider is disabled, so verification fails.'}
        />
        <TokenCard
          title="Token requested after activation"
          kid={newTokenIssued ? 'kid: new-2026-07' : 'kid: old-2026-01'}
          valid
          detail={newTokenIssued
            ? 'The higher-priority active replacement signs this token.'
            : 'The old active key still signs because no replacement is active.'}
        />
      </div>

      <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
        <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
          Operational target
        </p>
        <p className="mt-2 text-sm leading-6 text-neutral-800 dark:text-neutral-200">
          {incident.target}
        </p>
      </section>
    </div>
  );
}

function TokenCard({
  title,
  kid,
  valid,
  detail,
}: {
  title: string;
  kid: string;
  valid: boolean;
  detail: string;
}) {
  return (
    <section className={`rounded-md border p-4 ${
      valid
        ? 'border-emerald-200 bg-white dark:border-emerald-900 dark:bg-neutral-950'
        : 'border-rose-200 bg-white dark:border-rose-900 dark:bg-neutral-950'
    }`}
    >
      <div className="flex items-start gap-3">
        {valid ? (
          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
        ) : (
          <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-950 dark:text-white">{title}</p>
          <p className="mt-1 font-mono text-xs text-neutral-500 dark:text-neutral-400">{kid}</p>
          <p className={`mt-3 text-sm font-semibold ${valid
            ? 'text-emerald-700 dark:text-emerald-300'
            : 'text-rose-700 dark:text-rose-300'}`}
          >
            {valid ? 'Accepted' : 'Rejected'}
          </p>
          <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
            {detail}
          </p>
        </div>
      </div>
    </section>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center text-neutral-400" aria-hidden="true">
      <ArrowDown className="h-5 w-5 md:hidden" />
      <ArrowRight className="hidden h-5 w-5 md:block" />
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
      {error ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50">
          <div className="flex items-start gap-3">
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Realm-key model unavailable</p>
              <p className="mt-1 text-sm opacity-80">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-40 items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
          Loading realm-key lifecycle...
        </div>
      )}
    </div>
  );
}
