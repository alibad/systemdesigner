'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileOutput,
  RefreshCw,
  Route,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type RedirectScenario = {
  id: string;
  label: string;
  detail: string;
  requestMethod: string;
  recommendedStatusId: string;
  destinationMutable: boolean;
};

type RedirectStatus = {
  id: string;
  label: string;
  detail: string;
  temporary: boolean;
  preservesMethod: boolean;
  clientCacheControl: string;
};

type AnalyticsMode = {
  id: string;
  label: string;
  detail: string;
  addedP99Ms: number;
  blocksOnFailure: boolean;
};

type ContractModel = {
  defaults: {
    scenarioId: string;
    statusId: string;
    analyticsId: string;
  };
  scenarios: RedirectScenario[];
  statuses: RedirectStatus[];
  analyticsModes: AnalyticsMode[];
};

const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/url-shortener-read-path/data/redirect-contract-model.json';

function isContractModel(value: unknown): value is ContractModel {
  if (!value || typeof value !== 'object') return false;
  const model = value as Partial<ContractModel>;
  return (
    !!model.defaults
    && typeof model.defaults.scenarioId === 'string'
    && typeof model.defaults.statusId === 'string'
    && typeof model.defaults.analyticsId === 'string'
    && Array.isArray(model.scenarios)
    && model.scenarios.length > 0
    && Array.isArray(model.statuses)
    && model.statuses.length > 0
    && Array.isArray(model.analyticsModes)
    && model.analyticsModes.length > 0
  );
}

function LoadingState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-[360px] items-center justify-center p-6">
      {error ? (
        <div className="max-w-md text-center">
          <TriangleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
          <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
            The redirect contract could not be loaded
          </p>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
            {error}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-500"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Try again
          </button>
        </div>
      ) : (
        <div className="text-center" role="status">
          <Activity
            aria-hidden="true"
            className="mx-auto h-7 w-7 animate-pulse text-violet-500 motion-reduce:animate-none"
          />
          <p className="mt-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">
            Loading redirect semantics...
          </p>
        </div>
      )}
    </div>
  );
}

export default function UrlShortenerReadPathContractLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<ContractModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isContractModel(payload)) {
          throw new Error('The redirect contract model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(
          loadError instanceof Error ? loadError.message : 'Unable to load redirect semantics.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <div data-content-block="fundamentals/url-shortener-read-path-contract-lab">
        <LearningLab>
          <LearningLabHeader
            eyebrow="Redirect contract lab"
            title="Choose what the client may remember and what must stay off path"
            description="Match the link lifecycle to an HTTP status, then place analytics. The visible result combines mutability, method behavior, latency, and failure coupling."
            icon={FileOutput}
            accent="violet"
          />
          <LoadingState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      </div>
    );
  }

  return <ContractWorkbench model={model} />;
}

