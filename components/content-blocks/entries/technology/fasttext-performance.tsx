'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Binary,
  BookOpenText,
  CheckCircle2,
  CircleAlert,
  Cpu,
  FileCheck2,
  Gauge,
  HardDrive,
  Network,
  PackageCheck,
  ScanText,
  ShieldCheck,
  SpellCheck2,
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

type SubwordToken = {
  id: string;
  label: string;
  token: string;
  inVocabulary: boolean;
  note: string;
};

type SubwordExplorerData = {
  labKind: 'subword-explorer';
  title: string;
  description: string;
  sourceNote: string;
  defaults: { tokenId: string; minN: number; maxN: number };
  limits: { minN: number; maxN: number };
  knownFragments: string[];
  tokens: SubwordToken[];
};

type ModelProfile = {
  id: string;
  label: string;
  detail: string;
  fileSizeMb: number;
  macroF1: number;
  criticalRecall: number;
  p95LatencyMs: number;
  quantized: boolean;
};

type ReleasePolicy = {
  id: string;
  label: string;
  detail: string;
  maxFileSizeMb: number;
  minMacroF1: number;
  minCriticalRecall: number;
  maxP95LatencyMs: number;
};

type ReleaseDecisionData = {
  labKind: 'release-decision';
  title: string;
  description: string;
  fixtureNote: string;
  criticalTrafficShare: number;
  defaults: { profileId: string; policyId: string; dailyMessages: number };
  traffic: { min: number; max: number; step: number };
  profiles: ModelProfile[];
  policies: ReleasePolicy[];
};

type LabData = SubwordExplorerData | ReleaseDecisionData;

function isSubwordToken(value: unknown): value is SubwordToken {
  if (!value || typeof value !== 'object') return false;
  const token = value as Partial<SubwordToken>;
  return Boolean(
    token.id
      && token.label
      && token.token
      && typeof token.inVocabulary === 'boolean'
      && token.note,
  );
}

function isModelProfile(value: unknown): value is ModelProfile {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Partial<ModelProfile>;
  return Boolean(
    profile.id
      && profile.label
      && profile.detail
      && typeof profile.fileSizeMb === 'number'
      && profile.fileSizeMb > 0
      && typeof profile.macroF1 === 'number'
      && profile.macroF1 >= 0
      && profile.macroF1 <= 1
      && typeof profile.criticalRecall === 'number'
      && profile.criticalRecall >= 0
      && profile.criticalRecall <= 1
      && typeof profile.p95LatencyMs === 'number'
      && profile.p95LatencyMs > 0
      && typeof profile.quantized === 'boolean',
  );
}

function isReleasePolicy(value: unknown): value is ReleasePolicy {
  if (!value || typeof value !== 'object') return false;
  const policy = value as Partial<ReleasePolicy>;
  return Boolean(
    policy.id
      && policy.label
      && policy.detail
      && typeof policy.maxFileSizeMb === 'number'
      && policy.maxFileSizeMb > 0
      && typeof policy.minMacroF1 === 'number'
      && policy.minMacroF1 >= 0
      && policy.minMacroF1 <= 1
      && typeof policy.minCriticalRecall === 'number'
      && policy.minCriticalRecall >= 0
      && policy.minCriticalRecall <= 1
      && typeof policy.maxP95LatencyMs === 'number'
      && policy.maxP95LatencyMs > 0,
  );
}

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<LabData>;

  if (candidate.labKind === 'subword-explorer') {
    const data = candidate as Partial<SubwordExplorerData>;
    return Boolean(
      data.title
        && data.description
        && data.sourceNote
        && data.defaults?.tokenId
        && typeof data.defaults.minN === 'number'
        && typeof data.defaults.maxN === 'number'
        && typeof data.limits?.minN === 'number'
        && typeof data.limits.maxN === 'number'
        && Array.isArray(data.knownFragments)
        && data.knownFragments.every((fragment) => typeof fragment === 'string')
        && Array.isArray(data.tokens)
        && data.tokens.length >= 3
        && data.tokens.every(isSubwordToken),
    );
  }

  if (candidate.labKind === 'release-decision') {
    const data = candidate as Partial<ReleaseDecisionData>;
    return Boolean(
      data.title
        && data.description
        && data.fixtureNote
        && typeof data.criticalTrafficShare === 'number'
        && data.criticalTrafficShare > 0
        && data.criticalTrafficShare <= 1
        && data.defaults?.profileId
        && data.defaults.policyId
        && typeof data.defaults.dailyMessages === 'number'
        && typeof data.traffic?.min === 'number'
        && typeof data.traffic.max === 'number'
        && typeof data.traffic.step === 'number'
        && Array.isArray(data.profiles)
        && data.profiles.length >= 2
        && data.profiles.every(isModelProfile)
        && Array.isArray(data.policies)
        && data.policies.length >= 2
        && data.policies.every(isReleasePolicy),
    );
  }

  return false;
}

