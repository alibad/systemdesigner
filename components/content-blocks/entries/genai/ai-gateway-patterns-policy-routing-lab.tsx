'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BadgeCheck,
  Ban,
  Braces,
  CheckCircle2,
  CircleAlert,
  CircleDollarSign,
  Clock3,
  KeyRound,
  MapPin,
  Route,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert,
} from 'lucide-react';

import {
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type HealthState = 'healthy' | 'slow' | 'open';
type Tone = 'neutral' | 'blue' | 'emerald' | 'amber' | 'rose' | 'violet';

type IdentityMode = {
  id: string;
  label: string;
  detail: string;
  verified: boolean;
  tenantMatches: boolean;
  allowsRestrictedData: boolean;
};

type Objective = {
  id: string;
  label: string;
  detail: string;
  qualityWeight: number;
  latencyWeight: number;
  costWeight: number;
};

type HealthScenario = {
  id: string;
  label: string;
  detail: string;
  states: Record<string, HealthState>;
};

type Workload = {
  id: string;
  label: string;
  detail: string;
  taskType: string;
  dataClass: 'standard' | 'restricted';
  requiredRegion: 'any' | 'us' | 'eu';
  requiredSafetyTier: number;
  requiredCapabilities: string[];
  inputTokens: number;
  outputTokens: number;
  deadlineMs: number;
  budgetPer1000RequestsUsd: number;
};

type Candidate = {
  id: string;
  label: string;
  provider: string;
  adapter: string;
  nativeNote: string;
  regions: string[];
  capabilities: string[];
  safetyTier: number;
  maxInputTokens: number;
  p95LatencyMs: number;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  qualityByTask: Record<string, number>;
};

type RoutingModel = {
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    identityId: string;
    objectiveId: string;
    healthScenarioId: string;
  };
  identities: IdentityMode[];
  objectives: Objective[];
  healthScenarios: HealthScenario[];
  workloads: Workload[];
  candidates: Candidate[];
};

type CandidateResult = Candidate & {
  costPer1000RequestsUsd: number;
  effectiveLatencyMs: number;
  eligible: boolean;
  health: HealthState;
  qualityScore: number;
  reasons: string[];
  score: number;
};

const BLOCK_ID = 'genai/ai-gateway-patterns-policy-routing-lab';

function isRoutingModel(value: unknown): value is RoutingModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RoutingModel>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && Array.isArray(candidate.identities)
      && candidate.identities.length > 0
      && Array.isArray(candidate.objectives)
      && candidate.objectives.length > 0
      && Array.isArray(candidate.healthScenarios)
      && candidate.healthScenarios.length > 0
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length > 0
      && Array.isArray(candidate.candidates)
      && candidate.candidates.length > 0,
  );
}

const money = (value: number) => `$${value.toFixed(2)}`;
const clamp = (value: number) => Math.max(0, Math.min(1, value));

export default function AiGatewayPatternsPolicyRoutingLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<RoutingModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No routing model was supplied.');
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
        if (!isRoutingModel(payload)) throw new Error('The routing model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load routing data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  return (
    <div data-content-block={BLOCK_ID}>
      {error ? (
        <LoadState status="error" detail={error} />
      ) : data ? (
        <PolicyRoutingLab data={data} />
      ) : (
        <LoadState status="loading" detail="Loading route policies..." />
      )}
    </div>
  );
}

