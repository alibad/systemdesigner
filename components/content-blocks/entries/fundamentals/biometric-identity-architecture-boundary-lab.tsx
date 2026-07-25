'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Database,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  Network,
  ScanFace,
  Server,
  ShieldCheck,
  TriangleAlert,
  UserRoundCheck,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Stage = {
  id: string;
  label: string;
  detail: string;
};

type Architecture = {
  id: string;
  label: string;
  detail: string;
  biometricBoundary: string;
  relyingPartyReceives: string;
  storedAtRelyingParty: string;
  stages: Stage[];
};

type Outcome = {
  status: 'contained' | 'depends' | 'high-impact' | 'recoverable' | 'manual-path';
  statusLabel: string;
  impact: string;
  affectedStages: string[];
  requiredControls: string[];
  recovery: string;
};

type Scenario = {
  id: string;
  label: string;
  detail: string;
  outcomes: Record<string, Outcome>;
};

type BoundaryModel = {
  title: string;
  description: string;
  defaults: {
    architectureId: string;
    scenarioId: string;
  };
  architectures: Architecture[];
  scenarios: Scenario[];
};

const BLOCK_ID = 'fundamentals/biometric-identity-architecture-boundary-lab';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/biometric-identity-architecture/data/biometric-boundary-model.json';

function isBoundaryModel(value: unknown): value is BoundaryModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BoundaryModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.architectureId
      && candidate.defaults.scenarioId
      && Array.isArray(candidate.architectures)
      && candidate.architectures.length >= 2
      && candidate.architectures.every((architecture) => (
        typeof architecture.id === 'string'
        && typeof architecture.label === 'string'
        && typeof architecture.detail === 'string'
        && typeof architecture.biometricBoundary === 'string'
        && typeof architecture.relyingPartyReceives === 'string'
        && typeof architecture.storedAtRelyingParty === 'string'
        && Array.isArray(architecture.stages)
        && architecture.stages.length >= 3
        && architecture.stages.every((stage) => (
          typeof stage.id === 'string'
          && typeof stage.label === 'string'
          && typeof stage.detail === 'string'
        ))
      ))
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length >= 3
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.detail === 'string'
        && scenario.outcomes
        && typeof scenario.outcomes === 'object'
      )),
  );
}

export default function BiometricIdentityArchitectureBoundaryLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<BoundaryModel | null>(null);
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
        if (!isBoundaryModel(payload)) {
          throw new Error('The biometric boundary model is incomplete.');
        }
        const complete = payload.scenarios.every((scenario) => (
          payload.architectures.every((architecture) => {
            const outcome = scenario.outcomes[architecture.id];
            return Boolean(
              outcome
                && ['contained', 'depends', 'high-impact', 'recoverable', 'manual-path']
                  .includes(outcome.status)
                && typeof outcome.statusLabel === 'string'
                && typeof outcome.impact === 'string'
                && Array.isArray(outcome.affectedStages)
                && outcome.affectedStages.every((stage) => typeof stage === 'string')
                && Array.isArray(outcome.requiredControls)
                && outcome.requiredControls.length > 0
                && outcome.requiredControls.every((control) => typeof control === 'string')
                && typeof outcome.recovery === 'string',
            );
          })
        ));
        if (!complete) throw new Error('One or more failure outcomes are incomplete.');
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the biometric boundary model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Trust boundary lab"
            title="Load biometric paths and failure outcomes"
            description="The lesson-owned architecture model is loading."
            icon={LockKeyhole}
            accent="violet"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <BoundaryLab model={model} />
      )}
    </div>
  );
}

