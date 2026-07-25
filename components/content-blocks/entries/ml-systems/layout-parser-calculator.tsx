'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  Copy,
  Eye,
  Filter,
  LoaderCircle,
  ScanSearch,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/layout-parser/data/region-postprocessing-scenarios.json';
const BLOCK_ID = 'ml-systems/layout-parser-calculator';

type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Detection = {
  id: string;
  truthId: string;
  label: string;
  type: string;
  score: number;
  box: Box;
};

type PageFixture = {
  id: string;
  label: string;
  detail: string;
  expectedTruthIds: string[];
  detections: Detection[];
};

type Policy = {
  id: string;
  label: string;
  detail: string;
};

type RegionPolicyData = {
  title: string;
  description: string;
  defaultPageId: string;
  defaultPolicyId: string;
  defaultConfidenceFloor: number;
  overlapThreshold: number;
  policies: Policy[];
  pages: PageFixture[];
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBox(value: unknown): value is Box {
  if (!value || typeof value !== 'object') return false;
  const box = value as Partial<Box>;
  return (
    isFiniteNumber(box.x)
    && isFiniteNumber(box.y)
    && isFiniteNumber(box.width)
    && isFiniteNumber(box.height)
  );
}

function isRegionPolicyData(value: unknown): value is RegionPolicyData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<RegionPolicyData>;
  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && typeof data.defaultPageId === 'string'
      && typeof data.defaultPolicyId === 'string'
      && isFiniteNumber(data.defaultConfidenceFloor)
      && isFiniteNumber(data.overlapThreshold)
      && Array.isArray(data.policies)
      && data.policies.length > 0
      && data.policies.every((policy) => (
        typeof policy.id === 'string'
        && typeof policy.label === 'string'
        && typeof policy.detail === 'string'
      ))
      && Array.isArray(data.pages)
      && data.pages.length > 0
      && data.pages.every((page) => (
        typeof page.id === 'string'
        && typeof page.label === 'string'
        && typeof page.detail === 'string'
        && Array.isArray(page.expectedTruthIds)
        && page.expectedTruthIds.every((id) => typeof id === 'string')
        && Array.isArray(page.detections)
        && page.detections.every((detection) => (
          typeof detection.id === 'string'
          && typeof detection.truthId === 'string'
          && typeof detection.label === 'string'
          && typeof detection.type === 'string'
          && isFiniteNumber(detection.score)
          && isBox(detection.box)
        ))
      )),
  );
}

function intersectionOverUnion(left: Box, right: Box) {
  const intersectionWidth = Math.max(
    0,
    Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x),
  );
  const intersectionHeight = Math.max(
    0,
    Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y),
  );
  const intersectionArea = intersectionWidth * intersectionHeight;
  const unionArea = left.width * left.height + right.width * right.height - intersectionArea;
  return unionArea > 0 ? intersectionArea / unionArea : 0;
}

function applyClassAwareNms(detections: Detection[], overlapThreshold: number) {
  const kept: Detection[] = [];
  for (const candidate of [...detections].sort((left, right) => right.score - left.score)) {
    const overlapsKeptRegion = kept.some(
      (region) => (
        region.type === candidate.type
        && intersectionOverUnion(region.box, candidate.box) >= overlapThreshold
      ),
    );
    if (!overlapsKeptRegion) kept.push(candidate);
  }
  return kept;
}

const regionTone: Record<string, string> = {
  title:
    'border-blue-600 bg-blue-100/90 text-blue-950 dark:border-blue-400 dark:bg-blue-950/90 dark:text-blue-50',
  text:
    'border-cyan-600 bg-cyan-100/90 text-cyan-950 dark:border-cyan-400 dark:bg-cyan-950/90 dark:text-cyan-50',
  table:
    'border-violet-600 bg-violet-100/90 text-violet-950 dark:border-violet-400 dark:bg-violet-950/90 dark:text-violet-50',
  figure:
    'border-emerald-600 bg-emerald-100/90 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-950/90 dark:text-emerald-50',
  caption:
    'border-amber-600 bg-amber-100/90 text-amber-950 dark:border-amber-400 dark:bg-amber-950/90 dark:text-amber-50',
  footer:
    'border-neutral-500 bg-neutral-100/90 text-neutral-950 dark:border-neutral-400 dark:bg-neutral-900/90 dark:text-neutral-50',
};

