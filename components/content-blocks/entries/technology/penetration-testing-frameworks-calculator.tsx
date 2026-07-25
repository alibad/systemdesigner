'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Eye,
  Gauge,
  KeyRound,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Network,
  Route,
  ShieldCheck,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bounds = { min: number; max: number; step: number };
type TargetBoundary = {
  id: string;
  label: string;
  detail: string;
  targetCount: number;
  production: boolean;
  maxParallelTargets: number;
};
type AccessProfile = {
  id: string;
  label: string;
  detail: string;
  casesPerTarget: number;
  evidenceSources: number;
};
type ValidationDepth = {
  id: string;
  label: string;
  detail: string;
  caseMultiplier: number;
  minutesPerTarget: number;
  evidenceItemsPerTarget: number;
  requiresExplicitApproval: boolean;
};
type EngagementModel = {
  title: string;
  description: string;
  defaults: {
    boundaryId: string;
    accessProfileId: string;
    validationDepthId: string;
    parallelTargets: number;
  };
  bounds: { parallelTargets: Bounds };
  targetBoundaries: TargetBoundary[];
  accessProfiles: AccessProfile[];
  validationDepths: ValidationDepth[];
};

const BLOCK_ID = 'technology/penetration-testing-frameworks-calculator';
const DEFAULT_DATA_FILE = '/api/content/technology/penetration-testing-frameworks/data/engagement-envelope.json';

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBounds(value: unknown): value is Bounds {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bounds>;
  return isNumber(candidate.min)
    && isNumber(candidate.max)
    && isNumber(candidate.step)
    && candidate.step > 0
    && candidate.max >= candidate.min;
}

function isTargetBoundary(value: unknown): value is TargetBoundary {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TargetBoundary>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && isNumber(candidate.targetCount)
      && candidate.targetCount > 0
      && typeof candidate.production === 'boolean'
      && isNumber(candidate.maxParallelTargets)
      && candidate.maxParallelTargets > 0,
  );
}

function isAccessProfile(value: unknown): value is AccessProfile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AccessProfile>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && isNumber(candidate.casesPerTarget)
      && candidate.casesPerTarget > 0
      && isNumber(candidate.evidenceSources)
      && candidate.evidenceSources > 0,
  );
}

function isValidationDepth(value: unknown): value is ValidationDepth {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ValidationDepth>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && isNumber(candidate.caseMultiplier)
      && candidate.caseMultiplier > 0
      && isNumber(candidate.minutesPerTarget)
      && candidate.minutesPerTarget > 0
      && isNumber(candidate.evidenceItemsPerTarget)
      && candidate.evidenceItemsPerTarget > 0
      && typeof candidate.requiresExplicitApproval === 'boolean',
  );
}

function isEngagementModel(value: unknown): value is EngagementModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EngagementModel>;
  const boundaries = candidate.targetBoundaries;
  const profiles = candidate.accessProfiles;
  const depths = candidate.validationDepths;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.boundaryId
      && candidate.defaults.accessProfileId
      && candidate.defaults.validationDepthId
      && isNumber(candidate.defaults.parallelTargets)
      && candidate.bounds
      && isBounds(candidate.bounds.parallelTargets)
      && Array.isArray(boundaries)
      && boundaries.length >= 3
      && boundaries.every(isTargetBoundary)
      && boundaries.some((item) => item.id === candidate.defaults?.boundaryId)
      && Array.isArray(profiles)
      && profiles.length >= 3
      && profiles.every(isAccessProfile)
      && profiles.some((item) => item.id === candidate.defaults?.accessProfileId)
      && Array.isArray(depths)
      && depths.length >= 3
      && depths.every(isValidationDepth)
      && depths.some((item) => item.id === candidate.defaults?.validationDepthId),
  );
}

export default function PenetrationTestingFrameworksCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<EngagementModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isEngagementModel(payload)) throw new Error('The engagement model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the engagement planner.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <EngagementEnvelopeLab data={data} />;
}

