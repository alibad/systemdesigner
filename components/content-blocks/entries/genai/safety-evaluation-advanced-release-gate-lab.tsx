'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Eye,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type RolloutId = 'shadow' | 'canary-1' | 'canary-10' | 'full';

type EvidenceBundle = {
  id: string;
  label: string;
  detail: string;
  overallFailureRate: number;
  sliceLabel: string;
  sliceShare: number;
  sliceFailureRate: number;
  benignRefusalPct: number;
  privacyLeaks: number;
  overlapPct: number;
  labelAgreementPct: number;
  diagnosis: string;
};

type ReleaseGateData = {
  defaultBundleId: string;
  defaultEvidenceCases: number;
  defaultSevereThresholdPct: number;
  gates: {
    maxWorstSliceUcbPct: number;
    maxBenignRefusalPct: number;
    maxOverlapPct: number;
    minLabelAgreementPct: number;
  };
  bundles: EvidenceBundle[];
};

const DEFAULT_DATA_FILE =
  '/api/content/genai/safety-evaluation-advanced/data/release-evidence.json';

const rollouts: Array<{ id: RolloutId; label: string; detail: string }> = [
  { id: 'shadow', label: 'Shadow', detail: 'No user-visible outputs.' },
  { id: 'canary-1', label: '1% canary', detail: 'Bounded exposure with rollback.' },
  { id: 'canary-10', label: '10% canary', detail: 'Requires every offline gate.' },
  { id: 'full', label: 'Full release', detail: 'Requires production canary evidence.' },
];

const rolloutRank: Record<RolloutId, number> = {
  shadow: 0,
  'canary-1': 1,
  'canary-10': 2,
  full: 3,
};

function isReleaseGateData(value: unknown): value is ReleaseGateData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ReleaseGateData>;
  return typeof candidate.defaultBundleId === 'string'
    && typeof candidate.defaultEvidenceCases === 'number'
    && typeof candidate.defaultSevereThresholdPct === 'number'
    && Boolean(candidate.gates)
    && Array.isArray(candidate.bundles)
    && candidate.bundles.length > 0;
}

function wilsonUpper(failures: number, total: number) {
  if (total <= 0) return 1;
  const z = 1.96;
  const rate = failures / total;
  const denominator = 1 + (z * z) / total;
  const center = rate + (z * z) / (2 * total);
  const spread = z * Math.sqrt((rate * (1 - rate)) / total + (z * z) / (4 * total * total));
  return (center + spread) / denominator;
}

function formatPct(value: number, digits = 2) {
  return `${value.toFixed(digits)}%`;
}

