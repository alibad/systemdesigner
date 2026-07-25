'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Eye,
  Filter,
  Focus,
  RefreshCw,
  ScanSearch,
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

type Box = [number, number, number, number];

type Candidate = {
  id: string;
  label: string;
  classId: string;
  score: number;
  box: Box;
};

type DetectionScene = {
  id: string;
  label: string;
  summary: string;
  width: number;
  height: number;
  candidates: Candidate[];
};

type DetectionData = {
  title: string;
  description: string;
  defaults: {
    sceneId: string;
    confidenceThreshold: number;
    iouThreshold: number;
  };
  bounds: {
    confidenceThreshold: { min: number; max: number; step: number };
    iouThreshold: { min: number; max: number; step: number };
  };
  scenes: DetectionScene[];
};

type Decision = Candidate & {
  status: 'kept' | 'suppressed' | 'filtered';
  reason: string;
  overlap?: number;
  suppressorId?: string;
};

const DEFAULT_DATA_FILE =
  '/api/content/technology/yolo/data/detection-candidates.json';

function isBox(value: unknown): value is Box {
  return Array.isArray(value)
    && value.length === 4
    && value.every((coordinate) => typeof coordinate === 'number');
}

function isDetectionData(value: unknown): value is DetectionData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<DetectionData>;

  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && data.defaults
      && typeof data.defaults.sceneId === 'string'
      && typeof data.defaults.confidenceThreshold === 'number'
      && typeof data.defaults.iouThreshold === 'number'
      && data.bounds
      && data.bounds.confidenceThreshold
      && data.bounds.iouThreshold
      && Array.isArray(data.scenes)
      && data.scenes.length > 0
      && data.scenes.every((scene) => (
        typeof scene.id === 'string'
        && typeof scene.label === 'string'
        && typeof scene.summary === 'string'
        && typeof scene.width === 'number'
        && scene.width > 0
        && typeof scene.height === 'number'
        && scene.height > 0
        && Array.isArray(scene.candidates)
        && scene.candidates.length > 0
        && scene.candidates.every((candidate) => (
          typeof candidate.id === 'string'
          && typeof candidate.label === 'string'
          && typeof candidate.classId === 'string'
          && typeof candidate.score === 'number'
          && candidate.score >= 0
          && candidate.score <= 1
          && isBox(candidate.box)
        ))
      )),
  );
}

function intersectionOverUnion(left: Box, right: Box) {
  const intersectionWidth = Math.max(
    0,
    Math.min(left[2], right[2]) - Math.max(left[0], right[0]),
  );
  const intersectionHeight = Math.max(
    0,
    Math.min(left[3], right[3]) - Math.max(left[1], right[1]),
  );
  const intersectionArea = intersectionWidth * intersectionHeight;
  const leftArea = (left[2] - left[0]) * (left[3] - left[1]);
  const rightArea = (right[2] - right[0]) * (right[3] - right[1]);
  const unionArea = leftArea + rightArea - intersectionArea;

  return unionArea > 0 ? intersectionArea / unionArea : 0;
}

