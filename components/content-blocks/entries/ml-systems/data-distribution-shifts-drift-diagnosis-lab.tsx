'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Microscope,
  ScanSearch,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/data-distribution-shifts/data/drift-diagnosis-scenarios.json';
const BLOCK_ID = 'ml-systems/data-distribution-shifts-drift-diagnosis-lab';

type DiagnosisId =
  | 'data-quality-incident'
  | 'covariate-shift'
  | 'label-shift'
  | 'concept-drift';

type Diagnosis = {
  id: DiagnosisId;
  label: string;
  detail: string;
};

type Evidence = {
  id: string;
  label: string;
  baseline: string;
  current: string;
  status: 'stable' | 'changed' | 'unknown';
  detail: string;
};

type Scenario = {
  id: string;
  label: string;
  context: string;
  urgency: string;
  affectedSlice: string;
  correctDiagnosis: DiagnosisId;
  summary: string;
  nextProbe: string;
  evidence: Evidence[];
  whyNot: Record<DiagnosisId, string>;
};

type LabData = {
  title: string;
  description: string;
  defaultScenario: string;
  defaultDiagnosis: DiagnosisId;
  diagnoses: Diagnosis[];
  scenarios: Scenario[];
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      typeof data.defaultScenario === 'string' &&
      typeof data.defaultDiagnosis === 'string' &&
      Array.isArray(data.diagnoses) &&
      data.diagnoses.length === 4 &&
      data.diagnoses.every(
        (diagnosis) =>
          typeof diagnosis.id === 'string' &&
          typeof diagnosis.label === 'string' &&
          typeof diagnosis.detail === 'string',
      ) &&
      Array.isArray(data.scenarios) &&
      data.scenarios.length > 0 &&
      data.scenarios.every(
        (scenario) =>
          typeof scenario.id === 'string' &&
          typeof scenario.correctDiagnosis === 'string' &&
          Array.isArray(scenario.evidence) &&
          scenario.evidence.length > 0,
      ),
  );
}

const statusStyles: Record<Evidence['status'], string> = {
  stable:
    'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30',
  changed: 'border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30',
  unknown:
    'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60',
};

const statusLabels: Record<Evidence['status'], string> = {
  stable: 'Stable',
  changed: 'Changed',
  unknown: 'Pending',
};

function EvidenceIcon({ status }: { status: Evidence['status'] }) {
  if (status === 'stable') {
    return <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
  }
  if (status === 'changed') {
    return <AlertTriangle aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
  }
  return <CircleHelp aria-hidden="true" className="h-4 w-4 text-neutral-500" />;
}