function getCharacterNgrams(token: string, minN: number, maxN: number) {
  const characters = Array.from(`<${token.toLowerCase()}>`);
  const fragments = new Set<string>();

  for (let width = minN; width <= maxN; width += 1) {
    for (let start = 0; start + width <= characters.length; start += 1) {
      fragments.add(characters.slice(start, start + width).join(''));
    }
  }

  return [...fragments];
}

export default function FastTextPerformance({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No fastText learning-lab data was supplied.');
      return;
    }

    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isLabData(payload)) throw new Error('The fastText lab data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />;
  }

  if (data.labKind === 'subword-explorer') return <SubwordExplorer data={data} />;
  return <ReleaseDecisionLab data={data} />;
}

function SubwordExplorer({ data }: { data: SubwordExplorerData }) {
  const initialToken = data.tokens.find((token) => token.id === data.defaults.tokenId) ?? data.tokens[0];
  const [tokenId, setTokenId] = useState(initialToken.id);
  const [minN, setMinN] = useState(data.defaults.minN);
  const [maxN, setMaxN] = useState(data.defaults.maxN);
  const token = data.tokens.find((item) => item.id === tokenId) ?? data.tokens[0];
  const fragments = useMemo(
    () => getCharacterNgrams(token.token, minN, maxN),
    [maxN, minN, token.token],
  );
  const known = useMemo(() => new Set(data.knownFragments), [data.knownFragments]);
  const sharedFragments = fragments.filter((fragment) => known.has(fragment));
  const coverage = fragments.length === 0 ? 0 : sharedFragments.length / fragments.length;
  const representation = token.inVocabulary
    ? 'Word + subwords'
    : sharedFragments.length > 0
      ? 'Subwords only'
      : 'Weak subword evidence';

  const reset = () => {
    setTokenId(initialToken.id);
    setMinN(data.defaults.minN);
    setMaxN(data.defaults.maxN);
  };

  return (
    <div data-content-block="technology/fasttext-subword-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Subword representation lab"
          title={data.title}
          description={data.description}
          icon={SpellCheck2}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Token to inspect
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.tokens.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === token.id}
                      label={`${item.label}: ${item.token}`}
                      detail={item.note}
                      icon={item.inVocabulary ? BookOpenText : ScanText}
                      accent={item.inVocabulary ? 'blue' : 'cyan'}
                      onClick={() => setTokenId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <LabRange
                label="Minimum n-gram"
                value={minN}
                output={`${minN} characters`}
                min={data.limits.minN}
                max={data.limits.maxN - 1}
                accent="cyan"
                lowLabel="Short fragments"
                highLabel="Long fragments"
                onChange={(value) => {
                  setMinN(value);
                  if (value > maxN) setMaxN(value);
                }}
              />
              <LabRange
                label="Maximum n-gram"
                value={maxN}
                output={`${maxN} characters`}
                min={data.limits.minN + 1}
                max={data.limits.maxN}
                accent="blue"
                lowLabel="Fewer fragments"
                highLabel="More fragments"
                onChange={(value) => {
                  setMaxN(value);
                  if (value < minN) setMinN(value);
                }}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Vocabulary"
                value={token.inVocabulary ? 'Seen' : 'Unseen'}
                detail={token.inVocabulary ? 'The word row can contribute.' : 'No dedicated word row is available.'}
                icon={BookOpenText}
                tone={token.inVocabulary ? 'blue' : 'amber'}
              />
              <LabMetric
                label="Representation path"
                value={representation}
                detail="The deployed model hashes character fragments into learned buckets."
                icon={Network}
                tone={sharedFragments.length > 0 ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Shared fragments"
                value={`${sharedFragments.length} / ${fragments.length}`}
                detail={`${Math.round(coverage * 100)}% of this teaching view overlaps the fixture.`}
                icon={Binary}
                tone={coverage >= 0.2 ? 'violet' : 'neutral'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Boundary-marked fragments for <code>{token.token}</code>
                </h4>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  minn={minN}, maxn={maxN}
                </span>
              </div>
              <div className="mt-4 flex max-h-52 flex-wrap gap-2 overflow-y-auto pr-1">
                {fragments.map((fragment) => {
                  const isShared = known.has(fragment);
                  return (
                    <span
                      key={fragment}
                      className={`rounded border px-2 py-1 font-mono text-xs ${
                        isShared
                          ? 'border-emerald-300 bg-emerald-50 font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100'
                          : 'border-neutral-200 bg-white text-neutral-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300'
                      }`}
                    >
                      {fragment}
                    </span>
                  );
                })}
              </div>
              <p className="mt-4 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                Highlighted fragments also occur in the lesson fixture. {data.sourceNote}
              </p>
            </section>

            <div className={`flex gap-3 rounded-md border p-4 ${
              sharedFragments.length > 0
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
                : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
            }`}>
              {sharedFragments.length > 0
                ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
              <p className="text-sm leading-6">
                {token.inVocabulary
                  ? 'A seen token combines its word representation with subword evidence; changing the n-gram range changes which fragments contribute.'
                  : sharedFragments.length > 0
                    ? 'This unseen token can still reuse learned subword buckets. That is why spelling variants and morphological relatives may receive useful vectors.'
                    : 'fastText can still hash these fragments, but little recognizable overlap is a warning: an OOV vector exists, yet it is not guaranteed to be semantically useful.'}
              </p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ReleaseDecisionLab({ data }: { data: ReleaseDecisionData }) {
  const initialProfile = data.profiles.find((profile) => profile.id === data.defaults.profileId) ?? data.profiles[0];
  const initialPolicy = data.policies.find((policy) => policy.id === data.defaults.policyId) ?? data.policies[0];
  const [profileId, setProfileId] = useState(initialProfile.id);
  const [policyId, setPolicyId] = useState(initialPolicy.id);
  const [dailyMessages, setDailyMessages] = useState(data.defaults.dailyMessages);
  const profile = data.profiles.find((item) => item.id === profileId) ?? data.profiles[0];
  const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];

  const checks = [
    {
      label: `File size <= ${policy.maxFileSizeMb} MB`,
      actual: `${profile.fileSizeMb.toFixed(1)} MB`,
      passes: profile.fileSizeMb <= policy.maxFileSizeMb,
    },
    {
      label: `Macro F1 >= ${(policy.minMacroF1 * 100).toFixed(0)}%`,
      actual: `${(profile.macroF1 * 100).toFixed(1)}%`,
      passes: profile.macroF1 >= policy.minMacroF1,
    },
    {
      label: `Critical recall >= ${(policy.minCriticalRecall * 100).toFixed(0)}%`,
      actual: `${(profile.criticalRecall * 100).toFixed(1)}%`,
      passes: profile.criticalRecall >= policy.minCriticalRecall,
    },
    {
      label: `p95 latency <= ${policy.maxP95LatencyMs.toFixed(1)} ms`,
      actual: `${profile.p95LatencyMs.toFixed(2)} ms`,
      passes: profile.p95LatencyMs <= policy.maxP95LatencyMs,
    },
  ];
  const failures = checks.filter((check) => !check.passes);
  const criticalMessages = dailyMessages * data.criticalTrafficShare;
  const expectedMisses = Math.round(criticalMessages * (1 - profile.criticalRecall));
  const eligible = failures.length === 0;

  const reset = () => {
    setProfileId(initialProfile.id);
    setPolicyId(initialPolicy.id);
    setDailyMessages(data.defaults.dailyMessages);
  };

  return (
    <div data-content-block="technology/fasttext-release-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Classifier release lab"
          title={data.title}
          description={data.description}
          icon={PackageCheck}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Measured model profile
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.profiles.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === profile.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.quantized ? HardDrive : Cpu}
                      accent={item.quantized ? 'emerald' : 'violet'}
                      onClick={() => setProfileId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Release contract
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.policies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === policy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={ShieldCheck}
                      accent="blue"
                      onClick={() => setPolicyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <LabRange
                label="Daily messages"
                value={dailyMessages}
                output={dailyMessages.toLocaleString()}
                min={data.traffic.min}
                max={data.traffic.max}
                step={data.traffic.step}
                accent="violet"
                lowLabel="Pilot traffic"
                highLabel="High-volume route"
                onChange={setDailyMessages}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Release decision"
                value={eligible ? 'Eligible' : 'Blocked'}
                detail={eligible ? 'All selected policy gates pass.' : `${failures.length} policy gate${failures.length === 1 ? '' : 's'} fail.`}
                icon={eligible ? FileCheck2 : TriangleAlert}
                tone={eligible ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Model file"
                value={`${profile.fileSizeMb.toFixed(1)} MB`}
                detail={profile.quantized ? 'Quantized .ftz fixture' : 'Full-precision .bin fixture'}
                icon={HardDrive}
                tone="blue"
              />
              <LabMetric
                label="Critical misses/day"
                value={expectedMisses.toLocaleString()}
                detail={`${(data.criticalTrafficShare * 100).toFixed(0)}% critical-class traffic in this fixture`}
                icon={CircleAlert}
                tone={expectedMisses <= 300 ? 'emerald' : expectedMisses <= 800 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="p95 latency"
                value={`${profile.p95LatencyMs.toFixed(2)} ms`}
                detail="Measured in the illustrative validation fixture"
                icon={Gauge}
                tone="violet"
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                Policy gates for {policy.label}
              </h4>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {checks.map((check) => (
                  <div
                    key={check.label}
                    className={`flex items-start gap-3 rounded-md border p-3 ${
                      check.passes
                        ? 'border-emerald-200 bg-white text-neutral-800 dark:border-emerald-900 dark:bg-neutral-950 dark:text-neutral-100'
                        : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
                    }`}
                  >
                    {check.passes
                      ? <CheckCircle2 aria-label="Pass" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      : <TriangleAlert aria-label="Fail" className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />}
                    <span className="min-w-0 text-sm">
                      <span className="block font-medium">{check.label}</span>
                      <span className="mt-1 block text-xs opacity-75">Measured: {check.actual}</span>
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <div className={`flex gap-3 rounded-md border p-4 ${
              eligible
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
                : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
            }`}>
              {eligible
                ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                : <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {eligible ? 'This profile can enter a canary.' : 'Do not release this profile under the selected contract.'}
                </p>
                <p className="mt-1 text-sm leading-6 opacity-85">
                  {eligible
                    ? 'Passing offline and resource gates is necessary, not sufficient. Record the artifact, canary it, and compare labeled production outcomes before widening traffic.'
                    : `Failed gate${failures.length === 1 ? '' : 's'}: ${failures.map((failure) => failure.label).join('; ')}. Choose another artifact or renegotiate the product constraint explicitly.`}
                </p>
              </div>
            </div>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {data.fixtureNote}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="fastText learning lab"
        title={error ? 'The lab could not load' : 'Loading the model fixture'}
        description={error ?? 'Preparing the interactive lesson data.'}
        icon={error ? TriangleAlert : ScanText}
        accent={error ? 'rose' : 'cyan'}
      />
      <LearningLabBody>
        <div className="flex min-h-32 items-center justify-center">
          {error ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-10 items-center justify-center rounded-md border border-neutral-300 px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-900"
            >
              Try again
            </button>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading...</p>
          )}
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
