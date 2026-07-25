'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Boxes,
  Camera,
  CheckCircle2,
  CircleAlert,
  Film,
  Focus,
  Layers3,
  Link,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
  UserRound,
  Users,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Strategy = {
  id: string;
  label: string;
  detail: string;
  baseTemporal: number;
  baseIdentity: number;
  baseSeamRisk: number;
  relativeCost: number;
  retryScope: string;
  lesson: string;
};

type Scene = {
  id: string;
  label: string;
  detail: string;
  temporalPenalty: number;
  identityPenalty: number;
  costMultiplier: number;
  subject: string;
};

type Incident = {
  id: string;
  label: string;
  detail: string;
  temporalPenalty: number;
  identityPenalty: number;
  seamPenalty: number;
};

type ContinuityData = {
  title: string;
  description: string;
  defaults: {
    strategyId: string;
    sceneId: string;
    incidentId: string;
    anchorSpacing: number;
  };
  strategies: Strategy[];
  scenes: Scene[];
  incidents: Incident[];
};

const BLOCK_ID = 'genai/video-generation-continuity-lab';

function isContinuityData(value: unknown): value is ContinuityData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ContinuityData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && Array.isArray(candidate.strategies)
      && candidate.strategies.length >= 2
      && candidate.strategies.every((item) => (
        typeof item.id === 'string'
        && typeof item.baseTemporal === 'number'
        && typeof item.baseIdentity === 'number'
        && typeof item.relativeCost === 'number'
      ))
      && Array.isArray(candidate.scenes)
      && candidate.scenes.length > 0
      && Array.isArray(candidate.incidents)
      && candidate.incidents.length > 0,
  );
}

export default function VideoGenerationContinuityLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ContinuityData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No continuity scenarios were supplied.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isContinuityData(payload)) {
          throw new Error('Continuity scenario data is incomplete.');
        }
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load continuity scenarios.');
      });

    return () => controller.abort();
  }, [dataFile]);

  return (
    <div data-content-block={BLOCK_ID}>
      {loadError ? <LoadError detail={loadError} /> : data ? <ContinuityLab data={data} /> : <LoadState />}
    </div>
  );
}

