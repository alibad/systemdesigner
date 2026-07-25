'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Ban,
  Box,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Code2,
  KeyRound,
  LockKeyhole,
  Server,
  ShieldAlert,
  ShieldCheck,
  Tags,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Scenario = {
  id: string;
  label: string;
  detail: string;
  protectedRef: boolean;
  untrustedCode: boolean;
  requiredTags: string[];
  needsCredential: boolean;
  credentialLabel: string;
  needsHostControl: boolean;
};
type RunnerPool = {
  id: string;
  label: string;
  detail: string;
  tags: string[];
  protected: boolean;
  ephemeral: boolean;
  hostAccess: boolean;
  credentialMode: 'none' | 'oidc' | 'static';
  credentialDetail: string;
};
type TrustModel = {
  title: string;
  description: string;
  defaults: { scenarioId: string; poolId: string };
  scenarios: Scenario[];
  pools: RunnerPool[];
};
type Check = { id: string; label: string; detail: string; pass: boolean };

const BLOCK_ID = 'technology/gitlab-ci-runner-trust-lab';
const DEFAULT_DATA_FILE = '/api/content/technology/gitlab-ci/data/runner-trust-model.json';

function isTrustModel(value: unknown): value is TrustModel {
  if (!value || typeof value !== 'object') return false;
  const model = value as Partial<TrustModel>;
  return Boolean(
    model.title
      && model.description
      && model.defaults?.scenarioId
      && model.defaults.poolId
      && Array.isArray(model.scenarios)
      && model.scenarios.length >= 3
      && model.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.protectedRef === 'boolean'
        && typeof scenario.untrustedCode === 'boolean'
        && Array.isArray(scenario.requiredTags)
        && typeof scenario.needsCredential === 'boolean'
      ))
      && Array.isArray(model.pools)
      && model.pools.length >= 3
      && model.pools.every((pool) => (
        typeof pool.id === 'string'
        && typeof pool.label === 'string'
        && Array.isArray(pool.tags)
        && typeof pool.protected === 'boolean'
        && typeof pool.ephemeral === 'boolean'
        && typeof pool.hostAccess === 'boolean'
        && ['none', 'oidc', 'static'].includes(pool.credentialMode)
      )),
  );
}

export default function GitlabCiRunnerTrustLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<TrustModel | null>(null);
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
        if (!isTrustModel(payload)) throw new Error('The runner trust model is incomplete.');
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load runner data.');
      });
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Runner trust lab"
            title="Inspect the execution boundary"
            description="Loading workload, runner, credential, and eligibility policy."
            icon={ShieldCheck}
            accent="rose"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : <TrustLab model={model} />}
    </div>
  );
}

