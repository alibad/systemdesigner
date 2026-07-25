'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, CircleAlert, CloudOff, Database, ListChecks, ShieldCheck } from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type Failure = 'ranker-timeout' | 'stale-features' | 'candidate-gap';
type Fallback = 'cached-personal' | 'contextual-popular' | 'empty-shelf';

const failures: Array<{ id: Failure; label: string; detail: string }> = [
  { id: 'ranker-timeout', label: 'Ranker timeout', detail: 'The heavy ranker misses its 100 ms deadline.' },
  { id: 'stale-features', label: 'Stale session features', detail: 'The current-session feature stream is delayed.' },
  { id: 'candidate-gap', label: 'Candidate-source gap', detail: 'A primary retrieval source returns too few items.' },
];

const fallbacks: Array<{ id: Fallback; label: string; detail: string }> = [
  { id: 'cached-personal', label: 'Cached personal slate', detail: 'A recently computed listener-specific slate.' },
  { id: 'contextual-popular', label: 'Contextual popularity', detail: 'Eligible editorial and local popularity candidates.' },
  { id: 'empty-shelf', label: 'Empty shelf', detail: 'Hide the surface instead of returning weak results.' },
];

export default function SpotifyRecommendationsFallbackLab() {
  const [failure, setFailure] = useState<Failure>('ranker-timeout');
  const [fallback, setFallback] = useState<Fallback>('cached-personal');
  const [finalPolicy, setFinalPolicy] = useState(true);

  const result = useMemo(() => {
    const latency = fallback === 'cached-personal' ? 18 : fallback === 'contextual-popular' ? 25 : 4;
    const freshness = fallback === 'cached-personal' ? (failure === 'stale-features' ? 64 : 82) : fallback === 'contextual-popular' ? 53 : 0;
    const relevance = fallback === 'cached-personal' ? (failure === 'stale-features' ? 66 : 81) : fallback === 'contextual-popular' ? 51 : 0;
    const available = fallback !== 'empty-shelf';
    const protectedResult = finalPolicy && available;
    const verdict = !available
      ? 'The shelf is hidden. This can protect trust on a secondary surface, but it removes a discovery opportunity.'
      : !finalPolicy
        ? 'Unsafe fallback: stale or unavailable content can escape. Fallbacks must not bypass final policy.'
        : failure === 'candidate-gap' && fallback === 'cached-personal'
          ? 'The cached slate keeps continuity while another source is unhealthy. Monitor its age and source coverage.'
          : failure === 'stale-features' && fallback === 'contextual-popular'
            ? 'A broad eligible fallback avoids making a precise claim from stale session evidence, at the cost of personalization.'
            : 'This fallback preserves a fast response while final policy rechecks availability, safety, and session repetition.';
    return { latency, freshness, relevance, protectedResult, verdict };
  }, [failure, fallback, finalPolicy]);

  const controls = (
    <div className="space-y-6">
      <fieldset><legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Failure to contain</legend><div className="mt-3 space-y-2">{failures.map((item) => <LabChoice key={item.id} selected={failure === item.id} label={item.label} detail={item.detail} icon={CircleAlert} accent="rose" onClick={() => setFailure(item.id)} />)}</div></fieldset>
      <fieldset><legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Fallback response</legend><div className="mt-3 space-y-2">{fallbacks.map((item) => <LabChoice key={item.id} selected={fallback === item.id} label={item.label} detail={item.detail} icon={Database} accent="blue" onClick={() => setFallback(item.id)} />)}</div></fieldset>
      <LabChoice selected={finalPolicy} label="Run final policy checks" detail="Recheck availability, restrictions, and session deduplication before release." icon={ShieldCheck} accent="emerald" onClick={() => setFinalPolicy((value) => !value)} />
    </div>
  );

  return (
    <LearningLab>
      <LearningLabHeader eyebrow="Resilience lab" title="Choose a fallback that preserves the contract" description="Inject a serving failure, choose a response, and decide whether final policy still runs. A low-latency fallback is not automatically a safe one." icon={CloudOff} accent="rose" onReset={() => { setFailure('ranker-timeout'); setFallback('cached-personal'); setFinalPolicy(true); }} />
      <LearningLabBody controls={controls}>
        <div className="grid gap-3 sm:grid-cols-3"><LabMetric label="Fallback latency" value={`${result.latency} ms`} detail="Time added by fallback path" icon={CloudOff} tone="blue" /><LabMetric label="Personal relevance" value={result.relevance ? `${result.relevance}/100` : 'N/A'} detail="Illustrative quality under failure" icon={ListChecks} tone="violet" /><LabMetric label="Session freshness" value={result.freshness ? `${result.freshness}/100` : 'N/A'} detail="How current the decision is" icon={Database} tone="amber" /></div>
        <div className={`mt-6 rounded-md border p-5 ${result.protectedResult ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50' : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'}`}>
          <div className="flex items-center gap-2 text-sm font-semibold">{result.protectedResult ? <CheckCircle2 aria-hidden="true" className="h-5 w-5" /> : <CircleAlert aria-hidden="true" className="h-5 w-5" />}{result.protectedResult ? 'Listener protections remain active' : 'Listener protections are incomplete'}</div>
          <p className="mt-2 text-sm leading-6 opacity-90">{result.verdict}</p>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
