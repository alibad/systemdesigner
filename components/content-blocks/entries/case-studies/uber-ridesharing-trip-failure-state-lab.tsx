'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Database,
  GitBranch,
  MapPin,
  Network,
  RadioTower,
  RefreshCw,
  Route,
  Server,
  ShieldAlert,
  ShieldCheck,
  Unplug,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type NodeStatus = 'healthy' | 'degraded' | 'failed' | 'isolated';
type OutcomeTone = 'healthy' | 'warning' | 'danger';

interface FailureNode {
  id: string;
  label: string;
  responsibility: string;
}

interface FailureResponse {
  id: string;
  label: string;
  detail: string;
}

interface FailureOutcome {
  tone: OutcomeTone;
  title: string;
  detail: string;
  authority: string;
  freshness: string;
  blastRadius: string;
  duplicateRisk: string;
  tripState: string;
  riderState: string;
}

interface FailureScenario {
  id: string;
  label: string;
  detail: string;
  recommendedResponse: string;
  route: string[];
  statuses: Record<string, NodeStatus>;
  outcomes: Record<string, FailureOutcome>;
}

interface FailureStateData {
  title: string;
  description: string;
  nodes: FailureNode[];
  responses: FailureResponse[];
  scenarios: FailureScenario[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isNodeStatus(value: unknown): value is NodeStatus {
  return ['healthy', 'degraded', 'failed', 'isolated'].includes(String(value));
}

function isOutcomeTone(value: unknown): value is OutcomeTone {
  return ['healthy', 'warning', 'danger'].includes(String(value));
}

function isFailureOutcome(value: unknown): value is FailureOutcome {
  if (!isRecord(value)) return false;
  return (
    isOutcomeTone(value.tone) &&
    typeof value.title === 'string' &&
    typeof value.detail === 'string' &&
    typeof value.authority === 'string' &&
    typeof value.freshness === 'string' &&
    typeof value.blastRadius === 'string' &&
    typeof value.duplicateRisk === 'string' &&
    typeof value.tripState === 'string' &&
    typeof value.riderState === 'string'
  );
}

function isFailureStateData(value: unknown): value is FailureStateData {
  if (!isRecord(value)) return false;
  if (
    typeof value.title !== 'string' ||
    typeof value.description !== 'string' ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.responses) ||
    !Array.isArray(value.scenarios) ||
    value.nodes.length === 0 ||
    value.responses.length === 0 ||
    value.scenarios.length === 0
  ) {
    return false;
  }

  const nodesValid = value.nodes.every(
    (node) =>
      isRecord(node) &&
      typeof node.id === 'string' &&
      typeof node.label === 'string' &&
      typeof node.responsibility === 'string',
  );
  const responsesValid = value.responses.every(
    (response) =>
      isRecord(response) &&
      typeof response.id === 'string' &&
      typeof response.label === 'string' &&
      typeof response.detail === 'string',
  );
  if (!nodesValid || !responsesValid) return false;

  const nodeIds = new Set(value.nodes.map((node) => String(node.id)));
  const responseIds = new Set(value.responses.map((response) => String(response.id)));

  return value.scenarios.every((scenario) => {
    if (
      !isRecord(scenario) ||
      typeof scenario.id !== 'string' ||
      typeof scenario.label !== 'string' ||
      typeof scenario.detail !== 'string' ||
      typeof scenario.recommendedResponse !== 'string' ||
      !responseIds.has(scenario.recommendedResponse) ||
      !isStringArray(scenario.route) ||
      !scenario.route.every((nodeId) => nodeIds.has(nodeId)) ||
      !isRecord(scenario.statuses) ||
      !isRecord(scenario.outcomes)
    ) {
      return false;
    }

    const statuses = scenario.statuses;
    const outcomes = scenario.outcomes;
    const statusesValid = [...nodeIds].every((nodeId) =>
      isNodeStatus(statuses[nodeId]),
    );
    const outcomesValid = [...responseIds].every((responseId) =>
      isFailureOutcome(outcomes[responseId]),
    );
    return statusesValid && outcomesValid;
  });
}

function nodeIcon(nodeId: string): LucideIcon {
  if (nodeId === 'gateway') return Users;
  if (nodeId === 'location') return MapPin;
  if (nodeId === 'dispatch') return GitBranch;
  if (nodeId === 'trip') return Database;
  if (nodeId === 'events') return RadioTower;
  return Network;
}

function scenarioIcon(scenarioId: string): LucideIcon {
  if (scenarioId === 'dispatch-failure') return Server;
  if (scenarioId === 'stale-location') return MapPin;
  if (scenarioId === 'region-isolation') return Unplug;
  return RefreshCw;
}

function responseIcon(responseId: string): LucideIcon {
  if (responseId === 'retry-everywhere') return RefreshCw;
  if (responseId === 'gate-and-isolate') return ShieldAlert;
  return ShieldCheck;
}

const statusStyles: Record<NodeStatus, string> = {
  healthy:
    'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50',
  degraded:
    'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50',
  failed:
    'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50',
  isolated:
    'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-50',
};

export default function UberRidesharingTripFailureStateLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<FailureStateData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [scenarioId, setScenarioId] = useState('');
  const [responseId, setResponseId] = useState('');

