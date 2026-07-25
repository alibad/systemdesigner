'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Database,
  GitMerge,
  Link2,
  LoaderCircle,
  Network,
  ShieldCheck,
  Split,
  UsersRound,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type SourceRecord = {
  id: string;
  label: string;
  source: string;
  identityScore: number;
  sameEntityAsAnchor: boolean;
  signals: string[];
};

type RelationCandidate = {
  id: string;
  fromRecordId: string;
  type: string;
  targetLabel: string;
  confidence: number;
  sources: string[];
};

type Scenario = {
  id: string;
  label: string;
  detail: string;
  anchorRecordId: string;
  canonicalLabel: string;
  expectedEntityCount: number;
  consequence: string;
  records: SourceRecord[];
  relations: RelationCandidate[];
};

type ResolutionPolicy = {
  id: string;
  label: string;
  detail: string;
  threshold: number;
};

type EdgePolicy = {
  id: string;
  label: string;
  detail: string;
  minConfidence: number;
  minSources: number;
};

type ResolutionData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    resolutionPolicyId: string;
    edgePolicyId: string;
  };
  resolutionPolicies: ResolutionPolicy[];
  edgePolicies: EdgePolicy[];
  scenarios: Scenario[];
};

const BLOCK_ID = 'genai/knowledge-graphs-entity-resolution-lab';

const isNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

function isResolutionData(value: unknown): value is ResolutionData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ResolutionData>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.scenarioId
      && candidate.defaults.resolutionPolicyId
      && candidate.defaults.edgePolicyId
      && Array.isArray(candidate.resolutionPolicies)
      && candidate.resolutionPolicies.length > 0
      && candidate.resolutionPolicies.every((policy) => (
        typeof policy.id === 'string'
        && typeof policy.label === 'string'
        && typeof policy.detail === 'string'
        && isNumber(policy.threshold)
      ))
      && Array.isArray(candidate.edgePolicies)
      && candidate.edgePolicies.length > 0
      && candidate.edgePolicies.every((policy) => (
        typeof policy.id === 'string'
        && typeof policy.label === 'string'
        && typeof policy.detail === 'string'
        && isNumber(policy.minConfidence)
        && isNumber(policy.minSources)
      ))
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.detail === 'string'
        && typeof scenario.anchorRecordId === 'string'
        && typeof scenario.canonicalLabel === 'string'
        && isNumber(scenario.expectedEntityCount)
        && typeof scenario.consequence === 'string'
        && Array.isArray(scenario.records)
        && scenario.records.length > 0
        && scenario.records.every((record) => (
          typeof record.id === 'string'
          && typeof record.label === 'string'
          && typeof record.source === 'string'
          && isNumber(record.identityScore)
          && typeof record.sameEntityAsAnchor === 'boolean'
          && Array.isArray(record.signals)
          && record.signals.every((signal) => typeof signal === 'string')
        ))
        && Array.isArray(scenario.relations)
        && scenario.relations.every((relation) => (
          typeof relation.id === 'string'
          && typeof relation.fromRecordId === 'string'
          && typeof relation.type === 'string'
          && typeof relation.targetLabel === 'string'
          && isNumber(relation.confidence)
          && Array.isArray(relation.sources)
          && relation.sources.every((source) => typeof source === 'string')
        ))
      )),
  );
}

export default function KnowledgeGraphsEntityResolutionLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ResolutionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No entity-resolution model was supplied.');
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
        if (!isResolutionData(payload)) throw new Error('Entity-resolution data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load entity-resolution data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <ResolutionLab data={data} />;
}

