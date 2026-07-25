'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Gauge,
  Languages,
  RefreshCw,
  Scale,
  ShieldAlert,
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

type Severity = 'moderate' | 'high' | 'critical';
type PolicyId = 'traffic' | 'equal' | 'severity';

interface EvaluationSlice {
  id: string;
  label: string;
  context: string;
  trafficSharePct: number;
  severity: Severity;
  pilotViolationPct: number;
  evaluatorAgreementPct: number;
}

interface ProductProfile {
  id: string;
  label: string;
  detail: string;
  slices: EvaluationSlice[];
}

interface AllocationPolicy {
  id: PolicyId;
  label: string;
  detail: string;
}

interface SliceEvidenceData {
  title: string;
  description: string;
  defaults: {
    productId: string;
    policyId: PolicyId;
    evaluationBudget: number;
    humanReviewPct: number;
  };
  requirements: {
    minimumCasesBySeverity: Record<Severity, number>;
    minimumHumanReviewsBySeverity: Record<Severity, number>;
    maximumMarginPctBySeverity: Record<Severity, number>;
  };
  policies: AllocationPolicy[];
  products: ProductProfile[];
}

const DEFAULT_DATA_FILE =
  '/api/content/genai/safety-evaluation/data/slice-evidence-model.json';
const BLOCK_ID = 'genai/safety-evaluation-slice-evidence-lab';
const Z_95 = 1.96;

const severityWeight: Record<Severity, number> = {
  moderate: 1,
  high: 2,
  critical: 4,
};

function isSliceEvidenceData(value: unknown): value is SliceEvidenceData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<SliceEvidenceData>;
  return Boolean(
    data.title
      && data.description
      && data.defaults
      && data.requirements
      && Array.isArray(data.policies)
      && data.policies.length > 0
      && Array.isArray(data.products)
      && data.products.length > 0
      && data.products.every((product) => (
        typeof product.id === 'string'
        && Array.isArray(product.slices)
        && product.slices.length > 0
        && product.slices.every((slice) => (
          typeof slice.id === 'string'
          && typeof slice.trafficSharePct === 'number'
          && typeof slice.pilotViolationPct === 'number'
          && typeof slice.evaluatorAgreementPct === 'number'
        ))
      )),
  );
}

function allocationWeights(slices: EvaluationSlice[], policyId: PolicyId) {
  return slices.map((slice) => {
    if (policyId === 'equal') return 1;
    if (policyId === 'severity') {
      return Math.sqrt(Math.max(1, slice.trafficSharePct)) * severityWeight[slice.severity];
    }
    return slice.trafficSharePct;
  });
}

function allocateExactly(budget: number, weights: number[]) {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const raw = weights.map((weight) => budget * weight / totalWeight);
  const allocated = raw.map(Math.floor);
  let remainder = budget - allocated.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction);

  for (const item of order) {
    if (remainder <= 0) break;
    allocated[item.index] += 1;
    remainder -= 1;
  }

  return allocated;
}

function wilsonMarginPct(ratePct: number, sampleSize: number) {
  const proportion = ratePct / 100;
  const zSquared = Z_95 * Z_95;
  const denominator = 1 + zSquared / sampleSize;
  const spread = Z_95 * Math.sqrt(
    proportion * (1 - proportion) / sampleSize
      + zSquared / (4 * sampleSize * sampleSize),
  ) / denominator;
  return spread * 100;
}

export default function SafetyEvaluationSliceEvidenceLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<SliceEvidenceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [productId, setProductId] = useState('');
  const [policyId, setPolicyId] = useState<PolicyId>('traffic');
  const [evaluationBudget, setEvaluationBudget] = useState(1200);
  const [humanReviewPct, setHumanReviewPct] = useState(12);

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile, { signal: controller.signal });
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isSliceEvidenceData(payload)) {
          throw new Error('Slice evidence data is incomplete.');
        }

        setData(payload);
        setProductId(payload.defaults.productId);
        setPolicyId(payload.defaults.policyId);
        setEvaluationBudget(payload.defaults.evaluationBudget);
        setHumanReviewPct(payload.defaults.humanReviewPct);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load slice evidence.');
      }
    }

    void loadData();
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const product = data?.products.find((item) => item.id === productId) ?? data?.products[0];
  const policy = data?.policies.find((item) => item.id === policyId) ?? data?.policies[0];

  const model = useMemo(() => {
    if (!data || !product || !policy) return null;

    const allocations = allocateExactly(
      evaluationBudget,
      allocationWeights(product.slices, policy.id),
    );
    const rows = product.slices.map((slice, index) => {
      const cases = allocations[index];
      const evaluationSharePct = cases / evaluationBudget * 100;
      const humanCases = Math.round(cases * humanReviewPct / 100);
      const marginPct = wilsonMarginPct(slice.pilotViolationPct, cases);
      const minimumCases = data.requirements.minimumCasesBySeverity[slice.severity];
      const minimumHumanCases =
        data.requirements.minimumHumanReviewsBySeverity[slice.severity];
      const maximumMarginPct =
        data.requirements.maximumMarginPctBySeverity[slice.severity];
      const blockers = [
        cases < minimumCases ? `${minimumCases - cases} more test cases` : null,
        humanCases < minimumHumanCases
          ? `${minimumHumanCases - humanCases} more calibrated reviews`
          : null,
        marginPct > maximumMarginPct
          ? `narrow the 95% margin below +/-${maximumMarginPct} points`
          : null,
      ].filter((item): item is string => Boolean(item));

      return {
        ...slice,
        blockers,
        cases,
        evaluationSharePct,
        humanCases,
        marginPct,
        ready: blockers.length === 0,
      };
    });
    const readyCount = rows.filter((row) => row.ready).length;
    const criticalRows = rows.filter((row) => row.severity === 'critical');
    const rarestRow = [...rows].sort(
      (left, right) => left.trafficSharePct - right.trafficSharePct,
    )[0];
    return {
      criticalReady: criticalRows.every((row) => row.ready),
      rarestRow,
      readyCount,
      rows,
    };
  }, [data, evaluationBudget, humanReviewPct, policy, product]);

  function reset() {
    if (!data) return;
    setProductId(data.defaults.productId);
    setPolicyId(data.defaults.policyId);
    setEvaluationBudget(data.defaults.evaluationBudget);
    setHumanReviewPct(data.defaults.humanReviewPct);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Slice evidence planner"
          title={data?.title ?? 'Allocate evidence where harm can hide'}
          description={data?.description ?? 'Loading the evaluation allocation model...'}
          icon={Scale}
          accent="violet"
          onReset={data ? reset : undefined}
        />

        {!data || !product || !policy || !model ? (
          <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Product context
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.products.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === product.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.id === 'global-support' ? Languages : item.id === 'health-guidance' ? ShieldAlert : Users}
                        accent={item.id === 'global-support' ? 'blue' : item.id === 'health-guidance' ? 'rose' : 'amber'}
                        onClick={() => setProductId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    2. Allocation policy
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.policies.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === policy.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.id === 'severity' ? ShieldAlert : item.id === 'equal' ? Scale : Gauge}
                        accent={item.id === 'severity' ? 'rose' : item.id === 'equal' ? 'violet' : 'cyan'}
                        onClick={() => setPolicyId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="3. Evaluation budget"
                  value={evaluationBudget}
                  output={`${evaluationBudget.toLocaleString()} cases`}
                  min={400}
                  max={4000}
                  step={100}
                  accent="blue"
                  lowLabel="Sparse evidence"
                  highLabel="Broad evidence"
                  onChange={setEvaluationBudget}
                />

                <LabRange
                  label="4. Human calibration"
                  value={humanReviewPct}
                  output={`${humanReviewPct}%`}
                  min={5}
                  max={40}
                  step={1}
                  accent="amber"
                  lowLabel="Small audit"
                  highLabel="Deep review"
                  onChange={setHumanReviewPct}
                />
              </div>
            )}
          >
            <div className="min-h-[720px] min-w-0">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Budget preserved"
                  value={model.rows.reduce((sum, row) => sum + row.cases, 0).toLocaleString()}
                  detail="Allocated cases sum exactly to the selected budget"
                  icon={Target}
                  tone="blue"
                />
                <LabMetric
                  label="Slices ready"
                  value={`${model.readyCount} / ${model.rows.length}`}
                  detail="Case count, human calibration, and margin all pass"
                  icon={CheckCircle2}
                  tone={model.readyCount === model.rows.length ? 'emerald' : 'amber'}
                />
                <LabMetric
                  label="Critical evidence"
                  value={model.criticalReady ? 'Supported' : 'Not ready'}
                  detail="Critical slices are never rescued by a healthy average"
                  icon={ShieldAlert}
                  tone={model.criticalReady ? 'emerald' : 'rose'}
                />
                <LabMetric
                  label="Rarest slice"
                  value={`${model.rarestRow.trafficSharePct}% traffic`}
                  detail={model.rarestRow.label}
                  icon={Users}
                  tone="violet"
                />
              </div>

              <section className="mt-6" aria-labelledby="allocation-comparison-title">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h4
                      id="allocation-comparison-title"
                      className="text-base font-semibold text-neutral-950 dark:text-white"
                    >
                      Traffic share versus evaluation share
                    </h4>
                    <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                      A wider purple bar means the policy deliberately gathers more evidence than production prevalence alone would provide.
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-neutral-600 sm:mt-0 dark:text-neutral-300">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-neutral-300 dark:bg-neutral-600" />
                      Traffic
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-violet-500" />
                      Evaluation
                    </span>
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  {model.rows.map((row) => (
                    <div key={row.id}>
                      <div className="mb-1.5 flex items-center justify-between gap-4 text-xs">
                        <span className="min-w-0 truncate font-medium text-neutral-800 dark:text-neutral-100">
                          {row.label}
                        </span>
                        <span className="shrink-0 tabular-nums text-neutral-500 dark:text-neutral-400">
                          {row.trafficSharePct.toFixed(0)}% / {row.evaluationSharePct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="relative h-4 overflow-hidden rounded-sm bg-neutral-100 dark:bg-neutral-800">
                        <div
                          className="absolute inset-y-0 left-0 bg-neutral-300 dark:bg-neutral-600"
                          style={{ width: `${row.trafficSharePct}%` }}
                        />
                        <div
                          className="absolute bottom-0 left-0 h-1.5 bg-violet-500"
                          style={{ width: `${row.evaluationSharePct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-7" aria-labelledby="slice-readiness-title">
                <h4
                  id="slice-readiness-title"
                  className="text-base font-semibold text-neutral-950 dark:text-white"
                >
                  Evidence by declared slice
                </h4>
                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  {model.rows.map((row) => (
                    <article
                      key={row.id}
                      className={`rounded-md border p-4 ${
                        row.ready
                          ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20'
                          : 'border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h5 className="font-semibold text-neutral-950 dark:text-white">
                              {row.label}
                            </h5>
                            <SeverityBadge severity={row.severity} />
                          </div>
                          <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                            {row.context}
                          </p>
                        </div>
                        {row.ready ? (
                          <CheckCircle2 aria-label="Evidence ready" className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                        ) : (
                          <AlertTriangle aria-label="Evidence incomplete" className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
                        )}
                      </div>

                      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                        <div>
                          <dt className="text-xs text-neutral-500 dark:text-neutral-400">Allocated</dt>
                          <dd className="mt-0.5 font-semibold tabular-nums text-neutral-950 dark:text-white">
                            {row.cases} cases
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-neutral-500 dark:text-neutral-400">Human review</dt>
                          <dd className="mt-0.5 font-semibold tabular-nums text-neutral-950 dark:text-white">
                            {row.humanCases} cases
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-neutral-500 dark:text-neutral-400">Planning margin</dt>
                          <dd className="mt-0.5 font-semibold tabular-nums text-neutral-950 dark:text-white">
                            +/-{row.marginPct.toFixed(1)} pts
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-neutral-500 dark:text-neutral-400">Evaluator agreement</dt>
                          <dd className="mt-0.5 font-semibold tabular-nums text-neutral-950 dark:text-white">
                            {row.evaluatorAgreementPct}%
                          </dd>
                        </div>
                      </dl>

                      {row.blockers.length > 0 ? (
                        <p className="mt-4 border-t border-current/10 pt-3 text-xs leading-5 text-neutral-700 dark:text-neutral-200">
                          <strong>Evidence gap:</strong> {row.blockers.join('; ')}.
                        </p>
                      ) : (
                        <p className="mt-4 border-t border-current/10 pt-3 text-xs leading-5 text-neutral-700 dark:text-neutral-200">
                          The plan supports a bounded claim for this slice. It does not prove the absence of harm outside the tested cases.
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </section>

              <div className="mt-6 rounded-md border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100">
                <strong>{policy.label} consequence:</strong>{' '}
                {policy.id === 'traffic'
                  ? `${model.rarestRow.label} receives only ${model.rarestRow.evaluationSharePct.toFixed(0)}% of the evaluation budget. Matching traffic exactly still leaves too little evidence for that critical slice.`
                  : policy.id === 'equal'
                    ? 'Every declared slice receives the same count, but equal allocation can still underweight a rare critical harm relative to its consequence.'
                    : 'Rare, high-severity slices receive intentional oversampling. The trade-off is less precision for common moderate-risk traffic.'}
              </div>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const styles: Record<Severity, string> = {
    moderate: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200',
    high: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
    critical: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200',
  };

  return (
    <span className={`rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold uppercase ${styles[severity]}`}>
      {severity}
    </span>
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
    <LearningLabBody>
      <div className="grid min-h-[520px] place-items-center px-4 text-center">
        {error ? (
          <div>
            <CircleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-300" />
            <p className="mt-3 font-semibold text-neutral-950 dark:text-white">
              Slice evidence could not load
            </p>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Retry
            </button>
          </div>
        ) : (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Loading slice evidence...
          </p>
        )}
      </div>
    </LearningLabBody>
  );
}
