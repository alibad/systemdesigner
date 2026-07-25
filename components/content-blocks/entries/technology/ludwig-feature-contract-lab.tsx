'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  CircleX,
  Database,
  FileWarning,
  GitBranch,
  Layers3,
  LoaderCircle,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Split,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/ludwig-feature-contract-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/ludwig/data/feature-contract-model.json';

type Availability = 'request' | 'post-outcome' | 'offline-only';

type FeatureProfile = {
  id: string;
  label: string;
  detail: string;
};

type SplitStrategy = {
  id: string;
  label: string;
  detail: string;
  configType: 'random' | 'fixed';
  configColumn: string;
};

type FeatureField = {
  name: string;
  type: string;
  availability: Availability;
  detail: string;
};

type Scenario = {
  id: string;
  label: string;
  detail: string;
  target: string;
  outputType: string;
  recommendedSplitId: string;
  splitReason: string;
  fields: FeatureField[];
};

type FeatureContractModel = {
  kind: 'ludwig-feature-contract';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    featureProfileId: string;
    splitId: string;
  };
  featureProfiles: FeatureProfile[];
  splits: SplitStrategy[];
  scenarios: Scenario[];
  notice: string;
};

type ContractResult = {
  selectedFields: FeatureField[];
  riskyFields: FeatureField[];
  splitMatches: boolean;
  status: 'ready' | 'review' | 'blocked';
  headline: string;
  detail: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasUniqueIds(items: Array<{ id: string }>): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

function isAvailability(value: unknown): value is Availability {
  return value === 'request'
    || value === 'post-outcome'
    || value === 'offline-only';
}

function isFeatureProfile(value: unknown): value is FeatureProfile {
  return Boolean(
    isRecord(value)
      && isNonEmptyString(value.id)
      && isNonEmptyString(value.label)
      && isNonEmptyString(value.detail),
  );
}

function isSplitStrategy(value: unknown): value is SplitStrategy {
  return Boolean(
    isRecord(value)
      && isNonEmptyString(value.id)
      && isNonEmptyString(value.label)
      && isNonEmptyString(value.detail)
      && (value.configType === 'random' || value.configType === 'fixed')
      && typeof value.configColumn === 'string',
  );
}

function isFeatureField(value: unknown): value is FeatureField {
  return Boolean(
    isRecord(value)
      && isNonEmptyString(value.name)
      && isNonEmptyString(value.type)
      && isAvailability(value.availability)
      && isNonEmptyString(value.detail),
  );
}

function isScenario(value: unknown): value is Scenario {
  return Boolean(
    isRecord(value)
      && isNonEmptyString(value.id)
      && isNonEmptyString(value.label)
      && isNonEmptyString(value.detail)
      && isNonEmptyString(value.target)
      && isNonEmptyString(value.outputType)
      && isNonEmptyString(value.recommendedSplitId)
      && isNonEmptyString(value.splitReason)
      && Array.isArray(value.fields)
      && value.fields.length >= 4
      && value.fields.every(isFeatureField),
  );
}

function isFeatureContractModel(value: unknown): value is FeatureContractModel {
  if (
    !isRecord(value)
    || !isRecord(value.defaults)
    || !Array.isArray(value.featureProfiles)
    || !Array.isArray(value.splits)
    || !Array.isArray(value.scenarios)
  ) {
    return false;
  }

  const defaults = value.defaults;
  const featureProfiles = value.featureProfiles;
  const splits = value.splits;
  const scenarios = value.scenarios;

  return value.kind === 'ludwig-feature-contract'
    && value.blockId === BLOCK_ID
    && isNonEmptyString(value.title)
    && isNonEmptyString(value.description)
    && isNonEmptyString(defaults.scenarioId)
    && isNonEmptyString(defaults.featureProfileId)
    && isNonEmptyString(defaults.splitId)
    && featureProfiles.length === 3
    && featureProfiles.every(isFeatureProfile)
    && hasUniqueIds(featureProfiles)
    && featureProfiles.some((item) => item.id === defaults.featureProfileId)
    && splits.length === 3
    && splits.every(isSplitStrategy)
    && hasUniqueIds(splits)
    && splits.some((item) => item.id === defaults.splitId)
    && scenarios.length === 3
    && scenarios.every(isScenario)
    && hasUniqueIds(scenarios)
    && scenarios.some((item) => item.id === defaults.scenarioId)
    && scenarios.every((scenario) =>
      splits.some((split) => split.id === scenario.recommendedSplitId))
    && isNonEmptyString(value.notice);
}

function buildResult(
  scenario: Scenario,
  profile: FeatureProfile,
  split: SplitStrategy,
): ContractResult {
  const requestFields = scenario.fields.filter(
    (field) => field.availability === 'request',
  );
  const selectedFields = profile.id === 'baseline'
    ? requestFields.slice(0, 2)
    : profile.id === 'production'
      ? requestFields
      : scenario.fields;
  const riskyFields = selectedFields.filter(
    (field) => field.availability !== 'request',
  );
  const splitMatches = split.id === scenario.recommendedSplitId;

  if (riskyFields.length > 0) {
    const leakCount = riskyFields.filter(
      (field) => field.availability === 'post-outcome',
    ).length;
    const parityCount = riskyFields.length - leakCount;

    return {
      selectedFields,
      riskyFields,
      splitMatches,
      status: 'blocked',
      headline: 'The feature contract cannot be trusted',
      detail: [
        leakCount > 0
          ? `${leakCount} selected field${leakCount === 1 ? '' : 's'} reveal information created after the decision.`
          : '',
        parityCount > 0
          ? `${parityCount} selected field${parityCount === 1 ? '' : 's'} are absent from the online request.`
          : '',
        splitMatches ? '' : 'The split also tests the wrong generalization boundary.',
      ].filter(Boolean).join(' '),
    };
  }

  if (!splitMatches) {
    return {
      selectedFields,
      riskyFields,
      splitMatches,
      status: 'review',
      headline: 'The inputs are valid, but the evaluation can mislead',
      detail: scenario.splitReason,
    };
  }

  return {
    selectedFields,
    riskyFields,
    splitMatches,
    status: 'ready',
    headline: profile.id === 'baseline'
      ? 'A clean baseline contract'
      : 'The contract matches the decision boundary',
    detail: profile.id === 'baseline'
      ? 'This smaller request-time feature set is useful as a reference before adding justified complexity.'
      : 'Every selected feature exists at prediction time, and the split tests the failure mode the model will face.',
  };
}

export default function LudwigFeatureContractLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<FeatureContractModel | null>(null);
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
        if (!isFeatureContractModel(payload)) {
          throw new Error('The Ludwig feature-contract model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the Ludwig feature-contract model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <LoadState
        error={error}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  return <FeatureContractWorkbench model={model} />;
}

function FeatureContractWorkbench({ model }: { model: FeatureContractModel }) {
  const [scenarioId, setScenarioId] = useState(model.defaults.scenarioId);
  const [profileId, setProfileId] = useState(model.defaults.featureProfileId);
  const [splitId, setSplitId] = useState(model.defaults.splitId);

  const scenario =
    model.scenarios.find((item) => item.id === scenarioId)
    ?? model.scenarios[0];
  const profile =
    model.featureProfiles.find((item) => item.id === profileId)
    ?? model.featureProfiles[0];
  const split =
    model.splits.find((item) => item.id === splitId)
    ?? model.splits[0];
  const recommendedSplit =
    model.splits.find((item) => item.id === scenario.recommendedSplitId)
    ?? model.splits[0];
  const result = useMemo(
    () => buildResult(scenario, profile, split),
    [profile, scenario, split],
  );

  function reset() {
    setScenarioId(model.defaults.scenarioId);
    setProfileId(model.defaults.featureProfileId);
    setSplitId(model.defaults.splitId);
  }

  const outcomeStyles = {
    ready: {
      border: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
      icon: CheckCircle2,
      label: 'Contract ready',
    },
    review: {
      border: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
      icon: AlertTriangle,
      label: 'Evaluation risk',
    },
    blocked: {
      border: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
      icon: CircleX,
      label: 'Contract blocked',
    },
  } as const;
  const outcome = outcomeStyles[result.status];
  const OutcomeIcon = outcome.icon;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Feature contract lab"
          title={model.title}
          description={model.description}
          icon={Braces}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup label="1. Choose a prediction job">
                {model.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.detail}
                    icon={scenarioIcon(item.id)}
                    accent="violet"
                    onClick={() => setScenarioId(item.id)}
                  />
                ))}
              </ChoiceGroup>

              <ChoiceGroup label="2. Select model inputs">
                {model.featureProfiles.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === profile.id}
                    label={item.label}
                    detail={item.detail}
                    icon={profileIcon(item.id)}
                    accent="blue"
                    onClick={() => setProfileId(item.id)}
                  />
                ))}
              </ChoiceGroup>

              <ChoiceGroup label="3. Set the evaluation boundary">
                {model.splits.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === split.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Split}
                    accent="emerald"
                    onClick={() => setSplitId(item.id)}
                  />
                ))}
              </ChoiceGroup>
            </div>
          )}
        >
          <div className="space-y-5" aria-live="polite">
            <section className={`rounded-md border p-5 ${outcome.border}`}>
              <div className="flex items-start gap-3">
                <OutcomeIcon
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-75">
                    {outcome.label}
                  </p>
                  <h4 className="mt-1 text-lg font-semibold">
                    {result.headline}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {result.detail}
                  </p>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Prediction target"
                value={scenario.target}
                detail={`${scenario.outputType} output feature`}
                icon={Sparkles}
                tone="violet"
              />
              <LabMetric
                label="Selected inputs"
                value={String(result.selectedFields.length)}
                detail={`${scenario.fields.length} candidate columns`}
                icon={Database}
                tone="blue"
              />
              <LabMetric
                label="Contract issues"
                value={String(
                  result.riskyFields.length + (result.splitMatches ? 0 : 1),
                )}
                detail={result.riskyFields.length > 0
                  ? 'Leakage or serving-parity failures'
                  : result.splitMatches
                    ? 'No structural issue found'
                    : 'Evaluation boundary mismatch'}
                icon={FileWarning}
                tone={result.status === 'ready'
                  ? 'emerald'
                  : result.status === 'review'
                    ? 'amber'
                    : 'rose'}
              />
              <LabMetric
                label="Recommended split"
                value={recommendedSplit.label}
                detail={scenario.splitReason}
                icon={GitBranch}
                tone={result.splitMatches ? 'emerald' : 'amber'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Feature availability map
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    What the model sees at decision time
                  </h4>
                </div>
                <span className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                  {profile.label}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {scenario.fields.map((field) => (
                  <FeatureCard
                    key={field.name}
                    field={field}
                    selected={result.selectedFields.some(
                      (item) => item.name === field.name,
                    )}
                  />
                ))}
              </div>
            </section>

            <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
              <div className="min-w-0 rounded-md border border-neutral-200 bg-neutral-950 p-5 text-neutral-100 dark:border-neutral-800">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-violet-300">
                  <Braces aria-hidden="true" className="h-4 w-4" />
                  Generated contract shape
                </div>
                <pre className="mt-4 overflow-x-auto text-xs leading-6 text-neutral-200">
                  <code>{buildConfigPreview(
                    result.selectedFields,
                    scenario,
                    split,
                  )}</code>
                </pre>
              </div>
              <div className="min-w-0 rounded-md border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
                <div className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                  <ShieldCheck
                    aria-hidden="true"
                    className="h-4 w-4 text-emerald-600 dark:text-emerald-300"
                  />
                  Invariant to remember
                </div>
                <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  A training field is safe only when its value exists before the
                  prediction and the serving path can reproduce the same
                  preprocessing. A held-out split must also represent the
                  entities or future period the model will face.
                </p>
              </div>
            </section>

            <p className="flex items-start gap-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              {model.notice}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ChoiceGroup({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </legend>
      <div className="mt-3 grid gap-2">{children}</div>
    </fieldset>
  );
}