function PolicyRoutingLab({ data }: { data: RoutingModel }) {
  const [workloadId, setWorkloadId] = useState(data.defaults.workloadId);
  const [identityId, setIdentityId] = useState(data.defaults.identityId);
  const [objectiveId, setObjectiveId] = useState(data.defaults.objectiveId);
  const [healthScenarioId, setHealthScenarioId] = useState(
    data.defaults.healthScenarioId,
  );

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];
  const identity = data.identities.find((item) => item.id === identityId) ?? data.identities[0];
  const objective = data.objectives.find((item) => item.id === objectiveId) ?? data.objectives[0];
  const healthScenario = data.healthScenarios.find(
    (item) => item.id === healthScenarioId,
  ) ?? data.healthScenarios[0];

  const result = useMemo(() => {
    const candidates: CandidateResult[] = data.candidates.map((candidate) => {
      const health = healthScenario.states[candidate.id] ?? 'open';
      const effectiveLatencyMs = Math.round(
        candidate.p95LatencyMs * (health === 'slow' ? 1.75 : 1),
      );
      const requestCost = (
        workload.inputTokens * candidate.inputUsdPerMillion
        + workload.outputTokens * candidate.outputUsdPerMillion
      ) / 1_000_000;
      const costPer1000RequestsUsd = requestCost * 1000;
      const qualityScore = candidate.qualityByTask[workload.taskType] ?? 0;
      const reasons: string[] = [];

      if (!identity.verified) reasons.push('Tenant is not bound to verified identity.');
      if (!identity.tenantMatches) reasons.push('Caller and resource tenants do not match.');
      if (workload.dataClass === 'restricted' && !identity.allowsRestrictedData) {
        reasons.push('The tenant plan excludes restricted data.');
      }
      for (const capability of workload.requiredCapabilities) {
        if (!candidate.capabilities.includes(capability)) {
          reasons.push(`Missing required capability: ${capability}.`);
        }
      }
      if (
        workload.requiredRegion !== 'any'
        && !candidate.regions.includes(workload.requiredRegion)
      ) {
        reasons.push(`No ${workload.requiredRegion.toUpperCase()} route.`);
      }
      if (candidate.safetyTier < workload.requiredSafetyTier) {
        reasons.push(`Safety tier ${candidate.safetyTier} is below tier ${workload.requiredSafetyTier}.`);
      }
      if (workload.inputTokens > candidate.maxInputTokens) {
        reasons.push('Input exceeds the tested context limit.');
      }
      if (costPer1000RequestsUsd > workload.budgetPer1000RequestsUsd) {
        reasons.push('Estimated cost exceeds the admission budget.');
      }
      if (effectiveLatencyMs > workload.deadlineMs) {
        reasons.push('P95 latency exceeds the request deadline.');
      }
      if (health === 'open') reasons.push('The route circuit is open.');

      const qualityFit = qualityScore / 100;
      const latencyFit = clamp(1 - effectiveLatencyMs / workload.deadlineMs);
      const costFit = clamp(
        1 - costPer1000RequestsUsd / workload.budgetPer1000RequestsUsd,
      );
      const score = (
        qualityFit * objective.qualityWeight
        + latencyFit * objective.latencyWeight
        + costFit * objective.costWeight
      ) * 100;

      return {
        ...candidate,
        costPer1000RequestsUsd,
        effectiveLatencyMs,
        eligible: reasons.length === 0,
        health,
        qualityScore,
        reasons,
        score,
      };
    });

    const ranked = candidates
      .filter((candidate) => candidate.eligible)
      .sort((left, right) => right.score - left.score);

    return {
      candidates,
      primary: ranked[0] ?? null,
      fallback: ranked[1] ?? null,
      ranked,
    };
  }, [data.candidates, healthScenario, identity, objective, workload]);

  const reset = () => {
    setWorkloadId(data.defaults.workloadId);
    setIdentityId(data.defaults.identityId);
    setObjectiveId(data.defaults.objectiveId);
    setHealthScenarioId(data.defaults.healthScenarioId);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Policy routing lab"
        title={data.title}
        description={data.description}
        icon={Route}
        accent="blue"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <ControlSelect
              label="1. Product workload"
              items={data.workloads}
              selectedId={workload.id}
              onSelect={setWorkloadId}
            />
            <ControlSelect
              label="2. Trusted identity"
              items={data.identities}
              selectedId={identity.id}
              onSelect={setIdentityId}
            />
            <ControlSelect
              label="3. Ranking objective"
              items={data.objectives}
              selectedId={objective.id}
              onSelect={setObjectiveId}
            />
            <ControlSelect
              label="4. Route health"
              items={data.healthScenarios}
              selectedId={healthScenario.id}
              onSelect={setHealthScenarioId}
            />
          </div>
        )}
      >
        <div className="min-w-0 space-y-6" aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Eligible routes"
              value={`${result.ranked.length}/${data.candidates.length}`}
              detail="Hard constraints pass."
              icon={ShieldCheck}
              tone={result.ranked.length > 0 ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Primary"
              value={result.primary?.label ?? 'Denied'}
              detail={result.primary ? result.primary.provider : 'No compliant route exists.'}
              icon={result.primary ? Route : Ban}
              tone={result.primary ? 'blue' : 'rose'}
            />
            <LabMetric
              label="Estimated cost"
              value={result.primary
                ? `${money(result.primary.costPer1000RequestsUsd)}/1K`
                : 'No spend'}
              detail={`Budget: ${money(workload.budgetPer1000RequestsUsd)}/1K`}
              icon={CircleDollarSign}
              tone="amber"
            />
            <LabMetric
              label="Fallback quality"
              value={result.fallback ? `${result.fallback.qualityScore}/100` : 'None'}
              detail={result.fallback
                ? `${result.fallback.label} remains eligible.`
                : 'Do not weaken policy to invent one.'}
              icon={BadgeCheck}
              tone={result.fallback ? 'violet' : 'neutral'}
            />
          </div>

          <section aria-label="Gateway decision stages">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Decision trace
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <DecisionStage
                label="Normalize"
                detail={`${workload.taskType}; ${workload.requiredCapabilities.join(' + ')}`}
                state="pass"
                icon={Braces}
              />
              <DecisionStage
                label="Bind identity"
                detail={!identity.verified
                  ? 'Unverified tenant claim'
                  : !identity.tenantMatches
                    ? 'Cross-tenant request'
                    : 'Trusted tenant context'}
                state={identity.verified && identity.tenantMatches ? 'pass' : 'deny'}
                icon={KeyRound}
              />
              <DecisionStage
                label="Filter policy"
                detail={`${result.ranked.length} route${result.ranked.length === 1 ? '' : 's'} eligible`}
                state={result.ranked.length > 0 ? 'pass' : 'deny'}
                icon={ShieldCheck}
              />
              <DecisionStage
                label="Rank"
                detail={result.primary
                  ? `${objective.label}: ${result.primary.score.toFixed(1)}`
                  : 'Ranking never runs'}
                state={result.primary ? 'pass' : 'idle'}
                icon={SlidersHorizontal}
              />
            </div>
          </section>

          <section aria-label="Route candidate comparison">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Candidate evidence
                </p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                  Fictional values; adapter notes expose non-portable API semantics.
                </p>
              </div>
              <span className="rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                {healthScenario.label}
              </span>
            </div>
            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              {result.candidates.map((candidate) => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  selected={result.primary?.id === candidate.id}
                  fallback={result.fallback?.id === candidate.id}
                  requiredRegion={workload.requiredRegion}
                />
              ))}
            </div>
          </section>

          <div className={`rounded-md border p-4 ${
            result.primary
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-50'
              : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-50'
          }`}>
            <div className="flex items-start gap-3">
              {result.primary ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div>
                <p className="font-semibold">
                  {result.primary
                    ? `${result.primary.label} is the highest-ranked eligible route.`
                    : 'The gateway denies this request before provider invocation.'}
                </p>
                <p className="mt-1 text-sm leading-6 opacity-80">
                  {result.primary
                    ? result.fallback
                      ? `${result.fallback.label} is a policy-valid fallback, but its measured task quality is ${result.fallback.qualityScore}/100 and must remain above the release floor.`
                      : 'No fallback currently satisfies the same contract. Availability work must add a qualified route instead of weakening constraints.'
                    : 'A missing route is an explicit product outcome. Client-supplied identity, open circuits, or policy violations cannot be repaired by a cheaper model.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function ControlSelect({
  label,
  items,
  selectedId,
  onSelect,
}: {
  label: string;
  items: Array<{ id: string; label: string; detail: string }>;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const selected = items.find((item) => item.id === selectedId) ?? items[0];

  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      <select
        value={selectedId}
        onChange={(event) => onSelect(event.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
      >
        {items.map((item) => (
          <option key={item.id} value={item.id}>{item.label}</option>
        ))}
      </select>
      <span className="mt-2 block text-xs leading-5 text-neutral-600 dark:text-neutral-400">
        {selected.detail}
      </span>
    </label>
  );
}

function DecisionStage({
  label,
  detail,
  state,
  icon: Icon,
}: {
  label: string;
  detail: string;
  state: 'pass' | 'deny' | 'idle';
  icon: typeof Route;
}) {
  const styles = {
    pass: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-50',
    deny: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-50',
    idle: 'border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300',
  };

  return (
    <div className={`min-h-28 rounded-md border p-4 ${styles[state]}`}>
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <p className="text-sm font-semibold">{label}</p>
      </div>
      <p className="mt-2 break-words text-xs leading-5 opacity-80">{detail}</p>
    </div>
  );
}

function CandidateCard({
  candidate,
  selected,
  fallback,
  requiredRegion,
}: {
  candidate: CandidateResult;
  selected: boolean;
  fallback: boolean;
  requiredRegion: Workload['requiredRegion'];
}) {
  const tone: Tone = selected
    ? 'blue'
    : fallback
      ? 'violet'
      : candidate.eligible
        ? 'emerald'
        : 'neutral';
  const styles: Record<Tone, string> = {
    neutral: 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950',
    blue: 'border-blue-400 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30',
    emerald: 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/20',
    amber: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30',
    rose: 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30',
    violet: 'border-violet-400 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/30',
  };
  const healthStyle = candidate.health === 'healthy'
    ? 'text-emerald-700 dark:text-emerald-300'
    : candidate.health === 'slow'
      ? 'text-amber-700 dark:text-amber-300'
      : 'text-rose-700 dark:text-rose-300';

  return (
    <article className={`min-w-0 rounded-md border p-4 ${styles[tone]}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-neutral-950 dark:text-white">{candidate.label}</p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {candidate.provider} / {candidate.adapter}
          </p>
        </div>
        <span className={`flex items-center gap-1 text-xs font-semibold ${healthStyle}`}>
          {candidate.health === 'open' ? (
            <Ban aria-hidden="true" className="h-3.5 w-3.5" />
          ) : candidate.health === 'slow' ? (
            <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
          ) : (
            <Activity aria-hidden="true" className="h-3.5 w-3.5" />
          )}
          {candidate.health}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <Evidence label="Quality" value={`${candidate.qualityScore}/100`} />
        <Evidence label="P95 latency" value={`${candidate.effectiveLatencyMs} ms`} />
        <Evidence label="Cost per 1K" value={money(candidate.costPer1000RequestsUsd)} />
        <Evidence
          label="Region"
          value={requiredRegion === 'any' ? candidate.regions.join(', ').toUpperCase() : requiredRegion.toUpperCase()}
          icon={MapPin}
        />
      </dl>

      <div className="mt-4 rounded-md border border-neutral-200 bg-white/80 p-3 dark:border-neutral-800 dark:bg-neutral-950/70">
        <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">
          Adapter-owned semantics
        </p>
        <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
          {candidate.nativeNote}
        </p>
      </div>

      <div className="mt-4">
        {candidate.eligible ? (
          <p className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
            {selected ? 'Selected primary' : fallback ? 'Qualified fallback' : `Eligible score ${candidate.score.toFixed(1)}`}
          </p>
        ) : (
          <ul className="space-y-1.5 text-xs leading-5 text-rose-700 dark:text-rose-300">
            {candidate.reasons.slice(0, 3).map((reason) => (
              <li key={reason} className="flex items-start gap-2">
                <CircleAlert aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{reason}</span>
              </li>
            ))}
            {candidate.reasons.length > 3 ? (
              <li className="pl-5">+{candidate.reasons.length - 3} more constraint</li>
            ) : null}
          </ul>
        )}
      </div>
    </article>
  );
}

function Evidence({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof MapPin;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-neutral-500 dark:text-neutral-400">{label}</dt>
      <dd className="mt-1 flex items-center gap-1 break-words font-semibold tabular-nums text-neutral-950 dark:text-white">
        {Icon ? <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> : null}
        {value}
      </dd>
    </div>
  );
}

function LoadState({
  status,
  detail,
}: {
  status: 'loading' | 'error';
  detail: string;
}) {
  return (
    <div
      className={`not-prose my-7 flex min-h-64 items-center justify-center rounded-lg border p-6 ${
        status === 'error'
          ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
          : 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200'
      }`}
      role={status === 'error' ? 'alert' : 'status'}
    >
      <div className="max-w-md text-center">
        {status === 'error' ? (
          <TriangleAlert aria-hidden="true" className="mx-auto h-6 w-6" />
        ) : (
          <Activity aria-hidden="true" className="mx-auto h-6 w-6 animate-pulse motion-reduce:animate-none" />
        )}
        <p className="mt-3 text-sm font-semibold">
          {status === 'error' ? 'Routing model unavailable' : 'Preparing the routing lab'}
        </p>
        <p className="mt-1 text-sm opacity-75">{detail}</p>
      </div>
    </div>
  );
}
