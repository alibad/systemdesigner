'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  FileSearch,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Wrench,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'fundamentals/red-teaming-fundamentals-evidence-retest-lab';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/red-teaming-fundamentals/data/evidence-retest-model.json';

type EvidenceItem = { id: string; label: string; detail: string };
type RemediationState = {
  id: string;
  label: string;
  detail: string;
  deployed: boolean;
  retest: 'none' | 'failed' | 'passed';
};
type Finding = {
  id: string;
  label: string;
  hypothesis: string;
  failedBoundary: string;
  requiredEvidenceIds: string[];
  retestExpectation: string;
};
type RetestModel = {
  title: string;
  description: string;
  defaultFindingId: string;
  defaultEvidenceIds: string[];
  defaultRemediationId: string;
  evidence: EvidenceItem[];
  remediationStates: RemediationState[];
  findings: Finding[];
};

function isRetestModel(value: unknown): value is RetestModel {
  if (!value || typeof value !== 'object') return false;
  const model = value as Partial<RetestModel>;
  return Boolean(
    model.title
      && model.description
      && model.defaultFindingId
      && Array.isArray(model.defaultEvidenceIds)
      && model.defaultRemediationId
      && Array.isArray(model.evidence)
      && model.evidence.length >= 5
      && model.evidence.every((item) => item.id && item.label && item.detail)
      && Array.isArray(model.remediationStates)
      && model.remediationStates.length >= 4
      && model.remediationStates.every((item) => (
        item.id
        && item.label
        && item.detail
        && typeof item.deployed === 'boolean'
        && ['none', 'failed', 'passed'].includes(item.retest)
      ))
      && Array.isArray(model.findings)
      && model.findings.length >= 3
      && model.findings.every((item) => (
        item.id
        && item.label
        && item.hypothesis
        && item.failedBoundary
        && Array.isArray(item.requiredEvidenceIds)
        && item.retestExpectation
      )),
  );
}

export default function RedTeamingFundamentalsEvidenceRetestLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<RetestModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isRetestModel(payload)) throw new Error('The evidence model is incomplete.');
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load evidence data.');
      });
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Evidence and retest lab"
            title="Decide what the evidence actually supports"
            description="Loading finding, evidence, and remediation states."
            icon={ClipboardCheck}
            accent="cyan"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <EvidenceWorkbench model={model} />
      )}
    </div>
  );
}

