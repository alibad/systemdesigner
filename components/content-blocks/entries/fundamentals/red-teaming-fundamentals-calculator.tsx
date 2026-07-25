'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileLock2,
  RotateCcw,
  ShieldCheck,
  Siren,
  Target,
  UserRoundCheck,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'fundamentals/red-teaming-fundamentals-calculator';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/red-teaming-fundamentals/data/engagement-envelope-model.json';

type Safeguard = { id: string; label: string; detail: string };
type Scenario = {
  id: string;
  label: string;
  hypothesis: string;
  target: string;
  exclusions: string;
  risk: string;
  requiredSafeguardIds: string[];
  stopCondition: string;
  evidenceLimit: string;
  recoveryOwner: string;
};
type EnvelopeModel = {
  title: string;
  description: string;
  defaultScenarioId: string;
  defaultSafeguardIds: string[];
  safeguards: Safeguard[];
  scenarios: Scenario[];
};

function isEnvelopeModel(value: unknown): value is EnvelopeModel {
  if (!value || typeof value !== 'object') return false;
  const model = value as Partial<EnvelopeModel>;
  return Boolean(
    model.title
      && model.description
      && model.defaultScenarioId
      && Array.isArray(model.defaultSafeguardIds)
      && Array.isArray(model.safeguards)
      && model.safeguards.length >= 6
      && model.safeguards.every((item) => item.id && item.label && item.detail)
      && Array.isArray(model.scenarios)
      && model.scenarios.length >= 3
      && model.scenarios.every((item) => (
        item.id
        && item.label
        && item.hypothesis
        && item.target
        && item.exclusions
        && item.risk
        && Array.isArray(item.requiredSafeguardIds)
        && item.stopCondition
        && item.evidenceLimit
        && item.recoveryOwner
      )),
  );
}

export default function RedTeamingFundamentalsCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<EnvelopeModel | null>(null);
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
        if (!isEnvelopeModel(payload)) throw new Error('The engagement model is incomplete.');
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load engagement data.');
      });
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Rules of engagement lab"
            title="Build an enforceable engagement envelope"
            description="Loading authorization scenarios and safeguards."
            icon={ShieldCheck}
            accent="violet"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <EnvelopeWorkbench model={model} />
      )}
    </div>
  );
}

function EnvelopeWorkbench({ model }: { model: EnvelopeModel }) {
  const initialScenario = model.scenarios.find((item) => item.id === model.defaultScenarioId)
    ?? model.scenarios[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [selectedSafeguards, setSelectedSafeguards] = useState(model.defaultSafeguardIds);
  const scenario = model.scenarios.find((item) => item.id === scenarioId) ?? model.scenarios[0];

  const decision = useMemo(() => {
    const missingIds = scenario.requiredSafeguardIds.filter(
      (id) => !selectedSafeguards.includes(id),
    );
    const missing = missingIds.map(
      (id) => model.safeguards.find((item) => item.id === id)?.label ?? id,
    );
    return {
      ready: missing.length === 0,
      missing,
      covered: scenario.requiredSafeguardIds.length - missing.length,
      total: scenario.requiredSafeguardIds.length,
    };
  }, [model.safeguards, scenario, selectedSafeguards]);

  function chooseScenario(nextId: string) {
    setScenarioId(nextId);
    setSelectedSafeguards(model.defaultSafeguardIds);
  }

  function toggleSafeguard(id: string) {
    setSelectedSafeguards((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  }

  function reset() {
    setScenarioId(initialScenario.id);
    setSelectedSafeguards(model.defaultSafeguardIds);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Rules of engagement lab"
        title={model.title}
        description={model.description}
        icon={ShieldCheck}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <fieldset className="space-y-3">
            <legend className="mb-3 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              1. Choose the hypothesis
            </legend>
            {model.scenarios.map((item) => (
              <LabChoice
                key={item.id}
                selected={item.id === scenario.id}
                label={item.label}
                detail={item.hypothesis}
                icon={Target}
                accent="violet"
                onClick={() => chooseScenario(item.id)}
              />
            ))}
          </fieldset>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-3" aria-live="polite">
          <LabMetric
            label="Authorization"
            value={decision.ready ? 'Ready' : 'Denied'}
            detail={decision.ready ? 'All required safeguards are explicit.' : 'The plan must fail closed.'}
            icon={decision.ready ? CheckCircle2 : Ban}
            tone={decision.ready ? 'emerald' : 'rose'}
          />
          <LabMetric
            label="Safeguards"
            value={`${decision.covered} / ${decision.total}`}
            detail="Required controls made explicit"
            icon={FileLock2}
            tone={decision.ready ? 'emerald' : 'amber'}
          />
          <LabMetric
            label="Primary risk"
            value="Bounded"
            detail={scenario.risk}
            icon={AlertTriangle}
            tone="amber"
          />
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <BoundaryCard label="Authorized target" value={scenario.target} icon={Target} />
          <BoundaryCard label="Explicit exclusions" value={scenario.exclusions} icon={Ban} />
          <BoundaryCard label="Stop condition" value={scenario.stopCondition} icon={Siren} />
          <BoundaryCard label="Recovery owner" value={scenario.recoveryOwner} icon={UserRoundCheck} />
        </div>

        <fieldset className="mt-6">
          <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            2. Add or remove safeguards
          </legend>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {model.safeguards.map((item) => {
              const selected = selectedSafeguards.includes(item.id);
              const required = scenario.requiredSafeguardIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleSafeguard(item.id)}
                  className={`grid min-h-24 grid-cols-[24px_minmax(0,1fr)] gap-3 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                    selected
                      ? 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-50'
                      : 'border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'
                  }`}
                >
                  <span className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded border ${selected ? 'border-violet-600 bg-violet-600 text-white' : 'border-neutral-400 dark:border-neutral-600'}`}>
                    {selected ? <Check aria-hidden="true" className="h-4 w-4" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">
                      {item.label}{required ? ' - required' : ' - optional'}
                    </span>
                    <span className="mt-1 block text-xs leading-5 opacity-75">{item.detail}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className={`mt-6 rounded-md border p-4 ${decision.ready ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50' : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'}`}>
          <div className="flex items-start gap-3">
            {decision.ready ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
            <div>
              <p className="font-semibold">
                {decision.ready ? 'The bounded test may proceed inside this envelope.' : `Missing ${decision.missing.length} required safeguard${decision.missing.length === 1 ? '' : 's'}.`}
              </p>
              <p className="mt-1 text-sm leading-6 opacity-80">
                {decision.ready ? scenario.evidenceLimit : decision.missing.join(', ')}
              </p>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function BoundaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {label}
      </div>
      <p className="mt-2 text-sm leading-6 text-neutral-800 dark:text-neutral-200">{value}</p>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <LearningLabBody>
      <div className="flex min-h-40 items-center justify-center text-center">
        {error ? (
          <div>
            <CircleAlert aria-hidden="true" className="mx-auto h-6 w-6 text-rose-500" />
            <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-200"
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              Retry
            </button>
          </div>
        ) : (
          <span className="inline-flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
            <Clock3 aria-hidden="true" className="h-4 w-4" />
            Loading engagement model
          </span>
        )}
      </div>
    </LearningLabBody>
  );
}
