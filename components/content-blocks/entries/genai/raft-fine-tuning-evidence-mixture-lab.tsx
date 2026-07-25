'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  Boxes,
  BrainCircuit,
  CheckCircle2,
  FileQuestion,
  Layers3,
  SearchCheck,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

interface RangeConfig {
  min: number;
  max: number;
  step: number;
}

interface DomainProfile {
  id: string;
  label: string;
  detail: string;
  questionFamilies: number;
  recommendedOracleMinPct: number;
  recommendedOracleMaxPct: number;
  recommendedHardDistractorMinPct: number;
}

interface MixtureData {
  title: string;
  description: string;
  defaults: {
    profileId: string;
    examples: number;
    oraclePresentPct: number;
    documentsPerExample: number;
    hardDistractorPct: number;
  };
  ranges: {
    examples: RangeConfig;
    oraclePresentPct: RangeConfig;
    documentsPerExample: RangeConfig;
    hardDistractorPct: RangeConfig;
  };
  profiles: DomainProfile[];
}

const DEFAULT_DATA_FILE =
  '/api/content/genai/raft-fine-tuning/data/evidence-mixture-model.json';
const BLOCK_ID = 'genai/raft-fine-tuning-evidence-mixture-lab';

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRange(value: unknown): value is RangeConfig {
  if (!value || typeof value !== 'object') return false;
  const range = value as Partial<RangeConfig>;
  return isNumber(range.min) && isNumber(range.max) && isNumber(range.step);
}

function isMixtureData(value: unknown): value is MixtureData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<MixtureData>;
  return Boolean(
    data.title
      && data.description
      && data.defaults
      && data.ranges
      && isRange(data.ranges.examples)
      && isRange(data.ranges.oraclePresentPct)
      && isRange(data.ranges.documentsPerExample)
      && isRange(data.ranges.hardDistractorPct)
      && Array.isArray(data.profiles)
      && data.profiles.length >= 3
      && data.profiles.every((profile) => (
        typeof profile.id === 'string'
          && typeof profile.label === 'string'
          && isNumber(profile.questionFamilies)
          && isNumber(profile.recommendedOracleMinPct)
          && isNumber(profile.recommendedOracleMaxPct)
          && isNumber(profile.recommendedHardDistractorMinPct)
      )),
  );
}

