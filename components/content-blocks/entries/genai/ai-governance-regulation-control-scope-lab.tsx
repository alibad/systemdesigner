'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CircleAlert,
  ClipboardCheck,
  Gauge,
  LoaderCircle,
  Scale,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Tone = 'emerald' | 'amber' | 'rose';

interface ScopeBand {
  id: 'limited' | 'enhanced' | 'stringent';
  maxScore: number;
  label: string;
  cadence: string;
  decisionOwner: string;
  summary: string;
}

interface ScopeScenario {
  id: string;
  label: string;
  detail: string;
  impact: number;
  dataSensitivity: number;
  irreversibility: number;
  role: string;
  affectedGroup: string;
  priorityEvidence: string[];
}

interface ScopeModel {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    autonomyPercent: number;
    monthlyReachThousands: number;
  };
  bands: ScopeBand[];
  scenarios: ScopeScenario[];
}

const BLOCK_ID = 'genai/ai-governance-regulation-control-scope-lab';

function isScopeModel(value: unknown): value is ScopeModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ScopeModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && Array.isArray(candidate.bands)
      && candidate.bands.length > 0
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0,
  );
}

function factorBand(value: number, thresholds: [number, number, number]) {
  if (value <= thresholds[0]) return 1;
  if (value <= thresholds[1]) return 2;
  if (value <= thresholds[2]) return 3;
  return 4;
}

export default function AiGovernanceRegulationControlScopeLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ScopeModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No governance scope model was supplied.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isScopeModel(payload)) throw new Error('Governance scope data is incomplete.');
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the scope model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabError detail={loadError} />;
  if (!data) return <LabLoading />;
  return <ControlScopeLab data={data} />;
}

function ControlScopeLab({ data }: { data: ScopeModel }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [autonomyPercent, setAutonomyPercent] = useState(data.defaults.autonomyPercent);
  const [monthlyReachThousands, setMonthlyReachThousands] = useState(
    data.defaults.monthlyReachThousands,
  );

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const model = useMemo(() => {
    const autonomy = factorBand(autonomyPercent, [20, 50, 75]);
    const reach = factorBand(monthlyReachThousands, [10, 100, 500]);
    const score = scenario.impact
      + scenario.dataSensitivity
      + scenario.irreversibility
      + autonomy
      + reach;
    const band = data.bands.find((item) => score <= item.maxScore)
      ?? data.bands[data.bands.length - 1];
    const tone: Tone = band.id === 'limited'
      ? 'emerald'
      : band.id === 'enhanced'
        ? 'amber'
        : 'rose';

    return {
      autonomy,
      band,
      factors: [
        { label: 'Impact', value: scenario.impact },
        { label: 'Sensitive data', value: scenario.dataSensitivity },
        { label: 'Irreversibility', value: scenario.irreversibility },
        { label: 'Autonomy', value: autonomy },
        { label: 'Reach', value: reach },
      ],
      reach,
      score,
      tone,
    };
  }, [autonomyPercent, data.bands, monthlyReachThousands, scenario]);

  const reset = () => {
    setScenarioId(data.defaults.scenarioId);
    setAutonomyPercent(data.defaults.autonomyPercent);
    setMonthlyReachThousands(data.defaults.monthlyReachThousands);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Governance scope lab"
          title={data.title}
          description={data.description}
          icon={Scale}
          accent="blue"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. System context
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={scenario.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={ClipboardCheck}
                      accent="violet"
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Action autonomy"
                value={autonomyPercent}
                output={`${autonomyPercent}%`}
                min={0}
                max={100}
                step={5}
                accent="amber"
                lowLabel="Draft only"
                highLabel="Acts without review"
                onChange={setAutonomyPercent}
              />

              <LabRange
                label="People reached monthly"
                value={monthlyReachThousands}
                output={monthlyReachThousands >= 1_000
                  ? `${(monthlyReachThousands / 1_000).toFixed(1)}M`
                  : `${monthlyReachThousands}K`}
                min={1}
                max={1_000}
                step={1}
                accent="cyan"
                lowLabel="1K"
                highLabel="1M"
                onChange={setMonthlyReachThousands}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Triage score"
                value={`${model.score} / 20`}
                detail="Internal prioritization, not a legal category"
                icon={Gauge}
                tone={model.tone}
              />
              <LabMetric
                label="Review depth"
                value={model.band.label}
                detail={model.band.cadence}
                icon={ShieldCheck}
                tone={model.tone}
              />
              <LabMetric
                label="Decision owner"
                value={model.band.id === 'limited' ? 'Product' : model.band.id === 'enhanced' ? 'Risk owner' : 'Independent'}
                detail={model.band.decisionOwner}
                icon={UsersRound}
                tone="violet"
              />
              <LabMetric
                label="Organization role"
                value={scenario.role}
                detail={scenario.affectedGroup}
                icon={Scale}
                tone="blue"
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Why the review depth changed
                  </p>
                  <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                    Each factor contributes one to four points. Context changes the control burden even when the model is identical.
                  </p>
                </div>
                <span className="shrink-0 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold tabular-nums text-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white">
                  {model.score}
                </span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-5">
                {model.factors.map((factor) => (
                  <div key={factor.label} className="min-w-0">
                    <div className="flex items-center justify-between gap-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                      <span>{factor.label}</span>
                      <span>{factor.value}/4</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-[width] motion-reduce:transition-none"
                        style={{ width: `${factor.value * 25}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
              <section className="rounded-md border border-neutral-200 p-5 dark:border-neutral-800">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Priority evidence for this context
                </p>
                <ul className="mt-3 space-y-3">
                  {scenario.priorityEvidence.map((item) => (
                    <li key={item} className="flex gap-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                      <ShieldCheck aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className={`rounded-md border p-5 ${model.tone === 'emerald'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
                : model.tone === 'amber'
                  ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'}`}
              >
                <p className="text-xs font-semibold uppercase opacity-75">Triage consequence</p>
                <p className="mt-2 text-sm font-semibold leading-6">{model.band.summary}</p>
                <p className="mt-3 text-xs leading-5 opacity-80">
                  Validate legal scope separately. This model only allocates internal review effort.
                </p>
              </section>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LabLoading() {
  return (
    <LearningLab>
      <LearningLabBody>
        <div role="status" className="flex min-h-48 items-center justify-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
          <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
          Loading governance scope model...
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function LabError({ detail }: { detail: string }) {
  return (
    <LearningLab>
      <LearningLabBody>
        <div role="alert" className="flex min-h-48 items-center justify-center gap-3 text-sm text-rose-700 dark:text-rose-300">
          <CircleAlert aria-hidden="true" className="h-5 w-5 shrink-0" />
          <span>{detail}</span>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
