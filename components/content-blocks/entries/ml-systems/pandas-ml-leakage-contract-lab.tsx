'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  GitBranch,
  Link2,
  LoaderCircle,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'ml-systems/pandas-ml-leakage-contract-lab';
const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/pandas-ml/data/leakage-contract-model.json';

type Option = { id: string; label: string; detail: string };
type Scenario = Option & {
  requiredSplit: string;
  requiredWindow: string;
  requiredJoin: string;
};

type LeakageModel = {
  kind: 'pandas-leakage-contract';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    splitId: string;
    fitScopeId: string;
    joinContractId: string;
    windowId: string;
  };
  scenarios: Scenario[];
  splitPolicies: Option[];
  fitScopes: Option[];
  joinContracts: Option[];
  windows: Option[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isLeakageModel(value: unknown): value is LeakageModel {
  return Boolean(
    isRecord(value)
      && value.kind === 'pandas-leakage-contract'
      && value.blockId === BLOCK_ID
      && typeof value.title === 'string'
      && typeof value.description === 'string'
      && isRecord(value.defaults)
      && Array.isArray(value.scenarios)
      && Array.isArray(value.splitPolicies)
      && Array.isArray(value.fitScopes)
      && Array.isArray(value.joinContracts)
      && Array.isArray(value.windows),
  );
}

export default function PandasMLLeakageContractLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<LeakageModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [scenarioId, setScenarioId] = useState('');
  const [splitId, setSplitId] = useState('');
  const [fitScopeId, setFitScopeId] = useState('');
  const [joinContractId, setJoinContractId] = useState('');
  const [windowId, setWindowId] = useState('');

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
        if (!isLeakageModel(payload)) throw new Error('The leakage contract is incomplete.');
        setModel(payload);
        setScenarioId(payload.defaults.scenarioId);
        setSplitId(payload.defaults.splitId);
        setFitScopeId(payload.defaults.fitScopeId);
        setJoinContractId(payload.defaults.joinContractId);
        setWindowId(payload.defaults.windowId);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load leakage data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const scenario =
    model?.scenarios.find((item) => item.id === scenarioId) ?? model?.scenarios[0];
  const split =
    model?.splitPolicies.find((item) => item.id === splitId) ?? model?.splitPolicies[0];
  const fitScope =
    model?.fitScopes.find((item) => item.id === fitScopeId) ?? model?.fitScopes[0];
  const joinContract =
    model?.joinContracts.find((item) => item.id === joinContractId) ??
    model?.joinContracts[0];
  const window =
    model?.windows.find((item) => item.id === windowId) ?? model?.windows[0];

  const result = useMemo(() => {
    if (!scenario || !split || !fitScope || !joinContract || !window) return null;
    const blockers = [
      split.id !== scenario.requiredSplit
        ? `The ${scenario.label.toLowerCase()} evaluation requires ${scenario.requiredSplit === 'forward-time' ? 'a forward-time split' : 'an entity-held-out split'}.`
        : null,
      fitScope.id !== 'train-only'
        ? 'Data-dependent transforms learn from evaluation rows.'
        : null,
      joinContract.id !== scenario.requiredJoin
        ? 'The feature join does not enforce the expected many-to-one contract.'
        : null,
      window.id !== scenario.requiredWindow
        ? 'The feature window includes evidence unavailable at prediction time.'
        : null,
    ].filter((item): item is string => Boolean(item));
    const passed = 4 - blockers.length;
    return { blockers, passed, ready: blockers.length === 0 };
  }, [fitScope, joinContract, scenario, split, window]);

  if (!model || !scenario || !split || !fitScope || !joinContract || !window || !result) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Leakage boundary lab"
            title="Keep features behind prediction time"
            description="Loading scenarios, split policies, joins, and feature windows."
            icon={ShieldCheck}
            accent="emerald"
          />
          <div className="flex min-h-52 items-center justify-center p-6 text-sm text-neutral-600 dark:text-neutral-300">
            {error ? (
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className="rounded-md border border-rose-300 bg-rose-50 px-4 py-3 font-semibold text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
              >
                {error} Retry
              </button>
            ) : (
              <>
                <LoaderCircle aria-hidden="true" className="mr-2 h-5 w-5 animate-spin" />
                Loading leakage model...
              </>
            )}
          </div>
        </LearningLab>
      </div>
    );
  }

  const reset = () => {
    setScenarioId(model.defaults.scenarioId);
    setSplitId(model.defaults.splitId);
    setFitScopeId(model.defaults.fitScopeId);
    setJoinContractId(model.defaults.joinContractId);
    setWindowId(model.defaults.windowId);
  };
  const OutcomeIcon = result.ready ? CheckCircle2 : AlertTriangle;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Leakage boundary lab"
          title={model.title}
          description={model.description}
          icon={ShieldCheck}
          accent="emerald"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Prediction scenario
                </legend>
                <div className="mt-3 space-y-2">
                  {model.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'churn' ? Users : item.id === 'fraud' ? ShieldCheck : Sparkles}
                      accent={item.id === 'fraud' ? 'rose' : 'blue'}
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Evaluation split
                </legend>
                <div className="mt-3 space-y-2">
                  {model.splitPolicies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === split.id}
                      label={item.label}
                      detail={item.detail}
                      icon={GitBranch}
                      accent={item.id === 'random-row' ? 'amber' : 'violet'}
                      onClick={() => setSplitId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div aria-live="polite">
            <div className="grid gap-5 lg:grid-cols-3">
              <ChoicePanel
                label="Transform fit scope"
                icon={ScanSearch}
                items={model.fitScopes}
                selected={fitScope}
                accent="blue"
                onSelect={setFitScopeId}
              />
              <ChoicePanel
                label="Join contract"
                icon={Link2}
                items={model.joinContracts}
                selected={joinContract}
                accent="violet"
                onSelect={setJoinContractId}
              />
              <ChoicePanel
                label="Feature window"
                icon={Clock3}
                items={model.windows}
                selected={window}
                accent="amber"
                onSelect={setWindowId}
              />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <LabMetric
                label="Contract checks"
                value={`${result.passed}/4`}
                detail="Split, fit, join, and time window"
                icon={ShieldCheck}
                tone={result.ready ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Split"
                value={split.id === scenario.requiredSplit ? 'Aligned' : 'Mismatch'}
                detail={split.label}
                icon={GitBranch}
                tone={split.id === scenario.requiredSplit ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Transform state"
                value={fitScope.id === 'train-only' ? 'Frozen' : 'Leaking'}
                detail={fitScope.label}
                icon={ScanSearch}
                tone={fitScope.id === 'train-only' ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Prediction window"
                value={window.id === 'past-only' ? 'Past only' : 'Future seen'}
                detail={window.label}
                icon={Clock3}
                tone={window.id === 'past-only' ? 'violet' : 'rose'}
              />
            </div>

            <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Offline-to-serving contract
              </p>
              <div className="mt-4 grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
                <Boundary label="Training rows" detail="Fit state" tone="blue" />
                <span className="hidden text-neutral-400 sm:block">→</span>
                <Boundary label="Frozen transform" detail="Versioned schema" tone="violet" />
                <span className="hidden text-neutral-400 sm:block">→</span>
                <Boundary label="Validation and serving" detail="Transform only" tone="emerald" />
              </div>
            </section>

            <section
              className={`mt-5 rounded-md border p-4 ${
                result.ready
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <OutcomeIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">
                    {result.ready
                      ? 'The offline evidence respects the prediction boundary'
                      : 'The selected pipeline can overstate offline quality'}
                  </p>
                  {result.ready ? (
                    <p className="mt-1 text-sm leading-6 opacity-85">
                      Version the source snapshot, split manifest, transform state, output schema, and serving parity fixtures before treating the evaluation as release evidence.
                    </p>
                  ) : (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 opacity-85">
                      {result.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ChoicePanel({
  label,
  icon,
  items,
  selected,
  accent,
  onSelect,
}: {
  label: string;
  icon: typeof Link2;
  items: Option[];
  selected: Option;
  accent: 'blue' | 'violet' | 'amber';
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset className="rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
      <legend className="px-1 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </legend>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <LabChoice
            key={item.id}
            selected={item.id === selected.id}
            label={item.label}
            icon={icon}
            accent={accent}
            onClick={() => onSelect(item.id)}
          />
        ))}
      </div>
      <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
        {selected.detail}
      </p>
    </fieldset>
  );
}

function Boundary({
  label,
  detail,
  tone,
}: {
  label: string;
  detail: string;
  tone: 'blue' | 'violet' | 'emerald';
}) {
  const styles = {
    blue: 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100',
    violet: 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100',
    emerald: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100',
  } as const;
  return (
    <div className={`rounded-md border p-3 text-center ${styles[tone]}`}>
      <p className="font-semibold">{label}</p>
      <p className="mt-1 text-xs opacity-75">{detail}</p>
    </div>
  );
}