function TrustLab({ model }: { model: TrustModel }) {
  const [scenarioId, setScenarioId] = useState(model.defaults.scenarioId);
  const [poolId, setPoolId] = useState(model.defaults.poolId);
  const scenario = model.scenarios.find((item) => item.id === scenarioId) ?? model.scenarios[0];
  const pool = model.pools.find((item) => item.id === poolId) ?? model.pools[0];

  const result = useMemo(() => {
    const tagsMatch = scenario.requiredTags.every((tag) => pool.tags.includes(tag));
    const protectionAllows = !pool.protected || scenario.protectedRef;
    const eligible = tagsMatch && protectionAllows;
    const checks: Check[] = [
      {
        id: 'tags',
        label: 'Capability tags match',
        pass: tagsMatch,
        detail: tagsMatch
          ? `Runner exposes every required tag: ${scenario.requiredTags.join(', ')}.`
          : `Job requires ${scenario.requiredTags.join(', ')}, runner exposes ${pool.tags.join(', ')}.`,
      },
      {
        id: 'protection',
        label: 'Protected-ref policy allows the job',
        pass: protectionAllows,
        detail: protectionAllows
          ? pool.protected ? 'The protected runner receives a protected-ref job.' : 'This unprotected runner accepts the selected ref under the model.'
          : 'A protected runner does not accept this unprotected-ref job.',
      },
      {
        id: 'workspace',
        label: 'Workspace lifetime matches the trust level',
        pass: pool.ephemeral,
        detail: pool.ephemeral
          ? 'The model gives each job a fresh execution environment.'
          : 'A persistent workspace can retain repository data, outputs, and runner state across jobs.',
      },
      {
        id: 'host',
        label: 'Host authority is intentionally bounded',
        pass: !pool.hostAccess || scenario.needsHostControl,
        detail: pool.hostAccess
          ? 'The job runs with access to the persistent runner host boundary.'
          : 'The model denies direct control of the runner host.',
      },
      {
        id: 'credential',
        label: 'Credential scope matches the job',
        pass: scenario.needsCredential
          ? pool.credentialMode === 'oidc' && pool.protected
          : pool.credentialMode === 'none',
        detail: scenario.needsCredential
          ? pool.credentialMode === 'oidc' && pool.protected
            ? 'A protected job requests a short-lived identity for the named audience.'
            : `The job needs ${scenario.credentialLabel.toLowerCase()}, but this pool does not provide the modeled protected OIDC boundary.`
          : pool.credentialMode === 'none'
            ? 'No deployment credential is available to this job.'
            : 'This job does not need the credential capability present in the selected pool.',
      },
    ];
    const failed = checks.filter((check) => !check.pass);
    const verdict = !eligible ? 'blocked' : failed.length === 0 ? 'aligned' : 'exposed';
    return { checks, failed, eligible, verdict };
  }, [pool, scenario]);

  function reset() {
    setScenarioId(model.defaults.scenarioId);
    setPoolId(model.defaults.poolId);
  }

  const verdictTone = result.verdict === 'aligned' ? 'emerald' : result.verdict === 'blocked' ? 'amber' : 'rose';
  const VerdictIcon = result.verdict === 'aligned' ? ShieldCheck : result.verdict === 'blocked' ? Ban : ShieldAlert;

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Runner trust lab"
        title={model.title}
        description={model.description}
        icon={ShieldCheck}
        accent="rose"
        onReset={reset}
      />
      <LearningLabBody controls={(
        <div className="space-y-7">
          <fieldset>
            <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Pipeline workload</legend>
            <div className="mt-3 space-y-2">
              {model.scenarios.map((item) => (
                <LabChoice
                  key={item.id}
                  selected={item.id === scenario.id}
                  label={item.label}
                  detail={item.detail}
                  icon={item.untrustedCode ? Code2 : item.needsCredential ? KeyRound : Box}
                  accent={item.untrustedCode ? 'rose' : item.needsCredential ? 'amber' : 'blue'}
                  onClick={() => setScenarioId(item.id)}
                />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Runner pool</legend>
            <div className="mt-3 space-y-2">
              {model.pools.map((item) => (
                <LabChoice
                  key={item.id}
                  selected={item.id === pool.id}
                  label={item.label}
                  detail={item.detail}
                  icon={item.protected ? LockKeyhole : Server}
                  accent={item.protected ? 'emerald' : item.ephemeral ? 'blue' : 'amber'}
                  onClick={() => setPoolId(item.id)}
                />
              ))}
            </div>
          </fieldset>
        </div>
      )}>
        <div className="space-y-5" aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric label="Scheduler" value={result.eligible ? 'Eligible' : 'Blocked'} detail={result.eligible ? 'Tag and protection checks pass.' : 'The runner cannot claim this job.'} icon={Tags} tone={result.eligible ? 'blue' : 'amber'} />
            <LabMetric label="Code trust" value={scenario.untrustedCode ? 'Untrusted' : 'Reviewed ref'} detail={scenario.protectedRef ? 'Protected-ref workload in this model.' : 'Unprotected-ref workload in this model.'} icon={Code2} tone={scenario.untrustedCode ? 'rose' : 'emerald'} />
            <LabMetric label="Credential" value={pool.credentialMode === 'oidc' ? 'Short-lived OIDC' : pool.credentialMode === 'static' ? 'Static secret' : 'None'} detail={pool.credentialDetail} icon={KeyRound} tone={pool.credentialMode === 'oidc' ? 'violet' : 'neutral'} />
          </div>

          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Authority path</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-stretch">
              <BoundaryCard icon={Code2} eyebrow={scenario.untrustedCode ? 'Untrusted source' : 'Reviewed source'} title={scenario.label} detail={scenario.protectedRef ? 'Protected ref' : 'Unprotected ref'} />
              <ChevronRight aria-hidden="true" className="mx-auto h-5 w-5 rotate-90 self-center text-neutral-400 sm:rotate-0" />
              <BoundaryCard icon={Server} eyebrow={pool.protected ? 'Protected runner' : 'General runner'} title={pool.label} detail={pool.ephemeral ? 'Ephemeral workspace' : 'Persistent workspace'} />
              <ChevronRight aria-hidden="true" className="mx-auto h-5 w-5 rotate-90 self-center text-neutral-400 sm:rotate-0" />
              <BoundaryCard icon={KeyRound} eyebrow="Available authority" title={scenario.needsCredential ? scenario.credentialLabel : 'Build only'} detail={pool.credentialMode === 'oidc' ? 'OIDC identity token' : pool.credentialMode === 'none' ? 'No deploy identity' : 'Static credential'} />
            </div>
          </div>

          <div className="overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Boundary checks</p>
            </div>
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {result.checks.map((check) => (
                <li key={check.id} className="flex items-start gap-3 px-4 py-3">
                  {check.pass
                    ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                    : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />}
                  <div>
                    <p className="text-sm font-semibold text-neutral-950 dark:text-white">{check.label}</p>
                    <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">{check.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className={`rounded-md border p-4 ${verdictTone === 'emerald'
            ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
            : verdictTone === 'amber'
              ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'
              : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'}`}>
            <div className="flex items-start gap-3">
              <VerdictIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">
                  {result.verdict === 'aligned' ? 'Workload and runner boundary align' : result.verdict === 'blocked' ? 'The scheduler must leave this job queued' : 'The job can run, but its authority is broader than required'}
                </p>
                <p className="mt-1 text-sm leading-6 opacity-80">
                  {result.verdict === 'aligned'
                    ? 'The selected pool supplies the required capability without adding persistence, host control, or an unnecessary credential in this model.'
                    : result.verdict === 'blocked'
                      ? 'Fix the runner tags or protected-ref policy deliberately; bypassing eligibility would erase the intended boundary.'
                      : `${result.failed.length} boundary ${result.failed.length === 1 ? 'check needs' : 'checks need'} attention before this assignment is production-ready.`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function BoundaryCard({ icon: Icon, eyebrow, title, detail }: { icon: typeof Server; eyebrow: string; title: string; detail: string }) {
  return (
    <div className="min-w-0 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-950">
      <div className="flex items-start gap-2">
        <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase text-neutral-500 dark:text-neutral-400">{eyebrow}</p>
          <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">{title}</p>
          <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="p-5 md:p-6">
      {error ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50">
          <div className="flex items-start gap-3">
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Runner trust model unavailable</p>
              <p className="mt-1 text-sm opacity-80">{error}</p>
              <button type="button" onClick={onRetry} className="mt-3 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">Retry</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-32 items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">Loading runner trust model...</div>
      )}
    </div>
  );
}