function ContractWorkbench({ model }: { model: ContractModel }) {
  const [scenarioId, setScenarioId] = useState(model.defaults.scenarioId);
  const [statusId, setStatusId] = useState(model.defaults.statusId);
  const [analyticsId, setAnalyticsId] = useState(model.defaults.analyticsId);

  const scenario =
    model.scenarios.find((item) => item.id === scenarioId) ?? model.scenarios[0];
  const status = model.statuses.find((item) => item.id === statusId) ?? model.statuses[0];
  const analytics =
    model.analyticsModes.find((item) => item.id === analyticsId) ?? model.analyticsModes[0];

  const result = useMemo(() => {
    const lifecycleSafe =
      scenario.recommendedStatusId === status.id
      || (!scenario.destinationMutable && !status.temporary)
      || (scenario.destinationMutable && status.temporary);
    const methodSafe = scenario.requestMethod === 'GET' || status.preservesMethod;
    const analyticsSafe = !analytics.blocksOnFailure;
    const checks = [lifecycleSafe, methodSafe, analyticsSafe];
    const passed = checks.filter(Boolean).length;

    const recommendation = !lifecycleSafe
      ? `${scenario.label} should use ${model.statuses.find((item) => item.id === scenario.recommendedStatusId)?.label ?? scenario.recommendedStatusId}.`
      : !methodSafe
        ? `${scenario.requestMethod} must keep its method and body, so use a method-preserving status.`
        : !analyticsSafe
          ? 'Move click aggregation behind an asynchronous event so its failure cannot block the redirect.'
          : 'The selected contract matches the link lifecycle and keeps analytics off the critical path.';

    return {
      lifecycleSafe,
      methodSafe,
      analyticsSafe,
      passed,
      recommendation,
      p99Ms: 18 + analytics.addedP99Ms,
    };
  }, [analytics, model.statuses, scenario, status]);

  function chooseScenario(nextScenario: RedirectScenario) {
    setScenarioId(nextScenario.id);
    setStatusId(nextScenario.recommendedStatusId);
  }

  function reset() {
    setScenarioId(model.defaults.scenarioId);
    setStatusId(model.defaults.statusId);
    setAnalyticsId(model.defaults.analyticsId);
  }

  return (
    <div data-content-block="fundamentals/url-shortener-read-path-contract-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Redirect contract lab"
          title="Choose what the client may remember and what must stay off path"
          description="Match the link lifecycle to an HTTP status, then place analytics. The visible result combines mutability, method behavior, latency, and failure coupling."
          icon={FileOutput}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Link lifecycle
                </legend>
                <div className="mt-3 space-y-2">
                  {model.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={scenario.id === item.id}
                      label={item.label}
                      detail={`${item.requestMethod}: ${item.detail}`}
                      icon={Route}
                      accent="violet"
                      onClick={() => chooseScenario(item)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. HTTP response
                </legend>
                <div className="mt-3 space-y-2">
                  {model.statuses.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={status.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={FileOutput}
                      accent="blue"
                      onClick={() => setStatusId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Click analytics
                </legend>
                <div className="mt-3 space-y-2">
                  {model.analyticsModes.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={analytics.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Activity}
                      accent="emerald"
                      onClick={() => setAnalyticsId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          }
        >
          <div aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Contract checks"
                value={`${result.passed} / 3`}
                detail="Lifecycle, method behavior, and failure isolation."
                icon={CheckCircle2}
                tone={result.passed === 3 ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Modelled redirect p99"
                value={`${result.p99Ms} ms`}
                detail={`${analytics.addedP99Ms} ms attributed to analytics placement.`}
                icon={Clock}
                tone={result.p99Ms <= 25 ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Analytics failure"
                value={analytics.blocksOnFailure ? 'Blocks redirect' : 'Redirect survives'}
                detail="Whether a counter outage changes the user result."
                icon={ShieldAlert}
                tone={analytics.blocksOnFailure ? 'rose' : 'emerald'}
              />
            </div>

            <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Client-visible trace
              </p>
              <div className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] md:items-stretch">
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
                  <p className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-300">
                    Request
                  </p>
                  <p className="mt-1 text-sm font-semibold text-blue-950 dark:text-blue-50">
                    {scenario.requestMethod} /short-code
                  </p>
                </div>
                <ArrowRight
                  aria-hidden="true"
                  className="mx-auto h-4 w-4 rotate-90 self-center text-neutral-400 md:rotate-0"
                />
                <div className="rounded-md border border-violet-200 bg-violet-50 p-3 dark:border-violet-900 dark:bg-violet-950/30">
                  <p className="text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">
                    Service
                  </p>
                  <p className="mt-1 text-sm font-semibold text-violet-950 dark:text-violet-50">
                    {status.label}
                  </p>
                </div>
                <ArrowRight
                  aria-hidden="true"
                  className="mx-auto h-4 w-4 rotate-90 self-center text-neutral-400 md:rotate-0"
                />
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <p className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-300">
                    Client behavior
                  </p>
                  <p className="mt-1 text-sm font-semibold text-emerald-950 dark:text-emerald-50">
                    {status.clientCacheControl}
                  </p>
                </div>
              </div>
            </section>

            <section
              className={`mt-5 rounded-md border p-4 ${
                result.passed === 3
                  ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                  : 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.passed === 3 ? (
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300"
                  />
                ) : (
                  <TriangleAlert
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300"
                  />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-neutral-950 dark:text-white">
                    {result.passed === 3 ? 'Contract aligned' : 'Contract needs revision'}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    {result.recommendation}
                  </p>
                </div>
              </div>
            </section>

            <ul className="mt-5 divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
              {[
                {
                  label: 'Destination change control',
                  pass: result.lifecycleSafe,
                  detail: status.temporary
                    ? 'The response remains temporary.'
                    : 'The client may retain a permanent destination.',
                },
                {
                  label: `${scenario.requestMethod} method behavior`,
                  pass: result.methodSafe,
                  detail: status.preservesMethod
                    ? 'The method and body are explicitly preserved.'
                    : 'This status does not promise method preservation.',
                },
                {
                  label: 'Analytics isolation',
                  pass: result.analyticsSafe,
                  detail: analytics.blocksOnFailure
                    ? 'Counter storage is part of the redirect failure domain.'
                    : 'Aggregation can recover independently after the redirect.',
                },
              ].map((check) => (
                <li key={check.label} className="flex items-start gap-3 px-4 py-3">
                  {check.pass ? (
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300"
                    />
                  ) : (
                    <TriangleAlert
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                      {check.label}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                      {check.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
