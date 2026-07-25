'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CircleAlert,
  CircleX,
  Clock3,
  Eye,
  FileSearch,
  Gauge,
  ScanSearch,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Evidence = {
  id: string;
  label: string;
  source: 'region' | 'ocr' | 'layout';
  confidence: number;
};

type Claim = {
  text: string;
  evidenceIds: string[];
  confidence: number;
  supported: boolean;
};

type CaptionCandidate = {
  id: string;
  caption: string;
  languageScore: number;
  discoveryBeam: number;
  greedyChoice: boolean;
  claims: Claim[];
};

type Scene = {
  id: string;
  label: string;
  brief: string;
  useCase: string;
  encoderMs: number;
  evidence: Evidence[];
  candidates: CaptionCandidate[];
};

type Strategy = {
  id: string;
  label: string;
  detail: string;
  kind: 'greedy' | 'beam' | 'grounded';
  baseDecoderMs: number;
  perBeamMs: number;
  groundingWeight: number;
  enforceGrounding: boolean;
};

type DecodingData = {
  title: string;
  description: string;
  defaults: {
    sceneId: string;
    strategyId: string;
    beamWidth: number;
    groundingFloor: number;
  };
  strategies: Strategy[];
  scenes: Scene[];
};

const BLOCK_ID = 'genai/image-captioning-decoding-grounding-lab';

function isDecodingData(value: unknown): value is DecodingData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DecodingData>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.sceneId
      && candidate.defaults.strategyId
      && typeof candidate.defaults.beamWidth === 'number'
      && typeof candidate.defaults.groundingFloor === 'number'
      && Array.isArray(candidate.strategies)
      && candidate.strategies.length >= 3
      && Array.isArray(candidate.scenes)
      && candidate.scenes.length > 0
      && candidate.scenes.every((scene) => (
        Array.isArray(scene.evidence)
          && scene.evidence.length > 0
          && Array.isArray(scene.candidates)
          && scene.candidates.length > 0
          && scene.candidates.every((caption) => Array.isArray(caption.claims))
      )),
  );
}

function groundingScore(candidate: CaptionCandidate) {
  if (candidate.claims.length === 0) return 0;
  const total = candidate.claims.reduce(
    (sum, claim) => sum + (claim.supported ? claim.confidence : 0),
    0,
  );
  return Math.round(total / candidate.claims.length);
}

export default function ImageCaptioningDecodingGroundingLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<DecodingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No decoding scenarios were supplied.');
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
        if (!isDecodingData(payload)) throw new Error('Decoding scenario data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load decoding data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {error ? (
        <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
      ) : data ? (
        <DecodingLab data={data} />
      ) : (
        <LoadState error={null} onRetry={() => setReloadKey((key) => key + 1)} />
      )}
    </div>
  );
}

