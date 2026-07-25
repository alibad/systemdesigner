'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, CheckCircle2, GitBranch, ShieldAlert, ShieldCheck, Wrench } from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

interface Stage {
  id: string;
  label: string;
  detail: string;
}

interface Failure {
  id: string;
  label: string;
  detail: string;
  affectedStageIds: string[];
  observableSignal: string;
  hiddenRisk: string;
  matchedControlId: string;
  evidenceNeeded: string;
}

interface Control {
  id: string;
  label: string;
  detail: string;
  action: string;
  limit: string;
}

interface OversightFailureData {
  title: string;
  description: string;
  stages: Stage[];
  failures: Failure[];
  controls: Control[];
}

function isTextRecord(value: unknown, keys: string[]): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return keys.every((key) => typeof record[key] === 'string' && record[key] !== '');
}

function isStage(value: unknown): value is Stage {
  return isTextRecord(value, ['id', 'label', 'detail']);
}

function isFailure(value: unknown): value is Failure {
  if (!isTextRecord(value, ['id', 'label', 'detail', 'observableSignal', 'hiddenRisk', 'matchedControlId', 'evidenceNeeded'])) {
    return false;
  }
  const failure = value as Partial<Failure>;
  return (
    Array.isArray(failure.affectedStageIds) &&
    failure.affectedStageIds.length > 0 &&
    failure.affectedStageIds.every((stageId) => typeof stageId === 'string')
  );
}

function isControl(value: unknown): value is Control {
  return isTextRecord(value, ['id', 'label', 'detail', 'action', 'limit']);
}

function isOversightFailureData(value: unknown): value is OversightFailureData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<OversightFailureData>;
  if (
    typeof data.title !== 'string' ||
    typeof data.description !== 'string' ||
    !Array.isArray(data.stages) ||
    !Array.isArray(data.failures) ||
    !Array.isArray(data.controls) ||
    data.stages.length < 2 ||
    data.failures.length === 0 ||
    data.controls.length === 0 ||
    !data.stages.every(isStage) ||
    !data.failures.every(isFailure) ||
    !data.controls.every(isControl)
  ) {
    return false;
  }

  const stageIds = new Set(data.stages.map((stage) => stage.id));
  const controlIds = new Set(data.controls.map((control) => control.id));
  return data.failures.every(
    (failure) =>
      controlIds.has(failure.matchedControlId) && failure.affectedStageIds.every((stageId) => stageIds.has(stageId)),
  );
}