function ContinuityLab({ data }: { data: ContinuityData }) {
  const initialStrategy = data.strategies.find((item) => item.id === data.defaults.strategyId)
    ?? data.strategies[0];
  const initialScene = data.scenes.find((item) => item.id === data.defaults.sceneId)
    ?? data.scenes[0];
  const initialIncident = data.incidents.find((item) => item.id === data.defaults.incidentId)
    ?? data.incidents[0];
  const [strategyId, setStrategyId] = useState(initialStrategy.id);
  const [sceneId, setSceneId] = useState(initialScene.id);
  const [incidentId, setIncidentId] = useState(initialIncident.id);
  const [anchorSpacing, setAnchorSpacing] = useState(data.defaults.anchorSpacing);

  const strategy = data.strategies.find((item) => item.id === strategyId) ?? data.strategies[0];
  const scene = data.scenes.find((item) => item.id === sceneId) ?? data.scenes[0];
  const incident = data.incidents.find((item) => item.id === incidentId) ?? data.incidents[0];

  const result = useMemo(() => {
    const usesAnchors = strategy.id !== 'independent';
    const spacingPenalty = usesAnchors ? Math.max(0, anchorSpacing - 4) * 2.6 : 0;
    const tightAnchorGain = usesAnchors ? Math.max(0, 4 - anchorSpacing) * 1.4 : 0;
    const boundaryPenalty = usesAnchors ? Math.abs(anchorSpacing - 4) * 1.6 : 0;
    const temporal = clamp(
      strategy.baseTemporal
        - scene.temporalPenalty
        - incident.temporalPenalty
        - spacingPenalty
        + tightAnchorGain,
    );
    const identity = clamp(
      strategy.baseIdentity
        - scene.identityPenalty
        - incident.identityPenalty
        - spacingPenalty * 1.15
        + tightAnchorGain * 1.4,
    );
    const seamRisk = clamp(
      strategy.baseSeamRisk + incident.seamPenalty + scene.temporalPenalty * 0.35 + boundaryPenalty,
    );
    const relativeCost = strategy.relativeCost
      * scene.costMultiplier
      * (usesAnchors ? 1 + Math.max(0, 6 - anchorSpacing) * 0.035 : 1);

    let decision = 'Continue to sequence evaluation';
    let explanation = 'The modeled continuity evidence is strong enough for full quality and safety evaluation.';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';

    if (incident.id === 'unsafe-transition') {
      decision = 'Quarantine the complete sequence';
      explanation = 'A sequence-level policy failure blocks publication even when isolated thumbnails appear acceptable.';
      tone = 'rose';
    } else if (incident.id === 'worker-loss') {
      decision = strategy.id === 'independent'
        ? 'Restart with a temporal contract'
        : 'Retry the bounded window and overlap';
      explanation = strategy.retryScope;
      tone = 'amber';
    } else if (temporal < 75 || identity < 75 || seamRisk > 35) {
      decision = 'Regenerate before final encoding';
      explanation = identity < temporal
        ? 'Identity evidence is the weakest dimension. Add or tighten a reference anchor around the failed span.'
        : 'Temporal evidence or boundary quality is below the working floor. Reduce the retry scope and inspect the seam.';
      tone = 'amber';
    }

    return {
      decision,
      explanation,
      identity,
      relativeCost,
      seamRisk,
      temporal,
      tone,
    };
  }, [anchorSpacing, incident, scene, strategy]);

  const reset = () => {
    setStrategyId(initialStrategy.id);
    setSceneId(initialScene.id);
    setIncidentId(initialIncident.id);
    setAnchorSpacing(data.defaults.anchorSpacing);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Continuity lab"
        title={data.title}
        description={data.description}
        icon={Activity}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                1. Temporal strategy
              </legend>
              <div className="mt-3 grid gap-2">
                {data.strategies.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === strategy.id}
                    label={item.label}
                    detail={item.detail}
                    icon={strategyIcon(item.id)}
                    accent="violet"
                    onClick={() => setStrategyId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                2. Scene difficulty
              </legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                {data.scenes.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scene.id}
                    label={item.label}
                    detail={item.detail}
                    icon={sceneIcon(item.id)}
                    accent="cyan"
                    onClick={() => setSceneId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <div className={strategy.id === 'independent' ? 'opacity-55' : ''}>
              <LabRange
                label="Anchor spacing"
                value={anchorSpacing}
                output={`Every ${anchorSpacing}s`}
                min={2}
                max={10}
                step={1}
                accent="violet"
                lowLabel="More anchors"
                highLabel="More drift risk"
                onChange={setAnchorSpacing}
              />
              {strategy.id === 'independent' ? (
                <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                  Independent frames have no temporal anchors, so spacing does not improve their scores.
                </p>
              ) : null}
            </div>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                3. Inject an incident
              </legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {data.incidents.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === incident.id}
                    label={item.label}
                    detail={item.detail}
                    icon={incidentIcon(item.id)}
                    accent={item.id === 'unsafe-transition' ? 'rose' : 'amber'}
                    onClick={() => setIncidentId(item.id)}
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
              label="Temporal"
              value={`${result.temporal}/100`}
              detail="Motion and frame-to-frame coherence"
              icon={Activity}
              tone={scoreTone(result.temporal)}
            />
            <LabMetric
              label="Identity"
              value={`${result.identity}/100`}
              detail="Subject attributes across viewpoints"
              icon={UserRound}
              tone={scoreTone(result.identity)}
            />
            <LabMetric
              label="Seam risk"
              value={`${result.seamRisk}%`}
              detail="Boundary artifact likelihood"
              icon={Link}
              tone={riskTone(result.seamRisk)}
            />
            <LabMetric
              label="Relative compute"
              value={`${result.relativeCost.toFixed(2)}x`}
              detail="Compared with the overlap baseline"
              icon={Boxes}
              tone="neutral"
            />
          </div>

          <section aria-labelledby="continuity-timeline-title">
            <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
              Modeled timeline
            </p>
            <h4 id="continuity-timeline-title" className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
              {scene.subject} through six checkpoints
            </h4>
            <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
              Position changes are intentional motion. Label and border changes expose drift, worker loss, or a blocked transition.
            </p>

            <div
              className="mt-4 grid min-w-0 grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6"
              role="img"
              aria-label={`Six timeline checkpoints for ${scene.subject}; temporal score ${result.temporal}, identity score ${result.identity}, seam risk ${result.seamRisk} percent`}
            >
              {Array.from({ length: 6 }, (_, index) => {
                const state = frameState(index, incident.id, result.identity, result.seamRisk);
                const x = Math.min(72, 18 + index * 9 + (state === 'drift' ? 12 : 0));
                return (
                  <div
                    key={index}
                    className={`relative min-h-32 overflow-hidden rounded-md border p-3 ${frameTone(state)}`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                      <span>F{index + 1}</span>
                      <span>{frameLabel(state)}</span>
                    </div>
                    <div className="relative mt-3 h-16 rounded border border-current/25 bg-white/70 dark:bg-neutral-950/70">
                      <UserRound
                        aria-hidden="true"
                        className="absolute top-4 h-8 w-8"
                        style={{ left: `calc(${x}% - 1rem)` }}
                      />
                      <span className="absolute bottom-1 left-2 right-2 h-px bg-current opacity-30" />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className={`rounded-md border p-5 ${decisionTone(result.tone)}`} aria-labelledby="continuity-decision-title">
            <div className="flex items-start gap-3">
              {result.tone === 'emerald' ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : result.tone === 'rose' ? (
                <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase opacity-75">Operational response</p>
                <h4 id="continuity-decision-title" className="mt-1 text-base font-semibold">{result.decision}</h4>
                <p className="mt-2 text-sm leading-6 opacity-85">{result.explanation}</p>
              </div>
            </div>
          </section>

          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">Why this strategy behaves this way</p>
            <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{strategy.lesson}</p>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

type FrameState = 'stable' | 'drift' | 'failed' | 'blocked';

function frameState(index: number, incidentId: string, identity: number, seamRisk: number): FrameState {
  if (incidentId === 'unsafe-transition' && index === 4) return 'blocked';
  if (incidentId === 'worker-loss' && index === 3) return 'failed';
  if (incidentId === 'occlusion' && (index === 3 || index === 4)) return 'drift';
  if (identity < 70 && index >= 3) return 'drift';
  if (seamRisk > 45 && index === 3) return 'failed';
  return 'stable';
}

function frameTone(state: FrameState) {
  if (state === 'blocked') return 'border-rose-400 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-100';
  if (state === 'failed') return 'border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100';
  if (state === 'drift') return 'border-violet-400 bg-violet-50 text-violet-900 dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-100';
  return 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100';
}

function frameLabel(state: FrameState) {
  if (state === 'blocked') return 'Policy block';
  if (state === 'failed') return 'Missing';
  if (state === 'drift') return 'Drift';
  return 'Stable';
}

function strategyIcon(id: string) {
  if (id === 'storyboard') return Film;
  if (id === 'overlap') return Layers3;
  return Boxes;
}

function sceneIcon(id: string) {
  if (id === 'camera-orbit') return Camera;
  if (id === 'multi-shot') return Users;
  return Focus;
}

function incidentIcon(id: string) {
  if (id === 'unsafe-transition') return ShieldAlert;
  if (id === 'worker-loss') return RefreshCw;
  if (id === 'occlusion') return UserRound;
  return CheckCircle2;
}

function scoreTone(value: number): 'emerald' | 'amber' | 'rose' {
  if (value >= 80) return 'emerald';
  if (value >= 65) return 'amber';
  return 'rose';
}

function riskTone(value: number): 'emerald' | 'amber' | 'rose' {
  if (value <= 20) return 'emerald';
  if (value <= 40) return 'amber';
  return 'rose';
}

function decisionTone(tone: 'emerald' | 'amber' | 'rose') {
  if (tone === 'emerald') return 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50';
  if (tone === 'rose') return 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50';
  return 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50';
}

function clamp(value: number) {
  return Math.round(Math.max(0, Math.min(100, value)));
}

function LoadState() {
  return (
    <div className="not-prose my-7 flex min-h-64 items-center justify-center rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950" role="status">
      <LoaderCircle aria-hidden="true" className="h-6 w-6 animate-spin text-violet-600 motion-reduce:animate-none dark:text-violet-300" />
      <span className="ml-3 text-sm font-medium text-neutral-700 dark:text-neutral-200">Loading continuity lab...</span>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div className="not-prose my-7 rounded-lg border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50" role="alert">
      <div className="flex items-start gap-3">
        <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Continuity lab unavailable</p>
          <p className="mt-1 text-sm leading-6 opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
