'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock3,
  Fingerprint,
  Globe2,
  LoaderCircle,
  Network,
  Radar,
  Search,
  ShieldBan,
  ShieldCheck,
  Siren,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bound = { min: number; max: number; step: number };
type IndicatorKind = 'domain' | 'hash' | 'ip';
type IndicatorCandidate = {
  id: string;
  label: string;
  observable: string;
  detail: string;
  kind: IndicatorKind;
  baseConfidence: number;
  contextCompleteness: number;
  falsePositiveRisk: number;
  sightings: number;
  lastSeenDaysAgo: number;
  validForDays: number;
  decayEveryDays: number;
  decayPoints: number;
};
type ActionPolicy = {
  id: string;
  label: string;
  detail: string;
  minConfidence: number;
  maxFalsePositiveRisk: number;
  minContextCompleteness: number;
  minSightings: number;
  requiresFresh: boolean;
  blastRadius: string;
};
type TriageModel = {
  title: string;
  description: string;
  defaults: {
    indicatorId: string;
    actionId: string;
    analysisDelayDays: number;
  };
  bounds: { analysisDelayDays: Bound };
  indicators: IndicatorCandidate[];
  actions: ActionPolicy[];
};

const BLOCK_ID = 'technology/threat-intelligence-platforms-calculator';
const DEFAULT_DATA_FILE = '/api/content/technology/threat-intelligence-platforms/data/indicator-triage-model.json';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return isFiniteNumber(candidate.min)
    && isFiniteNumber(candidate.max)
    && isFiniteNumber(candidate.step)
    && candidate.step > 0
    && candidate.max >= candidate.min;
}

function isIndicator(value: unknown): value is IndicatorCandidate {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<IndicatorCandidate>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.observable
      && candidate.detail
      && (candidate.kind === 'domain' || candidate.kind === 'hash' || candidate.kind === 'ip')
      && isFiniteNumber(candidate.baseConfidence)
      && isFiniteNumber(candidate.contextCompleteness)
      && isFiniteNumber(candidate.falsePositiveRisk)
      && isFiniteNumber(candidate.sightings)
      && isFiniteNumber(candidate.lastSeenDaysAgo)
      && isFiniteNumber(candidate.validForDays)
      && isFiniteNumber(candidate.decayEveryDays)
      && candidate.decayEveryDays > 0
      && isFiniteNumber(candidate.decayPoints),
  );
}

function isAction(value: unknown): value is ActionPolicy {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ActionPolicy>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && candidate.blastRadius
      && isFiniteNumber(candidate.minConfidence)
      && isFiniteNumber(candidate.maxFalsePositiveRisk)
      && isFiniteNumber(candidate.minContextCompleteness)
      && isFiniteNumber(candidate.minSightings)
      && typeof candidate.requiresFresh === 'boolean',
  );
}

function isTriageModel(value: unknown): value is TriageModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TriageModel>;
  const indicators = candidate.indicators;
  const actions = candidate.actions;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.indicatorId
      && candidate.defaults.actionId
      && isFiniteNumber(candidate.defaults.analysisDelayDays)
      && candidate.bounds
      && isBound(candidate.bounds.analysisDelayDays)
      && Array.isArray(indicators)
      && indicators.length >= 3
      && indicators.every(isIndicator)
      && indicators.some((item) => item.id === candidate.defaults?.indicatorId)
      && Array.isArray(actions)
      && actions.length >= 3
      && actions.every(isAction)
      && actions.some((item) => item.id === candidate.defaults?.actionId),
  );
}

export default function ThreatIntelligencePlatformsCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<TriageModel | null>(null);
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
        if (!isTriageModel(payload)) throw new Error('The indicator triage model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the triage model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <IndicatorTriageLab data={data} />;
}