function EvidenceWorkbench({ model }: { model: RetestModel }) {
  const initialFinding = model.findings.find((item) => item.id === model.defaultFindingId)
    ?? model.findings[0];
  const [findingId, setFindingId] = useState(initialFinding.id);
  const [evidenceIds, setEvidenceIds] = useState(model.defaultEvidenceIds);
  const [remediationId, setRemediationId] = useState(model.defaultRemediationId);
  const finding = model.findings.find((item) => item.id === findingId) ?? model.findings[0];
  const remediation = model.remediationStates.find((item) => item.id === remediationId)
    ?? model.remediationStates[0];

  const decision = useMemo(() => {
    const has = (id: string) => evidenceIds.includes(id);
    const completeEvidence = finding.requiredEvidenceIds.every(has);
    let status = 'Insufficient evidence';
    let action = 'Preserve authorization, execution, and control records before making a finding claim.';
    let tone: 'rose' | 'amber' | 'emerald' | 'blue' = 'rose';

    if (has('authorization') && has('execution') && has('control')) {
      status = 'Report the control gap';
      action = 'Assign the failed boundary to a risk owner and preserve the linked evidence.';
      tone = 'amber';
    }
    if (remediation.deployed && remediation.retest === 'none') {
      status = 'Retest required';
      action = 'A deployment artifact is not proof of correction. Replay the same bounded hypothesis.';
      tone = 'blue';
    }
    if (remediation.retest === 'failed') {
      status = 'Reopen the finding';
      action = 'The changed control did not produce the expected outcome. Keep the gap open.';
      tone = 'rose';
    }
    if (remediation.retest === 'passed' && !completeEvidence) {
      status = 'Retest proof incomplete';
      action = 'Link every required artifact before claiming verified closure.';
      tone = 'amber';
    }
    if (remediation.retest === 'passed' && completeEvidence) {
      status = 'Close as validated';
      action = 'Preserve the passed retest, control version, owner, and timestamps with the finding.';
      tone = 'emerald';
    }

    return {
      status,
      action,
      tone,
      completeEvidence,
      present: finding.requiredEvidenceIds.filter(has).length,
      total: finding.requiredEvidenceIds.length,
    };
  }, [evidenceIds, finding, remediation]);

  function chooseFinding(nextId: string) {
    setFindingId(nextId);
    setEvidenceIds(model.defaultEvidenceIds);
    setRemediationId(model.defaultRemediationId);
  }

  function toggleEvidence(id: string) {
    setEvidenceIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  }

  function reset() {
    setFindingId(initialFinding.id);
    setEvidenceIds(model.defaultEvidenceIds);
    setRemediationId(model.defaultRemediationId);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Evidence and retest lab"
        title={model.title}
        description={model.description}
        icon={ClipboardCheck}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset className="space-y-3">
              <legend className="mb-3 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Choose the observed gap
              </legend>
              {model.findings.map((item) => (
                <LabChoice
                  key={item.id}
                  selected={item.id === finding.id}
                  label={item.label}
                  detail={item.hypothesis}
                  icon={ShieldAlert}
                  accent="rose"
                  onClick={() => chooseFinding(item.id)}
                />
              ))}
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="mb-3 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Set remediation state
              </legend>
              {model.remediationStates.map((item) => (
                <LabChoice
                  key={item.id}
                  selected={item.id === remediation.id}
                  label={item.label}
                  detail={item.detail}
                  icon={item.retest === 'passed' ? CheckCircle2 : Wrench}
                  accent={item.retest === 'passed' ? 'emerald' : item.retest === 'failed' ? 'rose' : 'amber'}
                  onClick={() => setRemediationId(item.id)}
                />
              ))}
            </fieldset>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-3" aria-live="polite">
          <LabMetric
            label="Failed boundary"
            value={finding.failedBoundary}
            detail={finding.hypothesis}
            icon={ShieldAlert}
            tone="rose"
          />
          <LabMetric
            label="Evidence chain"
            value={`${decision.present} / ${decision.total}`}
            detail={decision.completeEvidence ? 'Required artifacts linked' : 'Closure proof is incomplete'}
            icon={FileSearch}
            tone={decision.completeEvidence ? 'emerald' : 'amber'}
          />
          <LabMetric
            label="Decision"
            value={decision.status}
            detail={decision.action}
            icon={decision.tone === 'emerald' ? ShieldCheck : CircleAlert}
            tone={decision.tone}
          />
        </div>

        <fieldset className="mt-6">
          <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            3. Record independently inspectable evidence
          </legend>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {model.evidence.map((item) => {
              const selected = evidenceIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleEvidence(item.id)}
                  className={`grid min-h-24 grid-cols-[24px_minmax(0,1fr)] gap-3 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                    selected
                      ? 'border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-50'
                      : 'border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'
                  }`}
                >
                  <span className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded border ${selected ? 'border-cyan-600 bg-cyan-600 text-white' : 'border-neutral-400 dark:border-neutral-600'}`}>
                    {selected ? <Check aria-hidden="true" className="h-4 w-4" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span className="mt-1 block text-xs leading-5 opacity-75">{item.detail}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className={`mt-6 rounded-md border p-4 ${decision.tone === 'emerald' ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50' : decision.tone === 'rose' ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50' : decision.tone === 'blue' ? 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50' : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'}`}>
          <p className="font-semibold">{decision.status}</p>
          <p className="mt-1 text-sm leading-6 opacity-80">{decision.action}</p>
          <p className="mt-3 border-t border-current/15 pt-3 text-xs leading-5 opacity-75">
            Retest expectation: {finding.retestExpectation}
          </p>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <LearningLabBody>
      <div className="flex min-h-40 items-center justify-center text-center">
        {error ? (
          <div>
            <CircleAlert aria-hidden="true" className="mx-auto h-6 w-6 text-rose-500" />
            <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-200"
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              Retry
            </button>
          </div>
        ) : (
          <span className="text-sm text-neutral-600 dark:text-neutral-300">Loading evidence model</span>
        )}
      </div>
    </LearningLabBody>
  );
}
