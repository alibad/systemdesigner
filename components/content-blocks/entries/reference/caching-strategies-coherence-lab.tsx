'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Network,
  RefreshCw,
  Route,
  ShieldAlert,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Pattern = { id: string; label: string; detail: string; authority: string; path: string };
type Scenario = { id: string; label: string; detail: string };
type Effect = { staleRisk: string; duplicateRisk: string; blastRadius: string; recovery: string };
type FailureModel = {
  defaults: { pattern: string; scenario: string };
  patterns: Pattern[];
  scenarios: Scenario[];
  effects: Record<string, Record<string, Effect>>;
};

export default function CachingStrategiesInvalidationFailureLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<FailureModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [patternId, setPatternId] = useState('cache-aside');
  const [scenarioId, setScenarioId] = useState('stale-write');

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The invalidation and failure model was not provided.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<FailureModel>;
      })
      .then((model) => {
        setData(model);
        setPatternId(model.defaults.pattern);
        setScenarioId(model.defaults.scenario);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the invalidation and failure model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabError title="Invalidation failure lab unavailable" detail={loadError} />;
  if (!data) return <LabLoading />;

  const pattern = data.patterns.find((item) => item.id === patternId) ?? data.patterns[0];
  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const effect = data.effects[pattern.id]?.[scenario.id];
  if (!effect) return <LabError title="Invalidation scenario is incomplete" detail="The selected pattern has no configured consequence for this failure." />;

  const warning = /High|divergent|conflicting|data loss|broad/i.test(`${effect.staleRisk} ${effect.duplicateRisk} ${effect.blastRadius}`);

  return (
    <div data-content-block="reference/caching-strategies-coherence-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Write path, failure, and recovery explorer"
          title="Choose the cache pattern you can repair under failure"
          description="Select a cache pattern and inject a real failure. The model makes the authority boundary and operational recovery work visible instead of comparing patterns only by read latency."
          icon={Network}
          accent="violet"
          onReset={() => {
            setPatternId(data.defaults.pattern);
            setScenarioId(data.defaults.scenario);
          }}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Cache pattern</legend>
                <div className="mt-3 space-y-2">
                  {data.patterns.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={pattern.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'write-behind' ? RefreshCw : item.id === 'event-invalidation' ? Network : Database}
                      accent="violet"
                      onClick={() => setPatternId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <label htmlFor="cache-failure-scenario" className="block">
                <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Injected failure</span>
                <select
                  id="cache-failure-scenario"
                  value={scenario.id}
                  onChange={(event) => setScenarioId(event.target.value)}
                  className="mt-3 h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-950 outline-none focus-visible:border-violet-500 focus-visible:ring-2 focus-visible:ring-violet-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                >
                  {data.scenarios.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
                <span className="mt-2 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">{scenario.detail}</span>
              </label>
            </div>
          }
        >
          <div aria-live="polite" className="min-w-0">
            <div className="grid gap-3 sm:grid-cols-2">
              <LabMetric label="Authority" value={pattern.label} detail={pattern.authority} icon={Database} tone="violet" />
              <LabMetric label="Failure injected" value={scenario.label} detail="The selected failure changes the recovery obligation, not just the warning color." icon={ShieldAlert} tone={warning ? 'rose' : 'amber'} />
            </div>

            <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/50">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Selected request and write path</p>
              <div className="mt-3 flex items-start gap-3 text-sm leading-6 text-neutral-800 dark:text-neutral-100">
                <Route aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" />
                <p>{pattern.path}</p>
              </div>
            </section>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <Consequence title="Stale-read risk" detail={effect.staleRisk} icon={AlertTriangle} tone={warning ? 'rose' : 'amber'} />
              <Consequence title="Duplicate or loss risk" detail={effect.duplicateRisk} icon={RefreshCw} tone={warning ? 'rose' : 'blue'} />
              <Consequence title="Blast radius" detail={effect.blastRadius} icon={Network} tone="amber" />
              <Consequence title="Recovery owner" detail={effect.recovery} icon={CheckCircle2} tone="emerald" />
            </div>

            <section className={`mt-5 rounded-md border p-5 ${warning ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100' : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'}`} role="status">
              <div className="flex items-start gap-3">
                {warning ? <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-sm font-semibold">Decision consequence</p>
                  <p className="mt-1 text-sm leading-6 opacity-85">{warning ? 'This combination needs an explicit runbook and a tested repair path before it is a production default.' : 'This combination can be operated safely only while the stated authority, versioning, and recovery steps remain true.'}</p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function Consequence({ title, detail, icon: Icon, tone }: { title: string; detail: string; icon: typeof AlertTriangle; tone: 'rose' | 'amber' | 'blue' | 'emerald' }) {
  const styles = {
    rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50',
    amber: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50',
    blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-50',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50',
  };

  return (
    <section className={`min-w-0 rounded-md border p-4 ${styles[tone]}`}>
      <div className="flex items-center gap-2 text-sm font-semibold"><Icon aria-hidden="true" className="h-4 w-4 shrink-0" />{title}</div>
      <p className="mt-2 text-sm leading-6 opacity-85">{detail}</p>
    </section>
  );
}

function LabLoading() {
  return <div data-content-block="reference/caching-strategies-coherence-lab"><div className="min-h-[620px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading invalidation failure lab" /></div>;
}

function LabError({ title, detail }: { title: string; detail: string }) {
  return <div data-content-block="reference/caching-strategies-coherence-lab"><div className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert"><p className="font-semibold">{title}</p><p className="mt-2 opacity-80">{detail}</p></div></div>;
}
