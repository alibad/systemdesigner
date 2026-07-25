'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  FileCheck2,
  Fingerprint,
  ShieldCheck,
  TriangleAlert,
  Users,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'fundamentals/ethical-ai-governance-platforms-release-gate-lab';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/ethical-ai-governance-platforms/data/release-evidence-policy.json';

type EvidenceItem = {
  id: string;
  label: string;
  detail: string;
  owner: string;
};

type ChangeProfile = {
  id: string;
  label: string;
  detail: string;
  risk: string;
  requiredEvidence: string[];
  approver: string;
  expiry: string;
};

type ReleasePolicy = {
  title: string;
  description: string;
  defaults: {
    changeId: string;
    availableEvidence: string[];
  };
  evidence: EvidenceItem[];
  changes: ChangeProfile[];
};

function isReleasePolicy(value: unknown): value is ReleasePolicy {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ReleasePolicy>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.changeId
      && Array.isArray(candidate.defaults.availableEvidence)
      && Array.isArray(candidate.evidence)
      && candidate.evidence.length >= 5
      && candidate.evidence.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && typeof item.owner === 'string'
      ))
      && Array.isArray(candidate.changes)
      && candidate.changes.length >= 3
      && candidate.changes.every((change) => (
        typeof change.id === 'string'
        && typeof change.label === 'string'
        && typeof change.detail === 'string'
        && typeof change.risk === 'string'
        && Array.isArray(change.requiredEvidence)
        && typeof change.approver === 'string'
        && typeof change.expiry === 'string'
      )),
  );
}

export default function EthicalAIGovernanceReleaseGateLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [policy, setPolicy] = useState<ReleasePolicy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setPolicy(null);
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isReleasePolicy(payload)) {
          throw new Error('The release evidence policy is incomplete.');
        }
        setPolicy(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load release policy.');
      });
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!policy ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Release evidence gate"
            title="Load the versioned evidence contract"
            description="The lesson-owned change and evidence requirements are loading."
            icon={ClipboardCheck}
            accent="blue"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <ReleaseGate policy={policy} />
      )}
    </div>
  );
}

