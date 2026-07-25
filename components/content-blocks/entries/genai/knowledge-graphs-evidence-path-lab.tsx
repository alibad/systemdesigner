'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  CircleX,
  Clock3,
  EyeOff,
  FileCheck2,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Network,
  Route,
  Search,
  ShieldCheck,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type Citation = {
  id: string;
  label: string;
  accessible: boolean;
  fresh: boolean;
};

type GraphNode = {
  id: string;
  label: string;
  kind: string;
  hop: number;
};

type GraphEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
  hop: number;
  status: 'verified' | 'proposed';
  citations: Citation[];
};

type Question = {
  id: string;
  label: string;
  detail: string;
  query: string;
  answer: string;
  requiredDepth: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

type EvidencePolicy = {
  id: string;
  label: string;
  detail: string;
  allowProposed: boolean;
  requireCitation: boolean;
  requireFreshCitation: boolean;
  requireAccessibleCitation: boolean;
};

type EvidencePathData = {
  title: string;
  description: string;
  defaults: {
    questionId: string;
    policyId: string;
    depth: number;
  };
  policies: EvidencePolicy[];
  questions: Question[];
};

type EdgeEvaluation = {
  edge: GraphEdge;
  withinDepth: boolean;
  eligible: boolean;
  reasons: string[];
  visibleCitations: Citation[];
};

const BLOCK_ID = 'genai/knowledge-graphs-evidence-path-lab';

const isNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

function isEvidencePathData(value: unknown): value is EvidencePathData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EvidencePathData>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.questionId
      && candidate.defaults.policyId
      && isNumber(candidate.defaults.depth)
      && Array.isArray(candidate.policies)
      && candidate.policies.length > 0
      && candidate.policies.every((policy) => (
        typeof policy.id === 'string'
        && typeof policy.label === 'string'
        && typeof policy.detail === 'string'
        && typeof policy.allowProposed === 'boolean'
        && typeof policy.requireCitation === 'boolean'
        && typeof policy.requireFreshCitation === 'boolean'
        && typeof policy.requireAccessibleCitation === 'boolean'
      ))
      && Array.isArray(candidate.questions)
      && candidate.questions.length > 0
      && candidate.questions.every((question) => (
        typeof question.id === 'string'
        && typeof question.label === 'string'
        && typeof question.detail === 'string'
        && typeof question.query === 'string'
        && typeof question.answer === 'string'
        && isNumber(question.requiredDepth)
        && Array.isArray(question.nodes)
        && question.nodes.length > 0
        && question.nodes.every((node) => (
          typeof node.id === 'string'
          && typeof node.label === 'string'
          && typeof node.kind === 'string'
          && isNumber(node.hop)
        ))
        && Array.isArray(question.edges)
        && question.edges.length > 0
        && question.edges.every((edge) => (
          typeof edge.id === 'string'
          && typeof edge.from === 'string'
          && typeof edge.to === 'string'
          && typeof edge.label === 'string'
          && isNumber(edge.hop)
          && (edge.status === 'verified' || edge.status === 'proposed')
          && Array.isArray(edge.citations)
          && edge.citations.every((citation) => (
            typeof citation.id === 'string'
            && typeof citation.label === 'string'
            && typeof citation.accessible === 'boolean'
            && typeof citation.fresh === 'boolean'
          ))
        ))
      )),
  );
}

export default function KnowledgeGraphsEvidencePathLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<EvidencePathData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No evidence-path model was supplied.');
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
        if (!isEvidencePathData(payload)) throw new Error('Evidence-path data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load evidence-path data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <EvidencePathLab data={data} />;
}

