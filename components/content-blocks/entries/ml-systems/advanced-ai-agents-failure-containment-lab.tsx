'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Database,
  KeyRound,
  Network,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  TimerReset,
  Workflow,
  XCircle,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'ml-systems/advanced-ai-agents-failure-containment-lab';
const PIPELINE_STAGES = [
  'Memory',
  'Context',
  'Planner',
  'Coordinator',
  'Worker',
  'Tool',
  'External effect',
];

type Authority = {
  id: string;
  label: string;
  detail: string;
  blastMultiplier: number;
};

type Response = {
  id: string;
  label: string;
  detail: string;
  containmentPower: number;
};

type FailureScenario = {
  id: string;
  label: string;
  detail: string;
  sourceStage: string;
  affectedStages: string[];
  baseSeverity: number;
  recommendedResponseId: string;
  maximumSafeRetries: number;
  signal: string;
  survivingPath: string;
  recoveryEvidence: string;
  governanceOwner: string;
};

type FailureContainmentData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    responseId: string;
    authorityId: string;
    retryBudget: number;
  };
  retryRange: {
    min: number;
    max: number;
    step: number;
  };
  authorities: Authority[];
  responses: Response[];
  scenarios: FailureScenario[];
};

type Judgment = 'contained' | 'partial' | 'amplified';

function isFailureContainmentData(value: unknown): value is FailureContainmentData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<FailureContainmentData>;

  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && data.defaults
      && typeof data.defaults.scenarioId === 'string'
      && typeof data.defaults.responseId === 'string'
      && typeof data.defaults.authorityId === 'string'
      && typeof data.defaults.retryBudget === 'number'
      && data.retryRange
      && typeof data.retryRange.min === 'number'
      && typeof data.retryRange.max === 'number'
      && typeof data.retryRange.step === 'number'
      && Array.isArray(data.authorities)
      && data.authorities.length >= 2
      && data.authorities.every((authority) => (
        typeof authority.id === 'string'
        && typeof authority.label === 'string'
        && typeof authority.detail === 'string'
        && typeof authority.blastMultiplier === 'number'
      ))
      && Array.isArray(data.responses)
      && data.responses.length >= 3
      && data.responses.every((response) => (
        typeof response.id === 'string'
        && typeof response.label === 'string'
        && typeof response.detail === 'string'
        && typeof response.containmentPower === 'number'
      ))
      && Array.isArray(data.scenarios)
      && data.scenarios.length >= 3
      && data.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.detail === 'string'
        && typeof scenario.sourceStage === 'string'
        && Array.isArray(scenario.affectedStages)
        && scenario.affectedStages.every((stage) => typeof stage === 'string')
        && typeof scenario.baseSeverity === 'number'
        && typeof scenario.recommendedResponseId === 'string'
        && typeof scenario.maximumSafeRetries === 'number'
        && typeof scenario.signal === 'string'
        && typeof scenario.survivingPath === 'string'
        && typeof scenario.recoveryEvidence === 'string'
        && typeof scenario.governanceOwner === 'string'
      )),
  );
}