function EngagementEnvelopeLab({ data }: { data: EngagementModel }) {
  const [boundaryId, setBoundaryId] = useState(data.defaults.boundaryId);
  const [accessProfileId, setAccessProfileId] = useState(data.defaults.accessProfileId);
  const [validationDepthId, setValidationDepthId] = useState(data.defaults.validationDepthId);
  const [parallelTargets, setParallelTargets] = useState(data.defaults.parallelTargets);

  const boundary = data.targetBoundaries.find((item) => item.id === boundaryId) ?? data.targetBoundaries[0];
  const profile = data.accessProfiles.find((item) => item.id === accessProfileId) ?? data.accessProfiles[0];
  const depth = data.validationDepths.find((item) => item.id === validationDepthId) ?? data.validationDepths[0];

  const result = useMemo(() => {
    const activeParallelTargets = Math.min(parallelTargets, boundary.targetCount);
    const baseCases = boundary.targetCount * profile.casesPerTarget;
    const plannedCases = baseCases * depth.caseMultiplier;
    const executionWaves = Math.ceil(boundary.targetCount / activeParallelTargets);
    const evidenceItems = boundary.targetCount * depth.evidenceItemsPerTarget * profile.evidenceSources;
    const operatorHours = Math.ceil((boundary.targetCount * depth.minutesPerTarget) / 60);
    const concurrencySafe = activeParallelTargets <= boundary.maxParallelTargets;
    const depthNeedsReview = boundary.production && depth.requiresExplicitApproval;

    let status = 'Ready for rules-of-engagement review';
    let explanation = 'The modeled concurrency stays inside the selected target boundary. Confirm written authorization, exact commands, data handling, cleanup, and stop conditions before execution.';
    if (!concurrencySafe) {
      status = 'Hold: parallelism exceeds the boundary';
      explanation = `${boundary.label} allows at most ${boundary.maxParallelTargets} parallel target${boundary.maxParallelTargets === 1 ? '' : 's'} in this lesson model. Reduce concurrency or divide the scope into separately approved waves.`;
    } else if (depthNeedsReview) {
      status = 'Review: production depth needs explicit approval';
      explanation = `${depth.label} can change state or create a session. The selected production boundary needs per-step approval, a named stop authority, and verified cleanup before this plan can run.`;
    }

    return {
      activeParallelTargets,
      concurrencySafe,
      depthNeedsReview,
      evidenceItems,
      executionWaves,
      explanation,
      operatorHours,
      plannedCases,
      status,
    };
  }, [boundary, depth, parallelTargets, profile]);

  function reset() {
    setBoundaryId(data.defaults.boundaryId);
    setAccessProfileId(data.defaults.accessProfileId);
    setValidationDepthId(data.defaults.validationDepthId);
    setParallelTargets(data.defaults.parallelTargets);
  }

  const ready = result.concurrencySafe && !result.depthNeedsReview;
  const StatusIcon = ready ? CheckCircle2 : AlertTriangle;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Engagement envelope lab"
          title={data.title}
          description={data.description}
          icon={ShieldCheck}
          accent="rose"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Target boundary
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.targetBoundaries.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === boundary.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.production ? Network : LockKeyhole}
                      accent={item.production ? 'amber' : 'emerald'}
                      onClick={() => setBoundaryId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Access profile
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.accessProfiles.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === profile.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'external' ? Eye : item.id === 'authenticated' ? KeyRound : Layers3}
                      accent="blue"
                      onClick={() => setAccessProfileId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Validation depth
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.validationDepths.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === depth.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.requiresExplicitApproval ? Route : ClipboardCheck}
                      accent={item.requiresExplicitApproval ? 'rose' : 'cyan'}
                      onClick={() => setValidationDepthId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Parallel targets"
                value={parallelTargets}
                output={`${parallelTargets} target${parallelTargets === 1 ? '' : 's'}`}
                {...data.bounds.parallelTargets}
                lowLabel="One at a time"
                highLabel="Larger blast radius"
                accent="rose"
                onChange={setParallelTargets}
              />
            </div>
          )}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <LabMetric
              label="Planned test cases"
              value={result.plannedCases.toLocaleString()}
              detail={`${boundary.targetCount} targets x ${profile.casesPerTarget} access cases x ${depth.caseMultiplier} depth factor`}
              icon={Layers3}
              tone="rose"
            />
            <LabMetric
              label="Execution waves"
              value={result.executionWaves.toLocaleString()}
              detail={`${result.activeParallelTargets} target${result.activeParallelTargets === 1 ? '' : 's'} active per wave`}
              icon={Gauge}
              tone={result.concurrencySafe ? 'emerald' : 'amber'}
            />
            <LabMetric
              label="Evidence items"
              value={result.evidenceItems.toLocaleString()}
              detail={`${profile.evidenceSources} evidence source${profile.evidenceSources === 1 ? '' : 's'} across the selected depth`}
              icon={ClipboardCheck}
              tone="blue"
            />
            <LabMetric
              label="Review effort"
              value={`${result.operatorHours}h`}
              detail="Illustrative hands-on review time from the lesson model"
              icon={Clock3}
              tone="violet"
            />
          </div>

          <div
            className={`mt-5 rounded-md border p-5 ${
              ready
                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
            }`}
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <StatusIcon
                aria-hidden="true"
                className={`mt-0.5 h-5 w-5 shrink-0 ${ready ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}
              />
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Review decision
                </p>
                <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{result.status}</p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{result.explanation}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <BoundaryCheck
              label="Concurrency cap"
              pass={result.concurrencySafe}
              detail={`Selected ${result.activeParallelTargets}; boundary cap ${boundary.maxParallelTargets}.`}
            />
            <BoundaryCheck
              label="Depth approval"
              pass={!result.depthNeedsReview}
              detail={result.depthNeedsReview ? 'Explicit production approval is still required.' : 'No extra depth gate is triggered by this model.'}
            />
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function BoundaryCheck({ label, pass, detail }: { label: string; pass: boolean; detail: string }) {
  const Icon = pass ? CheckCircle2 : AlertTriangle;
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className={`h-4 w-4 ${pass ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`} />
        <p className="text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
      </div>
      <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 flex min-h-64 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-300">
      <div className="flex items-center gap-3 text-sm">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin text-rose-300" />
        Loading the engagement model...
      </div>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-rose-200 bg-rose-50 p-5 text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">The engagement planner could not be loaded.</p>
          <p className="mt-1 text-sm opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
