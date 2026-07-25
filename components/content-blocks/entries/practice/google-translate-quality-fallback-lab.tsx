'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  Languages,
  Route,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TextQuote,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type PairId = 'high' | 'medium' | 'low';
type ScenarioId = 'general' | 'entities' | 'medical';
type RouteId = 'direct' | 'adapter' | 'pivot';

type PairProfile = {
  id: PairId;
  label: string;
  detail: string;
  direct: number;
  adapter: number;
  pivot: number;
  latencyDelta: number;
};

type Scenario = {
  id: ScenarioId;
  label: string;
  detail: string;
  qualityDelta: number;
  terminologyRisk: number;
  critical: boolean;
  icon: LucideIcon;
};

type TranslationRoute = {
  id: RouteId;
  label: string;
  detail: string;
  baseMs: number;
  icon: LucideIcon;
};

const pairs: PairProfile[] = [
  { id: 'high', label: 'Spanish -> English', detail: 'High-resource pair with abundant direct evidence', direct: 91, adapter: 94, pivot: 82, latencyDelta: 0 },
  { id: 'medium', label: 'Swahili -> French', detail: 'Medium-resource pair with uneven domain coverage', direct: 80, adapter: 87, pivot: 79, latencyDelta: 18 },
  { id: 'low', label: 'Yoruba -> Igbo', detail: 'Low-resource pair with sparse direct parallel data', direct: 68, adapter: 78, pivot: 74, latencyDelta: 32 },
];

const scenarios: Scenario[] = [
  { id: 'general', label: 'General message', detail: 'Common phrasing with no special terminology', qualityDelta: 0, terminologyRisk: 4, critical: false, icon: TextQuote },
  { id: 'entities', label: 'Names and code-switching', detail: 'People, product names, and mixed-language phrases', qualityDelta: -7, terminologyRisk: 18, critical: false, icon: Sparkles },
  { id: 'medical', label: 'Medical instruction', detail: 'Specialized terminology with real-world consequences', qualityDelta: -10, terminologyRisk: 30, critical: true, icon: Stethoscope },
];

const routes: TranslationRoute[] = [
  { id: 'direct', label: 'Direct multilingual', detail: 'One shared model, lowest operational complexity', baseMs: 78, icon: Languages },
  { id: 'adapter', label: 'Specialized adapter', detail: 'Pair or domain adapter on the shared backbone', baseMs: 122, icon: FileCheck2 },
  { id: 'pivot', label: 'Pivot through English', detail: 'Broader coverage with two translation steps', baseMs: 176, icon: Route },
];

const clamp = (value: number) => Math.min(99, Math.max(0, value));

