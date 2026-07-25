'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BadgeCheck,
  FileKey2,
  ListChecks,
  LockKeyhole,
  Route,
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

type Severity = 'none' | 'high' | 'critical';
type Choice = {
  id: string;
  label: string;
  detail: string;
  severity: Severity;
  blocker: boolean;
  remediation: string;
};
type Dimension = { id: string; label: string; prompt: string; options: Choice[] };
type ReadinessModel = { service: string; endpoint: string; dimensions: Dimension[] };

const icons: LucideIcon[] = [Route, LockKeyhole, FileKey2, ListChecks, BadgeCheck, Activity, ShieldAlert];

export default function ApiDesignChecklistContractReadinessLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ReadinessModel | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The contract review model was not provided.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<ReadinessModel>;
      })
      .then((model) => {
        setData(model);
        setSelections(Object.fromEntries(model.dimensions.map((dimension) => [dimension.id, dimension.options[0]?.id ?? ''])));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the contract review model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  const review = useMemo(() => {
    if (!data) return null;

    const selected = data.dimensions.map((dimension) => ({
      dimension,
      choice: dimension.options.find((option) => option.id === selections[dimension.id]) ?? dimension.options[0],
    }));
    const findings = selected.filter((item) => item.choice.severity !== 'none');
    const critical = findings.filter((item) => item.choice.severity === 'critical');
    const blockers = findings.filter((item) => item.choice.blocker);
    const completeness = Math.round(((selected.length - findings.length) / selected.length) * 100);

    return {
      selected,
      critical,
      blockers,
      completeness,
      release: blockers.length > 0 ? 'Hold release' : critical.length > 0 ? 'Fix critical gaps' : findings.length > 0 ? 'Release with follow-up' : 'Ready to release',
    };
  }, [data, selections]);

  if (loadError) {
    return (
      <div data-content-block="reference/api-design-checklist-contract-readiness-lab" role="alert" className="min-h-48 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
        <p className="font-semibold">Contract readiness lab unavailable</p>
        <p className="mt-2 opacity-80">{loadError}</p>
      </div>
    );
  }

  if (!data || !review) {
    return <div data-content-block="reference/api-design-checklist-contract-readiness-lab" className="min-h-[680px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading contract readiness lab" />;
  }

  return (
    <div data-content-block="reference/api-design-checklist-contract-readiness-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Contract readiness review"
          title="Turn an API checklist into a release decision"
          description={`Review ${data.service}: ${data.endpoint}. Each choice changes completeness, severity, release blockers, and the ordered remediation work.`}
          icon={ListChecks}
          accent="blue"
          onReset={() => setSelections(Object.fromEntries(data.dimensions.map((dimension) => [dimension.id, dimension.options[0]?.id ?? ''])))}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              {data.dimensions.map((dimension, index) => (
                <fieldset key={dimension.id}>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{index + 1}. {dimension.label}</legend>
                  <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{dimension.prompt}</p>
                  <div className="mt-3 space-y-2">
                    {dimension.options.map((option) => (
                      <LabChoice
                        key={option.id}
                        selected={selections[dimension.id] === option.id}
                        label={option.label}
                        detail={option.detail}
                        icon={icons[index]}
                        accent={option.severity === 'critical' ? 'rose' : option.severity === 'high' ? 'amber' : 'emerald'}
                        onClick={() => setSelections((current) => ({ ...current, [dimension.id]: option.id }))}
                      />
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          }
        >
          <div aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric label="Contract completeness" value={`${review.completeness}%`} detail={`${data.dimensions.length - review.selected.filter((item) => item.choice.severity !== 'none').length} of ${data.dimensions.length} decisions meet the modeled release bar.`} icon={BadgeCheck} tone={review.completeness === 100 ? 'emerald' : review.completeness >= 70 ? 'amber' : 'rose'} />
              <LabMetric label="Critical findings" value={String(review.critical.length)} detail="Authorization, retry safety, compatibility, and error semantics can block correctness." icon={ShieldAlert} tone={review.critical.length ? 'rose' : 'emerald'} />
              <LabMetric label="Release blockers" value={String(review.blockers.length)} detail={review.release} icon={review.blockers.length ? TriangleAlert : BadgeCheck} tone={review.blockers.length ? 'rose' : 'emerald'} />
            </div>

            <section className={`mt-5 border-l-4 px-4 py-4 ${review.blockers.length ? 'border-rose-500 bg-rose-50 text-rose-950 dark:bg-rose-950/30 dark:text-rose-50' : review.critical.length ? 'border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-50' : 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50'}`}>
              <p className="text-xs font-semibold uppercase opacity-75">Release recommendation</p>
              <p className="mt-2 text-base font-semibold">{review.release}</p>
              <p className="mt-1 text-sm leading-6 opacity-90">A score is not a substitute for evidence. The chosen contract must be documented, tested, and observable at the boundary.</p>
            </section>

            <section className="mt-5 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">Prioritized remediation</h4>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Critical release blockers appear before high-severity operational gaps.</p>
              </header>
              {review.selected.filter((item) => item.choice.severity !== 'none').length ? (
                <ol className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {review.selected
                    .filter((item) => item.choice.severity !== 'none')
                    .sort((a, b) => Number(b.choice.blocker) - Number(a.choice.blocker) || (a.choice.severity === 'critical' ? -1 : 1))
                    .map(({ dimension, choice }) => (
                      <li key={dimension.id} className="p-4">
                        <p className="text-sm font-semibold text-neutral-950 dark:text-white">{choice.severity === 'critical' ? 'Critical' : 'High'}: {dimension.label}</p>
                        <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{choice.remediation}</p>
                      </li>
                    ))}
                </ol>
              ) : (
                <p className="p-4 text-sm leading-6 text-neutral-700 dark:text-neutral-300">No modeled remediation is open. Confirm the choices with contract tests, production telemetry, and a rollback plan before release.</p>
              )}
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
