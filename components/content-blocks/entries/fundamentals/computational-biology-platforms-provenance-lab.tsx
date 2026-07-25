'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CircleAlert,
  Container,
  Dna,
  FileCheck2,
  FileJson2,
  Fingerprint,
  GitCommitHorizontal,
  History,
  ShieldQuestion,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Evidence = { id: string; label: string; detail: string; stage: string };
type Scenario = {
  id: string;
  label: string;
  summary: string;
  requiredEvidence: string[];
  withoutEvidence: string;
  withEvidence: string;
};
type ProvenanceData = {
  title: string;
  description: string;
  defaults: { scenarioId: string; enabledEvidence: string[] };
  replayEvidence: string[];
  evidence: Evidence[];
  scenarios: Scenario[];
};

const BLOCK_ID = 'fundamentals/computational-biology-platforms-provenance-lab';

function isProvenanceData(value: unknown): value is ProvenanceData {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ProvenanceData>;
  return Boolean(
    item.title
      && item.description
      && item.defaults?.scenarioId
      && Array.isArray(item.defaults.enabledEvidence)
      && Array.isArray(item.replayEvidence)
      && Array.isArray(item.evidence)
      && item.evidence.length > 0
      && Array.isArray(item.scenarios)
      && item.scenarios.length > 0,
  );
}

export default function ComputationalBiologyPlatformsProvenanceLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ProvenanceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No provenance failure model was supplied.');
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
        if (!isProvenanceData(payload)) throw new Error('The provenance model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the provenance model.');
      });
    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadState error detail={error} />;
  if (!data) return <LoadState detail="Reading evidence contracts..." />;
  return <ProvenanceLab data={data} />;
}

function ProvenanceLab({ data }: { data: ProvenanceData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [enabledEvidence, setEnabledEvidence] = useState<string[]>(data.defaults.enabledEvidence);
  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const enabled = useMemo(() => new Set(enabledEvidence), [enabledEvidence]);
  const requiredMissing = scenario.requiredEvidence.filter((id) => !enabled.has(id));
  const replayMissing = data.replayEvidence.filter((id) => !enabled.has(id));
  const detected = requiredMissing.length === 0;
  const replayable = replayMissing.length === 0;

  const evidenceById = useMemo(
    () => new Map(data.evidence.map((item) => [item.id, item])),
    [data.evidence],
  );

  function toggleEvidence(id: string) {
    setEnabledEvidence((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  }

  function reset() {
    setScenarioId(data.defaults.scenarioId);
    setEnabledEvidence(data.defaults.enabledEvidence);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Lineage failure lab"
          title={data.title}
          description={data.description}
          icon={Fingerprint}
          accent="emerald"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Inject a lineage failure
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.summary}
                      icon={AlertTriangle}
                      accent="amber"
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Capture run evidence
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.evidence.map((item) => {
                    const checked = enabled.has(item.id);
                    const required = scenario.requiredEvidence.includes(item.id);
                    return (
                      <label
                        key={item.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors focus-within:ring-2 focus-within:ring-emerald-500 ${
                          checked
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                            : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleEvidence(item.id)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600"
                        />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                            {item.label}
                            {required ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] uppercase text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">Needed now</span> : null}
                          </span>
                          <span className="mt-1 block text-xs leading-5 opacity-75">{item.detail}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="space-y-5" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric label="Selected failure" value={scenario.label} detail={`${scenario.requiredEvidence.length} required evidence ${scenario.requiredEvidence.length === 1 ? 'item' : 'items'}`} icon={ShieldQuestion} tone="amber" />
              <LabMetric label="Change detection" value={detected ? 'Detectable' : 'Ambiguous'} detail={detected ? 'Required evidence is present' : `${requiredMissing.length} requirement missing`} icon={detected ? CheckCircle2 : CircleAlert} tone={detected ? 'emerald' : 'rose'} />
              <LabMetric label="Replay envelope" value={replayable ? 'Complete' : 'Incomplete'} detail={replayable ? 'Minimum run inputs are identified' : `${replayMissing.length} replay items missing`} icon={replayable ? FileCheck2 : History} tone={replayable ? 'blue' : 'violet'} />
            </div>

            <section className={`rounded-md border p-5 ${
              detected
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
            }`}>
              <div className="flex items-start gap-3">
                {detected ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-70">Observed consequence</p>
                  <h4 className="mt-1 text-lg font-semibold">
                    {detected ? 'The platform can explain this change' : 'The result remains scientifically ambiguous'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {detected ? scenario.withEvidence : scenario.withoutEvidence}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Evidence path</p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">What the run manifest can still identify</h4>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Checked means captured, not scientifically approved</p>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {data.evidence.map((item) => {
                  const present = enabled.has(item.id);
                  const Icon = evidenceIcon(item.id);
                  return (
                    <div key={item.id} className={`min-w-0 rounded-md border p-3 ${present ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <Icon aria-hidden="true" className={`h-4 w-4 ${present ? 'text-emerald-700 dark:text-emerald-300' : 'text-neutral-400'}`} />
                        <span className="text-[10px] font-semibold uppercase text-neutral-500 dark:text-neutral-400">{item.stage}</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">{item.label}</p>
                      <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${present ? 'text-emerald-700 dark:text-emerald-300' : 'text-neutral-500 dark:text-neutral-400'}`}>
                        {present ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <CircleAlert aria-hidden="true" className="h-3.5 w-3.5" />}
                        {present ? 'Captured' : 'Missing'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            {!detected || !replayable ? (
              <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900">
                <p className="font-semibold text-neutral-950 dark:text-white">Missing evidence to add</p>
                <ul className="mt-2 space-y-1 text-neutral-700 dark:text-neutral-300">
                  {[...new Set([...requiredMissing, ...replayMissing])].map((id) => (
                    <li key={id} className="flex items-start gap-2">
                      <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
                      {evidenceById.get(id)?.label ?? id}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function evidenceIcon(id: string) {
  if (id === 'reference-digest') return Dna;
  if (id === 'workflow-revision') return GitCommitHorizontal;
  if (id === 'container-digest') return Container;
  if (id === 'parameter-manifest') return FileJson2;
  if (id === 'attempt-log') return History;
  return FileCheck2;
}

function LoadState({ detail, error = false }: { detail: string; error?: boolean }) {
  return (
    <div className={`not-prose my-7 rounded-lg border p-6 ${error ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50' : 'border-neutral-200 bg-white text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'}`}>
      <div className="flex items-start gap-3">
        {error ? <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <Fingerprint aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
        <div><p className="font-semibold">{error ? 'Provenance model unavailable' : 'Loading provenance lab'}</p><p className="mt-1 text-sm opacity-75">{detail}</p></div>
      </div>
    </div>
  );
}
