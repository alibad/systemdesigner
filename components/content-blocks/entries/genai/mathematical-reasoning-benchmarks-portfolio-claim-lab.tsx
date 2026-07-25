'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  CircleAlert,
  FlaskConical,
  RefreshCw,
  Scale,
  ShieldX,
  Target,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type ProductClaim = {
  id: string;
  label: string;
  detail: string;
  targetMathSharePct: number;
  requiresTraceEvidence: boolean;
  requiredSampleSize: number;
};

type VerificationPolicy = {
  id: string;
  label: string;
  detail: string;
  evidencePoints: number;
  supportsTraceEvidence: boolean;
};

type PortfolioData = {
  defaultClaimId: string;
  defaultMathSharePct: number;
  defaultSampleSize: number;
  defaultContaminationPct: number;
  defaultVerificationId: string;
  claims: ProductClaim[];
  verificationPolicies: VerificationPolicy[];
  gates: {
    maximumContaminationPct: number;
    minimumClaimQualityPct: number;
    minimumCleanTasks: number;
  };
};

const DEFAULT_DATA_FILE =
  '/api/content/genai/mathematical-reasoning-benchmarks/data/portfolio-claim-lab.json';

function validData(value: unknown): value is PortfolioData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PortfolioData>;
  return typeof candidate.defaultClaimId === 'string'
    && typeof candidate.defaultMathSharePct === 'number'
    && typeof candidate.defaultSampleSize === 'number'
    && typeof candidate.defaultContaminationPct === 'number'
    && typeof candidate.defaultVerificationId === 'string'
    && Array.isArray(candidate.claims)
    && candidate.claims.length > 0
    && Array.isArray(candidate.verificationPolicies)
    && candidate.verificationPolicies.length > 0
    && Boolean(candidate.gates);
}

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, value));
}