function BoundaryLab({ model }: { model: BoundaryModel }) {
  const [architectureId, setArchitectureId] = useState(model.defaults.architectureId);
  const [scenarioId, setScenarioId] = useState(model.defaults.scenarioId);
  const architecture = model.architectures.find((item) => item.id === architectureId)
    ?? model.architectures[0];
  const scenario = model.scenarios.find((item) => item.id === scenarioId)
    ?? model.scenarios[0];
  const outcome = scenario.outcomes[architecture.id];

  function reset() {
    setArchitectureId(model.defaults.architectureId);
    setScenarioId(model.defaults.scenarioId);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Trust boundary lab"
        title={model.title}
        description={model.description}
        icon={LockKeyhole}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Architecture boundary
              </legend>
              <div className="mt-3 grid gap-2">
                {model.architectures.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === architecture.id}
                    label={item.label}
                    detail={item.detail}
                    icon={architectureIcon(item.id)}
                    accent="violet"
                    onClick={() => setArchitectureId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Inject a failure
              </legend>
              <div className="mt-3 grid gap-2">
                {model.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.detail}
                    icon={AlertTriangle}
                    accent="amber"
                    onClick={() => setScenarioId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="min-w-0 space-y-6" aria-live="polite">
          <OutcomePanel outcome={outcome} scenario={scenario} />

          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Biometric boundary"
              value={architecture.id === 'local-passkey' ? 'Local' : 'Central'}
              detail={architecture.biometricBoundary}
              icon={Fingerprint}
              tone={architecture.id === 'local-passkey' ? 'emerald' : 'violet'}
            />
            <LabMetric
              label="Relying party gets"
              value={architecture.id === 'local-passkey' ? 'Assertion' : 'Decision'}
              detail={architecture.relyingPartyReceives}
              icon={KeyRound}
              tone="blue"
            />
            <LabMetric
              label="Recovery mode"
              value={recoveryLabel(outcome.status)}
              detail={outcome.recovery}
              icon={UserRoundCheck}
              tone={outcome.status === 'high-impact' ? 'rose' : 'amber'}
            />
          </div>

          <ArchitecturePath architecture={architecture} outcome={outcome} />

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-start gap-3">
                <Database
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-violet-700 dark:text-violet-300"
                />
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Stored at the relying party
                  </p>
                  <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    {architecture.storedAtRelyingParty}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-50">
              <div className="flex items-start gap-3">
                <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold uppercase opacity-70">
                    Recovery action
                  </p>
                  <p className="mt-2 text-sm leading-6">{outcome.recovery}</p>
                </div>
              </div>
            </section>
          </div>

          <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Controls required for this failure
            </p>
            <ul className="mt-3 grid gap-2 text-sm text-neutral-700 sm:grid-cols-2 dark:text-neutral-300">
              {outcome.requiredControls.map((control) => (
                <li key={control} className="flex items-start gap-2">
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300"
                  />
                  <span>{control}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function OutcomePanel({
  outcome,
  scenario,
}: {
  outcome: Outcome;
  scenario: Scenario;
}) {
  const highImpact = outcome.status === 'high-impact';
  const contained = outcome.status === 'contained' || outcome.status === 'recoverable';
  const Icon = highImpact ? TriangleAlert : contained ? CheckCircle2 : CircleAlert;
  const styles = highImpact
    ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
    : contained
      ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
      : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50';

  return (
    <section className={`rounded-md border p-5 ${styles}`}>
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="text-xs font-semibold uppercase opacity-70">
            {scenario.label} outcome
          </p>
          <h4 className="mt-1 text-xl font-semibold">{outcome.statusLabel}</h4>
          <p className="mt-2 text-sm leading-6 opacity-80">{outcome.impact}</p>
        </div>
      </div>
    </section>
  );
}

function ArchitecturePath({
  architecture,
  outcome,
}: {
  architecture: Architecture;
  outcome: Outcome;
}) {
  return (
    <section>
      <div>
        <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
          Active data path
        </p>
        <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
          {architecture.label}
        </h4>
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-4 md:gap-5">
        {architecture.stages.map((stage, index) => {
          const affected = outcome.affectedStages.includes(stage.id);
          const Icon = stageIcon(stage.id);
          return (
            <div
              key={`${architecture.id}-${stage.id}`}
              className="relative min-w-0"
            >
              <article
                className={`h-full min-w-0 rounded-md border p-4 ${
                  affected
                    ? 'border-amber-300 bg-amber-50 text-amber-950 ring-1 ring-amber-400 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-50'
                    : 'border-neutral-200 bg-white text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
                  <span className="text-[11px] font-semibold uppercase opacity-60">
                    Step {index + 1}
                  </span>
                </div>
                <h5 className="mt-3 text-sm font-semibold">{stage.label}</h5>
                <p className="mt-1 text-xs leading-5 opacity-75">{stage.detail}</p>
                {affected ? (
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold">
                    <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
                    Failure touches this stage
                  </span>
                ) : null}
              </article>
              {index < architecture.stages.length - 1 ? (
                <>
                  <ArrowDown
                    aria-hidden="true"
                    className="absolute -bottom-5 left-1/2 h-4 w-4 -translate-x-1/2 text-neutral-400 md:hidden"
                  />
                  <ArrowRight
                    aria-hidden="true"
                    className="absolute -right-[18px] top-1/2 hidden h-4 w-4 -translate-y-1/2 text-neutral-400 md:block"
                  />
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function architectureIcon(id: string) {
  if (id === 'local-passkey') return KeyRound;
  if (id === 'central-verification') return Server;
  return Network;
}

function stageIcon(id: string) {
  if (id === 'sensor') return ScanFace;
  if (id === 'credential') return KeyRound;
  if (id === 'rp' || id === 'adjudication') return UserRoundCheck;
  if (id === 'channel') return LockKeyhole;
  if (id === 'gallery') return Database;
  return Server;
}

function recoveryLabel(status: Outcome['status']) {
  if (status === 'contained') return 'Credential';
  if (status === 'recoverable') return 'Fallback';
  if (status === 'manual-path') return 'Adjudicate';
  if (status === 'high-impact') return 'Incident';
  return 'Policy';
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
              <p className="text-sm font-semibold">Biometric boundary model unavailable</p>
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
        <div className="flex min-h-36 items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
          Loading biometric boundary model...
        </div>
      )}
    </div>
  );
}
