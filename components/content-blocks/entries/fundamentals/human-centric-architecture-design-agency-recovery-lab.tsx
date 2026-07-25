'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Check,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  FileClock,
  Fingerprint,
  Gavel,
  History,
  RefreshCw,
  Scale,
  ShieldCheck,
  TriangleAlert,
  UserCheck,
  X,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'fundamentals/human-centric-architecture-design-agency-recovery-lab';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/human-centric-architecture-design/data/agency-recovery-boundaries.json';

type AuthorityMode = {
  id: string;
  label: string;
  description: string;
};

type ConsequentialScenario = {
  id: string;
  label: string;
  description: string;
  effect: string;
  consequence: string;
  allowedAuthorityModeIds: string[];
  requiredSafeguardIds: string[];
  recoveryLabel: string;
};

type SafeguardCategory = 'privacy' | 'agency' | 'recovery' | 'oversight' | 'evidence';

type Safeguard = {
  id: string;
  label: string;
  description: string;
  category: SafeguardCategory;
};

type AgencyBoundaryModel = {
  kind: 'human-centric-agency-boundary';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    authorityModeId: string;
    selectedSafeguardIds: string[];
  };
  authorityModes: AuthorityMode[];
  scenarios: ConsequentialScenario[];
  safeguards: Safeguard[];
};

const safeguardCategories: SafeguardCategory[] = [
  'privacy',
  'agency',
  'recovery',
  'oversight',
  'evidence',
];

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isAgencyBoundaryModel(value: unknown): value is AgencyBoundaryModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AgencyBoundaryModel>;

  return Boolean(
    candidate.kind === 'human-centric-agency-boundary'
      && candidate.blockId === BLOCK_ID
      && typeof candidate.title === 'string'
      && typeof candidate.description === 'string'
      && typeof candidate.defaults?.scenarioId === 'string'
      && typeof candidate.defaults.authorityModeId === 'string'
      && isStringArray(candidate.defaults.selectedSafeguardIds)
      && Array.isArray(candidate.authorityModes)
      && candidate.authorityModes.length >= 3
      && candidate.authorityModes.every((mode) => (
        typeof mode.id === 'string'
        && typeof mode.label === 'string'
        && typeof mode.description === 'string'
      ))
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length >= 3
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.description === 'string'
        && typeof scenario.effect === 'string'
        && typeof scenario.consequence === 'string'
        && typeof scenario.recoveryLabel === 'string'
        && isStringArray(scenario.allowedAuthorityModeIds)
        && isStringArray(scenario.requiredSafeguardIds)
      ))
      && Array.isArray(candidate.safeguards)
      && candidate.safeguards.length >= 8
      && candidate.safeguards.every((safeguard) => (
        typeof safeguard.id === 'string'
        && typeof safeguard.label === 'string'
        && typeof safeguard.description === 'string'
        && safeguardCategories.includes(safeguard.category)
      )),
  );
}

export default function HumanCentricArchitectureAgencyRecoveryLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<AgencyBoundaryModel | null>(null);
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
        if (!isAgencyBoundaryModel(payload)) {
          throw new Error('The authority and recovery policy data is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load authority policy.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Agency and recovery lab"
            title="Load the decision boundaries"
            description="The lesson-owned scenarios, authority modes, and safeguards are loading."
            icon={ShieldCheck}
            accent="violet"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <AgencyRecoveryLab model={model} />
      )}
    </div>
  );
}

