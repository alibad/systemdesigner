'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Ban,
  CheckCircle2,
  CircleAlert,
  Crosshair,
  Eye,
  FileWarning,
  GitBranch,
  ScanSearch,
  Sparkles,
  Target,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'genai/advanced-image-captioning';

type DecodeMode = 'greedy' | 'beam' | 'nucleus';

type Scene = {
  label: string;
  summary: string;
  salientEvidenceIds: string[];
};

type Evidence = {
  id: string;
  label: string;
  source: string;
  confidence: number;
  detail: string;
};

type Constraint = {
  id: string;
  label: string;
  detail: string;
  requiredEvidenceId: string | null;
};

type CandidateClaim = {
  phrase: string;
  evidenceId: string;
};

type Candidate = {
  id: string;
  caption: string;
  decoderConfidence: number;
  probabilityMass: number;
  claims: CandidateClaim[];
};

type DecodingData = {
  title: string;
  description: string;
  evidenceNote: string;
  defaultMode: DecodeMode;
  defaultBeamWidth: number;
  defaultTopP: number;
  defaultSampleIndex: number;
  defaultConstraintId: string;
  defaultEvidenceThreshold: number;
  scene: Scene;
  evidence: Evidence[];
  constraints: Constraint[];
  candidates: Candidate[];
};

const modeOptions: Array<{
  id: DecodeMode;
  label: string;
  detail: string;
}> = [
  {
    id: 'greedy',
    label: 'Greedy',
    detail: 'Keep the single highest decoder preference.',
  },
  {
    id: 'beam',
    label: 'Beam + reranker',
    detail: 'Expose several likely candidates to a synthetic task reranker.',
  },
  {
    id: 'nucleus',
    label: 'Nucleus sample',
    detail: 'Draw from candidates inside a bounded cumulative mass.',
  },
];

function isDecodingData(value: unknown): value is DecodingData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DecodingData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.evidenceNote
      && ['greedy', 'beam', 'nucleus'].includes(candidate.defaultMode ?? '')
      && typeof candidate.defaultBeamWidth === 'number'
      && typeof candidate.defaultTopP === 'number'
      && typeof candidate.defaultSampleIndex === 'number'
      && typeof candidate.defaultEvidenceThreshold === 'number'
      && candidate.scene
      && Array.isArray(candidate.scene.salientEvidenceIds)
      && Array.isArray(candidate.evidence)
      && candidate.evidence.length > 0
      && candidate.evidence.every((item) => (
        Boolean(item.id && item.label && item.source)
          && item.confidence >= 0
          && item.confidence <= 1
      ))
      && Array.isArray(candidate.constraints)
      && candidate.constraints.length > 0
      && Array.isArray(candidate.candidates)
      && candidate.candidates.length > 0
      && candidate.candidates.every((item) => (
        Boolean(item.id && item.caption)
          && item.decoderConfidence >= 0
          && item.decoderConfidence <= 1
          && item.probabilityMass >= 0
          && Array.isArray(item.claims)
          && item.claims.length > 0
      )),
  );
}

