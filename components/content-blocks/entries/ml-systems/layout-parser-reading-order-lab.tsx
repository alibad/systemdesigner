'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  BookOpenCheck,
  CheckCircle2,
  Columns3,
  ListOrdered,
  LoaderCircle,
  Route,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/layout-parser/data/reading-order-scenarios.json';
const BLOCK_ID = 'ml-systems/layout-parser-reading-order-lab';

type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Region = {
  id: string;
  label: string;
  text: string;
  kind: string;
  box: Box;
};

type Strategy = {
  id: string;
  label: string;
  detail: string;
};

type Scenario = {
  id: string;
  label: string;
  detail: string;
  regions: Region[];
  expectedOrder: string[];
  orders: Record<string, string[]>;
};

type ReadingOrderData = {
  title: string;
  description: string;
  defaultScenarioId: string;
  defaultStrategyId: string;
  strategies: Strategy[];
  scenarios: Scenario[];
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBox(value: unknown): value is Box {
  if (!value || typeof value !== 'object') return false;
  const box = value as Partial<Box>;
  return (
    isFiniteNumber(box.x)
    && isFiniteNumber(box.y)
    && isFiniteNumber(box.width)
    && isFiniteNumber(box.height)
  );
}

function isReadingOrderData(value: unknown): value is ReadingOrderData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<ReadingOrderData>;
  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && typeof data.defaultScenarioId === 'string'
      && typeof data.defaultStrategyId === 'string'
      && Array.isArray(data.strategies)
      && data.strategies.length > 0
      && data.strategies.every((strategy) => (
        typeof strategy.id === 'string'
        && typeof strategy.label === 'string'
        && typeof strategy.detail === 'string'
      ))
      && Array.isArray(data.scenarios)
      && data.scenarios.length > 0
      && data.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.detail === 'string'
        && Array.isArray(scenario.expectedOrder)
        && scenario.expectedOrder.every((id) => typeof id === 'string')
        && scenario.orders
        && typeof scenario.orders === 'object'
        && Object.values(scenario.orders).every(
          (order) => Array.isArray(order) && order.every((id) => typeof id === 'string'),
        )
        && Array.isArray(scenario.regions)
        && scenario.regions.every((region) => (
          typeof region.id === 'string'
          && typeof region.label === 'string'
          && typeof region.text === 'string'
          && typeof region.kind === 'string'
          && isBox(region.box)
        ))
      )),
  );
}

const regionTone: Record<string, string> = {
  title:
    'border-blue-500 bg-blue-50 text-blue-950 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-50',
  text:
    'border-cyan-500 bg-cyan-50 text-cyan-950 dark:border-cyan-400 dark:bg-cyan-950 dark:text-cyan-50',
  figure:
    'border-violet-500 bg-violet-50 text-violet-950 dark:border-violet-400 dark:bg-violet-950 dark:text-violet-50',
  caption:
    'border-amber-500 bg-amber-50 text-amber-950 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-50',
  footer:
    'border-neutral-400 bg-neutral-100 text-neutral-950 dark:border-neutral-500 dark:bg-neutral-900 dark:text-neutral-50',
  sidebar:
    'border-emerald-500 bg-emerald-50 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-50',
};

