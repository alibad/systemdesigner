'use client';

import { useEffect, useState } from 'react';
import {
  Braces,
  CheckCircle2,
  CircleAlert,
  Code2,
  FileSearch,
  ListChecks,
  LoaderCircle,
  Search,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type MatchStatus = 'fit' | 'underfetch' | 'overfetch' | 'fragile' | 'wrong-target';

type MarkupLine = {
  id: string;
  text: string;
  depth: number;
};

type SelectorOption = {
  id: string;
  label: string;
  code: string;
  returnShape: string;
  matchIds: string[];
  status: MatchStatus;
  resultLabel: string;
  consequence: string;
};

type Mission = {
  id: string;
  label: string;
  detail: string;
  expected: string;
  recommendedOptionId: string;
  options: SelectorOption[];
};

type SelectorLabData = {
  title: string;
  description: string;
  documentLabel: string;
  defaults: {
    missionId: string;
  };
  markupLines: MarkupLine[];
  missions: Mission[];
};

const BLOCK_ID = 'technology/beautiful-soup-selector-lab';

const statusLabels: Record<MatchStatus, string> = {
  fit: 'Contract fit',
  underfetch: 'Too few results',
  overfetch: 'Too many results',
  fragile: 'Fragile match',
  'wrong-target': 'Wrong target',
};

function isSelectorLabData(value: unknown): value is SelectorLabData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SelectorLabData>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.documentLabel
      && candidate.defaults?.missionId
      && Array.isArray(candidate.markupLines)
      && candidate.markupLines.length > 0
      && candidate.markupLines.every((line) => (
        typeof line.id === 'string'
        && typeof line.text === 'string'
        && typeof line.depth === 'number'
        && line.depth >= 0
        && line.depth <= 3
      ))
      && Array.isArray(candidate.missions)
      && candidate.missions.length >= 2
      && candidate.missions.every((mission) => (
        typeof mission.id === 'string'
        && typeof mission.label === 'string'
        && typeof mission.detail === 'string'
        && typeof mission.expected === 'string'
        && typeof mission.recommendedOptionId === 'string'
        && Array.isArray(mission.options)
        && mission.options.length >= 2
        && mission.options.some((option) => option.id === mission.recommendedOptionId)
        && mission.options.every((option) => (
          typeof option.id === 'string'
          && typeof option.label === 'string'
          && typeof option.code === 'string'
          && typeof option.returnShape === 'string'
          && Array.isArray(option.matchIds)
          && option.matchIds.every((id) => typeof id === 'string')
          && option.status in statusLabels
          && typeof option.resultLabel === 'string'
          && typeof option.consequence === 'string'
        ))
      )),
  );
}

export default function BeautifulSoupSelectorLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<SelectorLabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No selector scenarios were supplied.');
      return;
    }

    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isSelectorLabData(payload)) throw new Error('The selector scenario data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the selector lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return (
      <LoadState
        error={error}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  return <SelectorWorkbench data={data} />;
}

function SelectorWorkbench({ data }: { data: SelectorLabData }) {
  const initialMission = data.missions.find((mission) => mission.id === data.defaults.missionId)
    ?? data.missions[0];
  const [missionId, setMissionId] = useState(initialMission.id);
  const [optionId, setOptionId] = useState(initialMission.recommendedOptionId);
  const mission = data.missions.find((item) => item.id === missionId) ?? data.missions[0];
  const option = mission.options.find((item) => item.id === optionId)
    ?? mission.options.find((item) => item.id === mission.recommendedOptionId)
    ?? mission.options[0];
  const isFit = option.status === 'fit';

  function selectMission(nextMission: Mission) {
    setMissionId(nextMission.id);
    setOptionId(nextMission.recommendedOptionId);
  }

  function reset() {
    setMissionId(initialMission.id);
    setOptionId(initialMission.recommendedOptionId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Selector contract lab"
          title={data.title}
          description={data.description}
          icon={FileSearch}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Extraction goal
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.missions.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === mission.id}
                      label={item.label}
                      detail={item.detail}
                      icon={ListChecks}
                      accent="cyan"
                      onClick={() => selectMission(item)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Candidate query
                </legend>
                <div className="mt-3 grid gap-2">
                  {mission.options.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === option.id}
                      label={item.label}
                      detail={item.code}
                      icon={Search}
                      accent={item.status === 'fit' ? 'emerald' : 'amber'}
                      onClick={() => setOptionId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Expected"
                value={mission.expected}
                detail="The extraction contract"
                icon={ListChecks}
                tone="blue"
              />
              <LabMetric
                label="Matched"
                value={option.resultLabel}
                detail={`${option.matchIds.length} highlighted tree node${option.matchIds.length === 1 ? '' : 's'}`}
                icon={Search}
                tone={isFit ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Return shape"
                value={option.returnShape}
                detail="Shape the calling code must handle"
                icon={Braces}
                tone="violet"
              />
              <LabMetric
                label="Verdict"
                value={statusLabels[option.status]}
                detail={isFit ? 'Matches scope and cardinality' : 'Revise before extraction'}
                icon={isFit ? CheckCircle2 : CircleAlert}
                tone={isFit ? 'emerald' : 'rose'}
              />
            </div>

            <section className="overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-2 border-b border-neutral-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    {data.documentLabel}
                  </p>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    Matching nodes change with the selected query.
                  </p>
                </div>
                <code className="max-w-full break-all rounded bg-neutral-900 px-3 py-2 text-xs text-cyan-200 dark:bg-black">
                  {option.code}
                </code>
              </div>
              <div className="space-y-1 p-3 font-mono text-xs sm:text-sm">
                {data.markupLines.map((line) => {
                  const matched = option.matchIds.includes(line.id);
                  const depthClass = ['pl-2', 'pl-5', 'pl-8', 'pl-11'][line.depth] ?? 'pl-2';

                  return (
                    <div
                      key={line.id}
                      className={`${depthClass} rounded px-2 py-1.5 break-all ${matched
                        ? 'border border-cyan-300 bg-cyan-50 font-semibold text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100'
                        : 'border border-transparent text-neutral-600 dark:text-neutral-400'}`}
                    >
                      {line.text}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className={`rounded-md border p-5 ${isFit
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
              : 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'}`}
            >
              <div className="flex items-start gap-3">
                {isFit
                  ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />}
                <div>
                  <h4 className="text-base font-semibold text-neutral-950 dark:text-white">
                    {statusLabels[option.status]}
                  </h4>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    {option.consequence}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Selector contract lab"
          title="Loading selector scenarios"
          description="The lab validates its sample markup and candidate queries before showing matches."
          icon={Code2}
          accent="cyan"
        />
        <LearningLabBody>
          <div className="flex min-h-36 flex-col items-center justify-center gap-3 text-center">
            {error
              ? <CircleAlert aria-hidden="true" className="h-7 w-7 text-rose-600 dark:text-rose-300" />
              : <LoaderCircle aria-hidden="true" className="h-7 w-7 animate-spin text-cyan-600 motion-reduce:animate-none dark:text-cyan-300" />}
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              {error ?? 'Loading selector data...'}
            </p>
            {error ? (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
              >
                Retry
              </button>
            ) : null}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