export default function DataDistributionShiftsDriftDiagnosisLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState('camera-fleet-change');
  const [diagnosisId, setDiagnosisId] = useState<DiagnosisId>('covariate-shift');

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load diagnosis evidence (${response.status}).`);
        return response.json();
      })
      .then((value: unknown) => {
        if (!isLabData(value)) {
          throw new Error('The diagnosis evidence does not match the expected contract.');
        }
        setData(value);
        setScenarioId(value.defaultScenario);
        setDiagnosisId(value.defaultDiagnosis);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') {
          setError(fetchError instanceof Error ? fetchError.message : 'Could not load diagnosis evidence.');
        }
      });
    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    if (!data) return null;
    const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
    const diagnosis =
      data.diagnoses.find((item) => item.id === diagnosisId) ?? data.diagnoses[0];
    const correctDiagnosis =
      data.diagnoses.find((item) => item.id === scenario.correctDiagnosis) ?? data.diagnoses[0];
    const changedCount = scenario.evidence.filter((item) => item.status === 'changed').length;
    const pendingCount = scenario.evidence.filter((item) => item.status === 'unknown').length;
    return {
      scenario,
      diagnosis,
      correctDiagnosis,
      changedCount,
      pendingCount,
      matches: diagnosis.id === scenario.correctDiagnosis,
    };
  }, [data, diagnosisId, scenarioId]);

  const reset = () => {
    if (!data) return;
    setScenarioId(data.defaultScenario);
    setDiagnosisId(data.defaultDiagnosis);
  };

  if (error) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!data || !result) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className="not-prose my-7 h-96 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading drift diagnosis lab"
      />
    );
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Drift diagnosis lab"
          title={data.title}
          description={data.description}
          icon={Microscope}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose an incident
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((scenario) => (
                    <LabChoice
                      key={scenario.id}
                      selected={scenario.id === result.scenario.id}
                      label={scenario.label}
                      detail={scenario.context}
                      accent="cyan"
                      onClick={() => setScenarioId(scenario.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Commit a diagnosis
                </legend>
                <div className="mt-3 space-y-2">
                  {data.diagnoses.map((diagnosis) => (
                    <LabChoice
                      key={diagnosis.id}
                      selected={diagnosis.id === result.diagnosis.id}
                      label={diagnosis.label}
                      detail={diagnosis.detail}
                      accent="violet"
                      onClick={() => setDiagnosisId(diagnosis.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Affected slice"
              value={result.scenario.affectedSlice}
              detail="Scope the incident before using an aggregate metric"
              icon={ScanSearch}
              tone="blue"
            />
            <LabMetric
              label="Changed signals"
              value={`${result.changedCount} of ${result.scenario.evidence.length}`}
              detail="Movement is evidence, not a root cause"
              icon={Activity}
              tone="amber"
            />
            <LabMetric
              label="Pending evidence"
              value={`${result.pendingCount}`}
              detail={result.pendingCount ? 'Do not overstate certainty' : 'All listed signals are available'}
              icon={CircleHelp}
              tone={result.pendingCount ? 'neutral' : 'emerald'}
            />
          </div>

          <div className="mt-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Evidence board
                </p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  Reference versus current window
                </h4>
              </div>
              <span className="shrink-0 rounded-md border border-neutral-200 px-2 py-1 text-xs font-semibold text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
                {result.scenario.urgency}
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {result.scenario.evidence.map((evidence) => (
                <article key={evidence.id} className={`rounded-md border p-4 ${statusStyles[evidence.status]}`}>
                  <div className="flex items-center justify-between gap-3">
                    <h5 className="text-sm font-semibold text-neutral-950 dark:text-white">
                      {evidence.label}
                    </h5>
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200">
                      <EvidenceIcon status={evidence.status} />
                      {statusLabels[evidence.status]}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm">
                    <div className="min-w-0">
                      <span className="block text-xs text-neutral-500 dark:text-neutral-400">Reference</span>
                      <strong className="mt-1 block break-words text-neutral-900 dark:text-neutral-100">
                        {evidence.baseline}
                      </strong>
                    </div>
                    <span aria-hidden="true" className="text-neutral-400">→</span>
                    <div className="min-w-0 text-right">
                      <span className="block text-xs text-neutral-500 dark:text-neutral-400">Current</span>
                      <strong className="mt-1 block break-words text-neutral-900 dark:text-neutral-100">
                        {evidence.current}
                      </strong>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                    {evidence.detail}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div
            className={`mt-6 rounded-md border p-5 ${
              result.matches
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-50'
                : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-50'
            }`}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              {result.matches ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase opacity-75">
                  {result.matches ? 'Diagnosis supported' : 'Evidence mismatch'}
                </p>
                <h4 className="mt-1 text-lg font-semibold">
                  {result.matches
                    ? result.correctDiagnosis.label
                    : `Reconsider ${result.diagnosis.label}`}
                </h4>
                <p className="mt-2 text-sm leading-6">{result.scenario.whyNot[result.diagnosis.id]}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Best explanation
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                {result.scenario.summary}
              </p>
            </div>
            <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Next discriminating probe
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                {result.scenario.nextProbe}
              </p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
