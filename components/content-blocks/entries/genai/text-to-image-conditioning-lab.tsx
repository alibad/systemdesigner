'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CircleAlert,
  CircleCheck,
  Focus,
  Image as ImageIcon,
  Layers3,
  LoaderCircle,
  Move,
  PersonStanding,
  ScanLine,
  Shapes,
  SlidersHorizontal,
  Sparkles,
  Target,
  Type,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Position = { x: number; y: number };

type ConditioningControl = {
  id: string;
  label: string;
  detail: string;
  structureGain: number;
  freedomCost: number;
  conflictMultiplier: number;
};

type ConditioningScenario = {
  id: string;
  label: string;
  prompt: string;
  primaryLabel: string;
  secondaryLabel: string;
  primaryPosition: Position;
  secondaryPosition: Position;
  baseAlignment: number;
  baseComposition: number;
  recommendedGuidance: number;
  recommendedControlId: string;
  layoutRequired: boolean;
  lesson: string;
};

type ConditioningData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    controlId: string;
    guidance: number;
    structureStrength: number;
  };
  controls: ConditioningControl[];
  scenarios: ConditioningScenario[];
};

const BLOCK_ID = 'genai/text-to-image-conditioning-lab';

function isConditioningData(value: unknown): value is ConditioningData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ConditioningData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && Array.isArray(candidate.controls)
      && candidate.controls.length > 0
      && candidate.controls.every((control) => (
        typeof control.id === 'string'
        && typeof control.structureGain === 'number'
        && typeof control.freedomCost === 'number'
      ))
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.prompt === 'string'
        && typeof scenario.recommendedGuidance === 'number'
        && typeof scenario.primaryPosition?.x === 'number'
        && typeof scenario.secondaryPosition?.y === 'number'
      )),
  );
}

export default function TextToImageConditioningLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ConditioningData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No conditioning scenarios were supplied.');
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
        if (!isConditioningData(payload)) {
          throw new Error('Conditioning data is incomplete.');
        }
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load conditioning data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  return (
    <div data-content-block={BLOCK_ID}>
      {loadError ? <LoadError detail={loadError} /> : data ? <ConditioningLab data={data} /> : <LoadState />}
    </div>
  );
}

