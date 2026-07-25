'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  Boxes,
  Cable,
  CheckCircle2,
  Code2,
  Database,
  Gauge,
  Globe2,
  Network,
  Radio,
  TriangleAlert,
  Zap,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type DimensionId = 'workflow' | 'latency' | 'streaming' | 'caching' | 'compatibility' | 'team';
type Option = { id: string; label: string; detail: string };
type Pattern = {
  id: string;
  label: string;
  summary: string;
  scores: Record<DimensionId, Record<string, number>>;
  contract: string;
  consequence: string;
  watch: string;
};
type StyleModel = { dimensions: Record<DimensionId, Option[]>; patterns: Pattern[] };

const dimensionMeta: Array<{ id: DimensionId; label: string; icon: typeof Activity }> = [
  { id: 'workflow', label: '1. Workflow shape', icon: Activity },
  { id: 'latency', label: '2. Latency target', icon: Gauge },
  { id: 'streaming', label: '3. Streaming need', icon: Cable },
  { id: 'caching', label: '4. Cache value', icon: Database },
  { id: 'compatibility', label: '5. Client compatibility', icon: Globe2 },
  { id: 'team', label: '6. Team constraint', icon: Boxes },
];

const patternIcons = { rest: Globe2, rpc: Zap, graphql: Network, event: Radio } as const;
const patternTones = { rest: 'blue', rpc: 'violet', graphql: 'emerald', event: 'amber' } as const;

function ChoiceSelect({
  id,
  label,
  options,
  value,
  icon,
  onChange,
}: {
  id: string;
  label: string;
  options: Option[];
  value: string;
  icon: ReactNode;
  onChange: (value: string) => void;
}) {
  const selected = options.find((option) => option.id === value) ?? options[0];

  return (
    <label htmlFor={id} className="block">
      <span className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {icon}
        {label}
      </span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-950 outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="mt-2 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">{selected?.detail}</span>
    </label>
  );
}

export default function ApiPatternsContractSelectorLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<StyleModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [choices, setChoices] = useState<Record<DimensionId, string>>({
    workflow: 'resource',
    latency: 'standard',
    streaming: 'none',
    caching: 'important',
    compatibility: 'public',
    team: 'http',
  });

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The API style selection model was not provided.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<StyleModel>;
      })
      .then(setData)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the API style model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  const ranked = useMemo(() => {
    if (!data) return [];
    return data.patterns
      .map((pattern) => ({
        ...pattern,
        score: dimensionMeta.reduce((total, dimension) => total + (pattern.scores[dimension.id][choices[dimension.id]] ?? 0), 0),
      }))
      .sort((left, right) => right.score - left.score);
  }, [choices, data]);

  if (loadError) {
    return (
      <div data-content-block="reference/api-patterns-contract-selector-lab">
        <div className="min-h-48 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
          <p className="font-semibold">API style selector unavailable</p>
          <p className="mt-2 opacity-80">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!data || ranked.length === 0) {
    return (
      <div data-content-block="reference/api-patterns-contract-selector-lab">
        <div className="min-h-[560px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading API style selector" />
      </div>
    );
  }

  const recommendation = ranked[0];
  const RunnerUpIcon = patternIcons[ranked[1]?.id as keyof typeof patternIcons] ?? CheckCircle2;
  const RecommendationIcon = patternIcons[recommendation.id as keyof typeof patternIcons] ?? Code2;
  const recommendationTone = patternTones[recommendation.id as keyof typeof patternTones] ?? 'blue';

  return (
    <div data-content-block="reference/api-patterns-contract-selector-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Constraint-driven contract selector"
          title="Rank an API style from the work it must support"
          description="The model ranks four boundary styles from six constraints. A high score identifies the next contract to write, not permission to ignore its failure and operating responsibilities."
          icon={Code2}
          accent="violet"
          onReset={() => setChoices({ workflow: 'resource', latency: 'standard', streaming: 'none', caching: 'important', compatibility: 'public', team: 'http' })}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Workflow</legend>
                <div className="mt-3 space-y-2">
                  {data.dimensions.workflow.map((option) => (
                    <LabChoice
                      key={option.id}
                      selected={choices.workflow === option.id}
                      label={option.label}
                      detail={option.detail}
                      icon={option.id === 'event' ? Radio : option.id === 'graph' ? Network : option.id === 'command' ? Zap : Boxes}
                      accent="violet"
                      onClick={() => setChoices((current) => ({ ...current, workflow: option.id }))}
                    />
                  ))}
                </div>
              </fieldset>
              {dimensionMeta.slice(1).map((dimension) => {
                const Icon = dimension.icon;
                return (
                  <ChoiceSelect
                    key={dimension.id}
                    id={`api-style-${dimension.id}`}
                    label={dimension.label}
                    options={data.dimensions[dimension.id]}
                    value={choices[dimension.id]}
                    icon={<Icon aria-hidden="true" className="h-4 w-4" />}
                    onChange={(value) => setChoices((current) => ({ ...current, [dimension.id]: value }))}
                  />
                );
              })}
            </div>
          }
        >
          <div aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric label="Starting style" value={recommendation.label} detail={`${recommendation.score} of 30 modeled fit points`} icon={RecommendationIcon} tone={recommendationTone} />
              <LabMetric label="Runner-up" value={ranked[1]?.label ?? 'None'} detail={ranked[1] ? `${ranked[1].score} of 30 modeled fit points` : 'No alternative configured'} icon={RunnerUpIcon} tone="neutral" />
              <LabMetric label="Hard decision" value={data.dimensions.workflow.find((option) => option.id === choices.workflow)?.label ?? choices.workflow} detail="A style cannot repair a mismatched interaction shape." icon={Activity} tone="amber" />
            </div>

            <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                  <RecommendationIcon aria-hidden="true" className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Contract consequence</p>
                  <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{recommendation.summary}</h4>
                  <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{recommendation.contract}</p>
                </div>
              </div>
            </section>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-cyan-200 bg-cyan-50 p-4 text-cyan-950 dark:border-cyan-900/70 dark:bg-cyan-950/30 dark:text-cyan-50">
                <p className="text-sm font-semibold">What this choice enables</p>
                <p className="mt-2 text-sm leading-6 opacity-85">{recommendation.consequence}</p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-50">
                <p className="flex items-center gap-2 text-sm font-semibold"><TriangleAlert aria-hidden="true" className="h-4 w-4" />Review before adopting</p>
                <p className="mt-2 text-sm leading-6 opacity-85">{recommendation.watch}</p>
              </div>
            </div>

            <section className="mt-6 border-t border-neutral-200 pt-4 dark:border-neutral-800">
              <div className="flex items-center justify-between gap-4">
                <h4 className="text-base font-semibold text-neutral-950 dark:text-white">All candidate fits</h4>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">Scores expose the trade-off; they do not decide architecture.</span>
              </div>
              <div className="mt-3 space-y-3">
                {ranked.map((pattern) => {
                  const width = `${Math.max(8, Math.round((pattern.score / 30) * 100))}%`;
                  return (
                    <div key={pattern.id} className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-3">
                      <div className="min-w-0">
                        <div className="flex justify-between gap-3 text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                          <span className="truncate">{pattern.label}</span>
                          <span className="shrink-0 tabular-nums">{pattern.score}/30</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                          <div className="h-full rounded-full bg-violet-500" style={{ width }} />
                        </div>
                      </div>
                      <span className="text-right text-xs text-neutral-500 dark:text-neutral-400">{Math.round((pattern.score / 30) * 100)}%</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
