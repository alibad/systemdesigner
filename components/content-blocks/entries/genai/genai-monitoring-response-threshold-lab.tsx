'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BadgeCheck,
  Ban,
  CheckCircle2,
  CircleAlert,
  CircleDollarSign,
  ClipboardCheck,
  LoaderCircle,
  SearchCheck,
  ShieldAlert,
  Timer,
} from 'lucide-react';

import {
  LabChoice,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

interface EvidenceLevel {
  id: string;
  label: string;
  detail: string;
  coveragePct: number;
  reproduced: boolean;
  releaseAttributed: boolean;
}

interface ResponseScenario {
  id: string;
  label: string;
  detail: string;
  qualityPct: number;
  costUsd: number;
  latencyMs: number;
  exposurePct: number;
  rollbackTarget: string | null;
  isolatedCostMitigation: string;
  userImpact: string;
}

interface ResponseThresholdData {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    evidenceId: string;
    minimumQualityPct: number;
    maximumCostUsd: number;
    maximumLatencyMs: number;
  };
  evidenceLevels: EvidenceLevel[];
  scenarios: ResponseScenario[];
}

type Tone = 'emerald' | 'amber' | 'rose';

const BLOCK_ID = 'genai/genai-monitoring-response-threshold-lab';

function isResponseThresholdData(value: unknown): value is ResponseThresholdData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ResponseThresholdData>;
  return Boolean(
    typeof candidate.title === 'string'
      && typeof candidate.description === 'string'
      && candidate.defaults
      && typeof candidate.defaults.scenarioId === 'string'
      && typeof candidate.defaults.evidenceId === 'string'
      && typeof candidate.defaults.minimumQualityPct === 'number'
      && typeof candidate.defaults.maximumCostUsd === 'number'
      && typeof candidate.defaults.maximumLatencyMs === 'number'
      && Array.isArray(candidate.evidenceLevels)
      && candidate.evidenceLevels.length > 0
      && candidate.evidenceLevels.every((level) => (
        typeof level.id === 'string'
        && typeof level.label === 'string'
        && typeof level.detail === 'string'
        && typeof level.coveragePct === 'number'
        && typeof level.reproduced === 'boolean'
        && typeof level.releaseAttributed === 'boolean'
      ))
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.detail === 'string'
        && typeof scenario.qualityPct === 'number'
        && typeof scenario.costUsd === 'number'
        && typeof scenario.latencyMs === 'number'
        && typeof scenario.exposurePct === 'number'
        && (typeof scenario.rollbackTarget === 'string' || scenario.rollbackTarget === null)
        && typeof scenario.isolatedCostMitigation === 'string'
        && typeof scenario.userImpact === 'string'
      )),
  );
}

export default function GenAiMonitoringResponseThresholdLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ResponseThresholdData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No response threshold data file was supplied.');
      return;
    }

    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isResponseThresholdData(payload)) {
          throw new Error('Response threshold data is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LabError detail={error} />;
  if (!data) return <LabLoading />;
  return <ResponseThresholdLab data={data} />;
}

function ResponseThresholdLab({ data }: { data: ResponseThresholdData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [evidenceId, setEvidenceId] = useState(data.defaults.evidenceId);
  const [minimumQualityPct, setMinimumQualityPct] = useState(data.defaults.minimumQualityPct);
  const [maximumCostCents, setMaximumCostCents] = useState(
    Math.round(data.defaults.maximumCostUsd * 1000),
  );
  const [maximumLatencyMs, setMaximumLatencyMs] = useState(data.defaults.maximumLatencyMs);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const evidence = data.evidenceLevels.find((item) => item.id === evidenceId)
    ?? data.evidenceLevels[0];
  const maximumCostUsd = maximumCostCents / 1000;

  const decision = useMemo(() => {
    const guardrails = [
      {
        id: 'quality',
        label: 'Quality floor',
        current: scenario.qualityPct,
        limit: minimumQualityPct,
        breached: scenario.qualityPct < minimumQualityPct,
        display: `${scenario.qualityPct.toFixed(1)}% / min ${minimumQualityPct}%`,
        ratio: scenario.qualityPct / 100,
        icon: BadgeCheck,
      },
      {
        id: 'cost',
        label: 'Cost per success',
        current: scenario.costUsd,
        limit: maximumCostUsd,
        breached: scenario.costUsd > maximumCostUsd,
        display: `$${scenario.costUsd.toFixed(3)} / max $${maximumCostUsd.toFixed(3)}`,
        ratio: Math.min(1, scenario.costUsd / Math.max(maximumCostUsd * 1.5, 0.001)),
        icon: CircleDollarSign,
      },
      {
        id: 'latency',
        label: 'P95 latency',
        current: scenario.latencyMs,
        limit: maximumLatencyMs,
        breached: scenario.latencyMs > maximumLatencyMs,
        display: `${scenario.latencyMs.toLocaleString()} ms / max ${maximumLatencyMs.toLocaleString()} ms`,
        ratio: Math.min(1, scenario.latencyMs / Math.max(maximumLatencyMs * 1.5, 1)),
        icon: Timer,
      },
    ];
    const breached = guardrails.filter((guardrail) => guardrail.breached);
    const evidenceReady = evidence.coveragePct >= 75
      && evidence.reproduced
      && evidence.releaseAttributed;
    const userVisibleBreach = breached.some((item) => item.id === 'quality' || item.id === 'latency');

    let action = 'Continue the bounded canary';
    let explanation = 'Every independent guardrail passes. Keep the exposure cap while evidence accumulates.';
    let tone: Tone = 'emerald';
    let responseSteps = [
      'Keep the current exposure cap.',
      'Continue slice-aware monitoring.',
      'Expand only after the next evidence checkpoint.',
    ];

    if (breached.length > 0 && !evidenceReady) {
      action = 'Cap exposure and escalate evaluation';
      explanation = 'A declared boundary is crossed, but evidence is not strong enough to attribute the cause safely.';
      tone = 'amber';
      responseSteps = [
        `Hold exposure at or below ${scenario.exposurePct}%.`,
        'Sample the affected slice and preserve representative traces.',
        'Replay the candidate against the known-good version before choosing rollback.',
      ];
    } else if (breached.length > 0 && userVisibleBreach && scenario.rollbackTarget) {
      action = `Roll back to ${scenario.rollbackTarget}`;
      explanation = 'A user-visible breach is reproduced, release-attributed, and has a known-good recovery target.';
      tone = 'rose';
      responseSteps = [
        'Stop candidate expansion and preserve the failing traces.',
        `Restore ${scenario.rollbackTarget}.`,
        'Verify recovery on the affected slice and add the failure to the regression suite.',
      ];
    } else if (breached.length > 0) {
      action = scenario.id === 'tool-timeouts'
        ? 'Isolate the dependency and degrade truthfully'
        : 'Mitigate the expensive route';
      explanation = 'The evidence supports a targeted control that preserves healthy behavior.';
      tone = 'amber';
      responseSteps = [
        scenario.isolatedCostMitigation,
        'Keep the breached route under a bounded exposure limit.',
        'Verify the guardrail returns inside its declared boundary.',
      ];
    }

    return { action, breached, evidenceReady, explanation, guardrails, responseSteps, tone };
  }, [evidence, maximumCostUsd, maximumLatencyMs, minimumQualityPct, scenario]);

  function reset() {
    setScenarioId(data.defaults.scenarioId);
    setEvidenceId(data.defaults.evidenceId);
    setMinimumQualityPct(data.defaults.minimumQualityPct);
    setMaximumCostCents(Math.round(data.defaults.maximumCostUsd * 1000));
    setMaximumLatencyMs(data.defaults.maximumLatencyMs);
  }

  const ResultIcon = decision.tone === 'emerald'
    ? CheckCircle2
    : decision.tone === 'amber'
      ? CircleAlert
      : Ban;

  const resultStyles: Record<Tone, string> = {
    emerald: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50',
    amber: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50',
    rose: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50',
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Guardrail response lab"
          title={data.title}
          description={data.description}
          icon={ShieldAlert}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Production condition
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'healthy-canary' ? CheckCircle2 : Activity}
                      accent={item.id === 'healthy-canary' ? 'emerald' : 'amber'}
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Available evidence
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.evidenceLevels.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === evidence.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'reproduced' ? SearchCheck : ClipboardCheck}
                      accent={item.id === 'reproduced' ? 'emerald' : 'blue'}
                      onClick={() => setEvidenceId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="space-y-6 border-t border-neutral-200 pt-6 dark:border-neutral-800">
                <LabRange
                  label="Minimum quality"
                  value={minimumQualityPct}
                  output={`${minimumQualityPct}%`}
                  min={70}
                  max={98}
                  step={1}
                  accent="violet"
                  lowLabel="Permissive"
                  highLabel="Strict"
                  onChange={setMinimumQualityPct}
                />
                <LabRange
                  label="Maximum cost per success"
                  value={maximumCostCents}
                  output={`$${maximumCostUsd.toFixed(3)}`}
                  min={30}
                  max={160}
                  step={5}
                  accent="cyan"
                  lowLabel="$0.030"
                  highLabel="$0.160"
                  onChange={setMaximumCostCents}
                />
                <LabRange
                  label="Maximum P95 latency"
                  value={maximumLatencyMs}
                  output={`${maximumLatencyMs.toLocaleString()} ms`}
                  min={1500}
                  max={10000}
                  step={250}
                  accent="amber"
                  lowLabel="1.5 s"
                  highLabel="10 s"
                  onChange={setMaximumLatencyMs}
                />
              </div>
            </div>
          )}
        >
          <div aria-live="polite" className="space-y-6">
            <section className={`rounded-md border p-5 ${resultStyles[decision.tone]}`}>
              <div className="flex items-start gap-3">
                <ResultIcon aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-70">Recommended response</p>
                  <h4 className="mt-1 text-xl font-semibold">{decision.action}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">{decision.explanation}</p>
                </div>
              </div>
            </section>

            <section>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Independent production guardrails
                  </p>
                  <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                    {decision.breached.length === 0
                      ? 'Every boundary passes'
                      : `${decision.breached.length} ${decision.breached.length === 1 ? 'boundary is' : 'boundaries are'} breached`}
                  </h4>
                </div>
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                  {scenario.exposurePct}% production exposure
                </span>
              </div>

              <div className="mt-5 space-y-4">
                {decision.guardrails.map((guardrail) => {
                  const Icon = guardrail.icon;
                  return (
                    <div key={guardrail.id} className="grid gap-2 rounded-md border border-neutral-200 p-4 sm:grid-cols-[170px_minmax(0,1fr)_auto] sm:items-center dark:border-neutral-800">
                      <div className="flex items-center gap-2">
                        <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-neutral-500 dark:text-neutral-400" />
                        <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                          {guardrail.label}
                        </span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800">
                        <div
                          className={`h-full rounded-sm ${
                            guardrail.breached
                              ? 'bg-rose-500 dark:bg-rose-400'
                              : 'bg-emerald-500 dark:bg-emerald-400'
                          }`}
                          style={{ width: `${Math.max(5, Math.min(100, guardrail.ratio * 100))}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-2 text-xs font-semibold tabular-nums text-neutral-600 sm:justify-end dark:text-neutral-300">
                        {guardrail.breached ? (
                          <CircleAlert aria-hidden="true" className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                        ) : (
                          <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        )}
                        <span>{guardrail.display}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Evidence readiness
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <EvidenceState
                  label="Slice coverage"
                  value={`${evidence.coveragePct}%`}
                  ready={evidence.coveragePct >= 75}
                />
                <EvidenceState
                  label="Reproduced"
                  value={evidence.reproduced ? 'Yes' : 'Not yet'}
                  ready={evidence.reproduced}
                />
                <EvidenceState
                  label="Release attribution"
                  value={evidence.releaseAttributed ? 'Confirmed' : 'Unknown'}
                  ready={evidence.releaseAttributed}
                />
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.75fr)]">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Response sequence
                </p>
                <ol className="mt-3 space-y-3">
                  {decision.responseSteps.map((step, index) => (
                    <li key={step} className="flex items-start gap-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="rounded-md border-l-4 border-blue-500 bg-blue-50 p-4 text-blue-950 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-50">
                <p className="text-xs font-semibold uppercase opacity-70">User consequence</p>
                <p className="mt-2 text-sm leading-6">{scenario.userImpact}</p>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function EvidenceState({ label, value, ready }: { label: string; value: string; ready: boolean }) {
  return (
    <div className="flex items-start gap-2">
      {ready ? (
        <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      )}
      <div>
        <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{label}</p>
        <p className="mt-0.5 text-sm font-semibold text-neutral-900 dark:text-neutral-100">{value}</p>
      </div>
    </div>
  );
}

function LabLoading() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
        Loading response threshold lab...
      </div>
    </div>
  );
}

function LabError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-rose-300 bg-rose-50 p-6 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50">
      <div className="flex items-start gap-3">
        <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Response threshold lab unavailable</p>
          <p className="mt-1 text-sm opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
