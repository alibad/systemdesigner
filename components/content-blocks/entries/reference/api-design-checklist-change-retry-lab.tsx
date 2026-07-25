'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  FileKey2,
  GitBranch,
  Repeat2,
  ShieldAlert,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Option = { id: string; label: string; detail: string };
type ScenarioModel = {
  operation: string;
  versioning: Option[];
  timeouts: Option[];
  duplicates: Option[];
  consumers: Option[];
  rollouts: Option[];
};

const groups: Array<{ key: keyof Omit<ScenarioModel, 'operation'>; label: string; icon: LucideIcon; accent: 'blue' | 'amber' | 'violet' | 'emerald' | 'rose' }> = [
  { key: 'versioning', label: '1. Versioning strategy', icon: GitBranch, accent: 'blue' },
  { key: 'timeouts', label: '2. Timeout point', icon: Clock3, accent: 'amber' },
  { key: 'duplicates', label: '3. Duplicate request', icon: Repeat2, accent: 'violet' },
  { key: 'consumers', label: '4. Consumer age', icon: ArrowRightLeft, accent: 'emerald' },
  { key: 'rollouts', label: '5. Rollout policy', icon: ShieldAlert, accent: 'rose' },
];

export default function ApiDesignChecklistChangeRetryLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ScenarioModel | null>(null);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The change and retry scenario model was not provided.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<ScenarioModel>;
      })
      .then((model) => {
        setData(model);
        setChoices({ versioning: 'new-version', timeouts: 'after-commit', duplicates: 'same-key', consumers: 'legacy', rollouts: 'sunset' });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the change and retry scenario model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    const versioning = choices.versioning;
    const timeout = choices.timeouts;
    const duplicate = choices.duplicates;
    const legacy = choices.consumers === 'legacy';
    const rollout = choices.rollouts;
    const breaksClient = legacy && versioning === 'mutate-v1';
    const protectedReplay = duplicate === 'same-key';
    const originalArrives = timeout !== 'before-arrival';
    const duplicateCanRepeat = originalArrives && (duplicate === 'new-key' || duplicate === 'no-key');

    const clientBreakage = breaksClient
      ? rollout === 'cutover' ? 'Immediate parse or behavior break' : 'Legacy client needs migration before promotion'
      : legacy && versioning === 'new-version' ? 'v1 continues during support window' : 'No modeled client breakage';
    const serverState = !originalArrives
      ? duplicate === 'none' ? 'No payment recorded' : 'One payment may be created by the retry'
      : duplicateCanRepeat ? 'Two payment attempts can commit'
      : timeout === 'after-commit' ? 'One payment committed; response lost' : timeout === 'during-work' ? 'One payment may still finish' : 'One completed payment';
    const recovery = duplicateCanRepeat
      ? 'Stop automatic retries and reconcile with the business reference. A new or missing key cannot prove one logical intent.'
      : !originalArrives
        ? 'A retry can be the first delivery, but keep its deadline and correlation ID.'
        : protectedReplay
          ? 'Retry only with the same idempotency key and request fingerprint; return the stored result or operation state.'
          : 'Read the payment or operation status before another write; the timeout does not prove the server did nothing.';
    const migrationRisk = breaksClient
      ? rollout === 'cutover' ? 'Critical: breaking contract reaches legacy callers immediately.' : 'High: track remaining legacy callers and block sunset until migration is proven.'
      : versioning === 'new-version' && legacy ? 'Moderate: support window needs usage telemetry and a dated sunset.' : rollout === 'cutover' ? 'Moderate: current clients still need rollout monitoring and rollback.' : 'Low: compatibility and retry evidence remain observable.';

    return { clientBreakage, serverState, recovery, migrationRisk, breaksClient, duplicateCanRepeat, protectedReplay };
  }, [choices]);

  if (loadError) {
    return (
      <div data-content-block="reference/api-design-checklist-change-retry-lab" role="alert" className="min-h-48 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
        <p className="font-semibold">Change and retry lab unavailable</p>
        <p className="mt-2 opacity-80">{loadError}</p>
      </div>
    );
  }

  if (!data) {
    return <div data-content-block="reference/api-design-checklist-change-retry-lab" className="min-h-[650px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading change and retry lab" />;
  }

  return (
    <div data-content-block="reference/api-design-checklist-change-retry-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Change, timeout, and retry scenario"
          title="See compatibility and recovery fail together"
          description={`Change ${data.operation}, then place a timeout and duplicate request on the path. The model keeps client impact, durable state, recovery, and migration risk visible at once.`}
          icon={Repeat2}
          accent="rose"
          onReset={() => setChoices({ versioning: 'new-version', timeouts: 'after-commit', duplicates: 'same-key', consumers: 'legacy', rollouts: 'sunset' })}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              {groups.map((group) => (
                <fieldset key={group.key}>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{group.label}</legend>
                  <div className="mt-3 space-y-2">
                    {data[group.key].map((option) => (
                      <LabChoice
                        key={option.id}
                        selected={choices[group.key] === option.id}
                        label={option.label}
                        detail={option.detail}
                        icon={group.icon}
                        accent={group.accent}
                        onClick={() => setChoices((current) => ({ ...current, [group.key]: option.id }))}
                      />
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          }
        >
          <div aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2">
              <LabMetric label="Client breakage" value={result.clientBreakage} detail="Compatibility is a user-facing behavior, not only a schema version." icon={result.breaksClient ? TriangleAlert : CheckCircle2} tone={result.breaksClient ? 'rose' : 'emerald'} />
              <LabMetric label="Server state" value={result.serverState} detail="A missing response is not evidence that durable work did not happen." icon={Database} tone={result.duplicateCanRepeat ? 'rose' : 'violet'} />
              <LabMetric label="Recovery" value={result.protectedReplay ? 'Replay one intent' : result.duplicateCanRepeat ? 'Reconcile before retry' : 'Verify status first'} detail={result.recovery} icon={result.protectedReplay ? FileKey2 : CircleAlert} tone={result.protectedReplay ? 'emerald' : 'amber'} />
              <LabMetric label="Migration risk" value={result.migrationRisk.startsWith('Critical') ? 'Critical' : result.migrationRisk.startsWith('High') ? 'High' : result.migrationRisk.startsWith('Moderate') ? 'Moderate' : 'Low'} detail={result.migrationRisk} icon={ShieldAlert} tone={result.migrationRisk.startsWith('Critical') || result.migrationRisk.startsWith('High') ? 'rose' : result.migrationRisk.startsWith('Moderate') ? 'amber' : 'emerald'} />
            </div>

            <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Recovery path</p>
              <p className="mt-2 text-base font-semibold text-neutral-950 dark:text-white">{result.recovery}</p>
            </section>

            <section className={`mt-5 border-l-4 px-4 py-4 ${result.breaksClient || result.duplicateCanRepeat ? 'border-rose-500 bg-rose-50 text-rose-950 dark:bg-rose-950/30 dark:text-rose-50' : 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50'}`}>
              <p className="text-xs font-semibold uppercase opacity-75">Scenario consequence</p>
              <p className="mt-2 text-sm leading-6 opacity-90">{result.breaksClient ? 'Do not promote a compatibility break until affected consumers have a tested migration or an explicitly supported old version.' : result.duplicateCanRepeat ? 'The release may look compatible while it still risks duplicate money movement during a network failure.' : 'The selected contract preserves a recoverable path, but validate it with consumer, contract, and fault-injection tests.'}</p>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