export default function AnthropicConstitutionalAiOversightFailureLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<OversightFailureData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [failureId, setFailureId] = useState('');
  const [controlId, setControlId] = useState('');

  useEffect(() => {
    if (!dataFile) {
      setLoadError(true);
      return;
    }

    const controller = new AbortController();
    setLoadError(false);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Oversight failure data request failed');
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isOversightFailureData(payload)) throw new Error('Oversight failure data is invalid');
        setData(payload);
        setFailureId(payload.failures[0]!.id);
        setControlId(payload.controls[0]!.id);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(true);
      });

    return () => controller.abort();
  }, [dataFile]);

  const failure = useMemo(
    () => data?.failures.find((item) => item.id === failureId) ?? data?.failures[0] ?? null,
    [data, failureId],
  );
  const control = useMemo(
    () => data?.controls.find((item) => item.id === controlId) ?? data?.controls[0] ?? null,
    [controlId, data],
  );

  if (loadError) {
    return (
      <div
        data-content-block="case-studies/anthropic-constitutional-ai-oversight-failure-lab"
        role="alert"
        className="min-h-40 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
      >
        The oversight failure model could not be loaded.
      </div>
    );
  }

  if (!data || !failure || !control) {
    return (
      <div
        data-content-block="case-studies/anthropic-constitutional-ai-oversight-failure-lab"
        aria-busy="true"
        aria-label="Loading oversight failure model"
        className="min-h-[720px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
      />
    );
  }

  const matched = control.id === failure.matchedControlId;
  const originStage = data.stages.find((stage) => failure.affectedStageIds.includes(stage.id));
  const reset = () => {
    setFailureId(data.failures[0]!.id);
    setControlId(data.controls[0]!.id);
  };

  return (
    <div data-content-block="case-studies/anthropic-constitutional-ai-oversight-failure-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Failure injection lab"
          title={data.title}
          description={data.description}
          icon={GitBranch}
          accent="rose"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Inject a failure
                </p>
                <div className="mt-3 space-y-2">
                  {data.failures.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === failure.id}
                      label={item.label}
                      detail={item.detail}
                      icon={AlertTriangle}
                      accent="rose"
                      onClick={() => setFailureId(item.id)}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Choose the first control
                </p>
                <div className="mt-3 space-y-2">
                  {data.controls.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === control.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Wrench}
                      accent="amber"
                      onClick={() => setControlId(item.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          }
        >
          <div className="grid gap-2 md:grid-cols-4">
            {data.stages.map((stage, index) => {
              const affected = failure.affectedStageIds.includes(stage.id);
              return (
                <div key={stage.id} className="relative min-w-0">
                  <div
                    className={`h-full rounded-md border p-4 ${
                      affected
                        ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase opacity-70">Stage {index + 1}</span>
                      {affected ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold">
                          <ShieldAlert aria-hidden="true" className="h-4 w-4" />
                          Affected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold opacity-70">
                          <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                          Upstream clear
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-sm font-semibold">{stage.label}</p>
                    <p className="mt-1 text-xs leading-5 opacity-75">{stage.detail}</p>
                  </div>
                  {index < data.stages.length - 1 ? (
                    <ArrowDown aria-hidden="true" className="mx-auto my-1 h-4 w-4 text-neutral-400 md:absolute md:-right-3 md:top-1/2 md:z-10 md:m-0 md:-translate-y-1/2 md:-rotate-90" />
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Earliest affected boundary"
              value={originStage?.label ?? 'Unknown'}
              detail="Repair this boundary before regenerating downstream evidence"
              icon={GitBranch}
              tone="rose"
            />
            <LabMetric
              label="Selected control"
              value={matched ? 'Matched' : 'Incomplete'}
              detail={matched ? 'Addresses the failure origin' : 'Does not repair the earliest faulty signal'}
              icon={matched ? CheckCircle2 : AlertTriangle}
              tone={matched ? 'emerald' : 'amber'}
            />
            <LabMetric
              label="Release state"
              value={matched ? 'Re-evaluate' : 'Hold'}
              detail={matched ? 'The control starts a new evidence cycle' : 'Promotion remains blocked'}
              icon={matched ? ShieldCheck : ShieldAlert}
              tone={matched ? 'blue' : 'rose'}
            />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50">
              <p className="text-xs font-semibold uppercase opacity-70">Observed signal</p>
              <p className="mt-2 text-sm leading-6">{failure.observableSignal}</p>
              <p className="mt-4 text-xs font-semibold uppercase opacity-70">Hidden risk</p>
              <p className="mt-2 text-sm leading-6">{failure.hiddenRisk}</p>
            </div>
            <div
              role="status"
              aria-live="polite"
              className={`rounded-md border p-4 ${
                matched
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
                  : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'
              }`}
            >
              <p className="text-xs font-semibold uppercase opacity-70">
                {matched ? 'Matched first response' : 'Control mismatch'}
              </p>
              <p className="mt-2 text-sm font-semibold leading-6">{control.action}</p>
              <p className="mt-4 text-xs font-semibold uppercase opacity-70">Evidence required next</p>
              <p className="mt-2 text-sm leading-6">{failure.evidenceNeeded}</p>
              <p className="mt-4 border-t border-current/15 pt-3 text-xs leading-5 opacity-75">
                Limit: {control.limit}
              </p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
