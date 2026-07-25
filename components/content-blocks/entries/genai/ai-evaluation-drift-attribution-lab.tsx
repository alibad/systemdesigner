'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  CircleAlert,
  Database,
  RefreshCw,
  Search,
  ShieldCheck,
  type LucideIcon,
  Users,
  Workflow,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Tone = 'neutral' | 'cyan' | 'violet' | 'emerald' | 'amber' | 'rose' | 'blue';

interface EvidenceLens {
  id: string;
  label: string;
  detail: string;
}

interface DriftScenario {
  id: string;
  label: string;
  detail: string;
  observedDeltaPct: number;
  applicationEffectPct: number;
  judgeEffectPct: number;
  populationEffectPct: number;
  rootKind: 'system' | 'judge' | 'population' | 'instrumentation';
  rootLabel: string;
  changedVersions: string[];
  stableVersions: string[];
  headline: string;
  pairedConclusion: string;
  matchedConclusion: string;
  action: string;
}

interface AttributionData {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    lensId: string;
  };
  lenses: EvidenceLens[];
  scenarios: DriftScenario[];
}

const DEFAULT_DATA_FILE =
  '/api/content/genai/ai-evaluation-drift/data/drift-attribution-scenarios.json';
const BLOCK_ID = 'genai/ai-evaluation-drift-attribution-lab';

function isAttributionData(value: unknown): value is AttributionData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<AttributionData>;
  return Boolean(
    data.title
      && data.description
      && data.defaults
      && Array.isArray(data.lenses)
      && data.lenses.length === 3
      && Array.isArray(data.scenarios)
      && data.scenarios.length > 0
      && data.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.observedDeltaPct === 'number'
        && typeof scenario.applicationEffectPct === 'number'
        && typeof scenario.judgeEffectPct === 'number'
        && typeof scenario.populationEffectPct === 'number'
        && Array.isArray(scenario.changedVersions)
        && Array.isArray(scenario.stableVersions)
      )),
  );
}