function EvidencePathLab({ data }: { data: EvidencePathData }) {
  const initialQuestion = data.questions.find((item) => item.id === data.defaults.questionId)
    ?? data.questions[0];
  const initialPolicy = data.policies.find((item) => item.id === data.defaults.policyId)
    ?? data.policies[0];
  const maxDepth = Math.max(...data.questions.flatMap((question) => question.edges.map((edge) => edge.hop)));

  const [questionId, setQuestionId] = useState(initialQuestion.id);
  const [policyId, setPolicyId] = useState(initialPolicy.id);
  const [depth, setDepth] = useState(data.defaults.depth);

  const question = data.questions.find((item) => item.id === questionId) ?? data.questions[0];
  const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];

  const result = useMemo(() => {
    const evaluations: EdgeEvaluation[] = question.edges.map((edge) => {
      const withinDepth = edge.hop <= depth;
      const visibleCitations = edge.citations.filter((citation) => citation.accessible);
      const reasons: string[] = [];

      if (!withinDepth) reasons.push(`hop ${edge.hop} is outside the ${depth}-hop budget`);
      if (edge.status === 'proposed' && !policy.allowProposed) reasons.push('the edge is proposed, not verified');
      if (policy.requireCitation && edge.citations.length === 0) reasons.push('the edge has no citation');
      if (policy.requireAccessibleCitation && visibleCitations.length === 0) reasons.push('the citation is not accessible');
      if (
        policy.requireFreshCitation
        && !visibleCitations.some((citation) => citation.fresh)
      ) {
        reasons.push('no fresh, accessible citation supports the edge');
      }

      return {
        edge,
        withinDepth,
        eligible: reasons.length === 0,
        reasons,
        visibleCitations,
      };
    });

    const required = evaluations.filter((item) => item.edge.hop <= question.requiredDepth);
    const acceptedRequired = required.filter((item) => item.eligible);
    const complete = acceptedRequired.length === required.length && depth >= question.requiredDepth;
    const evidenceCoverage = required.length === 0 ? 0 : acceptedRequired.length / required.length * 100;
    const permissionLeak = complete && required.some((item) => (
      item.edge.citations.some((citation) => !citation.accessible)
      && !policy.requireAccessibleCitation
    ));
    const citationIds = new Set(
      acceptedRequired.flatMap((item) => item.visibleCitations.map((citation) => citation.id)),
    );
    const blockedReasons = Array.from(new Set(
      required.flatMap((item) => item.reasons),
    ));

    const state = permissionLeak
      ? {
          label: 'The path resolves, but the answer crosses an access boundary',
          detail: `Unsafe candidate answer: ${question.answer}`,
          tone: 'rose' as const,
          icon: LockKeyhole,
        }
      : complete
        ? {
            label: 'The evidence policy supports an answer',
            detail: question.answer,
            tone: 'emerald' as const,
            icon: CheckCircle2,
          }
        : depth < question.requiredDepth
          ? {
              label: 'Abstain: the traversal does not reach the answer',
              detail: `This question needs ${question.requiredDepth} hops, but the current budget permits ${depth}.`,
              tone: 'amber' as const,
              icon: Route,
            }
          : {
              label: 'Abstain: at least one claim fails the evidence policy',
              detail: blockedReasons[0] ?? 'No complete supported path remains.',
              tone: 'rose' as const,
              icon: CircleX,
            };

    return {
      blockedReasons,
      citationCount: citationIds.size,
      complete,
      evidenceCoverage,
      evaluations,
      permissionLeak,
      state,
    };
  }, [depth, policy, question]);

  function chooseQuestion(nextQuestion: Question) {
    setQuestionId(nextQuestion.id);
    setDepth(Math.min(data.defaults.depth, Math.max(1, nextQuestion.requiredDepth)));
  }

  function reset() {
    setQuestionId(initialQuestion.id);
    setPolicyId(initialPolicy.id);
    setDepth(data.defaults.depth);
  }

  const StateIcon = result.state.icon;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Graph retrieval lab"
          title={data.title}
          description={data.description}
          icon={Route}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Question
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.questions.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === question.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Search}
                      accent="blue"
                      onClick={() => chooseQuestion(item)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="2. Traversal depth"
                value={depth}
                output={`${depth} hop${depth === 1 ? '' : 's'}`}
                min={1}
                max={maxDepth}
                step={1}
                accent="violet"
                lowLabel="Direct neighbors"
                highLabel="Deeper path"
                onChange={setDepth}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Evidence policy
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.policies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === policy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'graph-state' ? Network : item.id === 'release-grade' ? ShieldCheck : BookOpenCheck}
                      accent={item.id === 'graph-state' ? 'violet' : item.id === 'release-grade' ? 'emerald' : 'cyan'}
                      onClick={() => setPolicyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Question</p>
              <p className="mt-2 text-lg font-semibold leading-7 text-neutral-950 dark:text-white">{question.query}</p>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                Required path depth: {question.requiredDepth} hops
              </p>
            </section>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Path coverage"
                value={`${result.evidenceCoverage.toFixed(0)}%`}
                detail="Required edges surviving depth and evidence gates"
                icon={Route}
                tone={result.evidenceCoverage === 100 ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Visible citations"
                value={String(result.citationCount)}
                detail="Distinct accessible sources on the accepted path"
                icon={FileCheck2}
                tone={result.citationCount > 0 ? 'cyan' : 'neutral'}
              />
              <LabMetric
                label="Claim state"
                value={result.complete ? 'Complete' : 'Blocked'}
                detail={`${question.requiredDepth}-hop answer contract`}
                icon={Link2}
                tone={result.complete ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Access boundary"
                value={result.permissionLeak ? 'Crossed' : 'Preserved'}
                detail="Restricted evidence must not leak through graph context"
                icon={result.permissionLeak ? EyeOff : LockKeyhole}
                tone={result.permissionLeak ? 'rose' : 'blue'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Observable evidence path
                  </p>
                  <h4 className="mt-1 font-semibold text-neutral-950 dark:text-white">
                    Each relationship must survive independently
                  </h4>
                </div>
                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                  {policy.label}
                </p>
              </div>

              <ol className="mt-5 flex min-w-0 flex-col gap-3 xl:flex-row xl:items-stretch">
                {question.nodes.map((node, index) => {
                  const incoming = index === 0
                    ? null
                    : result.evaluations.find((item) => item.edge.to === node.id) ?? null;
                  const active = node.hop === 0 || Boolean(incoming?.withinDepth);
                  const accepted = node.hop === 0 || Boolean(incoming?.eligible);

                  return (
                    <li key={node.id} className="contents">
                      {incoming ? <PathConnector evaluation={incoming} /> : null}
                      <div className={`min-w-0 flex-1 rounded-md border p-4 ${
                        !active
                          ? 'border-neutral-200 bg-neutral-50 opacity-50 dark:border-neutral-800 dark:bg-neutral-900'
                          : accepted
                            ? 'border-cyan-300 bg-cyan-50 dark:border-cyan-900 dark:bg-cyan-950/30'
                            : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                      }`}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                            {node.kind}
                          </span>
                          <span className="text-xs font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">
                            Hop {node.hop}
                          </span>
                        </div>
                        <p className="mt-2 font-semibold text-neutral-950 dark:text-white">{node.label}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-center gap-2">
                <BookOpenCheck aria-hidden="true" className="h-5 w-5 text-cyan-700 dark:text-cyan-300" />
                <h4 className="font-semibold text-neutral-950 dark:text-white">Evidence inspection</h4>
              </div>
              <ul className="mt-4 grid gap-3 md:grid-cols-2">
                {result.evaluations
                  .filter((item) => item.edge.hop <= question.requiredDepth)
                  .map((item) => (
                    <li key={item.edge.id} className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-950">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-neutral-950 dark:text-white">{item.edge.label}</p>
                          <p className="mt-1 text-xs uppercase text-neutral-500 dark:text-neutral-400">{item.edge.status} edge</p>
                        </div>
                        {item.eligible ? (
                          <CheckCircle2 aria-label="Accepted" className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <CircleX aria-label="Rejected" className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
                        )}
                      </div>
                      <ul className="mt-3 space-y-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                        {item.edge.citations.map((citation) => (
                          <li key={citation.id} className="flex items-start gap-2">
                            {citation.accessible ? (
                              citation.fresh ? <FileCheck2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <Clock3 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            ) : (
                              <LockKeyhole aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                            )}
                            <span>{citation.label}: {citation.accessible ? citation.fresh ? 'accessible and current' : 'accessible but stale' : 'restricted'}</span>
                          </li>
                        ))}
                      </ul>
                      {item.reasons.length > 0 ? (
                        <p className="mt-3 text-xs font-medium leading-5 text-rose-700 dark:text-rose-300">
                          Blocked because {item.reasons.join('; ')}.
                        </p>
                      ) : null}
                    </li>
                  ))}
              </ul>
            </section>

            <section className={`rounded-md border p-4 ${
              result.state.tone === 'emerald'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
                : result.state.tone === 'amber'
                  ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
            }`}>
              <div className="flex items-start gap-3">
                <StateIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <h4 className="font-semibold">{result.state.label}</h4>
                  <p className="mt-1 text-sm leading-6 opacity-90">{result.state.detail}</p>
                  {result.blockedReasons.length > 1 ? (
                    <p className="mt-2 text-sm font-medium">Also blocked by: {result.blockedReasons.slice(1).join('; ')}.</p>
                  ) : null}
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function PathConnector({ evaluation }: { evaluation: EdgeEvaluation }) {
  return (
    <div className={`flex shrink-0 items-center justify-center gap-2 px-1 py-1 text-xs font-semibold xl:w-24 xl:flex-col ${
      !evaluation.withinDepth
        ? 'text-neutral-400'
        : evaluation.eligible
          ? 'text-cyan-700 dark:text-cyan-300'
          : 'text-rose-700 dark:text-rose-300'
    }`}>
      <span className={`h-6 w-0.5 xl:h-0.5 xl:w-full ${
        !evaluation.withinDepth
          ? 'bg-neutral-300 dark:bg-neutral-700'
          : evaluation.eligible
            ? 'bg-cyan-500'
            : 'bg-rose-500'
      }`} aria-hidden="true" />
      <span className="text-center">{evaluation.edge.label}</span>
    </div>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="flex min-h-72 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
        Loading evidence-path model...
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
          <p className="font-semibold">Evidence-path lab unavailable</p>
          <p className="mt-1 opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