function ResolutionLab({ data }: { data: ResolutionData }) {
  const initialScenario = data.scenarios.find((item) => item.id === data.defaults.scenarioId)
    ?? data.scenarios[0];
  const initialResolution = data.resolutionPolicies.find(
    (item) => item.id === data.defaults.resolutionPolicyId,
  ) ?? data.resolutionPolicies[0];
  const initialEdgePolicy = data.edgePolicies.find((item) => item.id === data.defaults.edgePolicyId)
    ?? data.edgePolicies[0];

  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [resolutionPolicyId, setResolutionPolicyId] = useState(initialResolution.id);
  const [edgePolicyId, setEdgePolicyId] = useState(initialEdgePolicy.id);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const resolutionPolicy = data.resolutionPolicies.find(
    (item) => item.id === resolutionPolicyId,
  ) ?? data.resolutionPolicies[0];
  const edgePolicy = data.edgePolicies.find((item) => item.id === edgePolicyId)
    ?? data.edgePolicies[0];

  const result = useMemo(() => {
    const mergedIds = new Set(
      scenario.records
        .filter((record) => record.identityScore >= resolutionPolicy.threshold)
        .map((record) => record.id),
    );
    const nonAnchorRecords = scenario.records.filter(
      (record) => record.id !== scenario.anchorRecordId,
    );
    const falseMerges = nonAnchorRecords.filter(
      (record) => mergedIds.has(record.id) && !record.sameEntityAsAnchor,
    );
    const missedMatches = nonAnchorRecords.filter(
      (record) => !mergedIds.has(record.id) && record.sameEntityAsAnchor,
    );
    const acceptedRelations = scenario.relations.filter((relation) => (
      relation.confidence >= edgePolicy.minConfidence
      && new Set(relation.sources).size >= edgePolicy.minSources
    ));
    const acceptedIds = new Set(acceptedRelations.map((relation) => relation.id));
    const pollutedEdges = acceptedRelations.filter((relation) => {
      const source = scenario.records.find((record) => record.id === relation.fromRecordId);
      return source ? mergedIds.has(source.id) && !source.sameEntityAsAnchor : false;
    });
    const graphEntityCount = 1 + nonAnchorRecords.filter((record) => !mergedIds.has(record.id)).length;
    const identityErrors = falseMerges.length + missedMatches.length;

    const state = pollutedEdges.length > 0 || falseMerges.length > 0
      ? {
          label: 'Identity collision contaminates the canonical node',
          detail: 'At least one different real entity was merged, so its admitted relationships can attach to the wrong identity.',
          tone: 'rose' as const,
          icon: AlertTriangle,
        }
      : missedMatches.length > 0
        ? {
            label: 'The graph is fragmented into duplicate islands',
            detail: 'Related records remain separate, so history and paths are incomplete until review resolves them.',
            tone: 'amber' as const,
            icon: Split,
          }
        : acceptedRelations.length === 0
          ? {
              label: 'Identity is clean, but no relationship passed the gate',
              detail: 'The graph avoids unsupported edges, but downstream queries will remain sparse until stronger evidence arrives.',
              tone: 'blue' as const,
              icon: ShieldCheck,
            }
          : {
              label: 'Identity and edge policies preserve the intended graph',
              detail: 'Matching observations converge on one canonical entity while weak or conflicting edges remain outside graph truth.',
              tone: 'emerald' as const,
              icon: CheckCircle2,
            };

    return {
      acceptedIds,
      acceptedRelations,
      falseMerges,
      graphEntityCount,
      identityErrors,
      mergedIds,
      missedMatches,
      pollutedEdges,
      state,
    };
  }, [edgePolicy, resolutionPolicy, scenario]);

  function reset() {
    setScenarioId(initialScenario.id);
    setResolutionPolicyId(initialResolution.id);
    setEdgePolicyId(initialEdgePolicy.id);
  }

  const StateIcon = result.state.icon;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Graph construction lab"
          title={data.title}
          description={data.description}
          icon={GitMerge}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Record set
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Database}
                      accent="blue"
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Identity policy
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.resolutionPolicies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === resolutionPolicy.id}
                      label={`${item.label} (${item.threshold}+)`}
                      detail={item.detail}
                      icon={item.id === 'aggressive' ? GitMerge : item.id === 'conservative' ? Split : UsersRound}
                      accent={item.id === 'aggressive' ? 'rose' : item.id === 'conservative' ? 'amber' : 'violet'}
                      onClick={() => setResolutionPolicyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Edge policy
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.edgePolicies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === edgePolicy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={ShieldCheck}
                      accent={item.id === 'single-extraction' ? 'rose' : item.id === 'high-assurance' ? 'blue' : 'emerald'}
                      onClick={() => setEdgePolicyId(item.id)}
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
                label="Graph identities"
                value={String(result.graphEntityCount)}
                detail={`Expected real entities: ${scenario.expectedEntityCount}`}
                icon={UsersRound}
                tone={result.graphEntityCount === scenario.expectedEntityCount ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Identity errors"
                value={String(result.identityErrors)}
                detail={`${result.falseMerges.length} false merge, ${result.missedMatches.length} missed match`}
                icon={GitMerge}
                tone={result.identityErrors === 0 ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Accepted edges"
                value={`${result.acceptedRelations.length}/${scenario.relations.length}`}
                detail={`${edgePolicy.minConfidence}+ confidence, ${edgePolicy.minSources}+ source(s)`}
                icon={Link2}
                tone="blue"
              />
              <LabMetric
                label="Polluted edges"
                value={String(result.pollutedEdges.length)}
                detail="Accepted edges transferred by a false merge"
                icon={Network}
                tone={result.pollutedEdges.length === 0 ? 'emerald' : 'rose'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Identity resolution
                  </p>
                  <h4 className="mt-1 font-semibold text-neutral-950 dark:text-white">
                    Source observations become graph identities
                  </h4>
                </div>
                <p className="text-xs font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">
                  Merge threshold {resolutionPolicy.threshold}
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {scenario.records.map((record) => {
                  const merged = result.mergedIds.has(record.id);
                  const wrongMerge = merged && !record.sameEntityAsAnchor;
                  const missedMatch = !merged && record.sameEntityAsAnchor;
                  return (
                    <div
                      key={record.id}
                      className={`rounded-md border p-3 ${
                        wrongMerge
                          ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                          : missedMatch
                            ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
                            : merged
                              ? 'border-violet-300 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/30'
                              : 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-950'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-neutral-950 dark:text-white">{record.label}</p>
                          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{record.source}</p>
                        </div>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-neutral-600 dark:text-neutral-300">
                          {record.identityScore}
                        </span>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                        {record.signals.join(' + ')}
                      </p>
                      <div className="mt-3 flex items-center gap-2 text-xs font-semibold">
                        <CircleDot aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                        {wrongMerge
                          ? `Wrongly merged into ${scenario.canonicalLabel}`
                          : missedMatch
                            ? 'Left as a duplicate candidate'
                            : merged
                              ? `Merged into ${scenario.canonicalLabel}`
                              : 'Preserved as a separate entity'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Observable graph relationships
              </p>
              <div className="mt-4 rounded-md border-2 border-violet-300 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-950/30">
                <div className="flex items-center gap-2">
                  <Network aria-hidden="true" className="h-5 w-5 text-violet-700 dark:text-violet-300" />
                  <p className="font-semibold text-violet-950 dark:text-violet-50">{scenario.canonicalLabel}</p>
                </div>
                <p className="mt-2 text-xs leading-5 text-violet-800 dark:text-violet-200">
                  {scenario.records.filter((record) => result.mergedIds.has(record.id)).map((record) => record.label).join(' / ')}
                </p>
              </div>

              <ul className="mt-4 space-y-3">
                {scenario.relations.map((relation) => {
                  const sourceRecord = scenario.records.find((record) => record.id === relation.fromRecordId);
                  const accepted = result.acceptedIds.has(relation.id);
                  const sourceLabel = sourceRecord && result.mergedIds.has(sourceRecord.id)
                    ? scenario.canonicalLabel
                    : sourceRecord?.label ?? relation.fromRecordId;
                  const polluted = sourceRecord
                    ? accepted && result.mergedIds.has(sourceRecord.id) && !sourceRecord.sameEntityAsAnchor
                    : false;

                  return (
                    <li
                      key={relation.id}
                      className={`rounded-md border p-3 ${
                        polluted
                          ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                          : accepted
                            ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                            : 'border-neutral-200 bg-neutral-50 opacity-70 dark:border-neutral-800 dark:bg-neutral-900'
                      }`}
                    >
                      <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center">
                        <span className="font-semibold text-neutral-950 dark:text-white">{sourceLabel}</span>
                        <span className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                          <Link2 aria-hidden="true" className="h-4 w-4" />
                          {relation.type}
                        </span>
                        <span className="font-semibold text-neutral-950 dark:text-white">{relation.targetLabel}</span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                        {accepted ? 'Accepted' : 'Rejected'}: {relation.confidence} confidence, {new Set(relation.sources).size} source(s)
                        {polluted ? '. This edge now belongs to the wrong canonical identity.' : '.'}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className={`rounded-md border p-4 ${
              result.state.tone === 'rose'
                ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
                : result.state.tone === 'amber'
                  ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'
                  : result.state.tone === 'blue'
                    ? 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-50'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
            }`}>
              <div className="flex items-start gap-3">
                <StateIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <h4 className="font-semibold">{result.state.label}</h4>
                  <p className="mt-1 text-sm leading-6 opacity-90">{result.state.detail}</p>
                  <p className="mt-2 text-sm font-medium">{scenario.consequence}</p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="flex min-h-72 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
        Loading entity-resolution model...
      </div>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Entity-resolution lab unavailable</p>
          <p className="mt-1 opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