function delta(value: number) {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)} pts`;
}

function deltaTone(value: number): Tone {
  if (value <= -4) return 'rose';
  if (value < -1) return 'amber';
  if (value >= 1) return 'emerald';
  return 'neutral';
}

export default function AiEvaluationDriftAttributionLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<AttributionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [scenarioId, setScenarioId] = useState('');
  const [lensId, setLensId] = useState('');

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isAttributionData(payload)) throw new Error('Drift attribution data is incomplete.');

        if (active) {
          setData(payload);
          setScenarioId(payload.defaults.scenarioId);
          setLensId(payload.defaults.lensId);
        }
      } catch (loadError) {
        if (active) {
          setData(null);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load attribution data.');
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const scenario = data?.scenarios.find((item) => item.id === scenarioId)
    ?? data?.scenarios[0];
  const lens = data?.lenses.find((item) => item.id === lensId) ?? data?.lenses[0];

  const model = useMemo(() => {
    if (!scenario || !lens) return null;
    const pairedVisible = lens.id === 'paired-judge' || lens.id === 'matched-population';
    const matchedVisible = lens.id === 'matched-population';
    const explained = scenario.applicationEffectPct
      + scenario.judgeEffectPct
      + scenario.populationEffectPct;
    const residual = scenario.observedDeltaPct - explained;
    const confidence = lens.id === 'headline' ? 28 : lens.id === 'paired-judge' ? 72 : 94;
    const conclusion = lens.id === 'headline'
      ? 'The score movement is real, but application, evaluator, population, and instrumentation causes remain confounded.'
      : lens.id === 'paired-judge'
        ? scenario.pairedConclusion
        : scenario.matchedConclusion;

    return {
      confidence,
      conclusion,
      matchedVisible,
      pairedVisible,
      residual,
    };
  }, [lens, scenario]);

  function reset() {
    if (!data) return;
    setScenarioId(data.defaults.scenarioId);
    setLensId(data.defaults.lensId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Causal evidence lab"
          title={data?.title ?? 'Separate product drift from measurement drift'}
          description={data?.description ?? 'Loading the versioned evidence model...'}
          icon={Search}
          accent="violet"
          onReset={data ? reset : undefined}
        />

        {!data || !scenario || !lens || !model ? (
          <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Observed incident
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.scenarios.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === scenario.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.rootKind === 'judge' ? Bot : item.rootKind === 'population' ? Users : Workflow}
                        accent={item.rootKind === 'judge' ? 'violet' : item.rootKind === 'population' ? 'amber' : 'blue'}
                        onClick={() => setScenarioId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    2. Evidence lens
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.lenses.map((item, index) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === lens.id}
                        label={`${index + 1}. ${item.label}`}
                        detail={item.detail}
                        icon={index === 0 ? Activity : index === 1 ? Bot : Users}
                        accent={index === 0 ? 'cyan' : index === 1 ? 'violet' : 'emerald'}
                        onClick={() => setLensId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
          >
            <div className="min-h-[680px] min-w-0">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Observed movement"
                  value={delta(scenario.observedDeltaPct)}
                  detail="Published top-line score"
                  icon={Activity}
                  tone={deltaTone(scenario.observedDeltaPct)}
                />
                <LabMetric
                  label="Application effect"
                  value={model.pairedVisible ? delta(scenario.applicationEffectPct) : 'Unknown'}
                  detail="Paired outputs, frozen judge"
                  icon={Workflow}
                  tone={model.pairedVisible ? deltaTone(scenario.applicationEffectPct) : 'neutral'}
                />
                <LabMetric
                  label="Judge effect"
                  value={model.pairedVisible ? delta(scenario.judgeEffectPct) : 'Unknown'}
                  detail="Stable anchors across judges"
                  icon={Bot}
                  tone={model.pairedVisible ? deltaTone(scenario.judgeEffectPct) : 'neutral'}
                />
                <LabMetric
                  label="Population effect"
                  value={model.matchedVisible ? delta(scenario.populationEffectPct) : 'Unknown'}
                  detail="Raw versus matched traffic"
                  icon={Users}
                  tone={model.matchedVisible ? deltaTone(scenario.populationEffectPct) : 'neutral'}
                />
              </div>

              <section className="mt-5" aria-label="Drift contribution model">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                      Attribution model
                    </p>
                    <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                      What explains the score movement?
                    </h4>
                  </div>
                  <p className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                    Evidence confidence: {model.confidence}%
                  </p>
                </div>

                <div className="mt-4 space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                  <ContributionBar
                    label="Application path"
                    value={scenario.applicationEffectPct}
                    visible={model.pairedVisible}
                    tone="blue"
                  />
                  <ContributionBar
                    label="Evaluator configuration"
                    value={scenario.judgeEffectPct}
                    visible={model.pairedVisible}
                    tone="violet"
                  />
                  <ContributionBar
                    label="Traffic and instrumentation"
                    value={scenario.populationEffectPct}
                    visible={model.matchedVisible}
                    tone="amber"
                  />
                </div>
              </section>

              <section className="mt-5 grid gap-3 md:grid-cols-2" aria-label="Version evidence">
                <VersionPanel
                  title="Changed identities"
                  items={scenario.changedVersions}
                  icon={Database}
                  tone="rose"
                />
                <VersionPanel
                  title="Held stable"
                  items={scenario.stableVersions}
                  icon={ShieldCheck}
                  tone="emerald"
                />
              </section>

              <section
                aria-live="polite"
                className={`mt-5 rounded-md border p-5 ${model.matchedVisible
                  ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/35'
                  : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/35'}`}
              >
                <div className="flex items-start gap-3">
                  {model.matchedVisible ? (
                    <ShieldCheck aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  ) : (
                    <Search aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-amber-700 dark:text-amber-300" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-950 dark:text-white">
                      {model.matchedVisible ? scenario.headline : 'Attribution is not complete'}
                    </p>
                    {model.matchedVisible ? (
                      <p className="mt-2 text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                        Likely source: {scenario.rootLabel}
                      </p>
                    ) : null}
                    <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                      {model.conclusion}
                    </p>
                    {model.matchedVisible ? (
                      <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                        <strong>Response:</strong> {scenario.action}
                      </p>
                    ) : null}
                    {model.matchedVisible && Math.abs(model.residual) > 0.1 ? (
                      <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">
                        Unexplained residual: {delta(model.residual)}. Keep investigating instead of forcing complete attribution.
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function ContributionBar({
  label,
  value,
  visible,
  tone,
}: {
  label: string;
  value: number;
  visible: boolean;
  tone: 'blue' | 'violet' | 'amber';
}) {
  const width = `${Math.max(4, Math.min(100, Math.abs(value) / 12 * 100))}%`;
  const barTone = {
    blue: 'bg-blue-500 dark:bg-blue-400',
    violet: 'bg-violet-500 dark:bg-violet-400',
    amber: 'bg-amber-500 dark:bg-amber-400',
  }[tone];

  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-medium text-neutral-800 dark:text-neutral-100">{label}</span>
        <span className="shrink-0 font-semibold tabular-nums text-neutral-950 dark:text-white">
          {visible ? delta(value) : 'Not isolated'}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${visible ? barTone : 'bg-neutral-300 dark:bg-neutral-700'}`}
          style={{ width: visible ? width : '100%' }}
        />
      </div>
    </div>
  );
}

function VersionPanel({
  title,
  items,
  icon: Icon,
  tone,
}: {
  title: string;
  items: string[];
  icon: LucideIcon;
  tone: 'rose' | 'emerald';
}) {
  const classes = tone === 'rose'
    ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
    : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30';
  const iconClass = tone === 'rose'
    ? 'text-rose-700 dark:text-rose-300'
    : 'text-emerald-700 dark:text-emerald-300';

  return (
    <div className={`rounded-md border p-4 ${classes}`}>
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className={`h-4 w-4 ${iconClass}`} />
        <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">{title}</p>
      </div>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-neutral-800 marker:text-neutral-400 dark:text-neutral-100 dark:marker:text-neutral-500">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <LearningLabBody>
      <div className="grid min-h-[360px] place-items-center text-center">
        {error ? (
          <div>
            <CircleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-300" />
            <p className="mt-3 font-semibold text-neutral-950 dark:text-white">Attribution data could not load</p>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Retry
            </button>
          </div>
        ) : <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading attribution model...</p>}
      </div>
    </LearningLabBody>
  );
}
