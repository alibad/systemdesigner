'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Blocks,
  CheckCircle2,
  CircleAlert,
  CircleX,
  FileSearch,
  Link2,
  LoaderCircle,
  ScanSearch,
  Tags,
  TextSearch,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type BlockRole = 'article' | 'aside' | 'generic' | 'main' | 'nav';
type PolicyMode = 'semantic' | 'density' | 'hybrid';

type PageBlock = {
  id: string;
  label: string;
  role: BlockRole;
  textCharacters: number;
  linkCharacters: number;
  sentenceCount: number;
  repeatedAcrossPages: boolean;
  isMainContent: boolean;
  summary: string;
};

type ClassificationPolicy = {
  id: string;
  label: string;
  detail: string;
  mode: PolicyMode;
  minimumScore: number;
};

type PageScenario = {
  id: string;
  label: string;
  detail: string;
  target: string;
  blocks: PageBlock[];
};

type ClassificationModel = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    policyId: string;
  };
  policies: ClassificationPolicy[];
  scenarios: PageScenario[];
};

type ClassifiedBlock = PageBlock & {
  keep: boolean;
  linkDensity: number;
  score: number | null;
};

const BLOCK_ID = 'technology/boilerplate-detection-calculator';
const DEFAULT_DATA_FILE = '/api/content/technology/boilerplate-detection/data/block-classification-scenarios.json';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isClassificationModel(value: unknown): value is ClassificationModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ClassificationModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.scenarioId
      && candidate.defaults.policyId
      && Array.isArray(candidate.policies)
      && candidate.policies.length >= 3
      && candidate.policies.every((policy) => (
        typeof policy.id === 'string'
        && typeof policy.label === 'string'
        && typeof policy.detail === 'string'
        && ['semantic', 'density', 'hybrid'].includes(policy.mode)
        && isFiniteNumber(policy.minimumScore)
      ))
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length >= 3
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.target === 'string'
        && Array.isArray(scenario.blocks)
        && scenario.blocks.length >= 4
        && scenario.blocks.every((block) => (
          typeof block.id === 'string'
          && ['article', 'aside', 'generic', 'main', 'nav'].includes(block.role)
          && isFiniteNumber(block.textCharacters)
          && isFiniteNumber(block.linkCharacters)
          && isFiniteNumber(block.sentenceCount)
          && typeof block.repeatedAcrossPages === 'boolean'
          && typeof block.isMainContent === 'boolean'
        ))
      )),
  );
}

function scoreBlock(block: PageBlock) {
  const linkDensity = block.linkCharacters / Math.max(1, block.textCharacters);
  let score = block.textCharacters >= 300 ? 35 : block.textCharacters >= 120 ? 20 : 0;
  score += Math.min(20, block.sentenceCount * 4);
  score += block.role === 'article' || block.role === 'main' ? 25 : 0;
  score -= block.repeatedAcrossPages ? 25 : 0;
  score -= Math.round(linkDensity * 40);
  return Math.max(0, Math.min(100, score));
}

function classifyBlock(block: PageBlock, policy: ClassificationPolicy): ClassifiedBlock {
  const linkDensity = block.linkCharacters / Math.max(1, block.textCharacters);
  const score = policy.mode === 'hybrid' ? scoreBlock(block) : null;
  let keep = false;

  if (policy.mode === 'semantic') {
    keep = block.role === 'article' || block.role === 'main';
  } else if (policy.mode === 'density') {
    keep = block.textCharacters >= 180 && block.sentenceCount >= 2 && linkDensity <= 0.35;
  } else {
    keep = (score ?? 0) >= policy.minimumScore;
  }

  return { ...block, keep, linkDensity, score };
}

export default function BoilerplateDetectionCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ClassificationModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isClassificationModel(payload)) throw new Error('The block-classification model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the classification model.');
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

  return <ClassificationWorkbench data={data} />;
}

