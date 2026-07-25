'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Clock,
  Database,
  Gauge,
  Search,
  Shield,
  Target,
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

const BLOCK_ID = 'ml-systems/shap-lime-explainability-calculator';

type Purpose = 'debug' | 'review' | 'monitor';
type ModelFamily = 'tree' | 'opaque' | 'text';
type MethodId = 'tree-shap' | 'sampled-shap' | 'lime';

type MethodProfile = {
  id: MethodId;
  label: string;
  detail: string;
  validation: string;
  scope: string;
};

const defaults = {
  purpose: 'review' as Purpose,
  modelFamily: 'tree' as ModelFamily,
  latencyBudgetMs: 1_000,
  correlationRisk: 45,
};

const purposes: Array<{
  id: Purpose;
  label: string;
  detail: string;
  icon: typeof Search;
}> = [
  {
    id: 'debug',
    label: 'Debug one surprising prediction',
    detail: 'A model builder needs a fast local hypothesis to investigate.',
    icon: Search,
  },
  {
    id: 'review',
    label: 'Review an individual decision',
    detail: 'A reviewer needs a reproducible case packet and explicit limitations.',
    icon: Users,
  },
  {
    id: 'monitor',
    label: 'Monitor population behavior',
    detail: 'A model owner needs aggregated attribution drift and slice comparisons.',
    icon: BarChart3,
  },
];

const modelFamilies: Array<{
  id: ModelFamily;
  label: string;
  detail: string;
  icon: typeof Database;
}> = [
  {
    id: 'tree',
    label: 'Tree ensemble',
    detail: 'The model structure is available to a specialized explainer.',
    icon: Database,
  },
  {
    id: 'opaque',
    label: 'Prediction API only',
    detail: 'The explainer can query scores but cannot inspect model internals.',
    icon: Shield,
  },
  {
    id: 'text',
    label: 'Sparse text classifier',
    detail: 'The interpretable representation is token or phrase presence.',
    icon: Activity,
  },
];

const methodProfiles: Record<MethodId, MethodProfile> = {
  'tree-shap': {
    id: 'tree-shap',
    label: 'TreeSHAP',
    detail: 'Use the model structure for efficient additive attributions.',
    validation: 'Reconcile base value plus contributions to the explained model output.',
    scope: 'Local packets and aggregated global summaries',
  },
  'sampled-shap': {
    id: 'sampled-shap',
    label: 'Sampled model-agnostic SHAP',
    detail: 'Estimate additive attributions through repeated model queries.',
    validation: 'Gate additivity residual, seed stability, and background sensitivity.',
    scope: 'Selected local cases and bounded cohort analysis',
  },
  lime: {
    id: 'lime',
    label: 'LIME',
    detail: 'Fit a weighted interpretable surrogate around one prediction.',
    validation: 'Gate weighted local fidelity, seed stability, and neighborhood realism.',
    scope: 'Fast local investigation, not global feature importance',
  },
};

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, value));
}