export default function MathematicalReasoningBenchmarksPortfolioClaimLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [claimId, setClaimId] = useState('');
  const [mathSharePct, setMathSharePct] = useState(45);
  const [sampleSize, setSampleSize] = useState(600);
  const [contaminationPct, setContaminationPct] = useState(2);
  const [verificationId, setVerificationId] = useState('');

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!validData(payload)) throw new Error('Portfolio lab data is incomplete.');
        if (!active) return;
        setData(payload);
        setClaimId(payload.defaultClaimId);
        setMathSharePct(payload.defaultMathSharePct);
        setSampleSize(payload.defaultSampleSize);
        setContaminationPct(payload.defaultContaminationPct);
        setVerificationId(payload.defaultVerificationId);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load portfolio lab data.');
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const claim = data?.claims.find((item) => item.id === claimId) ?? data?.claims[0];
  const verification = data?.verificationPolicies.find((item) => item.id === verificationId)
    ?? data?.verificationPolicies[0];

  const model = useMemo(() => {
    if (!data || !claim || !verification) return null;

    const mathTasks = Math.round(sampleSize * mathSharePct / 100);
    const gsmTasks = sampleSize - mathTasks;
    const cleanTasks = Math.floor(sampleSize * (1 - contaminationPct / 100));
    const mixFit = clamp(100 - Math.abs(mathSharePct - claim.targetMathSharePct) * 1.8);
    const sampleAdequacy = clamp(sampleSize / claim.requiredSampleSize * 100);
    const cleanRate = 100 - contaminationPct;
    const claimQualityPct = Math.round(
      mixFit * 0.4
      + verification.evidencePoints * 0.35
      + sampleAdequacy * 0.15
      + cleanRate * 0.1,
    );
    const marginPct = cleanTasks > 0 ? 98 / Math.sqrt(cleanTasks) : 100;
    const missingTraceEvidence = claim.requiresTraceEvidence && !verification.supportsTraceEvidence;
    const contaminated = contaminationPct > data.gates.maximumContaminationPct;
    const tooSmall = cleanTasks < data.gates.minimumCleanTasks;
    const weakClaim = claimQualityPct < data.gates.minimumClaimQualityPct;

    let state: 'eligible' | 'hold' | 'block';
    let decision: string;
    let explanation: string;
    if (contaminated) {
      state = 'block';
      decision = 'Block the benchmark claim';
      explanation = `Estimated contamination exceeds the ${data.gates.maximumContaminationPct}% gate. More samples cannot restore an independent holdout.`;
    } else if (missingTraceEvidence || tooSmall || weakClaim) {
      state = 'hold';
      decision = 'Hold for stronger evidence';
      explanation = missingTraceEvidence
        ? 'The tutoring claim promises valid explanations, but this policy scores only final answers. Add a separate visible-trace rubric.'
        : tooSmall
          ? `Only ${cleanTasks} tasks remain after contamination review; the gate requires ${data.gates.minimumCleanTasks}.`
          : 'The task mix or verifier is too weak for the selected product claim. Align the portfolio before widening exposure.';
    } else {
      state = 'eligible';
      decision = 'Eligible for a bounded canary';
      explanation = 'The task mix, clean sample, and verification depth support this narrow claim. Product monitoring and rollback are still required.';
    }

    const blindSpots: string[] = [];
    if (mathSharePct < claim.targetMathSharePct - 15) {
      blindSpots.push('Competition subjects and harder symbolic tasks are underrepresented.');
    }
    if (mathSharePct > claim.targetMathSharePct + 15) {
      blindSpots.push('Language-to-arithmetic word problems are underrepresented.');
    }
    if (verification.id === 'raw-exact') {
      blindSpots.push('Equivalent notation and parser failures can be misclassified.');
    }
    if (missingTraceEvidence) {
      blindSpots.push('The selected claim requires explanation evidence that the verifier does not collect.');
    }
    if (tooSmall) {
      blindSpots.push('The clean denominator is below the release gate.');
    }
    if (contaminationPct > 0) {
      blindSpots.push(`${contaminationPct}% of the sample is estimated to overlap with development exposure.`);
    }
    if (blindSpots.length === 0) {
      blindSpots.push('Public-task exposure and product-distribution shift still need independent checks.');
    }

    return {
      blindSpots,
      claimQualityPct,
      cleanTasks,
      decision,
      explanation,
      gsmTasks,
      marginPct,
      mathTasks,
      mixFit,
      state,
    };
  }, [claim, contaminationPct, data, mathSharePct, sampleSize, verification]);

  function reset() {
    if (!data) return;
    setClaimId(data.defaultClaimId);
    setMathSharePct(data.defaultMathSharePct);
    setSampleSize(data.defaultSampleSize);
    setContaminationPct(data.defaultContaminationPct);
    setVerificationId(data.defaultVerificationId);
  }

  return (
    <div data-content-block="genai/mathematical-reasoning-benchmarks-portfolio-claim-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Benchmark portfolio lab"
          title="Make the task mix match the product claim"
          description="Tune the benchmark allocation, clean denominator, and verification depth. Coverage, uncertainty, blind spots, and the release decision move together."
          icon={Scale}
          accent="cyan"
          onReset={data ? reset : undefined}
        />

        {!data || !claim || !verification || !model ? (
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Product claim
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.claims.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === claim.id}
                        label={item.label}
                        detail={item.detail}
                        icon={Target}
                        accent="cyan"
                        onClick={() => setClaimId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="2. MATH share"
                  value={mathSharePct}
                  output={`${mathSharePct}%`}
                  min={0}
                  max={100}
                  step={5}
                  lowLabel="All GSM8K"
                  highLabel="All MATH"
                  accent="violet"
                  onChange={setMathSharePct}
                />

                <LabRange
                  label="3. Evaluated tasks"
                  value={sampleSize}
                  output={sampleSize.toLocaleString()}
                  min={100}
                  max={1600}
                  step={100}
                  lowLabel="Fast signal"
                  highLabel="Narrower interval"
                  accent="blue"
                  onChange={setSampleSize}
                />

                <LabRange
                  label="4. Estimated contamination"
                  value={contaminationPct}
                  output={`${contaminationPct}%`}
                  min={0}
                  max={20}
                  step={1}
                  lowLabel="Independent"
                  highLabel="Claim compromised"
                  accent="rose"
                  onChange={setContaminationPct}
                />

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    5. Verification policy
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.verificationPolicies.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === verification.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.supportsTraceEvidence ? BookOpenCheck : FlaskConical}
                        accent="blue"
                        onClick={() => setVerificationId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
          >
            <div className="min-w-0 space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric label="Clean tasks" value={model.cleanTasks.toLocaleString()} detail={`${sampleSize - model.cleanTasks} quarantined`} icon={FlaskConical} tone={model.cleanTasks >= data.gates.minimumCleanTasks ? 'blue' : 'amber'} />
                <LabMetric label="Worst-case margin" value={`+/-${model.marginPct.toFixed(1)} pts`} detail="95% normal approximation" icon={BarChart3} tone="violet" />
                <LabMetric label="Portfolio fit" value={`${Math.round(model.mixFit)}%`} detail={`Target: ${claim.targetMathSharePct}% MATH`} icon={Target} tone={model.mixFit >= 75 ? 'emerald' : 'amber'} />
                <LabMetric label="Claim quality" value={`${model.claimQualityPct}%`} detail={`Gate: ${data.gates.minimumClaimQualityPct}%`} icon={model.claimQualityPct >= data.gates.minimumClaimQualityPct ? CheckCircle2 : CircleAlert} tone={model.claimQualityPct >= data.gates.minimumClaimQualityPct ? 'emerald' : 'rose'} />
              </div>

              <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h4 className="font-semibold text-neutral-950 dark:text-white">Task allocation</h4>
                    <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{claim.label}: target {claim.targetMathSharePct}% MATH</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">{sampleSize.toLocaleString()} total</p>
                </div>
                <div className="mt-4 flex h-12 w-full overflow-hidden rounded-md border border-neutral-300 dark:border-neutral-700" aria-label={`${model.mathTasks} MATH tasks and ${model.gsmTasks} GSM8K tasks`}>
                  {model.mathTasks > 0 ? (
                    <div className="flex min-w-0 items-center justify-center bg-violet-500 px-2 text-xs font-semibold text-white" style={{ width: `${mathSharePct}%` }}>
                      <span className="truncate">MATH {model.mathTasks}</span>
                    </div>
                  ) : null}
                  {model.gsmTasks > 0 ? (
                    <div className="flex min-w-0 flex-1 items-center justify-center bg-cyan-600 px-2 text-xs font-semibold text-white">
                      <span className="truncate">GSM8K {model.gsmTasks}</span>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className={`rounded-md border p-4 ${model.state === 'eligible' ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50' : model.state === 'hold' ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50' : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'}`} aria-live="polite">
                <div className="flex items-start gap-3">
                  {model.state === 'eligible' ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : model.state === 'hold' ? <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <ShieldX aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                  <div>
                    <h4 className="font-semibold">{model.decision}</h4>
                    <p className="mt-1 text-sm leading-6 opacity-90">{model.explanation}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">Remaining blind spots</h4>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                  {model.blindSpots.map((item) => (
                    <li key={item} className="flex gap-3">
                      <CircleAlert aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Claim quality is a teaching model, not a statistical certification. The margin uses the conservative binomial standard-error approximation and does not correct selection bias or correlated tasks.
              </p>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="min-h-[360px] p-6" aria-live="polite">
      {error ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
          <p className="font-semibold">The portfolio lab could not load.</p>
          <p className="mt-1 opacity-80">{error}</p>
          <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-2 rounded-md border border-current px-3 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Retry
          </button>
        </div>
      ) : (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading portfolio lab...</p>
      )}
    </div>
  );
}