function LoadingState({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
            <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
            {detail}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

export default function LayoutParserRegionPolicyLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<RegionPolicyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageId, setPageId] = useState('');
  const [policyId, setPolicyId] = useState('');
  const [confidenceFloor, setConfidenceFloor] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Region fixture request failed (${response.status}).`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isRegionPolicyData(payload)) {
          throw new Error('Region fixture data is incomplete.');
        }
        setData(payload);
        setPageId(payload.defaultPageId);
        setPolicyId(payload.defaultPolicyId);
        setConfidenceFloor(payload.defaultConfidenceFloor);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load region fixtures.');
      });

    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    if (!data) return null;
    const page = data.pages.find((item) => item.id === pageId) ?? data.pages[0];
    const scoreFiltered = page.detections.filter(
      (detection) => detection.score >= confidenceFloor,
    );
    const retained = policyId === 'class-aware-nms'
      ? applyClassAwareNms(scoreFiltered, data.overlapThreshold)
      : scoreFiltered;
    const retainedTruthIds = new Set(retained.map((detection) => detection.truthId));
    const missingTruthIds = page.expectedTruthIds.filter((id) => !retainedTruthIds.has(id));
    const duplicateTruthIds = [...retainedTruthIds].filter(
      (truthId) => retained.filter((detection) => detection.truthId === truthId).length > 1,
    );
    const truthLabels = new Map(
      page.detections.map((detection) => [detection.truthId, detection.label]),
    );
    const coveragePercent = Math.round(
      ((page.expectedTruthIds.length - missingTruthIds.length) / page.expectedTruthIds.length) * 100,
    );
    const retainedIds = new Set(retained.map((detection) => detection.id));

    return {
      page,
      retained,
      retainedIds,
      missingTruthIds,
      duplicateTruthIds,
      truthLabels,
      coveragePercent,
    };
  }, [confidenceFloor, data, pageId, policyId]);

  if (error) return <LoadingState detail={error} />;
  if (!data || !result) return <LoadingState detail="Loading exact detection fixtures..." />;

  const reset = () => {
    setPageId(data.defaultPageId);
    setPolicyId(data.defaultPolicyId);
    setConfidenceFloor(data.defaultConfidenceFloor);
  };

  const hasCoverageGap = result.missingTruthIds.length > 0;
  const hasDuplicates = result.duplicateTruthIds.length > 0;
  const outcome = hasCoverageGap
    ? {
        title: 'Extraction gap',
        detail: `Missing expected regions: ${result.missingTruthIds
          .map((truthId) => result.truthLabels.get(truthId) ?? truthId)
          .join(', ')}.`,
        tone: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50',
        icon: TriangleAlert,
      }
    : hasDuplicates
      ? {
          title: 'Duplicate crops',
          detail: `Multiple boxes still describe: ${result.duplicateTruthIds
            .map((truthId) => result.truthLabels.get(truthId) ?? truthId)
            .join(', ')}.`,
          tone: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50',
          icon: Copy,
        }
      : {
          title: 'Ready for region OCR',
          detail: 'Every expected region has one retained detection in this fixture.',
          tone: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50',
          icon: CheckCircle2,
        };
  const OutcomeIcon = outcome.icon;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Detection policy lab"
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
                  Page fixture
                </legend>
                <div className="mt-3 space-y-2">
                  {data.pages.map((page) => (
                    <LabChoice
                      key={page.id}
                      selected={page.id === result.page.id}
                      label={page.label}
                      detail={page.detail}
                      icon={Eye}
                      accent="cyan"
                      onClick={() => setPageId(page.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Confidence floor"
                value={confidenceFloor}
                output={confidenceFloor.toFixed(2)}
                min={0.5}
                max={0.95}
                step={0.01}
                accent="violet"
                lowLabel="Retain more"
                highLabel="Require more confidence"
                onChange={setConfidenceFloor}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Overlap policy
                </legend>
                <div className="mt-3 space-y-2">
                  {data.policies.map((policy) => (
                    <LabChoice
                      key={policy.id}
                      selected={policy.id === policyId}
                      label={policy.label}
                      detail={policy.detail}
                      icon={Filter}
                      accent="violet"
                      onClick={() => setPolicyId(policy.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <LabMetric
              label="Retained boxes"
              value={`${result.retained.length}/${result.page.detections.length}`}
              detail="After score and overlap policy"
              icon={Boxes}
              tone="cyan"
            />
            <LabMetric
              label="Expected coverage"
              value={`${result.coveragePercent}%`}
              detail="Unique fixture regions recovered"
              icon={Eye}
              tone={hasCoverageGap ? 'rose' : 'emerald'}
            />
            <LabMetric
              label="Duplicate truths"
              value={String(result.duplicateTruthIds.length)}
              detail="Multiple retained boxes for one region"
              icon={Copy}
              tone={hasDuplicates ? 'amber' : 'neutral'}
            />
          </div>

          <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
            <div>
              <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-md border border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900">
                {result.page.detections.map((detection, index) => {
                  const retained = result.retainedIds.has(detection.id);
                  const tone = regionTone[detection.type] ?? regionTone.text;
                  return (
                    <div
                      key={detection.id}
                      className={`absolute border-2 transition-opacity motion-reduce:transition-none ${tone} ${
                        retained ? 'opacity-100' : 'border-dashed opacity-25'
                      }`}
                      style={{
                        left: `${detection.box.x}%`,
                        top: `${detection.box.y}%`,
                        width: `${detection.box.width}%`,
                        height: `${detection.box.height}%`,
                      }}
                      title={`${detection.label}: ${detection.score.toFixed(2)}${
                        retained ? ', retained' : ', dropped'
                      }`}
                    >
                      <span className="absolute left-0 top-0 inline-flex min-h-5 min-w-5 items-center justify-center bg-neutral-950 px-1 text-[10px] font-bold text-white dark:bg-white dark:text-neutral-950">
                        {index + 1}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Solid boxes are retained. Dashed, faded boxes were removed by the selected policy.
              </p>
            </div>

            <div className="min-w-0">
              <div
                className={`rounded-md border p-4 ${outcome.tone}`}
                aria-live="polite"
              >
                <div className="flex items-start gap-3">
                  <OutcomeIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">{outcome.title}</p>
                    <p className="mt-1 text-sm leading-6 opacity-80">{outcome.detail}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                {result.page.detections.map((detection, index) => {
                  const retained = result.retainedIds.has(detection.id);
                  return (
                    <div
                      key={detection.id}
                      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 text-sm"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-neutral-950 dark:text-white">
                          {detection.label}
                        </span>
                        <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                          {detection.type} / {detection.score.toFixed(2)}
                        </span>
                      </span>
                      <span
                        className={`text-xs font-semibold ${
                          retained
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-neutral-500 dark:text-neutral-400'
                        }`}
                      >
                        {retained ? 'Keep' : 'Drop'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
