'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  CircleX,
  Clock3,
  Eye,
  EyeOff,
  Gauge,
  Languages,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  TextCursor,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type SuggestionScenario = {
  id: string;
  label: string;
  draft: string;
  candidate: string;
  confidence: number;
  ageMs: number;
  prefixMatches: boolean;
  policySafe: boolean;
  languageMatches: boolean;
  explanation: string;
};

type ReleasePolicy = {
  id: string;
  label: string;
  detail: string;
  maximumAgeMs: number;
  checkPrefix: boolean;
  checkSafety: boolean;
  checkLanguage: boolean;
};

type SuggestionReleaseData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    policyId: string;
    confidenceFloor: number;
  };
  scenarios: SuggestionScenario[];
  policies: ReleasePolicy[];
};

type Gate = {
  id: string;
  label: string;
  detail: string;
  status: 'pass' | 'fail' | 'unchecked';
  icon: typeof Gauge;
};

const BLOCK_ID = 'genai/gmail-smart-compose-architecture-suggestion-release-lab';

function isSuggestionReleaseData(value: unknown): value is SuggestionReleaseData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SuggestionReleaseData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.scenarioId
      && candidate.defaults.policyId
      && typeof candidate.defaults.confidenceFloor === 'number'
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0
      && Array.isArray(candidate.policies)
      && candidate.policies.length > 0,
  );
}

export default function GmailSmartComposeArchitectureSuggestionReleaseLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<SuggestionReleaseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No suggestion-release data was supplied.');
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
        if (!isSuggestionReleaseData(payload)) {
          throw new Error('Suggestion-release data is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load release data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {error ? (
        <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
      ) : data ? (
        <SuggestionReleaseLab data={data} />
      ) : (
        <LoadState error={null} onRetry={() => setReloadKey((key) => key + 1)} />
      )}
    </div>
  );
}