function FeatureCard({
  field,
  selected,
}: {
  field: FeatureField;
  selected: boolean;
}) {
  const styles = availabilityStyles[field.availability];
  const StatusIcon = styles.icon;

  return (
    <div
      className={`min-w-0 rounded-md border p-4 ${
        selected
          ? styles.selected
          : 'border-neutral-200 bg-white text-neutral-500 opacity-70 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-mono text-sm font-semibold">
            {field.name}
          </p>
          <p className="mt-1 text-xs uppercase opacity-70">{field.type}</p>
        </div>
        <StatusIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
      </div>
      <p className="mt-3 text-xs font-semibold uppercase opacity-75">
        {selected ? styles.label : 'Not selected'}
      </p>
      <p className="mt-1 text-xs leading-5 opacity-80">{field.detail}</p>
    </div>
  );
}

function buildConfigPreview(
  fields: FeatureField[],
  scenario: Scenario,
  split: SplitStrategy,
) {
  const inputs = fields
    .map((field) => `  - {name: ${field.name}, type: ${field.type}}`)
    .join('\n');
  const splitLines = split.configType === 'fixed'
    ? `    type: fixed\n    column: ${split.configColumn}`
    : '    type: random';

  return [
    'input_features:',
    inputs || '  []',
    'output_features:',
    `  - {name: ${scenario.target}, type: ${scenario.outputType}}`,
    'preprocessing:',
    '  split:',
    splitLines,
  ].join('\n');
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div className="flex min-h-56 items-center justify-center">
            {error ? (
              <div className="max-w-md text-center" role="alert">
                <AlertTriangle
                  aria-hidden="true"
                  className="mx-auto h-6 w-6 text-rose-600 dark:text-rose-300"
                />
                <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
                  Feature-contract model unavailable
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100"
                >
                  Retry
                </button>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                <LoaderCircle
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin"
                />
                Loading Ludwig feature-contract model
              </p>
            )}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

const availabilityStyles: Record<
  Availability,
  {
    icon: LucideIcon;
    label: string;
    selected: string;
  }
> = {
  request: {
    icon: CheckCircle2,
    label: 'Available at request time',
    selected:
      'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
  },
  'post-outcome': {
    icon: CircleX,
    label: 'Post-outcome leakage',
    selected:
      'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
  },
  'offline-only': {
    icon: AlertTriangle,
    label: 'Missing from serving',
    selected:
      'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
  },
};

function scenarioIcon(id: string): LucideIcon {
  if (id === 'support-routing') return ServerCog;
  if (id === 'renewal-risk') return GitBranch;
  return Layers3;
}

function profileIcon(id: string): LucideIcon {
  if (id === 'baseline') return ShieldCheck;
  if (id === 'production') return ServerCog;
  return Database;
}