function IndicatorTriageLab({ data }: { data: TriageModel }) {
  const [indicatorId, setIndicatorId] = useState(data.defaults.indicatorId);
  const [actionId, setActionId] = useState(data.defaults.actionId);
  const [analysisDelayDays, setAnalysisDelayDays] = useState(data.defaults.analysisDelayDays);

  const indicator = data.indicators.find((item) => item.id === indicatorId) ?? data.indicators[0];
  const action = data.actions.find((item) => item.id === actionId) ?? data.actions[0];

  const result = useMemo(() => {
    const ageDays = indicator.lastSeenDaysAgo + analysisDelayDays;
    const decayPeriods = Math.floor(ageDays / indicator.decayEveryDays);
    const effectiveConfidence = Math.max(
      0,
      indicator.baseConfidence - decayPeriods * indicator.decayPoints,
    );
    const checks = {
      confidence: effectiveConfidence >= action.minConfidence,
      context: indicator.contextCompleteness >= action.minContextCompleteness,
      falsePositive: indicator.falsePositiveRisk <= action.maxFalsePositiveRisk,
      fresh: !action.requiresFresh || ageDays <= indicator.validForDays,
      sightings: indicator.sightings >= action.minSightings,
    };
    const failedChecks = Object.values(checks).filter((pass) => !pass).length;
    const ready = failedChecks === 0;

    let explanation = `${indicator.label} meets this lesson policy's evidence gates for ${action.label.toLowerCase()}. Release still requires the real source, owner, marking, and consumer contract to be verified.`;
    if (!ready) {
      const reasons = [
        !checks.fresh ? 'the evidence is outside its freshness window' : '',
        !checks.confidence ? `effective confidence is below ${action.minConfidence}` : '',
        !checks.falsePositive ? `false-positive risk exceeds ${action.maxFalsePositiveRisk}` : '',
        !checks.context ? `context completeness is below ${action.minContextCompleteness}` : '',
        !checks.sightings ? `fewer than ${action.minSightings} sightings are present` : '',
      ].filter(Boolean);
      explanation = `Hold this action because ${reasons.join(', ')}. A lower-blast-radius investigative use may still be appropriate.`;
    }

    return { ageDays, checks, effectiveConfidence, explanation, failedChecks, ready };
  }, [action, analysisDelayDays, indicator]);

  function reset() {
    setIndicatorId(data.defaults.indicatorId);
    setActionId(data.defaults.actionId);
    setAnalysisDelayDays(data.defaults.analysisDelayDays);
  }

  const StatusIcon = result.ready ? CheckCircle2 : AlertTriangle;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Indicator triage lab"
          title={data.title}
          description={data.description}
          icon={Radar}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Candidate evidence
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.indicators.map((item) => {
                    const Icon = item.kind === 'domain' ? Globe2 : item.kind === 'hash' ? Fingerprint : Network;
                    return (
                      <LabChoice
                        key={item.id}
                        selected={item.id === indicator.id}
                        label={item.label}
                        detail={item.detail}
                        icon={Icon}
                        accent="cyan"
                        onClick={() => setIndicatorId(item.id)}
                      />
                    );
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Intended action
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.actions.map((item) => {
                    const Icon = item.id === 'investigate' ? Search : item.id === 'alert' ? BellRing : ShieldBan;
                    return (
                      <LabChoice
                        key={item.id}
                        selected={item.id === action.id}
                        label={item.label}
                        detail={item.detail}
                        icon={Icon}
                        accent={item.id === 'prevent' ? 'rose' : item.id === 'alert' ? 'amber' : 'blue'}
                        onClick={() => setActionId(item.id)}
                      />
                    );
                  })}
                </div>
              </fieldset>

              <LabRange
                label="Additional analysis delay"
                value={analysisDelayDays}
                output={`${analysisDelayDays} day${analysisDelayDays === 1 ? '' : 's'}`}
                {...data.bounds.analysisDelayDays}
                lowLabel="Act now"
                highLabel="Evidence ages"
                accent="cyan"
                onChange={setAnalysisDelayDays}
              />
            </div>
          )}
        >
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Selected observable
            </p>
            <p className="mt-2 break-all font-mono text-sm font-semibold text-neutral-950 dark:text-white">
              {indicator.observable}
            </p>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <LabMetric
              label="Effective confidence"
              value={`${result.effectiveConfidence}/100`}
              detail={`Starts at ${indicator.baseConfidence}; decays ${indicator.decayPoints} every ${indicator.decayEveryDays} days in this model`}
              icon={Radar}
              tone={result.checks.confidence ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Evidence age"
              value={`${result.ageDays} days`}
              detail={`Freshness window: ${indicator.validForDays} days`}
              icon={Clock3}
              tone={result.checks.fresh ? 'blue' : 'rose'}
            />
            <LabMetric
              label="False-positive risk"
              value={`${indicator.falsePositiveRisk}/100`}
              detail={`${indicator.sightings} corroborating sighting${indicator.sightings === 1 ? '' : 's'}`}
              icon={Siren}
              tone={result.checks.falsePositive ? 'emerald' : 'amber'}
            />
            <LabMetric
              label="Action blast radius"
              value={action.blastRadius}
              detail={action.label}
              icon={ShieldCheck}
              tone={action.id === 'prevent' ? 'rose' : action.id === 'alert' ? 'amber' : 'blue'}
            />
          </div>

          <div className={`mt-5 rounded-md border p-4 ${
            result.ready
              ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
              : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
          }`}>
            <div className="flex items-start gap-3">
              <StatusIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">
                  {result.ready ? `Eligible for ${action.label.toLowerCase()}` : `Hold: ${result.failedChecks} policy gate${result.failedChecks === 1 ? '' : 's'} failed`}
                </p>
                <p className="mt-1 text-sm leading-6 opacity-80">{result.explanation}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-5">
            <ModelCheck label="Fresh enough" pass={result.checks.fresh} />
            <ModelCheck label="Confidence" pass={result.checks.confidence} />
            <ModelCheck label="False positives" pass={result.checks.falsePositive} />
            <ModelCheck label="Context" pass={result.checks.context} />
            <ModelCheck label="Sightings" pass={result.checks.sightings} />
          </div>

          <p className="mt-5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            The thresholds are a transparent teaching policy, not an industry standard or a substitute for an organization's approved response policy.
          </p>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ModelCheck({ label, pass }: { label: string; pass: boolean }) {
  const Icon = pass ? CheckCircle2 : AlertTriangle;
  return (
    <div className="flex min-h-11 items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
      <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${pass ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`} />
      <span className="font-medium">{label}</span>
    </div>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 flex min-h-72 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-300">
      <div className="flex items-center gap-3 text-sm">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
        Loading the indicator triage model...
      </div>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200" role="alert">
      <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-semibold">The indicator triage lab could not be loaded.</p>
        <p className="mt-1 opacity-80">{detail}</p>
      </div>
    </div>
  );
}