function DecodingLab({ data }: { data: DecodingData }) {
  const initialScene = data.scenes.find((item) => item.id === data.defaults.sceneId)
    ?? data.scenes[0];
  const initialStrategy = data.strategies.find((item) => item.id === data.defaults.strategyId)
    ?? data.strategies[0];
  const [sceneId, setSceneId] = useState(initialScene.id);
  const [strategyId, setStrategyId] = useState(initialStrategy.id);
  const [beamWidth, setBeamWidth] = useState(data.defaults.beamWidth);
  const [groundingFloor, setGroundingFloor] = useState(data.defaults.groundingFloor);

  const scene = data.scenes.find((item) => item.id === sceneId) ?? data.scenes[0];
  const strategy = data.strategies.find((item) => item.id === strategyId) ?? data.strategies[0];

  const result = useMemo(() => {
    const effectiveBeam = strategy.kind === 'greedy' ? 1 : beamWidth;
    const discovered = scene.candidates.filter(
      (candidate) => candidate.discoveryBeam <= effectiveBeam,
    );
    const eligible = strategy.enforceGrounding
      ? discovered.filter((candidate) => candidate.claims.every(
        (claim) => claim.supported && claim.confidence >= groundingFloor,
      ))
      : discovered;

    const selected = strategy.kind === 'greedy'
      ? scene.candidates.find((candidate) => candidate.greedyChoice) ?? scene.candidates[0]
      : [...eligible].sort((left, right) => {
        const leftScore = strategy.enforceGrounding
          ? left.languageScore * (1 - strategy.groundingWeight)
            + (groundingScore(left) / 100) * strategy.groundingWeight
          : left.languageScore;
        const rightScore = strategy.enforceGrounding
          ? right.languageScore * (1 - strategy.groundingWeight)
            + (groundingScore(right) / 100) * strategy.groundingWeight
          : right.languageScore;
        return rightScore - leftScore;
      })[0];

    const unsupportedClaims = selected?.claims.filter((claim) => !claim.supported).length ?? 0;
    const weakClaims = selected?.claims.filter(
      (claim) => claim.supported && claim.confidence < groundingFloor,
    ).length ?? 0;
    const selectedGrounding = selected ? groundingScore(selected) : 0;
    const release = Boolean(selected && unsupportedClaims === 0 && weakClaims === 0);
    const latencyMs = scene.encoderMs
      + strategy.baseDecoderMs
      + Math.max(0, effectiveBeam - 1) * strategy.perBeamMs;
    const reason = !selected
      ? 'Abstain: no discovered candidate meets every claim-evidence requirement.'
      : unsupportedClaims > 0
        ? `Hold: ${unsupportedClaims} claim${unsupportedClaims === 1 ? '' : 's'} lack visual or OCR support.`
        : weakClaims > 0
          ? `Hold: ${weakClaims} supported claim${weakClaims === 1 ? '' : 's'} fall below the ${groundingFloor}% evidence floor.`
          : 'Eligible: every generated claim maps to evidence above the selected floor.';

    return {
      discovered,
      effectiveBeam,
      eligible,
      latencyMs,
      reason,
      release,
      selected,
      selectedGrounding,
      unsupportedClaims,
      weakClaims,
    };
  }, [beamWidth, groundingFloor, scene, strategy]);

  function reset() {
    setSceneId(initialScene.id);
    setStrategyId(initialStrategy.id);
    setBeamWidth(data.defaults.beamWidth);
    setGroundingFloor(data.defaults.groundingFloor);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Decoding and grounding lab"
        title={data.title}
        description={data.description}
        icon={ScanSearch}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Choose an evidence set
              </legend>
              <div className="mt-3 space-y-2">
                {data.scenes.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scene.id}
                    label={item.label}
                    detail={item.useCase}
                    icon={Eye}
                    accent="blue"
                    onClick={() => setSceneId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Select a decoder
              </legend>
              <div className="mt-3 space-y-2">
                {data.strategies.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === strategy.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.enforceGrounding ? ShieldCheck : Search}
                    accent={item.enforceGrounding ? 'emerald' : 'violet'}
                    onClick={() => setStrategyId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            {strategy.kind !== 'greedy' ? (
              <LabRange
                label="Beam width"
                value={beamWidth}
                output={`${beamWidth} paths`}
                min={2}
                max={4}
                step={1}
                lowLabel="Less search"
                highLabel="More decoder work"
                accent="violet"
                onChange={setBeamWidth}
              />
            ) : null}

            <LabRange
              label="Claim evidence floor"
              value={groundingFloor}
              output={`${groundingFloor}%`}
              min={50}
              max={95}
              step={5}
              lowLabel="More coverage"
              highLabel="More abstention"
              accent="cyan"
              onChange={setGroundingFloor}
            />
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-live="polite">
          <LabMetric
            label="Candidates found"
            value={`${result.discovered.length} / ${scene.candidates.length}`}
            detail={`${result.eligible.length} remain after decoder constraints`}
            icon={Search}
            tone="violet"
          />
          <LabMetric
            label="Grounding score"
            value={result.selected ? `${result.selectedGrounding}%` : 'No output'}
            detail="Unsupported claims contribute zero"
            icon={Gauge}
            tone={result.selectedGrounding >= groundingFloor ? 'cyan' : 'rose'}
          />
          <LabMetric
            label="Modeled latency"
            value={`${result.latencyMs} ms`}
            detail={`${scene.encoderMs} ms is encoder time`}
            icon={Clock3}
            tone="blue"
          />
          <LabMetric
            label="Claim gate"
            value={result.release ? 'Eligible' : result.selected ? 'Hold' : 'Abstain'}
            detail={`${result.unsupportedClaims} unsupported, ${result.weakClaims} weak`}
            icon={result.release ? BadgeCheck : CircleAlert}
            tone={result.release ? 'emerald' : 'rose'}
          />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Observed evidence
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
              {scene.brief}
            </p>
            <ul className="mt-4 space-y-2">
              {scene.evidence.map((item) => (
                <li
                  key={item.id}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950"
                >
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-semibold text-neutral-950 dark:text-white">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs uppercase text-neutral-500 dark:text-neutral-400">
                      {item.source} evidence
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                    {item.confidence}%
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section
            className={`min-w-0 rounded-md border p-5 ${
              result.release
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30'
            }`}
          >
            <div className="flex items-start gap-3">
              {result.release ? (
                <BadgeCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
              ) : (
                <CircleX aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                  Selected caption
                </p>
                <p className="mt-3 break-words text-lg font-semibold leading-8 text-neutral-950 dark:text-white">
                  {result.selected?.caption ?? 'No caption returned'}
                </p>
                <p className="mt-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  {result.reason}
                </p>
              </div>
            </div>

            {result.selected ? (
              <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                {result.selected.claims.map((claim) => (
                  <li
                    key={claim.text}
                    className={`rounded-md border p-3 ${
                      claim.supported && claim.confidence >= groundingFloor
                        ? 'border-emerald-200 bg-white text-emerald-950 dark:border-emerald-900 dark:bg-neutral-950 dark:text-emerald-100'
                        : 'border-rose-200 bg-white text-rose-950 dark:border-rose-900 dark:bg-neutral-950 dark:text-rose-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="break-words text-sm font-semibold">{claim.text}</span>
                      <span className="shrink-0 text-xs font-semibold tabular-nums">{claim.confidence}%</span>
                    </div>
                    <p className="mt-1 text-xs opacity-75">
                      {claim.supported ? `${claim.evidenceIds.length} evidence link${claim.evidenceIds.length === 1 ? '' : 's'}` : 'Unsupported inference'}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>

        <section className="mt-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            <Sparkles aria-hidden="true" className="h-4 w-4" />
            Candidate field
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {scene.candidates.map((candidate) => {
              const discovered = result.discovered.some((item) => item.id === candidate.id);
              const eligible = result.eligible.some((item) => item.id === candidate.id);
              const selected = result.selected?.id === candidate.id;
              const unsupported = candidate.claims.filter((claim) => !claim.supported).length;
              const status = selected
                ? 'Selected'
                : !discovered
                  ? `Needs beam ${candidate.discoveryBeam}`
                  : strategy.enforceGrounding && !eligible
                    ? 'Rejected by evidence'
                    : 'Available';

              return (
                <article
                  key={candidate.id}
                  className={`min-w-0 rounded-md border p-4 ${
                    selected
                      ? 'border-cyan-400 bg-cyan-50 ring-1 ring-cyan-400 dark:border-cyan-600 dark:bg-cyan-950/30'
                      : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                      {status}
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                      {(candidate.languageScore * 100).toFixed(0)} language
                    </span>
                  </div>
                  <p className="mt-3 break-words text-sm font-semibold leading-6 text-neutral-950 dark:text-white">
                    {candidate.caption}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-sm bg-neutral-100 px-2 py-1 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
                      {groundingScore(candidate)}% grounded
                    </span>
                    <span className={`rounded-sm px-2 py-1 ${
                      unsupported === 0
                        ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'
                        : 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100'
                    }`}>
                      {unsupported} unsupported
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </LearningLabBody>
    </LearningLab>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Decoding and grounding lab"
        title={error ? 'The caption evidence model could not load' : 'Loading caption candidates'}
        description={error ?? 'Preparing scenes, candidate paths, and claim evidence.'}
        icon={error ? CircleAlert : FileSearch}
        accent={error ? 'rose' : 'cyan'}
      />
      <LearningLabBody>
        <div className="flex min-h-32 items-center justify-center">
          {error ? (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-100"
            >
              Try again
            </button>
          ) : (
            <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400" role="status">
              <FileSearch aria-hidden="true" className="h-4 w-4" />
              Loading evidence...
            </div>
          )}
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