function ReleaseGate({ policy }: { policy: ReleasePolicy }) {
  const [changeId, setChangeId] = useState(policy.defaults.changeId);
  const [available, setAvailable] = useState(
    () => new Set(policy.defaults.availableEvidence),
  );
  const [matchesArtifact, setMatchesArtifact] = useState(true);

  const change = policy.changes.find((item) => item.id === changeId) ?? policy.changes[0];

  const result = useMemo(() => {
    const required = new Set(change.requiredEvidence);
    const missing = change.requiredEvidence.filter((id) => !available.has(id));
    const suppliedRequired = change.requiredEvidence.length - missing.length;
    const ready = missing.length === 0 && matchesArtifact;
    return { missing, ready, required, suppliedRequired };
  }, [available, change.requiredEvidence, matchesArtifact]);

  function toggleEvidence(id: string) {
    setAvailable((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function reset() {
    setChangeId(policy.defaults.changeId);
    setAvailable(new Set(policy.defaults.availableEvidence));
    setMatchesArtifact(true);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Release evidence gate"
        title={policy.title}
        description={policy.description}
        icon={ClipboardCheck}
        accent="blue"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Proposed change
              </legend>
              <div className="mt-3 grid gap-2">
                {policy.changes.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === change.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Fingerprint}
                    accent="blue"
                    onClick={() => setChangeId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <button
              type="button"
              aria-pressed={matchesArtifact}
              onClick={() => setMatchesArtifact((current) => !current)}
              className={`w-full rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${matchesArtifact
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50'
                : 'border-rose-300 bg-rose-50 text-rose-950 ring-1 ring-rose-500 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50'}`}
            >
              <span className="flex items-start gap-3">
                <Fingerprint aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <span className="block text-sm font-semibold">
                    Evidence {matchesArtifact ? 'matches' : 'does not match'} the release digest
                  </span>
                  <span className="mt-1 block text-xs leading-5 opacity-75">
                    Simulate whether the bundle was produced for this exact artifact.
                  </span>
                </span>
              </span>
            </button>
          </div>
        )}
      >
        <EvidencePanel
          policy={policy}
          change={change}
          available={available}
          matchesArtifact={matchesArtifact}
          result={result}
          onToggle={toggleEvidence}
        />
      </LearningLabBody>
    </LearningLab>
  );
}

function EvidencePanel({
  policy,
  change,
  available,
  matchesArtifact,
  result,
  onToggle,
}: {
  policy: ReleasePolicy;
  change: ChangeProfile;
  available: Set<string>;
  matchesArtifact: boolean;
  result: {
    missing: string[];
    ready: boolean;
    required: Set<string>;
    suppliedRequired: number;
  };
  onToggle: (id: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-6" aria-live="polite">
      <div className={`rounded-md border p-5 ${result.ready
        ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
        : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'}`}
      >
        <div className="flex items-start gap-3">
          {result.ready ? (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div>
            <p className="text-xs font-semibold uppercase opacity-70">Gate state</p>
            <h4 className="mt-1 text-xl font-semibold">
              {result.ready ? 'Ready for accountable approval' : 'Release blocked'}
            </h4>
            <p className="mt-2 text-sm leading-6 opacity-80">
              {result.ready
                ? `Every required artifact is present and bound to this version. ${change.approver} must still decide whether to accept the residual risk.`
                : !matchesArtifact
                  ? 'The evidence bundle references a different artifact digest. Matching documents cannot authorize an untested version.'
                  : `${result.missing.length} required ${result.missing.length === 1 ? 'artifact is' : 'artifacts are'} still missing.`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <LabMetric
          label="Required evidence"
          value={String(change.requiredEvidence.length)}
          detail={`${result.suppliedRequired} supplied for this change`}
          icon={FileCheck2}
          tone={result.ready ? 'emerald' : 'amber'}
        />
        <LabMetric
          label="Artifact binding"
          value={matchesArtifact ? 'Matched' : 'Mismatch'}
          detail="Evidence must name the release digest"
          icon={Fingerprint}
          tone={matchesArtifact ? 'blue' : 'rose'}
        />
        <LabMetric
          label="Decision owner"
          value={result.ready ? 'Named' : 'Pending gate'}
          detail={change.approver}
          icon={Users}
          tone="violet"
        />
      </div>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              2. Evidence bundle
            </p>
            <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
              Required items are marked. Optional evidence can still support a reviewer.
            </p>
          </div>
          <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            {available.size}/{policy.evidence.length} available
          </span>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {policy.evidence.map((item) => {
            const checked = available.has(item.id);
            const required = result.required.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={checked}
                onClick={() => onToggle(item.id)}
                className={`min-w-0 rounded-md border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${checked
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                  : required
                    ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
                    : 'border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'}`}
              >
                <span className="flex items-start gap-3">
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border ${checked
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-current bg-transparent'}`}
                  >
                    {checked ? <Check aria-hidden="true" className="h-4 w-4" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{item.label}</span>
                      <span className="rounded-full border border-current px-2 py-0.5 text-[11px] font-semibold uppercase opacity-75">
                        {required ? 'Required' : 'Optional'}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs leading-5 opacity-75">{item.detail}</span>
                    <span className="mt-2 block text-xs font-semibold">Owner: {item.owner}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50">
          <div className="flex items-start gap-3">
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-xs font-semibold uppercase opacity-70">Risk introduced</p>
              <p className="mt-2 text-sm leading-6">{change.risk}</p>
            </div>
          </div>
        </div>
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50">
          <div className="flex items-start gap-3">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-xs font-semibold uppercase opacity-70">Evidence expiry</p>
              <p className="mt-2 text-sm leading-6">{change.expiry}</p>
            </div>
          </div>
        </div>
      </div>
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
    <div className="p-5 md:p-6">
      {error ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50">
          <div className="flex items-start gap-3">
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Release evidence policy unavailable</p>
              <p className="mt-1 text-sm opacity-80">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-36 items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
          Loading release evidence policy…
        </div>
      )}
    </div>
  );
}