export default function GoogleTranslateQualityFallbackLab() {
  const [pairId, setPairId] = useState<PairId>('medium');
  const [scenarioId, setScenarioId] = useState<ScenarioId>('entities');
  const [routeId, setRouteId] = useState<RouteId>('adapter');
  const [qualityFloor, setQualityFloor] = useState(82);
  const [terminologyGuard, setTerminologyGuard] = useState(true);
  const [humanReview, setHumanReview] = useState(false);

  const result = useMemo(() => {
    const pair = pairs.find((item) => item.id === pairId) ?? pairs[1];
    const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[1];
    const route = routes.find((item) => item.id === routeId) ?? routes[1];
    const routeQuality = route.id === 'direct' ? pair.direct : route.id === 'adapter' ? pair.adapter : pair.pivot;
    const guardLift = terminologyGuard && scenario.id !== 'general' ? 6 : 0;
    const quality = clamp(routeQuality + scenario.qualityDelta + guardLift);
    const terminologyRisk = Math.max(0, scenario.terminologyRisk + (route.id === 'pivot' ? 6 : 0) - (terminologyGuard ? 13 : 0));
    const latency = route.baseMs + pair.latencyDelta + (scenario.critical ? 18 : 0) + (terminologyGuard ? 12 : 0);
    const qualityPass = quality >= qualityFloor;
    const terminologyPass = terminologyRisk <= 12;
    const latencyPass = latency <= 200;

    let outcome: 'release' | 'review' | 'abstain' = 'release';
    let decision = 'Release with confidence metadata';
    let explanation = 'This route clears the slice-specific quality, terminology, and interactive latency gates.';

    if (scenario.critical) {
      outcome = humanReview ? 'review' : 'abstain';
      decision = humanReview ? 'Queue specialist review' : 'Block until specialist review is available';
      explanation = 'A modeled confidence score is not sufficient authority for consequential medical wording.';
    } else if (!qualityPass || !terminologyPass) {
      outcome = humanReview ? 'review' : 'abstain';
      decision = humanReview ? 'Route the uncertain translation to review' : 'Abstain or ask for more context';
      explanation = !qualityPass
        ? 'The selected route misses the quality floor for this language and content slice.'
        : 'Entity or terminology risk remains too high for automatic release.';
    } else if (!latencyPass) {
      outcome = 'review';
      decision = 'Move this route off the interactive path';
      explanation = 'The translation may be useful, but a two-step or specialized route cannot meet the 200 ms interactive deadline.';
    }

    return {
      pair,
      scenario,
      route,
      quality,
      terminologyRisk,
      latency,
      qualityPass,
      terminologyPass,
      latencyPass,
      outcome,
      decision,
      explanation,
    };
  }, [humanReview, pairId, qualityFloor, routeId, scenarioId, terminologyGuard]);

  const reset = () => {
    setPairId('medium');
    setScenarioId('entities');
    setRouteId('adapter');
    setQualityFloor(82);
    setTerminologyGuard(true);
    setHumanReview(false);
  };

  const controls = (
    <div className="space-y-6">
      <fieldset>
        <legend className="text-sm font-semibold text-neutral-950 dark:text-white">1. Choose a language pair</legend>
        <div className="mt-3 space-y-2">
          {pairs.map((pair) => (
            <LabChoice key={pair.id} selected={pair.id === pairId} label={pair.label} detail={pair.detail} icon={Languages} accent="cyan" onClick={() => setPairId(pair.id)} />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-neutral-950 dark:text-white">2. Inject a content condition</legend>
        <div className="mt-3 space-y-2">
          {scenarios.map((scenario) => (
            <LabChoice key={scenario.id} selected={scenario.id === scenarioId} label={scenario.label} detail={scenario.detail} icon={scenario.icon} accent="rose" onClick={() => setScenarioId(scenario.id)} />
          ))}
        </div>
      </fieldset>
    </div>
  );

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Quality and fallback lab"
        title="Decide whether the translation may be released"
        description="Change the language pair, content slice, route, and release controls. Average model quality never overrides a failed slice or a high-consequence review policy."
        icon={ShieldCheck}
        accent="rose"
        onReset={reset}
      />
      <LearningLabBody controls={controls}>
        <fieldset>
          <legend className="text-sm font-semibold text-neutral-950 dark:text-white">3. Choose the translation route</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {routes.map((route) => (
              <LabChoice key={route.id} selected={route.id === routeId} label={route.label} detail={route.detail} icon={route.icon} accent="violet" onClick={() => setRouteId(route.id)} />
            ))}
          </div>
        </fieldset>

        <div className="mt-6 grid gap-5 rounded-lg border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-3 dark:border-neutral-800 dark:bg-neutral-900/50">
          <LabRange label="Release quality floor" value={qualityFloor} output={`${qualityFloor}/100`} min={70} max={95} step={1} accent="violet" lowLabel="More coverage" highLabel="More certainty" onChange={setQualityFloor} />
          <PolicyToggle label="Terminology guard" detail="Verify entities, numbers, glossary terms, and copied spans." checked={terminologyGuard} onClick={() => setTerminologyGuard((value) => !value)} />
          <PolicyToggle label="Human review" detail="Permit a governed specialist queue for uncertain output." checked={humanReview} onClick={() => setHumanReview((value) => !value)} />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <LabMetric label="Quality estimate" value={`${result.quality}/100`} detail={`Floor ${qualityFloor}`} icon={Sparkles} tone={result.qualityPass ? 'violet' : 'rose'} />
          <LabMetric label="Terminology risk" value={`${result.terminologyRisk}/100`} detail="Pass at 12 or lower" icon={TextQuote} tone={result.terminologyPass ? 'emerald' : 'amber'} />
          <LabMetric label="Modeled p95" value={`${result.latency} ms`} detail="Interactive target 200 ms" icon={Route} tone={result.latencyPass ? 'cyan' : 'amber'} />
          <LabMetric label="Outcome" value={result.outcome === 'release' ? 'Release' : result.outcome === 'review' ? 'Review' : 'Abstain'} detail={result.pair.label} icon={result.outcome === 'release' ? CheckCircle2 : UserCheck} tone={result.outcome === 'release' ? 'emerald' : result.outcome === 'review' ? 'amber' : 'rose'} />
        </div>

        <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Visible request path</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <PathStage number="1" label="Detect" value={result.pair.label} />
            <PathStage number="2" label="Translate" value={result.route.label} />
            <PathStage number="3" label="Verify" value={terminologyGuard ? 'Terms checked' : 'No term guard'} warning={!result.terminologyPass} />
            <PathStage number="4" label="Decide" value={result.outcome === 'release' ? 'Released' : result.outcome === 'review' ? 'Review queue' : 'No output'} warning={result.outcome !== 'release'} />
          </div>
        </div>

        <div className={result.outcome === 'release'
          ? 'mt-5 border-l-4 border-emerald-500 bg-emerald-50 p-4 dark:border-emerald-300 dark:bg-emerald-950/60'
          : result.outcome === 'review'
            ? 'mt-5 border-l-4 border-amber-500 bg-amber-50 p-4 dark:border-amber-300 dark:bg-amber-950/60'
            : 'mt-5 border-l-4 border-rose-500 bg-rose-50 p-4 dark:border-rose-300 dark:bg-rose-950/60'}>
          <div className="flex items-start gap-3">
            {result.outcome === 'release' ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-700 dark:text-emerald-200" /> : <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-200" />}
            <div><p className="font-semibold">{result.decision}</p><p className="mt-1 text-sm leading-6 opacity-80">{result.explanation}</p></div>
          </div>
        </div>
        <p className="sr-only" aria-live="polite">{result.decision}. Quality is {result.quality}, terminology risk is {result.terminologyRisk}, and latency is {result.latency} milliseconds.</p>
      </LearningLabBody>
    </LearningLab>
  );
}

function PolicyToggle({ label, detail, checked, onClick }: { label: string; detail: string; checked: boolean; onClick: () => void }) {
  return <button type="button" role="switch" aria-checked={checked} onClick={onClick} className={checked ? 'rounded-md border border-emerald-500 bg-emerald-50 p-3 text-left text-emerald-950 ring-1 ring-emerald-500 dark:border-emerald-300 dark:bg-emerald-950 dark:text-emerald-50 dark:ring-emerald-300' : 'rounded-md border border-neutral-200 bg-white p-3 text-left text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'}><span className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">{label}</span><span aria-hidden="true" className={`relative h-5 w-9 shrink-0 rounded-full ${checked ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}><span className={`absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`} /></span></span><span className="mt-1 block text-xs leading-5 opacity-75">{detail}</span></button>;
}

function PathStage({ number, label, value, warning = false }: { number: string; label: string; value: string; warning?: boolean }) {
  return <div className={`min-w-0 rounded-md border p-3 ${warning ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40' : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'}`}><span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{number}. {label}</span><p className="mt-2 break-words text-sm font-semibold text-neutral-950 dark:text-white">{value}</p></div>;
}