export default function AdvancedAiAgentsFailureContainmentLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<FailureContainmentData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No failure-containment scenario data was supplied.');
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
        if (!isFailureContainmentData(payload)) {
          throw new Error('Failure-containment scenario data is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError message={error} />;
  if (!data) return <LoadState />;
  return <ContainmentModel data={data} />;
}

function ContainmentModel({ data }: { data: FailureContainmentData }) {
  const initialScenario = data.scenarios.find((item) => item.id === data.defaults.scenarioId)
    ?? data.scenarios[0];
  const initialResponse = data.responses.find((item) => item.id === data.defaults.responseId)
    ?? data.responses[0];
  const initialAuthority = data.authorities.find((item) => item.id === data.defaults.authorityId)
    ?? data.authorities[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [responseId, setResponseId] = useState(initialResponse.id);
  const [authorityId, setAuthorityId] = useState(initialAuthority.id);
  const [retryBudget, setRetryBudget] = useState(data.defaults.retryBudget);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const response = data.responses.find((item) => item.id === responseId) ?? data.responses[0];
  const authority = data.authorities.find((item) => item.id === authorityId) ?? data.authorities[0];

  const model = useMemo(() => {
    const responseMatches = response.id === scenario.recommendedResponseId;
    const retryExcess = Math.max(0, retryBudget - scenario.maximumSafeRetries);
    const authorityPenalty = authority.id === 'broad-write' ? 18 : authority.id === 'read-only' ? -8 : 0;
    const rawBlast = (
      scenario.baseSeverity * 18 * authority.blastMultiplier
      + retryBudget * 6
      + retryExcess * 14
      + authorityPenalty
      - response.containmentPower * 13
    );
    const blastIndex = Math.max(0, Math.min(100, Math.round(rawBlast)));

    let judgment: Judgment;
    if (responseMatches && retryExcess === 0 && authority.id !== 'broad-write') {
      judgment = 'contained';
    } else if (response.id === 'keep-running' || retryExcess > 0) {
      judgment = 'amplified';
    } else {
      judgment = 'partial';
    }

    const verdict = judgment === 'contained'
      ? 'Failure contained at the intended boundary'
      : judgment === 'partial'
        ? 'Run paused, but recovery evidence is incomplete'
        : 'Failure can propagate beyond the original task';
    const detail = judgment === 'contained'
      ? scenario.survivingPath
      : judgment === 'partial'
        ? `The selected response reduces pressure, but the scenario calls for ${data.responses.find((item) => item.id === scenario.recommendedResponseId)?.label.toLowerCase() ?? 'a different recovery'}.`
        : retryExcess > 0
          ? `${retryExcess} retr${retryExcess === 1 ? 'y exceeds' : 'ies exceed'} the scenario limit and can repeat the failed path.`
          : 'Authority remains active while the failed path continues.';

    return { blastIndex, detail, judgment, responseMatches, retryExcess, verdict };
  }, [authority, data.responses, response, retryBudget, scenario]);

  function chooseScenario(nextScenario: FailureScenario) {
    setScenarioId(nextScenario.id);
    setResponseId(nextScenario.recommendedResponseId);
    setRetryBudget(Math.min(data.defaults.retryBudget, nextScenario.maximumSafeRetries));
  }

  function reset() {
    setScenarioId(initialScenario.id);
    setResponseId(initialResponse.id);
    setAuthorityId(initialAuthority.id);
    setRetryBudget(data.defaults.retryBudget);
  }

  const VerdictIcon = model.judgment === 'contained'
    ? BadgeCheck
    : model.judgment === 'partial'
      ? AlertTriangle
      : XCircle;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Failure containment lab"
          title={data.title}
          description={data.description}
          icon={ShieldAlert}
          accent="rose"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                  1. Inject a failure
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.sourceStage === 'Memory' ? Database : item.sourceStage === 'Coordinator' ? Network : ShieldAlert}
                      accent="rose"
                      onClick={() => chooseScenario(item)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                  2. Choose the containment response
                </legend>
                <div className="mt-3 space-y-2">
                  {data.responses.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === response.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'halt-and-revoke' ? KeyRound : item.id === 'keep-running' ? RefreshCcw : ShieldCheck}
                      accent={item.id === 'keep-running' ? 'rose' : 'emerald'}
                      onClick={() => setResponseId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                  3. Set effective authority
                </legend>
                <div className="mt-3 space-y-2">
                  {data.authorities.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === authority.id}
                      label={item.label}
                      detail={item.detail}
                      icon={KeyRound}
                      accent={item.id === 'broad-write' ? 'amber' : 'cyan'}
                      onClick={() => setAuthorityId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="4. Automatic retry budget"
                value={retryBudget}
                output={String(retryBudget)}
                min={data.retryRange.min}
                max={data.retryRange.max}
                step={data.retryRange.step}
                accent="amber"
                lowLabel="Stop immediately"
                highLabel="Repeat failed path"
                onChange={setRetryBudget}
              />
            </div>
          )}
        >
          <div className="space-y-6" aria-live="polite">
            <div className={`rounded-md border p-5 ${
              model.judgment === 'contained'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100'
                : model.judgment === 'partial'
                  ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100'
            }`}>
              <div className="flex items-start gap-3">
                <VerdictIcon aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
                <div className="min-w-0">
                  <p className="text-lg font-semibold">{model.verdict}</p>
                  <p className="mt-2 text-sm leading-6 opacity-80">{model.detail}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Relative blast index"
                value={`${model.blastIndex}/100`}
                detail="Scenario comparison, not a calibrated probability"
                icon={ShieldAlert}
                tone={model.blastIndex <= 25 ? 'emerald' : model.blastIndex <= 55 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Retry excess"
                value={String(model.retryExcess)}
                detail={`Maximum before reconciliation: ${scenario.maximumSafeRetries}`}
                icon={TimerReset}
                tone={model.retryExcess === 0 ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Decision owner"
                value={scenario.governanceOwner}
                detail="Accountable for recovery and resumption"
                icon={Workflow}
                tone="violet"
              />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Failure propagation path
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {PIPELINE_STAGES.map((stage) => {
                  const affected = scenario.affectedStages.includes(stage);
                  const source = stage === scenario.sourceStage;
                  const contained = affected && model.judgment === 'contained'
                    && stage === scenario.affectedStages[scenario.affectedStages.length - 1];
                  return (
                    <div
                      key={stage}
                      className={`min-w-0 rounded-md border p-3 ${
                        source
                          ? 'border-rose-400 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/35'
                          : contained
                            ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/35'
                            : affected
                              ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
                              : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50'
                      }`}
                    >
                      <p className="text-sm font-semibold text-neutral-950 dark:text-white">{stage}</p>
                      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                        {source ? 'Failure enters here' : contained ? 'Containment boundary' : affected ? 'Propagation path' : 'Outside current path'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Detection signal</p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{scenario.signal}</p>
              </div>
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Evidence before resumption</p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{scenario.recoveryEvidence}</p>
              </div>
            </div>

            {!model.responseMatches ? (
              <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-sm leading-6">
                  The response does not restore the boundary that failed. A stronger response is not automatically a complete one; recovery must produce the scenario-specific evidence above.
                </p>
              </div>
            ) : null}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LoadState() {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="not-prose my-7 min-h-96 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900"
      aria-label="Loading failure containment lab"
    />
  );
}

function LoadError({ message }: { message: string }) {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
      role="alert"
    >
      {message}
    </div>
  );
}