function evaluateCandidates(
  candidates: Candidate[],
  confidenceThreshold: number,
  iouThreshold: number,
) {
  const decisions = new Map<string, Decision>();
  const passing = candidates
    .filter((candidate) => {
      if (candidate.score >= confidenceThreshold) return true;
      decisions.set(candidate.id, {
        ...candidate,
        status: 'filtered',
        reason: `${candidate.score.toFixed(2)} is below ${confidenceThreshold.toFixed(2)}.`,
      });
      return false;
    })
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));

  const kept: Candidate[] = [];

  for (const candidate of passing) {
    const sameClassKept = kept.filter(
      (keptCandidate) => keptCandidate.classId === candidate.classId,
    );
    const overlaps = sameClassKept
      .map((keptCandidate) => ({
        candidate: keptCandidate,
        overlap: intersectionOverUnion(candidate.box, keptCandidate.box),
      }))
      .sort((left, right) => right.overlap - left.overlap);
    const strongestOverlap = overlaps[0];

    if (strongestOverlap && strongestOverlap.overlap > iouThreshold) {
      decisions.set(candidate.id, {
        ...candidate,
        status: 'suppressed',
        overlap: strongestOverlap.overlap,
        suppressorId: strongestOverlap.candidate.id,
        reason: `IoU ${strongestOverlap.overlap.toFixed(3)} with ${strongestOverlap.candidate.id} is greater than ${iouThreshold.toFixed(2)}.`,
      });
      continue;
    }

    kept.push(candidate);
    decisions.set(candidate.id, {
      ...candidate,
      status: 'kept',
      overlap: strongestOverlap?.overlap,
      reason: strongestOverlap
        ? `Largest same-class IoU ${strongestOverlap.overlap.toFixed(3)} is not greater than ${iouThreshold.toFixed(2)}.`
        : `No higher-scoring ${candidate.label} box survived for comparison.`,
    });
  }

  return candidates
    .map((candidate) => decisions.get(candidate.id))
    .filter((decision): decision is Decision => Boolean(decision))
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
}

export default function YoloThresholdLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<DetectionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const payload = (await response.json()) as unknown;
        if (!isDetectionData(payload)) {
          throw new Error('The detection scenario data is incomplete.');
        }
        setData(payload);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setData(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the detection scenarios.',
        );
      }
    }

    void loadData();
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return (
      <LoadState
        error={error}
        onRetry={() => setReloadKey((current) => current + 1)}
      />
    );
  }

  return <ThresholdLab data={data} />;
}