  useEffect(() => {
    if (!dataFile) {
      setLoadError(true);
      return;
    }

    const controller = new AbortController();
    setData(null);
    setLoadError(false);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Trip failure request failed: ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isFailureStateData(payload)) {
          throw new Error('Trip failure data is invalid');
        }
        setData(payload);
        setScenarioId(payload.scenarios[0].id);
        setResponseId(payload.responses[1]?.id ?? payload.responses[0].id);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(true);
      });

    return () => controller.abort();
  }, [dataFile]);

  const model = useMemo(() => {
    if (!data) return null;
    const scenario =
      data.scenarios.find((candidate) => candidate.id === scenarioId) ??
      data.scenarios[0];
    const response =
      data.responses.find((candidate) => candidate.id === responseId) ??
      data.responses[0];
    const outcome = scenario.outcomes[response.id];
    if (!outcome) return null;
    return {
      scenario,
      response,
      outcome,
      recommended: scenario.recommendedResponse === response.id,
    };
  }, [data, responseId, scenarioId]);

  if (loadError) {
    return (
      <div
        role="alert"
        className="min-h-40 rounded-md border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
      >
        The trip failure model could not be loaded.
      </div>
    );
  }

  if (!data || !model) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading trip failure model"
        className="min-h-[760px] animate-pulse rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
      />
    );
  }

  const reset = () => {
    setScenarioId(data.scenarios[0].id);
    setResponseId(data.responses[1]?.id ?? data.responses[0].id);
  };
  const outcomeStyle =
    model.outcome.tone === 'healthy'
      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'
      : model.outcome.tone === 'warning'
        ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'
        : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40';
  const OutcomeIcon = model.outcome.tone === 'healthy' ? CheckCircle2 : CircleAlert;
  const freshnessUnsafe =
    model.outcome.freshness.toLowerCase().includes('old') ||
    model.outcome.freshness.toLowerCase().includes('stale');
  const duplicateTone =
    model.outcome.duplicateRisk === 'High'
      ? 'rose'
      : model.outcome.duplicateRisk === 'Medium'
        ? 'amber'
        : 'emerald';

  return (
    <div data-content-block="case-studies/uber-ridesharing-trip-failure-state-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Trip and region failure state lab"
          title={data.title}
          description={data.description}
          icon={ShieldAlert}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Inject a failure
              </legend>
              <div className="mt-3 grid gap-2">
                {data.scenarios.map((scenario) => (
                  <LabChoice
                    key={scenario.id}
                    selected={scenario.id === model.scenario.id}
                    label={scenario.label}
                    detail={scenario.detail}
                    icon={scenarioIcon(scenario.id)}
                    accent="amber"
                    onClick={() => setScenarioId(scenario.id)}
                  />
                ))}
              </div>
            </fieldset>
          }
        >
          <fieldset>
            <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              2. Choose a recovery policy
            </legend>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {data.responses.map((response) => (
                <LabChoice
                  key={response.id}
                  selected={response.id === model.response.id}
                  label={response.label}
                  detail={response.detail}
                  icon={responseIcon(response.id)}
                  accent="blue"
                  onClick={() => setResponseId(response.id)}
                />
              ))}
            </div>
          </fieldset>

          <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <LabMetric
              label="Assignment authority"
              value={model.outcome.authority}
              detail="Who can commit the active trip"
              icon={Database}
              tone={model.outcome.tone === 'danger' ? 'rose' : 'emerald'}
            />
            <LabMetric
              label="Location evidence"
              value={model.outcome.freshness}
              detail="Freshness used by dispatch"
              icon={MapPin}
              tone={freshnessUnsafe ? 'rose' : 'cyan'}
            />
            <LabMetric
              label="Failure scope"
              value={model.outcome.blastRadius}
              detail="Smallest affected boundary"
              icon={Network}
              tone={model.outcome.blastRadius.includes('regions') ? 'rose' : 'violet'}
            />
            <LabMetric
              label="Duplicate risk"
              value={model.outcome.duplicateRisk}
              detail="Repeated assignment side effects"
              icon={RefreshCw}
              tone={duplicateTone}
            />
          </div>

          <div className="mt-5 border-y border-neutral-200 py-5 dark:border-neutral-800">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Active regional topology
                </p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                  Status words accompany color so the failure remains readable in every
                  theme.
                </p>
              </div>
              <output
                className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                  model.recommended
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
                    : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
                }`}
              >
                {model.recommended ? 'Policy fits incident' : 'Policy leaves a gap'}
              </output>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.nodes.map((node) => {
                const Icon = nodeIcon(node.id);
                const status = model.scenario.statuses[node.id];
                const active = model.scenario.route.includes(node.id);
                return (
                  <div
                    key={node.id}
                    className={`min-w-0 rounded-md border p-3 ${statusStyles[status]} ${
                      active ? 'ring-2 ring-cyan-500/60' : 'opacity-75'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
                      <span className="text-[10px] font-semibold uppercase">{status}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold">{node.label}</p>
                    <p className="mt-1 text-xs leading-5 opacity-75">
                      {node.responsibility}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
              <Route aria-hidden="true" className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-300" />
              {model.scenario.route.map((nodeId, index) => {
                const node = data.nodes.find((candidate) => candidate.id === nodeId);
                if (!node) return null;
                return (
                  <span key={nodeId} className="inline-flex items-center gap-2">
                    {index > 0 ? (
                      <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 text-neutral-400" />
                    ) : null}
                    <span className="font-medium">{node.label}</span>
                  </span>
                );
              })}
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(250px,0.8fr)]">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Authoritative trip ledger
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-50">
                  <Database aria-hidden="true" className="h-5 w-5" />
                  <p className="mt-2 text-xs font-semibold uppercase opacity-70">Trip state</p>
                  <p className="mt-1 break-words text-sm font-semibold">
                    {model.outcome.tripState}
                  </p>
                </div>
                <ArrowRight
                  aria-hidden="true"
                  className="hidden h-5 w-5 text-neutral-400 sm:block"
                />
                <div className="rounded-md border border-violet-200 bg-violet-50 p-3 text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-50">
                  <Activity aria-hidden="true" className="h-5 w-5" />
                  <p className="mt-2 text-xs font-semibold uppercase opacity-70">Rider view</p>
                  <p className="mt-1 break-words text-sm font-semibold">
                    {model.outcome.riderState}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                A retry proves nothing by itself. The trip authority answers with the
                command identity, current state, and version before another side effect
                is allowed.
              </p>
            </div>

            <div className={`rounded-md border p-5 ${outcomeStyle}`} aria-live="polite">
              <OutcomeIcon
                aria-hidden="true"
                className={`h-6 w-6 ${
                  model.outcome.tone === 'healthy'
                    ? 'text-emerald-600 dark:text-emerald-300'
                    : model.outcome.tone === 'warning'
                      ? 'text-amber-600 dark:text-amber-300'
                      : 'text-rose-600 dark:text-rose-300'
                }`}
              />
              <p className="mt-4 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Observed consequence
              </p>
              <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                {model.outcome.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                {model.outcome.detail}
              </p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