function compactNumber(value: number) {
  return new Intl.NumberFormat('en', {
    notation: value >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
}

export default function RaftFineTuningEvidenceMixtureLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<MixtureData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [profileId, setProfileId] = useState('');
  const [examples, setExamples] = useState(12000);
  const [oraclePresentPct, setOraclePresentPct] = useState(70);
  const [documentsPerExample, setDocumentsPerExample] = useState(5);
  const [hardDistractorPct, setHardDistractorPct] = useState(60);

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile, { signal: controller.signal });
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isMixtureData(payload)) throw new Error('Evidence-mixture data is incomplete.');

        setData(payload);
        setProfileId(payload.defaults.profileId);
        setExamples(payload.defaults.examples);
        setOraclePresentPct(payload.defaults.oraclePresentPct);
        setDocumentsPerExample(payload.defaults.documentsPerExample);
        setHardDistractorPct(payload.defaults.hardDistractorPct);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the RAFT recipe.');
      }
    }

    void loadData();
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const profile = data?.profiles.find((item) => item.id === profileId)
    ?? data?.profiles[0];

  const model = useMemo(() => {
    if (!profile) return null;

    const oraclePresentExamples = Math.round(examples * oraclePresentPct / 100);
    const oracleAbsentExamples = examples - oraclePresentExamples;
    const passageSlots = examples * documentsPerExample;
    const oracleSlots = oraclePresentExamples;
    const distractorSlots = passageSlots - oracleSlots;
    const hardDistractorSlots = Math.round(distractorSlots * hardDistractorPct / 100);
    const softDistractorSlots = distractorSlots - hardDistractorSlots;
    const issues: string[] = [];

    if (oraclePresentPct < profile.recommendedOracleMinPct) {
      issues.push(
        `Only ${oraclePresentPct}% of examples expose answer-bearing evidence; ${profile.label} needs more practice selecting and quoting oracles.`,
      );
    }
    if (oraclePresentPct > profile.recommendedOracleMaxPct) {
      issues.push(
        `${oraclePresentPct}% oracle presence leaves too few oracle-absent records to exercise the chosen canonical RAFT mixture.`,
      );
    }
    if (hardDistractorPct < profile.recommendedHardDistractorMinPct) {
      issues.push(
        `Hard distractors are below the ${profile.recommendedHardDistractorMinPct}% planning floor for this domain.`,
      );
    }
    if (documentsPerExample < 3) {
      issues.push('A two-document context gives little evidence about behavior under retrieval competition.');
    }

    return {
      distractorSlots,
      hardDistractorSlots,
      issues,
      oracleAbsentExamples,
      oraclePresentExamples,
      oracleSlots,
      passageSlots,
      softDistractorSlots,
    };
  }, [
    documentsPerExample,
    examples,
    hardDistractorPct,
    oraclePresentPct,
    profile,
  ]);

  function reset() {
    if (!data) return;
    setProfileId(data.defaults.profileId);
    setExamples(data.defaults.examples);
    setOraclePresentPct(data.defaults.oraclePresentPct);
    setDocumentsPerExample(data.defaults.documentsPerExample);
    setHardDistractorPct(data.defaults.hardDistractorPct);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="RAFT evidence mixture"
          title={data?.title ?? 'Compose the RAFT training distribution'}
          description={data?.description ?? 'Loading the versioned training recipe...'}
          icon={Layers3}
          accent="violet"
          onReset={data ? reset : undefined}
        />

        {!data || !profile || !model ? (
          <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Domain profile
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.profiles.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === profile.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.id === 'developer-docs' ? Boxes : item.id === 'medical-literature' ? BookOpenCheck : FileQuestion}
                        accent={item.id === 'developer-docs' ? 'blue' : item.id === 'medical-literature' ? 'rose' : 'violet'}
                        onClick={() => setProfileId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <div className="space-y-6">
                  <LabRange
                    label="Training examples"
                    value={examples}
                    output={examples.toLocaleString()}
                    min={data.ranges.examples.min}
                    max={data.ranges.examples.max}
                    step={data.ranges.examples.step}
                    accent="blue"
                    lowLabel="Pilot"
                    highLabel="Larger run"
                    onChange={setExamples}
                  />
                  <LabRange
                    label="Oracle present (P)"
                    value={oraclePresentPct}
                    output={`${oraclePresentPct}%`}
                    min={data.ranges.oraclePresentPct.min}
                    max={data.ranges.oraclePresentPct.max}
                    step={data.ranges.oraclePresentPct.step}
                    accent="emerald"
                    lowLabel="More oracle-absent"
                    highLabel="More evidence practice"
                    onChange={setOraclePresentPct}
                  />
                  <LabRange
                    label="Documents per example"
                    value={documentsPerExample}
                    output={documentsPerExample.toString()}
                    min={data.ranges.documentsPerExample.min}
                    max={data.ranges.documentsPerExample.max}
                    step={data.ranges.documentsPerExample.step}
                    accent="amber"
                    lowLabel="Short context"
                    highLabel="More competition"
                    onChange={setDocumentsPerExample}
                  />
                  <LabRange
                    label="Hard distractor share"
                    value={hardDistractorPct}
                    output={`${hardDistractorPct}%`}
                    min={data.ranges.hardDistractorPct.min}
                    max={data.ranges.hardDistractorPct.max}
                    step={data.ranges.hardDistractorPct.step}
                    accent="rose"
                    lowLabel="Mostly easy"
                    highLabel="Mostly plausible"
                    onChange={setHardDistractorPct}
                  />
                </div>
              </div>
            )}
          >
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Oracle present"
                  value={compactNumber(model.oraclePresentExamples)}
                  detail={`${oraclePresentPct}% of questions`}
                  icon={SearchCheck}
                  tone="emerald"
                />
                <LabMetric
                  label="Oracle absent"
                  value={compactNumber(model.oracleAbsentExamples)}
                  detail="Canonical RAFT keeps the answer target"
                  icon={BrainCircuit}
                  tone="violet"
                />
                <LabMetric
                  label="Passage slots"
                  value={compactNumber(model.passageSlots)}
                  detail={`${documentsPerExample} documents per record`}
                  icon={Layers3}
                  tone="blue"
                />
                <LabMetric
                  label="Hard distractors"
                  value={compactNumber(model.hardDistractorSlots)}
                  detail={`${hardDistractorPct}% of distractor slots`}
                  icon={TriangleAlert}
                  tone="rose"
                />
              </div>

              <section aria-labelledby="raft-record-mix-title">
                <h4
                  id="raft-record-mix-title"
                  className="text-sm font-semibold text-neutral-950 dark:text-white"
                >
                  Record mixture
                </h4>
                <div className="mt-3 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
                  <div className="flex h-12 w-full">
                    <div
                      className="flex min-w-0 items-center justify-center bg-emerald-500 px-2 text-xs font-semibold text-emerald-950"
                      style={{ width: `${oraclePresentPct}%` }}
                    >
                      {oraclePresentPct >= 18 ? `${oraclePresentPct}% oracle present` : null}
                    </div>
                    <div
                      className="flex min-w-0 items-center justify-center bg-violet-500 px-2 text-xs font-semibold text-white"
                      style={{ width: `${100 - oraclePresentPct}%` }}
                    >
                      {100 - oraclePresentPct >= 18 ? `${100 - oraclePresentPct}% oracle absent` : null}
                    </div>
                  </div>
                  <div className="grid gap-2 border-t border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600 sm:grid-cols-2 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                    <span>Oracle slots: {model.oracleSlots.toLocaleString()}</span>
                    <span>Distractor slots: {model.distractorSlots.toLocaleString()}</span>
                    <span>Hard distractors: {model.hardDistractorSlots.toLocaleString()}</span>
                    <span>Easy distractors: {model.softDistractorSlots.toLocaleString()}</span>
                  </div>
                </div>
              </section>

              <section
                className={`rounded-md border p-4 ${
                  model.issues.length === 0
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                    : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  {model.issues.length === 0 ? (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  ) : (
                    <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold">
                      {model.issues.length === 0
                        ? 'Balanced planning envelope'
                        : `${model.issues.length} recipe question${model.issues.length === 1 ? '' : 's'}`}
                    </h4>
                    {model.issues.length === 0 ? (
                      <p className="mt-1 text-sm leading-6 opacity-80">
                        This mixture covers evidence use, oracle absence, and realistic negative competition. Validate it with held-out experiments.
                      </p>
                    ) : (
                      <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 opacity-85">
                        {model.issues.map((issue) => <li key={issue}>{issue}</li>)}
                      </ul>
                    )}
                  </div>
                </div>
              </section>

              <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                {profile.questionFamilies} question families are tracked for this illustrative domain profile. Counts describe dataset composition, not expected model quality.
              </p>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
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
    <div className="p-6 text-sm text-neutral-600 dark:text-neutral-300">
      <p>{error ?? 'Loading the evidence-mixture model...'}</p>
      {error ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md border border-neutral-300 px-3 py-2 font-semibold text-neutral-900 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-900"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
