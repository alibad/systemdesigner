'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowDown,
  CheckCircle2,
  Gauge,
  Network,
  RefreshCw,
  Route,
  ShieldAlert,
  ShieldCheck,
  Timer,
  TriangleAlert,
  Users,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type OutcomeStatus = 'contained' | 'degraded' | 'unsafe';

interface FailureScenario {
  id: string;
  label: string;
  detail: string;
  injectedFault: string;
}

interface ResponsePolicy {
  id: string;
  label: string;
  detail: string;
  path: string;
}

interface RecordedOutcome {
  scenarioId: string;
  policyId: string;
  status: OutcomeStatus;
  successPct: number;
  p95LatencyMs: number;
  workerUtilizationPct: number;
  attemptsPerRequest: number;
  title: string;
  explanation: string;
  userResult: string;
}

interface FailureLabData {
  title: string;
  description: string;
  evidenceNotice: string;
  objective: {
    successPct: number;
    p95LatencyMs: number;
    workerUtilizationPct: number;
  };
  defaults: {
    scenarioId: string;
    policyId: string;
  };
  scenarios: FailureScenario[];
  policies: ResponsePolicy[];
  outcomes: RecordedOutcome[];
}

const BLOCK_ID = 'technology/chaos-engineering-failure-lab';

function isFailureLabData(value: unknown): value is FailureLabData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FailureLabData>;
  return Boolean(
    candidate.title &&
      candidate.description &&
      candidate.evidenceNotice &&
      candidate.objective &&
      candidate.defaults &&
      Array.isArray(candidate.scenarios) &&
      candidate.scenarios.length &&
      Array.isArray(candidate.policies) &&
      candidate.policies.length &&
      Array.isArray(candidate.outcomes) &&
      candidate.outcomes.length,
  );
}

export default function ChaosEngineeringFailureLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<FailureLabData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No failure-drill evidence was supplied.');
      return;
    }

    const controller = new AbortController();
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isFailureLabData(payload)) throw new Error('The failure-drill model is incomplete.');
        setData(payload);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Unable to load the failure drill.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <BlockState title="Failure drill unavailable" detail={error} />;
  if (!data) {
    return (
      <BlockState title="Loading failure drill" detail="Preparing recorded experiment outcomes..." />
    );
  }

  return <FailureResponseLab data={data} />;
}

function FailureResponseLab({ data }: { data: FailureLabData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [policyId, setPolicyId] = useState(data.defaults.policyId);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];
  const outcome =
    data.outcomes.find(
      (item) => item.scenarioId === scenario.id && item.policyId === policy.id,
    ) ?? data.outcomes[0];

  const reset = () => {
    setScenarioId(data.defaults.scenarioId);
    setPolicyId(data.defaults.policyId);
  };

  const statusClass =
    outcome.status === 'contained'
      ? healthyClass
      : outcome.status === 'degraded'
        ? warningClass
        : dangerClass;
  const StatusIcon =
    outcome.status === 'contained'
      ? CheckCircle2
      : outcome.status === 'degraded'
        ? TriangleAlert
        : ShieldAlert;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Failure containment lab"
          title={data.title}
          description={data.description}
          icon={Route}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Inject an incident
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Network}
                      accent="rose"
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Choose the response policy
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.policies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === policy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={
                        item.id === 'breaker-fallback'
                          ? ShieldCheck
                          : item.id === 'bounded-timeout'
                            ? Timer
                            : RefreshCw
                      }
                      accent="violet"
                      onClick={() => setPolicyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          }
        >
          <div className="space-y-6">
            <div className={`rounded-md border p-5 ${statusClass}`}>
              <div className="flex items-start gap-3">
                <StatusIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">
                    Recorded fixture outcome · {outcome.status}
                  </p>
                  <h4 className="mt-1 text-xl font-semibold">{outcome.title}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">{outcome.explanation}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Successful requests"
                value={`${outcome.successPct.toFixed(1)}%`}
                detail={`Objective ≥ ${data.objective.successPct.toFixed(1)}%`}
                icon={Activity}
                tone={outcome.successPct >= data.objective.successPct ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="p95 latency"
                value={`${outcome.p95LatencyMs}ms`}
                detail={`Objective ≤ ${data.objective.p95LatencyMs}ms`}
                icon={Timer}
                tone={outcome.p95LatencyMs <= data.objective.p95LatencyMs ? 'cyan' : 'amber'}
              />
              <LabMetric
                label="Worker utilization"
                value={`${outcome.workerUtilizationPct}%`}
                detail={`Guardrail ≤ ${data.objective.workerUtilizationPct}%`}
                icon={Gauge}
                tone={
                  outcome.workerUtilizationPct <= data.objective.workerUtilizationPct
                    ? 'violet'
                    : 'rose'
                }
              />
              <LabMetric
                label="Attempts per request"
                value={outcome.attemptsPerRequest.toFixed(1)}
                detail="Retry amplification under fault"
                icon={RefreshCw}
                tone={outcome.attemptsPerRequest <= 1.1 ? 'emerald' : 'amber'}
              />
            </div>

            <div className="grid items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
              <PathStage
                icon={Network}
                eyebrow="Fault"
                title={scenario.injectedFault}
                detail="A controlled condition applied to the selected target."
              />
              <PathArrow />
              <PathStage
                icon={ShieldCheck}
                eyebrow="Policy"
                title={policy.path}
                detail="The application behavior that turns a dependency fault into a bounded or amplified result."
              />
              <PathArrow />
              <PathStage
                icon={Users}
                eyebrow="User result"
                title={outcome.userResult}
                detail="The system-level consequence visible outside the failed component."
              />
            </div>

            <p className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-xs leading-5 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
              {data.evidenceNotice}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function PathStage({
  icon: Icon,
  eyebrow,
  title,
  detail,
}: {
  icon: typeof Network;
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="min-h-44 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {eyebrow}
      </div>
      <p className="mt-3 text-sm font-semibold leading-5 text-neutral-950 dark:text-white">
        {title}
      </p>
      <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

function PathArrow() {
  return (
    <div className="flex items-center justify-center py-1 text-neutral-400 dark:text-neutral-600">
      <ArrowDown aria-hidden="true" className="h-5 w-5 md:-rotate-90" />
      <span className="sr-only">then</span>
    </div>
  );
}

function BlockState({ title, detail }: { title: string; detail: string }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-sm font-semibold text-neutral-950 dark:text-white">{title}</p>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{detail}</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

const healthyClass =
  'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50';
const warningClass =
  'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50';
const dangerClass =
  'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50';