function percent(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

function groundingPotential(
  candidate: Candidate,
  evidenceById: Map<string, Evidence>,
  salientEvidenceIds: string[],
) {
  const supported = candidate.claims
    .map((claim) => evidenceById.get(claim.evidenceId)?.confidence ?? 0);
  const averageEvidence = supported.reduce((sum, value) => sum + value, 0) / supported.length;
  const mentioned = new Set(candidate.claims.map((claim) => claim.evidenceId));
  const coverage = salientEvidenceIds.filter((id) => mentioned.has(id)).length
    / Math.max(1, salientEvidenceIds.length);

  return averageEvidence * 0.55 + coverage * 0.45;
}

export default function CaptionDecodingGroundingLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<DecodingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No decoding evidence was supplied.');
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
        if (!isDecodingData(payload)) {
          throw new Error('Decoding evidence is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load decoding evidence.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (error) {
    return (
      <LoadState
        error={error}
        onRetry={() => setReloadKey((key) => key + 1)}
        title="Decoding lab unavailable"
      />
    );
  }

  if (!data) {
    return <LoadState error={null} onRetry={() => undefined} title="Loading decoding evidence" />;
  }

  return <DecodingLab data={data} />;
}

function DecodingLab({ data }: { data: DecodingData }) {
  const defaultConstraint = data.constraints.find(
    (constraint) => constraint.id === data.defaultConstraintId,
  ) ?? data.constraints[0];
  const [mode, setMode] = useState<DecodeMode>(data.defaultMode);
  const [beamWidth, setBeamWidth] = useState(data.defaultBeamWidth);
  const [topP, setTopP] = useState(Math.round(data.defaultTopP * 100));
  const [sampleIndex, setSampleIndex] = useState(data.defaultSampleIndex);
  const [constraintId, setConstraintId] = useState(defaultConstraint.id);
  const [evidenceThreshold, setEvidenceThreshold] = useState(
    Math.round(data.defaultEvidenceThreshold * 100),
  );

  const result = useMemo(() => {
    const evidenceById = new Map(data.evidence.map((item) => [item.id, item]));
    const constraint = data.constraints.find((item) => item.id === constraintId)
      ?? data.constraints[0];
    const eligible = data.candidates
      .filter((candidate) => (
        !constraint.requiredEvidenceId
          || candidate.claims.some((claim) => claim.evidenceId === constraint.requiredEvidenceId)
      ))
      .sort((left, right) => right.decoderConfidence - left.decoderConfidence);

    let pool: Candidate[];
    if (mode === 'greedy') {
      pool = eligible.slice(0, 1);
    } else if (mode === 'beam') {
      pool = eligible.slice(0, Math.max(1, beamWidth));
    } else {
      pool = [];
      let cumulativeMass = 0;
      for (const candidate of eligible) {
        pool.push(candidate);
        cumulativeMass += candidate.probabilityMass;
        if (cumulativeMass >= topP / 100) break;
      }
    }

    let selected: Candidate | undefined;
    if (mode === 'beam') {
      selected = [...pool].sort((left, right) => (
        groundingPotential(right, evidenceById, data.scene.salientEvidenceIds)
        - groundingPotential(left, evidenceById, data.scene.salientEvidenceIds)
      ))[0];
    } else if (mode === 'nucleus') {
      selected = pool.length > 0 ? pool[(sampleIndex - 1) % pool.length] : undefined;
    } else {
      selected = pool[0];
    }

    if (!selected) {
      return {
        assessedClaims: [],
        constraint,
        coverage: 0,
        pool,
        selected: null,
        status: 'blocked' as const,
        statusDetail: 'No candidate satisfies the selected lexical constraint.',
        weakestEvidence: 0,
      };
    }

    const assessedClaims = selected.claims.map((claim) => {
      const evidence = evidenceById.get(claim.evidenceId);
      const passed = Boolean(evidence && evidence.confidence * 100 >= evidenceThreshold);
      return { claim, evidence, passed };
    });
    const mentioned = new Set(selected.claims.map((claim) => claim.evidenceId));
    const coverage = data.scene.salientEvidenceIds.filter((id) => mentioned.has(id)).length
      / Math.max(1, data.scene.salientEvidenceIds.length);
    const weakestEvidence = Math.min(
      ...assessedClaims.map((item) => item.evidence?.confidence ?? 0),
    );
    const blockedClaims = assessedClaims.filter((item) => !item.passed);
    const status = blockedClaims.length > 0
      ? 'blocked' as const
      : coverage < 0.75
        ? 'review' as const
        : 'ready' as const;
    const statusDetail = blockedClaims.length > 0
      ? `${blockedClaims.length} claim${blockedClaims.length === 1 ? '' : 's'} fall below the evidence threshold.`
      : coverage < 0.75
        ? 'All stated claims pass, but the caption covers fewer than three quarters of salient facts.'
        : 'Every claim passes the selected evidence threshold and salient coverage is sufficient.';

    return {
      assessedClaims,
      constraint,
      coverage,
      pool,
      selected,
      status,
      statusDetail,
      weakestEvidence,
    };
  }, [
    beamWidth,
    constraintId,
    data,
    evidenceThreshold,
    mode,
    sampleIndex,
    topP,
  ]);

  function reset() {
    setMode(data.defaultMode);
    setBeamWidth(data.defaultBeamWidth);
    setTopP(Math.round(data.defaultTopP * 100));
    setSampleIndex(data.defaultSampleIndex);
    setConstraintId(defaultConstraint.id);
    setEvidenceThreshold(Math.round(data.defaultEvidenceThreshold * 100));
  }

  const statusStyles = {
    ready: {
      icon: CheckCircle2,
      label: 'Ready to release',
      panel: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-50',
    },
    review: {
      icon: CircleAlert,
      label: 'Review for coverage',
      panel: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-50',
    },
    blocked: {
      icon: Ban,
      label: 'Block the caption',
      panel: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-50',
    },
  }[result.status];
  const StatusIcon = statusStyles.icon;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Decoding and grounding lab"
          title={data.title}
          description={data.description}
          icon={GitBranch}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose a decoding strategy
                </legend>
                <div className="mt-3 space-y-2">
                  {modeOptions.map((option) => (
                    <LabChoice
                      key={option.id}
                      selected={mode === option.id}
                      label={option.label}
                      detail={option.detail}
                      icon={option.id === 'nucleus' ? Sparkles : GitBranch}
                      accent="violet"
                      onClick={() => setMode(option.id)}
                    />
                  ))}
                </div>
              </fieldset>

              {mode === 'beam' ? (
                <LabRange
                  label="Beam width"
                  value={beamWidth}
                  output={`${beamWidth} candidate${beamWidth === 1 ? '' : 's'}`}
                  min={1}
                  max={data.candidates.length}
                  step={1}
                  lowLabel="Narrow"
                  highLabel="More decoder work"
                  accent="blue"
                  onChange={setBeamWidth}
                />
              ) : null}

              {mode === 'nucleus' ? (
                <div className="space-y-6">
                  <LabRange
                    label="Cumulative mass (top-p)"
                    value={topP}
                    output={`${topP}%`}
                    min={30}
                    max={100}
                    step={1}
                    lowLabel="Concentrated"
                    highLabel="Broader pool"
                    accent="violet"
                    onChange={setTopP}
                  />
                  <LabRange
                    label="Deterministic sample draw"
                    value={sampleIndex}
                    output={`Draw ${sampleIndex}`}
                    min={1}
                    max={5}
                    step={1}
                    lowLabel="1"
                    highLabel="5"
                    accent="cyan"
                    onChange={setSampleIndex}
                  />
                </div>
              ) : null}

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Apply a lexical constraint
                </legend>
                <div className="mt-3 space-y-2">
                  {data.constraints.map((constraint) => (
                    <LabChoice
                      key={constraint.id}
                      selected={constraintId === constraint.id}
                      label={constraint.label}
                      detail={constraint.detail}
                      icon={Crosshair}
                      accent={constraint.id === 'none' ? 'cyan' : 'amber'}
                      onClick={() => setConstraintId(constraint.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Minimum claim evidence"
                value={evidenceThreshold}
                output={`${evidenceThreshold}%`}
                min={10}
                max={95}
                step={1}
                lowLabel="Permissive"
                highLabel="Strict"
                accent="emerald"
                onChange={setEvidenceThreshold}
              />
            </div>
          )}
        >
          <div className="rounded-md border border-neutral-200 bg-neutral-950 p-4 text-white dark:border-neutral-800">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-cyan-300">
              <Eye aria-hidden="true" className="h-4 w-4" />
              {data.scene.label}
            </div>
            <p className="mt-3 text-sm leading-6 text-neutral-300">{data.scene.summary}</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Decoder preference"
              value={result.selected ? percent(result.selected.decoderConfidence) : 'None'}
              detail="Synthetic sequence preference, not factual confidence"
              icon={Sparkles}
              tone="violet"
            />
            <LabMetric
              label="Weakest claim evidence"
              value={result.selected ? percent(result.weakestEvidence) : 'None'}
              detail={`Compared with a ${evidenceThreshold}% release threshold`}
              icon={ScanSearch}
              tone={result.status === 'blocked' ? 'rose' : 'cyan'}
            />
            <LabMetric
              label="Salient coverage"
              value={percent(result.coverage)}
              detail={`${Math.round(result.coverage * data.scene.salientEvidenceIds.length)}/${data.scene.salientEvidenceIds.length} required scene facts`}
              icon={Target}
              tone={result.coverage >= 0.75 ? 'emerald' : 'amber'}
            />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
            <div className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/45">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Selected caption
                </p>
                <span className="text-xs text-neutral-500">
                  {result.pool.length} in candidate pool
                </span>
              </div>
              <output className="mt-3 block text-lg font-semibold leading-7 text-neutral-950 dark:text-white">
                {result.selected?.caption ?? 'No candidate satisfies this constraint.'}
              </output>
              <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                {mode === 'beam'
                  ? 'The synthetic reranker favors supported salient detail inside the beam.'
                  : mode === 'nucleus'
                    ? 'The sample draw selects one candidate from the bounded cumulative-mass pool.'
                    : 'Greedy keeps the strongest decoder preference without comparing complete alternatives.'}
              </p>
            </div>

            <div className={`rounded-md border p-4 ${statusStyles.panel}`}>
              <StatusIcon aria-hidden="true" className="h-5 w-5" />
              <p className="mt-3 text-xs font-semibold uppercase opacity-70">Release verdict</p>
              <p className="mt-1 text-lg font-bold">{statusStyles.label}</p>
              <p className="mt-2 text-xs leading-5 opacity-80">{result.statusDetail}</p>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center gap-2">
              <ScanSearch aria-hidden="true" className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                Claim-to-evidence trace
              </p>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {result.assessedClaims.map(({ claim, evidence, passed }) => (
                <div
                  key={`${claim.phrase}-${claim.evidenceId}`}
                  className={`rounded-md border p-3 ${
                    passed
                      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                      : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                        {claim.phrase}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                        {evidence?.source ?? 'Missing evidence'} · {evidence?.detail ?? 'No record'}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-sm font-bold tabular-nums ${
                        passed
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      {evidence ? percent(evidence.confidence) : '0%'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-100">
            <BadgeCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm leading-6">{data.evidenceNote}</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LoadState({
  error,
  onRetry,
  title,
}: {
  error: string | null;
  onRetry: () => void;
  title: string;
}) {
  return (
    <div data-content-block={BLOCK_ID}>
      <div
        className={`not-prose my-7 min-h-48 rounded-md border p-5 ${
          error
            ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
            : 'border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200'
        }`}
        role={error ? 'alert' : 'status'}
      >
        {error ? <FileWarning aria-hidden="true" className="h-5 w-5" /> : null}
        <p className="mt-3 font-semibold">{title}</p>
        <p className="mt-2 text-sm opacity-80">
          {error ?? 'Preparing the finite candidate and evidence records.'}
        </p>
        {error ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}