function ThresholdLab({ data }: { data: DetectionData }) {
  const initialScene = data.scenes.find(
    (scene) => scene.id === data.defaults.sceneId,
  ) ?? data.scenes[0];
  const [sceneId, setSceneId] = useState(initialScene.id);
  const [confidenceThreshold, setConfidenceThreshold] = useState(
    data.defaults.confidenceThreshold,
  );
  const [iouThreshold, setIouThreshold] = useState(data.defaults.iouThreshold);

  const scene = data.scenes.find((item) => item.id === sceneId) ?? data.scenes[0];
  const decisions = useMemo(
    () => evaluateCandidates(
      scene.candidates,
      confidenceThreshold,
      iouThreshold,
    ),
    [confidenceThreshold, iouThreshold, scene.candidates],
  );
  const keptCount = decisions.filter((decision) => decision.status === 'kept').length;
  const suppressedCount = decisions.filter(
    (decision) => decision.status === 'suppressed',
  ).length;
  const filteredCount = decisions.filter(
    (decision) => decision.status === 'filtered',
  ).length;

  function reset() {
    setSceneId(initialScene.id);
    setConfidenceThreshold(data.defaults.confidenceThreshold);
    setIouThreshold(data.defaults.iouThreshold);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Post-processing lab"
        title={data.title}
        description={data.description}
        icon={ScanSearch}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Inspection frame
              </legend>
              <div className="mt-3 space-y-2">
                {data.scenes.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scene.id}
                    label={item.label}
                    detail={item.summary}
                    icon={Eye}
                    accent="cyan"
                    onClick={() => setSceneId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Confidence floor"
              value={confidenceThreshold}
              output={confidenceThreshold.toFixed(2)}
              {...data.bounds.confidenceThreshold}
              accent="blue"
              lowLabel="keep more candidates"
              highLabel="require stronger score"
              onChange={setConfidenceThreshold}
            />

            <LabRange
              label="NMS IoU threshold"
              value={iouThreshold}
              output={iouThreshold.toFixed(2)}
              {...data.bounds.iouThreshold}
              accent="amber"
              lowLabel="suppress more overlap"
              highLabel="allow more overlap"
              onChange={setIouThreshold}
            />

            <div className="rounded-md border border-neutral-200 bg-white p-3 text-xs leading-5 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
              This lab uses class-aware NMS. Boxes from different classes are not
              compared, even when they overlap.
            </div>
          </div>
        )}
      >
        <div className="min-w-0 space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Kept"
              value={`${keptCount}`}
              detail="Final detections after both gates."
              icon={CheckCircle2}
              tone="emerald"
            />
            <LabMetric
              label="NMS suppressed"
              value={`${suppressedCount}`}
              detail="Lower-score same-class overlaps."
              icon={Focus}
              tone="amber"
            />
            <LabMetric
              label="Confidence filtered"
              value={`${filteredCount}`}
              detail="Candidates below the score floor."
              icon={Filter}
              tone="neutral"
            />
          </div>

          <section
            aria-label="Detection frame"
            className="rounded-md border border-neutral-200 bg-neutral-100 p-3 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                  {scene.label}
                </p>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Fixed candidate coordinates in a {scene.width} x {scene.height} frame
                </p>
              </div>
              <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                Solid = kept, dashed = suppressed, dotted = filtered
              </p>
            </div>

            <div
              className="relative mt-4 aspect-video w-full overflow-hidden rounded-md border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-950"
              role="img"
              aria-label={`${keptCount} boxes kept, ${suppressedCount} suppressed by NMS, and ${filteredCount} filtered by confidence`}
            >
              <div className="absolute inset-x-0 bottom-0 h-1/3 border-t border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" />
              {decisions.map((decision) => {
                const [x1, y1, x2, y2] = decision.box;
                const statusStyle = {
                  kept: 'z-30 border-emerald-500 bg-emerald-500/5 text-emerald-800 dark:border-emerald-400 dark:text-emerald-200',
                  suppressed: 'z-20 border-dashed border-amber-500 bg-amber-500/5 text-amber-900 dark:border-amber-400 dark:text-amber-200',
                  filtered: 'z-10 border-dotted border-neutral-400 bg-neutral-500/5 text-neutral-600 opacity-65 dark:border-neutral-500 dark:text-neutral-300',
                }[decision.status];

                return (
                  <div
                    key={decision.id}
                    className={`absolute border-2 ${statusStyle}`}
                    style={{
                      left: `${(x1 / scene.width) * 100}%`,
                      top: `${(y1 / scene.height) * 100}%`,
                      width: `${((x2 - x1) / scene.width) * 100}%`,
                      height: `${((y2 - y1) / scene.height) * 100}%`,
                    }}
                  >
                    <span className="absolute left-0 top-0 max-w-full bg-white px-1.5 py-0.5 text-[10px] font-bold leading-4 shadow-sm dark:bg-neutral-950 sm:text-xs">
                      {decision.id} {decision.score.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="decision-trace-title">
            <div className="flex items-center justify-between gap-4">
              <h4
                id="decision-trace-title"
                className="text-sm font-semibold text-neutral-950 dark:text-white"
              >
                Exact decision trace
              </h4>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Evaluated from highest score to lowest
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {decisions.map((decision) => (
                <DecisionRow key={decision.id} decision={decision} />
              ))}
            </div>
          </section>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function DecisionRow({ decision }: { decision: Decision }) {
  const status = {
    kept: {
      icon: CheckCircle2,
      label: 'Kept',
      style: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100',
    },
    suppressed: {
      icon: CircleAlert,
      label: 'Suppressed',
      style: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100',
    },
    filtered: {
      icon: XCircle,
      label: 'Filtered',
      style: 'border-neutral-200 bg-neutral-50 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200',
    },
  }[decision.status];
  const Icon = status.icon;

  return (
    <div className={`rounded-md border p-3 ${status.style}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {decision.id}: {decision.label}
            </p>
            <p className="mt-1 text-xs leading-5 opacity-80">{decision.reason}</p>
          </div>
        </div>
        <span className="shrink-0 text-xs font-bold uppercase">
          {status.label}
        </span>
      </div>
    </div>
  );
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="not-prose my-7 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-start gap-3">
        <CircleAlert
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
        />
        <div>
          <p className="text-sm font-semibold text-neutral-950 dark:text-white">
            {error ? 'Detection scenarios unavailable' : 'Loading detection scenarios'}
          </p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
            {error ?? 'Reading the co-located candidate boxes.'}
          </p>
          {error ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex h-9 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-100"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Retry
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
