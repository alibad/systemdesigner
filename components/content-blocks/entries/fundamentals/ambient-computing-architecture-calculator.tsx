'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Gauge,
  Hand,
  RadioTower,
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

type Risk = 'low' | 'medium' | 'high';

interface Signal {
  id: string;
  label: string;
  confidence: number;
  weight: number;
  fresh: boolean;
}

interface Scenario {
  id: string;
  label: string;
  detail: string;
  proposedAction: string;
  risk: Risk;
  signals: Signal[];
}

interface Authority {
  id: 'suggest' | 'confirm' | 'automatic';
  label: string;
  detail: string;
  rank: number;
}

interface ContextModel {
  title: string;
  description: string;
  defaults: { scenarioId: string; authorityId: Authority['id']; threshold: number };
  scenarios: Scenario[];
  authorities: Authority[];
  staleSignalFactor: number;
}

const BLOCK_ID = 'fundamentals/ambient-computing-architecture-calculator';

export default function AmbientComputingArchitectureCalculator({ dataFile }: { dataFile?: string }) {
  const [model, setModel] = useState<ContextModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState('');
  const [authorityId, setAuthorityId] = useState<Authority['id']>('confirm');
  const [threshold, setThreshold] = useState(75);

  useEffect(() => {
    let active = true;
    if (!dataFile) {
      setError('The context evidence model is not configured.');
      return () => { active = false; };
    }

    fetch(dataFile)
      .then((response) => {
        if (!response.ok) throw new Error(`Context model returned ${response.status}`);
        return response.json() as Promise<ContextModel>;
      })
      .then((next) => {
        if (!active) return;
        setModel(next);
        setScenarioId(next.defaults.scenarioId);
        setAuthorityId(next.defaults.authorityId);
        setThreshold(next.defaults.threshold);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load context evidence.');
      });

    return () => { active = false; };
  }, [dataFile]);

  const scenario = model?.scenarios.find((item) => item.id === scenarioId) ?? model?.scenarios[0];
  const authority = model?.authorities.find((item) => item.id === authorityId) ?? model?.authorities[0];

  const result = useMemo(() => {
    if (!model || !scenario || !authority) return null;
    const score = Math.round(scenario.signals.reduce((sum, signal) => {
      const freshness = signal.fresh ? 1 : model.staleSignalFactor;
      return sum + signal.confidence * signal.weight * freshness;
    }, 0));
    const ceiling = { low: 2, medium: 1, high: 0 }[scenario.risk];
    const evidenceReady = score >= threshold;
    const authoritySafe = authority.rank <= ceiling;
    const outcome = !evidenceReady
      ? 'Defer for evidence'
      : !authoritySafe
        ? 'Reduce authority'
        : authority.id === 'automatic'
          ? 'Execute and notify'
          : authority.id === 'confirm'
            ? 'Ask before acting'
            : 'Offer a suggestion';
    return { score, ceiling, evidenceReady, authoritySafe, outcome };
  }, [authority, model, scenario, threshold]);

  if (!model || !scenario || !authority || !result) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Context decision lab"
            title="Decide when context may trigger an action"
            description={error ?? 'Loading lesson-owned sensor evidence.'}
            icon={RadioTower}
            accent={error ? 'rose' : 'cyan'}
          />
        </LearningLab>
      </div>
    );
  }

  const reset = () => {
    setScenarioId(model.defaults.scenarioId);
    setAuthorityId(model.defaults.authorityId);
    setThreshold(model.defaults.threshold);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Context decision lab"
          title={model.title}
          description={model.description}
          icon={RadioTower}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Behavior under consideration
                </legend>
                <div className="mt-3 space-y-2">
                  {model.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Activity}
                      accent="cyan"
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <LabRange
                label="Evidence threshold"
                value={threshold}
                output={`${threshold}%`}
                min={50}
                max={95}
                step={5}
                lowLabel="More permissive"
                highLabel="More cautious"
                accent="amber"
                onChange={setThreshold}
              />
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Automation authority
                </legend>
                <div className="mt-3 space-y-2">
                  {model.authorities.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === authority.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Hand}
                      accent="violet"
                      onClick={() => setAuthorityId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Evidence score" value={`${result.score}%`} detail={`Threshold ${threshold}%`} icon={Gauge} tone={result.evidenceReady ? 'emerald' : 'amber'} />
            <LabMetric label="Action risk" value={scenario.risk} detail={scenario.proposedAction} icon={ShieldCheck} tone={scenario.risk === 'high' ? 'rose' : scenario.risk === 'medium' ? 'amber' : 'blue'} />
            <LabMetric label="Authority" value={authority.label} detail={`Maximum safe rank: ${result.ceiling}`} icon={Hand} tone={result.authoritySafe ? 'violet' : 'rose'} />
            <LabMetric label="Decision" value={result.outcome} icon={result.evidenceReady && result.authoritySafe ? CheckCircle2 : CircleAlert} tone={result.evidenceReady && result.authoritySafe ? 'emerald' : 'rose'} />
          </div>

          <section className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
            <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">Evidence trace</h4>
            <div className="mt-4 space-y-4">
              {scenario.signals.map((signal) => {
                const effective = Math.round(signal.confidence * (signal.fresh ? 1 : model.staleSignalFactor));
                return (
                  <div key={signal.id}>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-semibold text-neutral-700 dark:text-neutral-200">{signal.label}</span>
                      <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
                        {effective}% effective · {Math.round(signal.weight * 100)}% weight
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800">
                      <div className={`h-full ${signal.fresh ? 'bg-cyan-500' : 'bg-amber-500'}`} style={{ width: `${effective}%` }} />
                    </div>
                    {!signal.fresh ? <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Stale evidence is discounted before the decision.</p> : null}
                  </div>
                );
              })}
            </div>
          </section>

          <div className={`mt-6 rounded-md border p-5 ${result.evidenceReady && result.authoritySafe ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50' : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'}`}>
            <p className="font-semibold">{result.outcome}: {scenario.proposedAction}</p>
            <p className="mt-2 text-sm leading-6 opacity-80">
              Context confidence and action authority are separate gates. More sensor evidence never grants permission for a higher-impact action by itself.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