export default function SafetyEvaluationAdvancedReleaseGateLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ReleaseGateData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [bundleId, setBundleId] = useState('');
  const [evidenceCases, setEvidenceCases] = useState(2_000);
  const [severeThresholdPct, setSevereThresholdPct] = useState(0.8);
  const [rolloutId, setRolloutId] = useState<RolloutId>('canary-1');

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isReleaseGateData(payload)) throw new Error('Release evidence data is incomplete.');

        if (active) {
          setData(payload);
          setBundleId(payload.defaultBundleId);
          setEvidenceCases(payload.defaultEvidenceCases);
          setSevereThresholdPct(payload.defaultSevereThresholdPct);
        }
      } catch (loadError) {
        if (active) {
          setData(null);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load release evidence.');
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const bundle = data?.bundles.find((item) => item.id === bundleId) ?? data?.bundles[0];

  const model = useMemo(() => {
    if (!data || !bundle) return null;

    const overallFailures = Math.max(0, Math.round(evidenceCases * bundle.overallFailureRate));
    const sliceCases = Math.max(20, Math.round(evidenceCases * bundle.sliceShare));
    const sliceFailures = Math.max(0, Math.round(sliceCases * bundle.sliceFailureRate));
    const severeUcbPct = wilsonUpper(overallFailures, evidenceCases) * 100;
    const sliceUcbPct = wilsonUpper(sliceFailures, sliceCases) * 100;

    const severePass = severeUcbPct <= severeThresholdPct;
    const slicePass = sliceUcbPct <= data.gates.maxWorstSliceUcbPct;
    const refusalPass = bundle.benignRefusalPct <= data.gates.maxBenignRefusalPct;
    const privacyPass = bundle.privacyLeaks === 0;
    const overlapPass = bundle.overlapPct <= data.gates.maxOverlapPct;
    const labelsPass = bundle.labelAgreementPct >= data.gates.minLabelAgreementPct;

    let maxRollout: RolloutId | 'hold' = 'canary-10';
    if (!privacyPass || !overlapPass || !labelsPass) maxRollout = 'hold';
    else if (!severePass || !slicePass) maxRollout = 'shadow';
    else if (!refusalPass) maxRollout = 'canary-1';

    const approved = maxRollout !== 'hold' && rolloutRank[rolloutId] <= rolloutRank[maxRollout];
    const failedLabels = [
      !severePass ? 'severe-harm confidence' : null,
      !slicePass ? `${bundle.sliceLabel} confidence` : null,
      !refusalPass ? 'benign refusal' : null,
      !privacyPass ? 'privacy leakage' : null,
      !overlapPass ? 'holdout leakage' : null,
      !labelsPass ? 'label reliability' : null,
    ].filter((label): label is string => Boolean(label));

    const decision = maxRollout === 'hold'
      ? 'Hold the candidate and repair the evidence'
      : approved
        ? `Proceed with ${rollouts.find((item) => item.id === rolloutId)?.label ?? 'bounded exposure'}`
        : `Reduce exposure to ${rollouts.find((item) => item.id === maxRollout)?.label ?? 'shadow'}`;

    return {
      approved,
      decision,
      failedLabels,
      labelsPass,
      maxRollout,
      overallFailures,
      overlapPass,
      privacyPass,
      refusalPass,
      severePass,
      severeUcbPct,
      sliceCases,
      sliceFailures,
      slicePass,
      sliceUcbPct,
    };
  }, [bundle, data, evidenceCases, rolloutId, severeThresholdPct]);

  function reset() {
    if (!data) return;
    setBundleId(data.defaultBundleId);
    setEvidenceCases(data.defaultEvidenceCases);
    setSevereThresholdPct(data.defaultSevereThresholdPct);
    setRolloutId('canary-1');
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Multi-axis safety release gate"
        title="Turn uncertain evidence into a bounded release decision"
        description="Choose an evidence bundle, add reviewed cases, predeclare a severe-harm ceiling, and request exposure. No favorable average can cancel a failed critical slice, privacy leak, or contaminated holdout."
        icon={ShieldCheck}
        accent="violet"
        onReset={data ? reset : undefined}
      />

      {!data || !bundle || !model ? (
        <LearningLabBody>
          <div className="grid min-h-[420px] place-items-center text-center">
            {error ? (
              <div>
                <CircleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-300" />
                <p className="mt-3 font-semibold text-neutral-950 dark:text-white">Release evidence could not load</p>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
                <button
                  type="button"
                  onClick={() => setReloadKey((key) => key + 1)}
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100"
                >
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                  Retry
                </button>
              </div>
            ) : (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading release evidence...</p>
            )}
          </div>
        </LearningLabBody>
      ) : (
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Evidence bundle
                </legend>
                <div className="mt-3 space-y-2">
                  {data.bundles.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === bundle.id}
                      label={item.label}
                      detail={item.detail}
                      icon={ClipboardCheck}
                      accent={item.id === data.defaultBundleId ? 'emerald' : 'amber'}
                      onClick={() => setBundleId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="2. Independently reviewed cases"
                value={evidenceCases}
                output={evidenceCases.toLocaleString()}
                min={500}
                max={10_000}
                step={500}
                accent="blue"
                lowLabel="Wide interval"
                highLabel="Narrower interval"
                onChange={setEvidenceCases}
              />

              <LabRange
                label="3. Maximum severe-harm upper bound"
                value={severeThresholdPct}
                output={formatPct(severeThresholdPct, 1)}
                min={0.2}
                max={2}
                step={0.1}
                accent="rose"
                lowLabel="Strict"
                highLabel="Permissive"
                onChange={setSevereThresholdPct}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  4. Requested exposure
                </legend>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {rollouts.map((rollout) => (
                    <LabChoice
                      key={rollout.id}
                      selected={rollout.id === rolloutId}
                      label={rollout.label}
                      detail={rollout.detail}
                      accent={rollout.id === 'full' ? 'rose' : 'violet'}
                      onClick={() => setRolloutId(rollout.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-h-[620px] min-w-0">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Severe-harm 95% upper bound"
                value={formatPct(model.severeUcbPct)}
                detail={`${model.overallFailures} observed failures in ${evidenceCases.toLocaleString()} cases`}
                icon={ShieldCheck}
                tone={model.severePass ? 'emerald' : 'rose'}
              />
              <LabMetric
                label={`${bundle.sliceLabel} upper bound`}
                value={formatPct(model.sliceUcbPct)}
                detail={`${model.sliceFailures} failures in ${model.sliceCases.toLocaleString()} slice cases`}
                icon={Users}
                tone={model.slicePass ? 'violet' : 'rose'}
              />
              <LabMetric
                label="Benign refusal"
                value={formatPct(bundle.benignRefusalPct, 1)}
                detail={`Maximum allowed: ${formatPct(data.gates.maxBenignRefusalPct, 1)}`}
                icon={Eye}
                tone={model.refusalPass ? 'blue' : 'amber'}
              />
              <LabMetric
                label="Privacy leaks"
                value={bundle.privacyLeaks.toString()}
                detail="Critical gate: exactly zero"
                icon={LockKeyhole}
                tone={model.privacyPass ? 'cyan' : 'rose'}
              />
            </div>

            <section
              aria-live="polite"
              className={`mt-5 rounded-md border p-5 ${model.approved
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-50'
                : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-50'}`}
            >
              <div className="flex items-start gap-3">
                {model.approved ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
                ) : (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-75">
                    {model.approved ? 'Request approved' : 'Request blocked'}
                  </p>
                  <p className="mt-1 text-lg font-semibold">{model.decision}</p>
                  <p className="mt-2 text-sm leading-6 opacity-90">
                    {model.failedLabels.length > 0
                      ? `Failed evidence: ${model.failedLabels.join(', ')}. ${bundle.diagnosis}`
                      : model.maxRollout === 'canary-10' && rolloutId === 'full'
                        ? 'Offline evidence supports a 10% canary, not an immediate full release. Earn wider exposure with monitored canary evidence and a tested rollback.'
                        : 'Every offline gate passes for this bounded request. Keep the same thresholds active by slice during the canary.'}
                  </p>
                </div>
              </div>
            </section>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Gate
                label="Severe harm"
                pass={model.severePass}
                result={`${formatPct(model.severeUcbPct)} upper bound`}
                requirement={`At most ${formatPct(severeThresholdPct, 1)}`}
              />
              <Gate
                label={`Worst slice: ${bundle.sliceLabel}`}
                pass={model.slicePass}
                result={`${formatPct(model.sliceUcbPct)} upper bound`}
                requirement={`At most ${formatPct(data.gates.maxWorstSliceUcbPct, 1)}`}
              />
              <Gate
                label="Benign refusal"
                pass={model.refusalPass}
                result={formatPct(bundle.benignRefusalPct, 1)}
                requirement={`At most ${formatPct(data.gates.maxBenignRefusalPct, 1)}`}
              />
              <Gate
                label="Privacy leakage"
                pass={model.privacyPass}
                result={`${bundle.privacyLeaks} observed`}
                requirement="Exactly zero"
              />
              <Gate
                label="Holdout overlap"
                pass={model.overlapPass}
                result={formatPct(bundle.overlapPct, 1)}
                requirement={`At most ${formatPct(data.gates.maxOverlapPct, 1)}`}
              />
              <Gate
                label="Reviewer agreement"
                pass={model.labelsPass}
                result={formatPct(bundle.labelAgreementPct, 0)}
                requirement={`At least ${formatPct(data.gates.minLabelAgreementPct, 0)}`}
              />
            </div>
          </div>
        </LearningLabBody>
      )}
    </LearningLab>
  );
}

function Gate({
  label,
  pass,
  requirement,
  result,
}: {
  label: string;
  pass: boolean;
  requirement: string;
  result: string;
}) {
  return (
    <div className="min-h-32 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
        <span className={`inline-flex shrink-0 items-center gap-1 text-xs font-semibold ${pass
          ? 'text-emerald-700 dark:text-emerald-300'
          : 'text-rose-700 dark:text-rose-300'}`}
        >
          {pass ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : <CircleAlert aria-hidden="true" className="h-4 w-4" />}
          {pass ? 'Pass' : 'Fail'}
        </span>
      </div>
      <p className="mt-3 text-sm font-medium tabular-nums text-neutral-800 dark:text-neutral-200">{result}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Gate: {requirement}</p>
    </div>
  );
}