function SuggestionReleaseLab({ data }: { data: SuggestionReleaseData }) {
  const initialScenario = data.scenarios.find((item) => item.id === data.defaults.scenarioId)
    ?? data.scenarios[0];
  const initialPolicy = data.policies.find((item) => item.id === data.defaults.policyId)
    ?? data.policies[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [policyId, setPolicyId] = useState(initialPolicy.id);
  const [confidenceFloor, setConfidenceFloor] = useState(data.defaults.confidenceFloor);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];

  const result = useMemo(() => {
    const confidencePasses = scenario.confidence >= confidenceFloor;
    const freshnessPasses = scenario.ageMs <= policy.maximumAgeMs;
    const gates: Gate[] = [
      {
        id: 'confidence',
        label: 'Confidence',
        detail: `${scenario.confidence}% candidate vs ${confidenceFloor}% floor`,
        status: confidencePasses ? 'pass' : 'fail',
        icon: Gauge,
      },
      {
        id: 'freshness',
        label: 'Freshness',
        detail: `${scenario.ageMs} ms old vs ${policy.maximumAgeMs} ms maximum`,
        status: freshnessPasses ? 'pass' : 'fail',
        icon: Clock3,
      },
      {
        id: 'prefix',
        label: 'Active prefix',
        detail: policy.checkPrefix
          ? scenario.prefixMatches ? 'Response still belongs to this draft' : 'Draft changed in flight'
          : scenario.prefixMatches ? 'Not checked; this sample still matches' : 'Mismatch ignored by policy',
        status: policy.checkPrefix ? scenario.prefixMatches ? 'pass' : 'fail' : 'unchecked',
        icon: TextCursor,
      },
      {
        id: 'safety',
        label: 'Content policy',
        detail: policy.checkSafety
          ? scenario.policySafe ? 'Candidate is within release policy' : 'Restricted content detected'
          : scenario.policySafe ? 'Not checked; this sample is benign' : 'Policy risk ignored',
        status: policy.checkSafety ? scenario.policySafe ? 'pass' : 'fail' : 'unchecked',
        icon: ShieldCheck,
      },
      {
        id: 'language',
        label: 'Cursor language',
        detail: policy.checkLanguage
          ? scenario.languageMatches ? 'Continuation follows the active language' : 'Continuation switched language'
          : scenario.languageMatches ? 'Not checked; language still matches' : 'Language mismatch ignored',
        status: policy.checkLanguage ? scenario.languageMatches ? 'pass' : 'fail' : 'unchecked',
        icon: Languages,
      },
    ];
    const checkedFailures = gates.filter((gate) => gate.status === 'fail').length;
    const uncheckedRisks = [
      !policy.checkPrefix && !scenario.prefixMatches,
      !policy.checkSafety && !scenario.policySafe,
      !policy.checkLanguage && !scenario.languageMatches,
    ].filter(Boolean).length;
    const renders = checkedFailures === 0;
    const outcome = !renders ? 'Suppress' : uncheckedRisks > 0 ? 'Render at risk' : 'Render';

    return { checkedFailures, gates, outcome, renders, uncheckedRisks };
  }, [confidenceFloor, policy, scenario]);

  function reset() {
    setScenarioId(initialScenario.id);
    setPolicyId(initialPolicy.id);
    setConfidenceFloor(data.defaults.confidenceFloor);
  }

  const outcomeTone = !result.renders ? 'rose' : result.uncheckedRisks > 0 ? 'amber' : 'emerald';

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Candidate release lab"
        title={data.title}
        description={data.description}
        icon={Sparkles}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Inspect a candidate
              </legend>
              <div className="mt-3 space-y-2">
                {data.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={`${item.confidence}% confidence, ${item.ageMs} ms old`}
                    icon={MessageSquareText}
                    accent="blue"
                    onClick={() => setScenarioId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Apply a release policy
              </legend>
              <div className="mt-3 space-y-2">
                {data.policies.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === policy.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'production' ? ShieldCheck : CircleAlert}
                    accent={item.id === 'production' ? 'emerald' : 'amber'}
                    onClick={() => setPolicyId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Confidence floor"
              value={confidenceFloor}
              output={`${confidenceFloor}%`}
              min={50}
              max={95}
              step={1}
              accent="violet"
              lowLabel="More coverage"
              highLabel="Fewer interruptions"
              onChange={setConfidenceFloor}
            />
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-3" aria-live="polite">
          <LabMetric
            label="Release decision"
            value={result.outcome}
            detail={result.renders ? 'The client would draw ghost text.' : 'The editor remains unchanged.'}
            icon={result.renders ? Eye : EyeOff}
            tone={outcomeTone}
          />
          <LabMetric
            label="Failed gates"
            value={`${result.checkedFailures}`}
            detail="Checked release conditions that failed"
            icon={result.checkedFailures > 0 ? CircleX : CheckCircle2}
            tone={result.checkedFailures > 0 ? 'rose' : 'emerald'}
          />
          <LabMetric
            label="Unchecked risks"
            value={`${result.uncheckedRisks}`}
            detail="Real mismatches omitted by this policy"
            icon={result.uncheckedRisks > 0 ? CircleAlert : ShieldCheck}
            tone={result.uncheckedRisks > 0 ? 'amber' : 'blue'}
          />
        </div>

        <section className="mt-5 overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex min-w-0 items-center gap-2">
              <MessageSquareText aria-hidden="true" className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />
              <p className="truncate text-sm font-semibold text-neutral-950 dark:text-white">
                Compose preview
              </p>
            </div>
            <span className={`shrink-0 rounded border px-2 py-1 text-xs font-semibold ${
              !result.renders
                ? 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
                : result.uncheckedRisks > 0
                  ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
            }`}>
              {result.outcome}
            </span>
          </div>
          <div className="min-h-32 p-5">
            <p className="text-base leading-8 text-neutral-950 dark:text-white">
              {scenario.draft}
              <span
                className={result.renders
                  ? 'rounded-sm bg-violet-100 px-0.5 text-violet-800 dark:bg-violet-950 dark:text-violet-200'
                  : 'text-neutral-400 line-through decoration-rose-500 dark:text-neutral-600'}
              >
                {scenario.candidate}
              </span>
              <span className="ml-0.5 inline-block h-5 w-0.5 translate-y-1 bg-blue-500" aria-hidden="true" />
            </p>
            <p className="mt-4 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
              {scenario.explanation}
            </p>
          </div>
        </section>

        <section className="mt-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Release trace
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">
                One failed checked gate is enough to abstain
              </p>
            </div>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">{policy.label}</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {result.gates.map((gate) => (
              <GateCard key={gate.id} gate={gate} />
            ))}
          </div>
        </section>

        <div className={`mt-5 rounded-md border p-4 ${
          !result.renders
            ? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30'
            : result.uncheckedRisks > 0
              ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
              : 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
        }`}>
          <p className="font-semibold text-neutral-950 dark:text-white">
            {!result.renders
              ? 'Suppression is a successful system response.'
              : result.uncheckedRisks > 0
                ? 'This shortcut renders a candidate while ignoring a known mismatch.'
                : 'All independent release conditions passed.'}
          </p>
          <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
            {!result.renders
              ? 'The user keeps typing without interruption; no retry is required on the critical path.'
              : result.uncheckedRisks > 0
                ? 'Latency and confidence alone cannot establish that text is current, safe, or appropriate for the language at the cursor.'
                : 'The candidate is eligible to render, but accepting it remains the user\'s explicit action.'}
          </p>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function GateCard({ gate }: { gate: Gate }) {
  const Icon = gate.icon;
  const StateIcon = gate.status === 'pass'
    ? CheckCircle2
    : gate.status === 'fail' ? CircleX : CircleAlert;
  const styles = {
    pass: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-50',
    fail: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-50',
    unchecked: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-50',
  };

  return (
    <div className={`min-h-32 rounded-md border p-3 ${styles[gate.status]}`}>
      <div className="flex items-center justify-between gap-2">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <StateIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
      </div>
      <p className="mt-3 text-sm font-semibold">{gate.label}</p>
      <p className="mt-1 text-xs leading-5 opacity-80">{gate.detail}</p>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Candidate release lab"
        title={error ? 'The release model could not load' : 'Loading release scenarios'}
        description={error ?? 'Preparing candidate and policy states.'}
        icon={error ? CircleAlert : Sparkles}
        accent={error ? 'rose' : 'violet'}
      />
      <LearningLabBody>
        <div className="flex min-h-32 items-center justify-center">
          {error ? (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100"
            >
              Try again
            </button>
          ) : (
            <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
              <ShieldCheck aria-hidden="true" className="h-4 w-4" />
              Loading gates...
            </div>
          )}
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