function ConditioningLab({ data }: { data: ConditioningData }) {
  const initialScenario = data.scenarios.find((item) => item.id === data.defaults.scenarioId)
    ?? data.scenarios[0];
  const initialControl = data.controls.find((item) => item.id === data.defaults.controlId)
    ?? data.controls[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [controlId, setControlId] = useState(initialControl.id);
  const [guidance, setGuidance] = useState(data.defaults.guidance);
  const [structureStrength, setStructureStrength] = useState(data.defaults.structureStrength);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const control = data.controls.find((item) => item.id === controlId) ?? data.controls[0];

  const result = useMemo(() => {
    const controlActive = control.id !== 'none';
    const controlMatches = control.id === scenario.recommendedControlId;
    const structureFraction = controlActive ? structureStrength / 100 : 0;
    const guidanceDistance = Math.abs(guidance - scenario.recommendedGuidance);
    const alignment = clamp(scenario.baseAlignment + 14 - guidanceDistance * 3.5);
    const composition = clamp(
      scenario.baseComposition
        + control.structureGain * structureFraction * (controlMatches ? 1 : 0.35),
    );
    const variation = clamp(100 - guidance * 4.4 - control.freedomCost * structureFraction);
    const mismatchConflict = controlActive && !controlMatches
      ? structureStrength * control.conflictMultiplier
      : 0;
    const pressureConflict = Math.max(0, guidance - 9) * 8;
    const conflict = clamp(mismatchConflict + pressureConflict);
    const missingLayoutEvidence = scenario.layoutRequired && !controlActive;

    let verdict = 'Signals are balanced for this brief';
    let detail = 'Text and structure reinforce the requested composition while leaving room for useful variation.';
    let tone: 'emerald' | 'amber' | 'rose' | 'violet' = 'emerald';

    if (missingLayoutEvidence) {
      verdict = 'The composition lacks spatial evidence';
      detail = 'Text names the relationship, but this brief needs a matching structural signal to anchor placement.';
      tone = 'amber';
    } else if (conflict >= 45) {
      verdict = 'The conditioning signals conflict';
      detail = 'Strong guidance and a mismatched structural control pull the sample toward different arrangements.';
      tone = 'rose';
    } else if (variation < 35) {
      verdict = 'The candidate envelope is over-constrained';
      detail = 'The controls may preserve the brief, but little variation remains for candidate exploration.';
      tone = 'violet';
    } else if (alignment < 75 || composition < 75) {
      verdict = 'One part of the brief remains weak';
      detail = alignment < composition
        ? 'Prompt pressure is too far from the measured range for dependable semantic alignment.'
        : 'The structure signal does not yet anchor the required spatial relationship.';
      tone = 'amber';
    }

    const placementFidelity = composition / 100;
    const primaryPosition = resolvePosition(scenario.primaryPosition, placementFidelity, 1);
    const secondaryPosition = resolvePosition(scenario.secondaryPosition, placementFidelity, -1);

    return {
      alignment,
      composition,
      conflict,
      controlActive,
      controlMatches,
      detail,
      primaryPosition,
      secondaryPosition,
      tone,
      variation,
      verdict,
    };
  }, [control, guidance, scenario, structureStrength]);

  const chooseScenario = (next: ConditioningScenario) => {
    const recommendedControl = data.controls.find((item) => item.id === next.recommendedControlId)
      ?? data.controls[0];
    setScenarioId(next.id);
    setControlId(recommendedControl.id);
    setGuidance(next.recommendedGuidance);
    setStructureStrength(data.defaults.structureStrength);
  };

  const reset = () => {
    setScenarioId(initialScenario.id);
    setControlId(initialControl.id);
    setGuidance(data.defaults.guidance);
    setStructureStrength(data.defaults.structureStrength);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Conditioning workbench"
        title={data.title}
        description={data.description}
        icon={SlidersHorizontal}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Visual brief
              </legend>
              <div className="mt-3 grid gap-2">
                {data.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.prompt}
                    icon={item.id === 'character-pose' ? PersonStanding : item.id === 'spatial-poster' ? Shapes : ImageIcon}
                    accent={item.id === 'character-pose' ? 'violet' : item.id === 'spatial-poster' ? 'amber' : 'cyan'}
                    onClick={() => chooseScenario(item)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Structural condition
              </legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {data.controls.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === control.id}
                    label={item.label}
                    detail={item.detail}
                    icon={controlIcon(item.id)}
                    accent={item.id === 'none' ? 'blue' : item.id === 'pose' ? 'violet' : 'cyan'}
                    onClick={() => setControlId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Guidance scale"
              value={guidance}
              output={guidance.toFixed(1)}
              min={1}
              max={14}
              step={0.5}
              accent="violet"
              lowLabel="More variation"
              highLabel="More prompt pressure"
              onChange={setGuidance}
            />

            <LabRange
              label="Structure strength"
              value={structureStrength}
              output={control.id === 'none' ? 'Inactive' : `${structureStrength}%`}
              min={0}
              max={100}
              step={5}
              accent="cyan"
              lowLabel="Loose"
              highLabel="Rigid"
              onChange={setStructureStrength}
            />
          </div>
        )}
      >
        <div className="min-w-0 space-y-6" aria-live="polite">
          <div className={`rounded-md border p-4 ${verdictClasses(result.tone)}`}>
            <div className="flex items-start gap-3">
              {result.tone === 'emerald' ? (
                <CircleCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-semibold">{result.verdict}</p>
                <p className="mt-1 text-sm leading-6 opacity-80">{result.detail}</p>
              </div>
            </div>
          </div>

          <section aria-labelledby="conditioning-preview-title">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Composition preview
                </p>
                <h4 id="conditioning-preview-title" className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                  See whether the two requested elements hold position
                </h4>
              </div>
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {result.controlActive
                  ? `${control.label}${result.controlMatches ? ' matches' : ' conflicts with'} this brief`
                  : 'No structural condition'}
              </span>
            </div>

            <div
              className="relative mt-4 aspect-[4/3] min-h-64 overflow-hidden rounded-md border border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900"
              aria-label={`${scenario.primaryLabel} at ${Math.round(result.primaryPosition.x)} percent horizontal and ${scenario.secondaryLabel} at ${Math.round(result.secondaryPosition.x)} percent horizontal`}
            >
              <div aria-hidden="true" className="absolute inset-x-0 top-1/3 border-t border-dashed border-neutral-300 dark:border-neutral-700" />
              <div aria-hidden="true" className="absolute inset-x-0 top-2/3 border-t border-dashed border-neutral-300 dark:border-neutral-700" />
              <div aria-hidden="true" className="absolute inset-y-0 left-1/3 border-l border-dashed border-neutral-300 dark:border-neutral-700" />
              <div aria-hidden="true" className="absolute inset-y-0 left-2/3 border-l border-dashed border-neutral-300 dark:border-neutral-700" />

              {result.controlActive ? (
                <div className="absolute inset-3 rounded border-2 border-dashed border-cyan-500/60" aria-hidden="true" />
              ) : null}

              <PreviewObject
                label={scenario.primaryLabel}
                index="1"
                position={result.primaryPosition}
                className={primaryObjectClasses(scenario.id)}
              />
              <PreviewObject
                label={scenario.secondaryLabel}
                index="2"
                position={result.secondaryPosition}
                className={secondaryObjectClasses(scenario.id)}
              />

              <div className="absolute bottom-3 left-3 right-3 rounded-md border border-neutral-300 bg-white/95 px-3 py-2 text-xs leading-5 text-neutral-700 shadow-sm dark:border-neutral-700 dark:bg-neutral-950/95 dark:text-neutral-200">
                <span className="font-semibold">Prompt:</span> {scenario.prompt}
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Text alignment" value={`${Math.round(result.alignment)}%`} detail="Modeled semantic fit to the prompt." icon={Type} tone={scoreTone(result.alignment)} />
            <LabMetric label="Composition" value={`${Math.round(result.composition)}%`} detail="Modeled placement of requested elements." icon={Target} tone={scoreTone(result.composition)} />
            <LabMetric label="Variation" value={`${Math.round(result.variation)}%`} detail="Candidate freedom remaining after controls." icon={Sparkles} tone={result.variation < 35 ? 'violet' : 'cyan'} />
            <LabMetric label="Signal conflict" value={`${Math.round(result.conflict)}%`} detail="Pressure from mismatched or excessive controls." icon={CircleAlert} tone={result.conflict >= 45 ? 'rose' : result.conflict > 15 ? 'amber' : 'emerald'} />
          </div>

          <section className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800" aria-label="Conditioning signal balance">
            <div className="flex items-center gap-2">
              <Layers3 aria-hidden="true" className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">Signal balance</h4>
            </div>
            <SignalBar label="Text pressure" value={Math.round((guidance / 14) * 100)} tone="violet" />
            <SignalBar label="Structure pressure" value={result.controlActive ? structureStrength : 0} tone="cyan" />
            <p className="mt-4 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{scenario.lesson}</p>
          </section>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function PreviewObject({
  className,
  index,
  label,
  position,
}: {
  className: string;
  index: string;
  label: string;
  position: Position;
}) {
  return (
    <div
      className={`absolute w-28 -translate-x-1/2 -translate-y-1/2 rounded-md border p-3 shadow-sm transition-[left,top] duration-300 motion-reduce:transition-none ${className}`}
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
    >
      <span className="flex items-center gap-2 text-xs font-semibold">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px]">{index}</span>
        {label}
      </span>
    </div>
  );
}

function SignalBar({ label, tone, value }: { label: string; tone: 'cyan' | 'violet'; value: number }) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-4 text-xs text-neutral-600 dark:text-neutral-300">
        <span>{label}</span>
        <span className="font-semibold tabular-nums">{value}%</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${tone === 'cyan' ? 'bg-cyan-500' : 'bg-violet-500'}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function resolvePosition(target: Position, fidelity: number, direction: 1 | -1): Position {
  const drift = (1 - fidelity) * 16 * direction;
  return {
    x: clampPosition(50 + (target.x - 50) * fidelity + drift),
    y: clampPosition(50 + (target.y - 50) * fidelity - drift * 0.35),
  };
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function clampPosition(value: number) {
  return Math.max(18, Math.min(82, value));
}

function controlIcon(id: string) {
  if (id === 'edges') return ScanLine;
  if (id === 'depth') return Focus;
  if (id === 'pose') return PersonStanding;
  return Move;
}

function scoreTone(value: number): 'emerald' | 'amber' | 'rose' {
  if (value >= 78) return 'emerald';
  if (value >= 65) return 'amber';
  return 'rose';
}

function verdictClasses(tone: 'emerald' | 'amber' | 'rose' | 'violet') {
  const classes = {
    emerald: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50',
    amber: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50',
    rose: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50',
    violet: 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-50',
  };
  return classes[tone];
}

function primaryObjectClasses(scenarioId: string) {
  if (scenarioId === 'product-still-life') return 'border-rose-400 bg-rose-100 text-rose-950 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-100';
  if (scenarioId === 'spatial-poster') return 'border-blue-400 bg-blue-100 text-blue-950 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100';
  return 'border-violet-400 bg-violet-100 text-violet-950 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-100';
}

function secondaryObjectClasses(scenarioId: string) {
  if (scenarioId === 'product-still-life') return 'border-blue-400 bg-blue-100 text-blue-950 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100';
  if (scenarioId === 'spatial-poster') return 'border-amber-400 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100';
  return 'border-cyan-400 bg-cyan-100 text-cyan-950 dark:border-cyan-700 dark:bg-cyan-950 dark:text-cyan-100';
}

function LoadState() {
  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Conditioning workbench"
        title="Loading the conditioning model"
        description="Preparing prompt, structure, and conflict scenarios."
        icon={SlidersHorizontal}
        accent="cyan"
      />
      <LearningLabBody>
        <div className="flex min-h-56 items-center justify-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
          <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
          Loading scenarios
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Conditioning workbench"
        title="The conditioning model could not load"
        description="The lesson remains available, but this interactive model needs valid scenario data."
        icon={CircleAlert}
        accent="rose"
      />
      <LearningLabBody>
        <p className="rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50">
          {detail}
        </p>
      </LearningLabBody>
    </LearningLab>
  );
}