function LoadingState({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
            <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
            {detail}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

export default function LayoutParserReadingOrderLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ReadingOrderData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState('');
  const [strategyId, setStrategyId] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Reading-order request failed (${response.status}).`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isReadingOrderData(payload)) {
          throw new Error('Reading-order fixture data is incomplete.');
        }
        setData(payload);
        setScenarioId(payload.defaultScenarioId);
        setStrategyId(payload.defaultStrategyId);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load reading-order fixtures.');
      });

    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    if (!data) return null;
    const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
    const order = scenario.orders[strategyId] ?? scenario.orders[data.defaultStrategyId];
    const regionsById = new Map(scenario.regions.map((region) => [region.id, region]));
    const displaced = order.filter(
      (regionId, index) => scenario.expectedOrder[index] !== regionId,
    ).length;
    const numberedRegions = new Map(order.map((regionId, index) => [regionId, index + 1]));
    const sequence = order
      .map((regionId) => regionsById.get(regionId))
      .filter((region): region is Region => Boolean(region));

    return {
      scenario,
      sequence,
      displaced,
      numberedRegions,
      matchesExpected: displaced === 0 && order.length === scenario.expectedOrder.length,
    };
  }, [data, scenarioId, strategyId]);

  if (error) return <LoadingState detail={error} />;
  if (!data || !result) return <LoadingState detail="Loading reading-order fixtures..." />;

  const reset = () => {
    setScenarioId(data.defaultScenarioId);
    setStrategyId(data.defaultStrategyId);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Reading-order lab"
          title={data.title}
          description={data.description}
          icon={Route}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Page structure
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((scenario) => (
                    <LabChoice
                      key={scenario.id}
                      selected={scenario.id === result.scenario.id}
                      label={scenario.label}
                      detail={scenario.detail}
                      icon={Columns3}
                      accent="violet"
                      onClick={() => setScenarioId(scenario.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Ordering strategy
                </legend>
                <div className="mt-3 space-y-2">
                  {data.strategies.map((strategy) => (
                    <LabChoice
                      key={strategy.id}
                      selected={strategy.id === strategyId}
                      label={strategy.label}
                      detail={strategy.detail}
                      icon={ListOrdered}
                      accent="cyan"
                      onClick={() => setStrategyId(strategy.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <LabMetric
              label="Regions"
              value={String(result.scenario.regions.length)}
              detail="Typed blocks in the fixture"
              icon={BookOpenCheck}
              tone="cyan"
            />
            <LabMetric
              label="Displaced positions"
              value={String(result.displaced)}
              detail="Compared with the labeled order"
              icon={ListOrdered}
              tone={result.matchesExpected ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Sequence gate"
              value={result.matchesExpected ? 'Pass' : 'Fail'}
              detail="Exact order for this fixture"
              icon={result.matchesExpected ? CheckCircle2 : TriangleAlert}
              tone={result.matchesExpected ? 'emerald' : 'amber'}
            />
          </div>

          <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.1fr)]">
            <div>
              <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-md border border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900">
                {result.scenario.regions.map((region) => {
                  const tone = regionTone[region.kind] ?? regionTone.text;
                  const number = result.numberedRegions.get(region.id);
                  return (
                    <div
                      key={region.id}
                      className={`absolute overflow-hidden border-2 p-1.5 ${tone}`}
                      style={{
                        left: `${region.box.x}%`,
                        top: `${region.box.y}%`,
                        width: `${region.box.width}%`,
                        height: `${region.box.height}%`,
                      }}
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-950 text-xs font-bold text-white dark:bg-white dark:text-neutral-950">
                        {number}
                      </span>
                      <span className="mt-1 hidden text-[10px] font-semibold leading-tight sm:block">
                        {region.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Numbers show the emitted sequence; colors identify region roles rather than correctness.
              </p>
            </div>

            <div className="min-w-0">
              <div
                className={`rounded-md border p-4 ${
                  result.matchesExpected
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
                    : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'
                }`}
                aria-live="polite"
              >
                <div className="flex items-start gap-3">
                  {result.matchesExpected ? (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  ) : (
                    <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  )}
                  <div>
                    <p className="font-semibold">
                      {result.matchesExpected
                        ? 'Reading order matches the labeled contract'
                        : 'Reading order changes the document meaning'}
                    </p>
                    <p className="mt-1 text-sm leading-6 opacity-80">
                      {result.matchesExpected
                        ? 'The sequence keeps each column and its dependent regions together.'
                        : `${result.displaced} positions differ; OCR text would be flattened in the wrong sequence.`}
                    </p>
                  </div>
                </div>
              </div>

              <ol className="mt-4 space-y-2">
                {result.sequence.map((region, index) => (
                  <li
                    key={region.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950"
                  >
                    <div className="flex flex-col items-center">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
                        {index + 1}
                      </span>
                      {index < result.sequence.length - 1 ? (
                        <ArrowDown aria-hidden="true" className="mt-2 h-4 w-4 text-neutral-400" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                        {region.label}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                        {region.text}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