function AgencyRecoveryLab({ model }: { model: AgencyBoundaryModel }) {
  const [scenarioId, setScenarioId] = useState(model.defaults.scenarioId);
  const [authorityModeId, setAuthorityModeId] = useState(model.defaults.authorityModeId);
  const [selected, setSelected] = useState(
    () => new Set(model.defaults.selectedSafeguardIds),
  );

  const scenario = model.scenarios.find((item) => item.id === scenarioId)
    ?? model.scenarios[0];
  const authorityMode = model.authorityModes.find((item) => item.id === authorityModeId)
    ?? model.authorityModes[0];

  const result = useMemo(() => {
    const required = new Set(scenario.requiredSafeguardIds);
    const missing = model.safeguards.filter(
      (safeguard) => required.has(safeguard.id) && !selected.has(safeguard.id),
    );
    const authorityAllowed = scenario.allowedAuthorityModeIds.includes(authorityMode.id);
    const ready = authorityAllowed && missing.length === 0;
    const requiredPresent = required.size - missing.length;
    const selectedRequired = model.safeguards.filter(
      (safeguard) => required.has(safeguard.id) && selected.has(safeguard.id),
    );
    const coveredCategories = new Set(selectedRequired.map((item) => item.category));
    const consentState = scenario.id === 'personalization-enrollment'
      ? selected.has('specific-choice') && selected.has('purpose-notice')
        ? 'Specific choice'
        : 'Incomplete'
      : 'Not assumed';
    const recoveryState = selected.has('revoke-or-undo') || selected.has('appeal-path')
      ? 'Reachable'
      : 'Missing';

    return {
      authorityAllowed,
      consentState,
      coveredCategories,
      missing,
      ready,
      recoveryState,
      requiredCount: required.size,
      requiredPresent,
    };
  }, [authorityMode.id, model.safeguards, scenario, selected]);

  function chooseScenario(nextId: string) {
    setScenarioId(nextId);
    const nextScenario = model.scenarios.find((item) => item.id === nextId);
    if (nextScenario && !nextScenario.allowedAuthorityModeIds.includes(authorityModeId)) {
      setAuthorityModeId(nextScenario.allowedAuthorityModeIds[0]);
    }
  }

  function toggleSafeguard(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function reset() {
    setScenarioId(model.defaults.scenarioId);
    setAuthorityModeId(model.defaults.authorityModeId);
    setSelected(new Set(model.defaults.selectedSafeguardIds));
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Agency and recovery lab"
        title={model.title}
        description={model.description}
        icon={ShieldCheck}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Consequential action
              </legend>
              <div className="mt-3 grid gap-2">
                {model.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.description}
                    icon={Gavel}
                    accent="violet"
                    onClick={() => chooseScenario(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Automation posture
              </legend>
              <div className="mt-3 grid gap-2">
                {model.authorityModes.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === authorityMode.id}
                    label={item.label}
                    detail={item.description}
                    icon={item.id === 'automatic' ? Bot : UserCheck}
                    accent="blue"
                    onClick={() => setAuthorityModeId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div
          className={`rounded-md border p-4 ${
            result.ready
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'
              : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40'
          }`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            {result.ready ? (
              <CheckCircle2
                aria-hidden="true"
                className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300"
              />
            ) : (
              <CircleAlert
                aria-hidden="true"
                className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300"
              />
            )}
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                Boundary decision
              </p>
              <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                {result.ready
                  ? 'The side effect has accountable authority and a recovery path'
                  : !result.authorityAllowed
                    ? 'The selected automation exceeds this boundary'
                    : `${result.missing.length} required safeguard${result.missing.length === 1 ? ' is' : 's are'} missing`}
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                {result.ready ? scenario.recoveryLabel : scenario.consequence}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LabMetric
            label="Authority"
            value={result.authorityAllowed ? 'Within policy' : 'Exceeds policy'}
            detail={authorityMode.label}
            icon={Scale}
            tone={result.authorityAllowed ? 'emerald' : 'rose'}
          />
          <LabMetric
            label="Required safeguards"
            value={`${result.requiredPresent}/${result.requiredCount}`}
            detail={result.missing.length === 0 ? 'Complete' : `${result.missing.length} missing`}
            icon={ShieldCheck}
            tone={result.missing.length === 0 ? 'violet' : 'amber'}
          />
          <LabMetric
            label="Consent"
            value={result.consentState}
            detail={scenario.id === 'personalization-enrollment' ? 'Optional purpose' : 'Do not assume consent is the authority'}
            icon={Fingerprint}
            tone={result.consentState === 'Incomplete' ? 'rose' : 'blue'}
          />
          <LabMetric
            label="Recovery"
            value={result.recoveryState}
            detail={scenario.recoveryLabel}
            icon={History}
            tone={result.recoveryState === 'Reachable' ? 'cyan' : 'rose'}
          />
        </div>

        <div className="mt-7">
          <div className="flex items-center gap-2">
            <FileClock aria-hidden="true" className="h-4 w-4 text-violet-700 dark:text-violet-300" />
            <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
              Decision boundary trace
            </h4>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-5">
            <TraceStage
              number="1"
              label="Purpose"
              detail={scenario.id === 'personalization-enrollment' ? 'Optional use is named' : 'The task purpose is recorded'}
              ready={scenario.id !== 'personalization-enrollment' || selected.has('purpose-notice')}
            />
            <TraceStage
              number="2"
              label="Evidence"
              detail={scenario.effect}
              ready={!scenario.requiredSafeguardIds.includes('reason-and-evidence') || selected.has('reason-and-evidence')}
            />
            <TraceStage
              number="3"
              label="Authority"
              detail={authorityMode.label}
              ready={result.authorityAllowed}
            />
            <TraceStage
              number="4"
              label="Commit"
              detail="Cross the side-effect boundary"
              ready={!scenario.requiredSafeguardIds.includes('review-before-commit') || selected.has('review-before-commit')}
            />
            <TraceStage
              number="5"
              label="Recover"
              detail={scenario.recoveryLabel}
              ready={result.recoveryState === 'Reachable'}
            />
          </div>
        </div>

        <fieldset className="mt-7">
          <legend className="text-sm font-semibold text-neutral-950 dark:text-white">
            3. Boundary safeguards
          </legend>
          <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
            Toggle safeguards. “Required here” comes from the selected action, not a universal checklist.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {model.safeguards.map((safeguard) => (
              <SafeguardToggle
                key={safeguard.id}
                safeguard={safeguard}
                selected={selected.has(safeguard.id)}
                required={scenario.requiredSafeguardIds.includes(safeguard.id)}
                onToggle={() => toggleSafeguard(safeguard.id)}
              />
            ))}
          </div>
        </fieldset>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Covered boundary concerns
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {safeguardCategories.map((category) => (
                <span
                  key={category}
                  className={`inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-xs font-semibold capitalize ${
                    result.coveredCategories.has(category)
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
                      : 'border-neutral-300 bg-white text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-400'
                  }`}
                >
                  {result.coveredCategories.has(category) ? (
                    <Check aria-hidden="true" className="h-3.5 w-3.5" />
                  ) : (
                    <X aria-hidden="true" className="h-3.5 w-3.5" />
                  )}
                  {category}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Policy rule
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
              Allowed postures: {scenario.allowedAuthorityModeIds
                .map((id) => model.authorityModes.find((mode) => mode.id === id)?.label)
                .filter(Boolean)
                .join(' or ')}.
            </p>
          </div>
        </div>

        {result.missing.length > 0 ? (
          <div className="mt-5 rounded-md border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/30">
            <p className="text-xs font-semibold uppercase text-rose-800 dark:text-rose-200">
              Missing before this boundary is safe to cross
            </p>
            <ul className="mt-2 space-y-2 pl-5 text-sm leading-6 text-rose-950 marker:text-rose-600 dark:text-rose-100 dark:marker:text-rose-300">
              {result.missing.map((safeguard) => (
                <li key={safeguard.id}>{safeguard.label}: {safeguard.description}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </LearningLabBody>
    </LearningLab>
  );
}

function TraceStage({
  number,
  label,
  detail,
  ready,
}: {
  number: string;
  label: string;
  detail: string;
  ready: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-md border p-3 ${
        ready
          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
          : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-950 text-[11px] font-semibold text-white dark:bg-white dark:text-neutral-950">
          {number}
        </span>
        <span className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
          {ready ? 'Ready' : 'Blocked'}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}

function SafeguardToggle({
  safeguard,
  selected,
  required,
  onToggle,
}: {
  safeguard: Safeguard;
  selected: boolean;
  required: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={`min-h-[116px] rounded-md border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
        selected
          ? 'border-violet-300 bg-violet-50 text-violet-950 ring-1 ring-violet-500 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-50'
          : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'
      }`}
    >
      <span className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border ${
            selected
              ? 'border-violet-600 bg-violet-600 text-white dark:border-violet-400 dark:bg-violet-400 dark:text-neutral-950'
              : 'border-neutral-400 text-transparent dark:border-neutral-600'
          }`}
        >
          <Check aria-hidden="true" className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{safeguard.label}</span>
            <span className="rounded-sm border border-current px-1.5 py-0.5 text-[10px] font-semibold uppercase">
              {safeguard.category}
            </span>
            {required ? (
              <span className="rounded-sm border border-current px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                Required here
              </span>
            ) : null}
          </span>
          <span className="mt-1 block text-xs leading-5 opacity-75">
            {safeguard.description}
          </span>
        </span>
      </span>
    </button>
  );
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <div className="min-h-[420px] p-6">
        <div
          className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
          role="alert"
        >
          <TriangleAlert aria-hidden="true" className="h-5 w-5" />
          <p className="mt-3 font-semibold">Authority policy could not be loaded</p>
          <p className="mt-1 leading-6">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-rose-400 px-3 font-semibold hover:border-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[420px] items-center justify-center p-6" role="status">
      <div className="text-center text-sm text-neutral-600 dark:text-neutral-300">
        <ClipboardCheck
          aria-hidden="true"
          className="mx-auto h-7 w-7 animate-pulse text-violet-500 motion-reduce:animate-none"
        />
        <p className="mt-3">Loading authority and recovery boundaries...</p>
      </div>
    </div>
  );
}
