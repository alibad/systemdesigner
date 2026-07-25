'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  BookOpenCheck,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  FileKey2,
  Fingerprint,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Signal = {
  id: string;
  label: string;
  detail: string;
  claim: string;
  sourceKind: string;
  sensitivity: number;
  requiresBehaviorConsent: boolean;
  requiresPrivateAccess: boolean;
  maximumRetentionDays: number;
};

type Scenario = {
  id: string;
  label: string;
  brief: string;
  usefulSignalIds: string[];
  unsafeSignalIds: string[];
  minimumUsefulSignals: number;
  fallback: string;
};

type SignalContractModel = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    selectedSignalIds: string[];
    behaviorConsent: boolean;
    privateSourceAccess: boolean;
    retentionDays: number;
  };
  signals: Signal[];
  scenarios: Scenario[];
};

const BLOCK_ID = 'genai/personalized-genai-signal-contract-lab';

function isSignalContractModel(value: unknown): value is SignalContractModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SignalContractModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && Array.isArray(candidate.signals)
      && candidate.signals.length > 0
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0,
  );
}

export default function PersonalizedGenaiSignalContractLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<SignalContractModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No signal-contract model was supplied.');
      return;
    }

    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isSignalContractModel(payload)) {
          throw new Error('Signal-contract data is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load signal data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <SignalContractWorkbench data={data} />;
}

function SignalContractWorkbench({ data }: { data: SignalContractModel }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [selectedSignalIds, setSelectedSignalIds] = useState(data.defaults.selectedSignalIds);
  const [behaviorConsent, setBehaviorConsent] = useState(data.defaults.behaviorConsent);
  const [privateSourceAccess, setPrivateSourceAccess] = useState(
    data.defaults.privateSourceAccess,
  );
  const [retentionDays, setRetentionDays] = useState(data.defaults.retentionDays);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const selectedSignals = data.signals.filter((signal) => selectedSignalIds.includes(signal.id));

  const result = useMemo(() => {
    const usefulSelected = selectedSignals.filter((signal) =>
      scenario.usefulSignalIds.includes(signal.id),
    );
    const violations = selectedSignals.flatMap((signal) => {
      const reasons: string[] = [];
      if (signal.requiresBehaviorConsent && !behaviorConsent) {
        reasons.push(`${signal.label}: behavioral-use consent is missing`);
      }
      if (signal.requiresPrivateAccess && !privateSourceAccess) {
        reasons.push(`${signal.label}: current source authorization is missing`);
      }
      if (scenario.unsafeSignalIds.includes(signal.id)) {
        reasons.push(`${signal.label}: unrelated or unsafe for this task`);
      }
      if (signal.maximumRetentionDays === 0 && retentionDays > 0) {
        reasons.push(`${signal.label}: this source must not become durable profile state`);
      } else if (retentionDays > signal.maximumRetentionDays) {
        reasons.push(`${signal.label}: retention exceeds its ${signal.maximumRetentionDays}-day limit`);
      }
      return reasons;
    });

    const admittedSignals = selectedSignals.filter((signal) => {
      const missingConsent = signal.requiresBehaviorConsent && !behaviorConsent;
      const missingAccess = signal.requiresPrivateAccess && !privateSourceAccess;
      const unsafe = scenario.unsafeSignalIds.includes(signal.id);
      const overRetained = signal.maximumRetentionDays === 0
        ? retentionDays > 0
        : retentionDays > signal.maximumRetentionDays;
      return !missingConsent && !missingAccess && !unsafe && !overRetained;
    });
    const admittedUseful = admittedSignals.filter((signal) =>
      scenario.usefulSignalIds.includes(signal.id),
    ).length;
    const coverage = Math.round(
      (admittedUseful / Math.max(1, scenario.usefulSignalIds.length)) * 100,
    );
    const sufficient = admittedUseful >= scenario.minimumUsefulSignals;
    const sensitivity = admittedSignals.reduce((highest, signal) =>
      Math.max(highest, signal.sensitivity), 0);

    let verdict = 'Profile contract is ready for this request';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';
    if (violations.length > 0) {
      verdict = 'Policy gate must reject one or more signals';
      tone = 'rose';
    } else if (!sufficient) {
      verdict = 'Use the generic fallback or ask the user';
      tone = 'amber';
    }

    return {
      admittedSignals,
      coverage,
      sensitivity,
      sufficient,
      usefulSelected: usefulSelected.length,
      verdict,
      violations,
      tone,
    };
  }, [behaviorConsent, privateSourceAccess, retentionDays, scenario, selectedSignals]);

  const toggleSignal = (signalId: string) => {
    setSelectedSignalIds((current) =>
      current.includes(signalId)
        ? current.filter((candidate) => candidate !== signalId)
        : [...current, signalId],
    );
  };

  const reset = () => {
    setScenarioId(data.defaults.scenarioId);
    setSelectedSignalIds(data.defaults.selectedSignalIds);
    setBehaviorConsent(data.defaults.behaviorConsent);
    setPrivateSourceAccess(data.defaults.privateSourceAccess);
    setRetentionDays(data.defaults.retentionDays);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Signal-contract workbench"
          title={data.title}
          description={data.description}
          icon={Fingerprint}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose the product task
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.brief}
                      icon={BookOpenCheck}
                      accent="blue"
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Admit profile signals
                </legend>
                <div className="mt-3 space-y-2">
                  {data.signals.map((signal) => (
                    <LabChoice
                      key={signal.id}
                      selected={selectedSignalIds.includes(signal.id)}
                      label={signal.label}
                      detail={`${signal.sourceKind} · ${signal.detail}`}
                      icon={signalIcon(signal)}
                      accent={signal.sensitivity >= 4 ? 'rose' : signal.sensitivity >= 3 ? 'violet' : 'cyan'}
                      onClick={() => toggleSignal(signal.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Set the authority contract
                </legend>
                <ContractToggle
                  checked={behaviorConsent}
                  label="Behavioral use is opt-in"
                  detail="Allows declared behavioral evidence to propose an inferred claim."
                  onChange={setBehaviorConsent}
                />
                <ContractToggle
                  checked={privateSourceAccess}
                  label="Private source access is current"
                  detail="Confirms request-time authorization for the selected corpus."
                  onChange={setPrivateSourceAccess}
                />
              </fieldset>

              <LabRange
                label="Durable profile retention"
                value={retentionDays}
                output={`${retentionDays} day${retentionDays === 1 ? '' : 's'}`}
                min={0}
                max={90}
                step={1}
                accent="amber"
                lowLabel="Session only"
                highLabel="90 days"
                onChange={setRetentionDays}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Useful coverage"
                value={`${result.coverage}%`}
                detail={`${result.usefulSelected} useful signals selected before policy checks.`}
                icon={Sparkles}
                tone={result.sufficient ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Policy violations"
                value={`${result.violations.length}`}
                detail="Consent, purpose, access, and retention checks."
                icon={result.violations.length ? CircleAlert : ShieldCheck}
                tone={result.violations.length ? 'rose' : 'emerald'}
              />
              <LabMetric
                label="Claims admitted"
                value={`${result.admittedSignals.length}`}
                detail="Only these claims reach prompt or retrieval assembly."
                icon={Database}
                tone="blue"
              />
              <LabMetric
                label="Highest sensitivity"
                value={result.sensitivity ? `${result.sensitivity} / 4` : 'None'}
                detail="A visible property, not a substitute for threat modeling."
                icon={FileKey2}
                tone={result.sensitivity >= 3 ? 'violet' : 'neutral'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    User-visible profile for this request
                  </p>
                  <h4 className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">
                    {scenario.label}
                  </h4>
                </div>
                <span className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                  Retain {retentionDays}d
                </span>
              </div>
              {result.admittedSignals.length ? (
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {result.admittedSignals.map((signal) => (
                    <li key={signal.id} className="rounded-md border border-cyan-200 bg-white p-3 dark:border-cyan-900 dark:bg-neutral-950">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-neutral-950 dark:text-white">{signal.claim}</p>
                          <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Source: {signal.sourceKind}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 rounded-md border border-dashed border-neutral-300 p-4 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
                  No profile claims pass the current contract. The product can still use the generic fallback.
                </p>
              )}
            </section>

            {result.violations.length ? (
              <section className="rounded-md border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
                  <XCircle aria-hidden="true" className="h-4 w-4" />
                  Rejected by policy
                </div>
                <ul className="mt-3 space-y-2 text-sm leading-6">
                  {result.violations.map((violation) => <li key={violation}>• {violation}</li>)}
                </ul>
              </section>
            ) : null}

            <section className={`rounded-md border p-5 ${result.tone === 'emerald'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
              : result.tone === 'amber'
                ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
                : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'}`}
            >
              <div className="flex items-start gap-3">
                {result.tone === 'emerald'
                  ? <UserRoundCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Request consequence</p>
                  <p className="mt-2 text-lg font-semibold">{result.verdict}</p>
                  <p className="mt-2 text-sm leading-6 opacity-85">
                    {result.tone === 'emerald'
                      ? 'The prompt builder receives only the admitted claims shown above.'
                      : result.tone === 'amber'
                        ? scenario.fallback
                        : 'Remove the rejected signal or repair its purpose, consent, authorization, or retention contract before use.'}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function signalIcon(signal: Signal): LucideIcon {
  if (signal.requiresPrivateAccess) return FileKey2;
  if (signal.sourceKind === 'Explicit') return BadgeCheck;
  if (signal.sourceKind === 'Session') return Clock3;
  return Sparkles;
}

function ContractToggle({
  checked,
  label,
  detail,
  onChange,
}: {
  checked: boolean;
  label: string;
  detail: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${checked
      ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
      : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-1 block text-xs leading-5 opacity-75">{detail}</span>
      </span>
    </label>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="flex min-h-72 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
        Loading signal-contract model...
      </div>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
      <p className="font-semibold">Signal-contract workbench unavailable</p>
      <p className="mt-2 opacity-80">{detail}</p>
    </div>
  );
}