function ClassificationWorkbench({ data }: { data: ClassificationModel }) {
  const initialScenario = data.scenarios.find((item) => item.id === data.defaults.scenarioId)
    ?? data.scenarios[0];
  const initialPolicy = data.policies.find((item) => item.id === data.defaults.policyId)
    ?? data.policies[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [policyId, setPolicyId] = useState(initialPolicy.id);
  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];

  const result = useMemo(() => {
    const blocks = scenario.blocks.map((block) => classifyBlock(block, policy));
    const truePositive = blocks.filter((block) => block.keep && block.isMainContent).length;
    const falsePositive = blocks.filter((block) => block.keep && !block.isMainContent).length;
    const falseNegative = blocks.filter((block) => !block.keep && block.isMainContent).length;
    const correct = blocks.length - falsePositive - falseNegative;
    return { blocks, correct, falseNegative, falsePositive, truePositive };
  }, [policy, scenario]);

  function reset() {
    setScenarioId(initialScenario.id);
    setPolicyId(initialPolicy.id);
  }

  const hasErrors = result.falsePositive > 0 || result.falseNegative > 0;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Block classification lab"
          title={data.title}
          description={data.description}
          icon={ScanSearch}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Page shape
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={FileSearch}
                      accent="blue"
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Evidence policy
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.policies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === policy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.mode === 'semantic' ? Tags : item.mode === 'density' ? TextSearch : Blocks}
                      accent={item.mode === 'semantic' ? 'violet' : item.mode === 'density' ? 'emerald' : 'cyan'}
                      onClick={() => setPolicyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="space-y-6" aria-live="polite">
            <section className="rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
              <p className="text-xs font-semibold uppercase opacity-70">Editorial target</p>
              <p className="mt-2 text-sm leading-6">{scenario.target}</p>
            </section>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Blocks kept"
                value={`${result.blocks.filter((block) => block.keep).length}/${result.blocks.length}`}
                detail={`${result.truePositive} target block${result.truePositive === 1 ? '' : 's'} retained`}
                icon={Blocks}
                tone="blue"
              />
              <LabMetric
                label="Correct decisions"
                value={`${result.correct}/${result.blocks.length}`}
                detail="Compared with the labeled editorial target"
                icon={CheckCircle2}
                tone={hasErrors ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Noise included"
                value={`${result.falsePositive}`}
                detail="Boilerplate blocks incorrectly kept"
                icon={CircleAlert}
                tone={result.falsePositive ? 'rose' : 'emerald'}
              />
              <LabMetric
                label="Content missed"
                value={`${result.falseNegative}`}
                detail="Target blocks incorrectly discarded"
                icon={CircleX}
                tone={result.falseNegative ? 'rose' : 'emerald'}
              />
            </div>

            <section>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Page block trace</p>
                  <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">What the policy keeps</h4>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Ground truth is shown independently of the verdict.</p>
              </div>
              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                {result.blocks.map((block) => (
                  <BlockVerdict key={block.id} block={block} />
                ))}
              </div>
            </section>

            <section className={`rounded-md border p-5 ${
              hasErrors
                ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
                : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
            }`}>
              <div className="flex items-start gap-3">
                {hasErrors
                  ? <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  : <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <h4 className="font-semibold">
                    {hasErrors ? 'This policy needs a fallback or a page-specific route' : 'This fixture matches the selected policy'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-85">
                    {hasErrors
                      ? 'Inspect the exact false inclusions and omissions before adding another feature. Aggregate accuracy alone cannot explain why the extraction failed.'
                      : 'A correct fixture is evidence for this page shape, not a universal guarantee. Keep testing other templates and future page versions.'}
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

function BlockVerdict({ block }: { block: ClassifiedBlock }) {
  const correct = block.keep === block.isMainContent;
  return (
    <article className={`min-w-0 rounded-md border p-4 ${
      correct
        ? 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'
        : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/25'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h5 className="font-semibold text-neutral-950 dark:text-white">{block.label}</h5>
            <span className="rounded bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              {block.role}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{block.summary}</p>
        </div>
        <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${
          block.keep
            ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'
            : 'border-neutral-300 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'
        }`}>
          {block.keep ? 'Kept' : 'Discarded'}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-neutral-200 pt-3 text-xs dark:border-neutral-800 sm:grid-cols-4">
        <div>
          <dt className="text-neutral-500 dark:text-neutral-400">Characters</dt>
          <dd className="mt-1 font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{block.textCharacters}</dd>
        </div>
        <div>
          <dt className="text-neutral-500 dark:text-neutral-400">Link density</dt>
          <dd className="mt-1 flex items-center gap-1 font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
            <Link2 aria-hidden="true" className="h-3 w-3" />
            {Math.round(block.linkDensity * 100)}%
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500 dark:text-neutral-400">Sentences</dt>
          <dd className="mt-1 font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{block.sentenceCount}</dd>
        </div>
        <div>
          <dt className="text-neutral-500 dark:text-neutral-400">Target</dt>
          <dd className="mt-1 font-semibold text-neutral-900 dark:text-neutral-100">{block.isMainContent ? 'Content' : 'Boilerplate'}</dd>
        </div>
      </dl>
      {block.score !== null ? (
        <div className="mt-3 h-2 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800" aria-label={`Hybrid content score ${block.score} out of 100`}>
          <div className="h-full bg-cyan-500 transition-[width] motion-reduce:transition-none" style={{ width: `${block.score}%` }} />
        </div>
      ) : null}
    </article>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Block classification lab"
          title={error ? 'Classification lab unavailable' : 'Loading classification lab'}
          description="The lab compares visible page-block evidence with an editorial target."
          icon={ScanSearch}
          accent="cyan"
        />
        <LearningLabBody>
          <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
            {error
              ? <CircleAlert aria-hidden="true" className="h-7 w-7 text-rose-600 dark:text-rose-300" />
              : <LoaderCircle aria-hidden="true" className="h-7 w-7 animate-spin text-cyan-600 motion-reduce:animate-none dark:text-cyan-300" />}
            <p className="text-sm text-neutral-600 dark:text-neutral-300">{error ?? 'Loading page-block fixtures...'}</p>
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