export default function ShapLimeExplainabilityCalculator() {
  const [purpose, setPurpose] = useState<Purpose>(defaults.purpose);
  const [modelFamily, setModelFamily] = useState<ModelFamily>(defaults.modelFamily);
  const [latencyBudgetMs, setLatencyBudgetMs] = useState(defaults.latencyBudgetMs);
  const [correlationRisk, setCorrelationRisk] = useState(defaults.correlationRisk);

  const result = useMemo(() => {
    const scores: Record<MethodId, number> = {
      'tree-shap': modelFamily === 'tree' ? 76 : -100,
      'sampled-shap': 55,
      lime: 54,
    };

    if (purpose === 'debug') {
      scores.lime += 18;
      scores['tree-shap'] += 8;
      scores['sampled-shap'] -= 4;
    }
    if (purpose === 'review') {
      scores['tree-shap'] += 14;
      scores['sampled-shap'] += 10;
      scores.lime += 2;
    }
    if (purpose === 'monitor') {
      scores['tree-shap'] += 16;
      scores['sampled-shap'] += 8;
      scores.lime -= 24;
    }

    if (modelFamily === 'opaque') {
      scores['sampled-shap'] += 13;
      scores.lime += 8;
    }
    if (modelFamily === 'text') {
      scores.lime += 15;
      scores['sampled-shap'] += 2;
    }

    if (latencyBudgetMs < 500) {
      scores.lime += 12;
      scores['sampled-shap'] -= 22;
    } else if (latencyBudgetMs > 2_000) {
      scores['sampled-shap'] += 8;
    }

    scores.lime -= correlationRisk * 0.18;
    scores['sampled-shap'] -= correlationRisk * 0.08;
    scores['tree-shap'] -= correlationRisk * 0.04;

    const ranked = (Object.keys(scores) as MethodId[])
      .filter((id) => scores[id] >= 0)
      .sort((left, right) => scores[right] - scores[left]);
    const method = methodProfiles[ranked[0] ?? 'sampled-shap'];
    const normalizedScores = (Object.keys(scores) as MethodId[]).map((id) => ({
      ...methodProfiles[id],
      score: scores[id] < 0 ? 0 : Math.round(clamp(scores[id])),
      unavailable: scores[id] < 0,
    }));
    const estimatedQueries = method.id === 'tree-shap'
      ? 'Model-native'
      : method.id === 'lime'
        ? '1K-5K / case'
        : '5K-50K / case';
    const repeatabilityRisk = correlationRisk >= 70
      ? 'High'
      : correlationRisk >= 40 || method.id !== 'tree-shap'
        ? 'Medium'
        : 'Lower';
    const artifact = purpose === 'monitor'
      ? 'Versioned cohort summary plus sampled local cases'
      : purpose === 'review'
        ? 'Immutable case packet with model output and reference cohort'
        : 'Short-lived diagnostic with seed and neighborhood metadata';
    const latencyFit = method.id === 'sampled-shap' && latencyBudgetMs < 750
      ? 'Precompute'
      : method.id === 'lime' && latencyBudgetMs >= 250
        ? 'Likely online'
        : method.id === 'tree-shap'
          ? 'Profile first'
          : 'Queue work';
    const scopeLabel = purpose === 'monitor' ? 'Cohort' : 'Local';
    const caveat = correlationRisk >= 70
      ? 'Correlated inputs can share, swap, or mask attribution. Group related features and test multiple plausible reference distributions before presenting a ranked list.'
      : purpose === 'monitor' && method.id === 'lime'
        ? 'LIME explains one neighborhood. Do not average local surrogate coefficients and call the result global importance.'
        : 'Treat the result as model-behavior evidence under a declared reference and representation, never as proof of real-world causality.';

    return {
      artifact,
      caveat,
      estimatedQueries,
      latencyFit,
      method,
      normalizedScores,
      repeatabilityRisk,
      scopeLabel,
    };
  }, [correlationRisk, latencyBudgetMs, modelFamily, purpose]);

  function reset() {
    setPurpose(defaults.purpose);
    setModelFamily(defaults.modelFamily);
    setLatencyBudgetMs(defaults.latencyBudgetMs);
    setCorrelationRisk(defaults.correlationRisk);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Explanation contract lab"
          title="Which explainer fits the decision you need to support?"
          description="Choose the user, access boundary, latency envelope, and dependence risk. The result recommends a starting method and the evidence needed to trust it."
          icon={Target}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Explanation purpose
                </legend>
                <div className="mt-3 space-y-2">
                  {purposes.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === purpose}
                      label={item.label}
                      detail={item.detail}
                      icon={item.icon}
                      accent="cyan"
                      onClick={() => setPurpose(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Model access
                </legend>
                <div className="mt-3 space-y-2">
                  {modelFamilies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === modelFamily}
                      label={item.label}
                      detail={item.detail}
                      icon={item.icon}
                      accent="blue"
                      onClick={() => setModelFamily(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Response budget"
                value={latencyBudgetMs}
                output={`${latencyBudgetMs.toLocaleString()} ms`}
                min={100}
                max={5_000}
                step={100}
                accent="amber"
                lowLabel="Synchronous"
                highLabel="Queued review"
                onChange={setLatencyBudgetMs}
              />

              <LabRange
                label="Feature dependence risk"
                value={correlationRisk}
                output={`${correlationRisk}/100`}
                min={0}
                max={100}
                step={5}
                accent="rose"
                lowLabel="Mostly independent"
                highLabel="Strongly coupled"
                onChange={setCorrelationRisk}
              />
            </div>
          )}
        >
          <div className="space-y-6" aria-live="polite">
            <div className="rounded-md border border-cyan-200 bg-cyan-50 p-5 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-50">
              <div className="flex items-start gap-3">
                <Target aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Recommended starting point</p>
                  <h4 className="mt-1 text-xl font-semibold">{result.method.label}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">{result.method.detail}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Evidence scope"
                value={result.scopeLabel}
                detail={result.method.scope}
                icon={BarChart3}
                tone="blue"
              />
              <LabMetric
                label="Model queries"
                value={result.estimatedQueries}
                detail="Order-of-magnitude planning envelope"
                icon={Activity}
                tone="violet"
              />
              <LabMetric
                label="Latency plan"
                value={result.latencyFit}
                detail={`Against a ${latencyBudgetMs.toLocaleString()} ms response budget`}
                icon={Clock}
                tone="amber"
              />
              <LabMetric
                label="Repeatability risk"
                value={result.repeatabilityRisk}
                detail="Driven by dependence, sampling, and representation"
                icon={Gauge}
                tone={result.repeatabilityRisk === 'High' ? 'rose' : result.repeatabilityRisk === 'Medium' ? 'amber' : 'emerald'}
              />
            </div>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/70">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Method fit
                  </p>
                  <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                    Fit is contextual, not a universal accuracy score.
                  </p>
                </div>
                <Activity aria-hidden="true" className="h-5 w-5 shrink-0 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div className="mt-5 space-y-4">
                {result.normalizedScores.map((method) => (
                  <div key={method.id}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className={`font-semibold ${method.id === result.method.id ? 'text-cyan-700 dark:text-cyan-300' : 'text-neutral-700 dark:text-neutral-300'}`}>
                        {method.label}
                      </span>
                      <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
                        {method.unavailable ? 'Unavailable' : `${method.score}/100`}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800">
                      <div
                        className={`h-full transition-[width] duration-300 ${method.id === result.method.id ? 'bg-cyan-500' : 'bg-neutral-500'}`}
                        style={{ width: `${method.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
                  <Shield aria-hidden="true" className="h-4 w-4" />
                  Validation contract
                </div>
                <p className="mt-3 text-sm leading-6">{result.method.validation}</p>
              </div>
              <div className="rounded-md border border-violet-200 bg-violet-50 p-5 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-50">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
                  <Users aria-hidden="true" className="h-4 w-4" />
                  Deliverable
                </div>
                <p className="mt-3 text-sm leading-6">{result.artifact}</p>
              </div>
            </div>

            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50">
              <p className="text-sm leading-6">{result.caveat}</p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
