'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Archive,
  CheckCircle2,
  GitBranch,
  KeyRound,
  Network,
  RefreshCw,
  Search,
  ShieldAlert,
  Timer,
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

type Bound = { min: number; max: number; step: number };
type Asset = {
  id: string;
  label: string;
  detail: string;
  protectionHorizonYears: number;
  deployments: number;
  externalDependencies: number;
  baseMigrationLeadMonths: number;
  harvestNowConcern: boolean;
  trustRoot: boolean;
};
type ReadinessState = {
  id: string;
  label: string;
  detail: string;
  discoveryCoveragePercent: number;
  leadMultiplier: number;
  negotiatedRollout: boolean;
  rollbackReady: boolean;
};
type MigrationModel = {
  title: string;
  description: string;
  defaults: {
    assetId: string;
    readinessId: string;
    delayMonths: number;
  };
  bounds: { delayMonths: Bound };
  assets: Asset[];
  readinessStates: ReadinessState[];
};

const BLOCK_ID = 'fundamentals/quantum-safe-cryptography-systems-calculator';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/quantum-safe-cryptography-systems/data/migration-inventory-model.json';

function isMigrationModel(value: unknown): value is MigrationModel {
  if (!value || typeof value !== 'object') return false;
  const model = value as Partial<MigrationModel>;
  return Boolean(
    model.title
      && model.description
      && model.defaults?.assetId
      && model.defaults?.readinessId
      && model.bounds?.delayMonths
      && Array.isArray(model.assets)
      && model.assets.length >= 3
      && Array.isArray(model.readinessStates)
      && model.readinessStates.length >= 3,
  );
}

function formatMonths(months: number) {
  if (months < 12) return `${months} mo`;
  const years = months / 12;
  return Number.isInteger(years) ? `${years} yr` : `${years.toFixed(1)} yr`;
}

function assetIcon(asset: Asset) {
  if (asset.trustRoot) return KeyRound;
  if (asset.harvestNowConcern) return Archive;
  return Network;
}

export default function QuantumSafeCryptographySystemsCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<MigrationModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [assetId, setAssetId] = useState('');
  const [readinessId, setReadinessId] = useState('');
  const [delayMonths, setDelayMonths] = useState(0);

  function reset(model: MigrationModel) {
    setAssetId(model.defaults.assetId);
    setReadinessId(model.defaults.readinessId);
    setDelayMonths(model.defaults.delayMonths);
  }

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isMigrationModel(payload)) {
          throw new Error('The migration inventory model is incomplete.');
        }
        setData(payload);
        reset(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setData(null);
        setError(
          loadError instanceof Error ? loadError.message : 'Unable to load migration data.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const view = useMemo(() => {
    if (!data) return null;
    const asset = data.assets.find((candidate) => candidate.id === assetId) ?? data.assets[0];
    const readiness =
      data.readinessStates.find((candidate) => candidate.id === readinessId)
      ?? data.readinessStates[0];
    const discoveredDeployments = Math.round(
      asset.deployments * readiness.discoveryCoveragePercent / 100,
    );
    const unknownDeployments = asset.deployments - discoveredDeployments;
    const migrationLeadMonths = Math.ceil(
      asset.baseMigrationLeadMonths * readiness.leadMultiplier,
    );
    const classicalOnlyMonths = delayMonths + migrationLeadMonths;

    let status = 'Controlled migration path';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';
    let verdict =
      'The modeled inventory is complete and the rollout has negotiation and rollback evidence.';
    let nextGate = 'Run a bounded production canary and retain interoperability evidence.';

    if (unknownDeployments > 0) {
      status = 'Inventory blind spot';
      tone = unknownDeployments > asset.deployments * 0.2 ? 'rose' : 'amber';
      verdict = `${unknownDeployments} of ${asset.deployments} modeled deployments remain outside the inventory. Cutover scope and ownership are not yet bounded.`;
      nextGate = 'Discover algorithm, purpose, owner, library, protocol, and certificate use.';
    } else if (asset.trustRoot && !readiness.rollbackReady) {
      status = 'Trust transition is not reversible';
      tone = 'rose';
      verdict =
        'The new signing path has no qualified rollback or recovery root. A failed update could strand devices.';
      nextGate = 'Prove dual-root verification, key rotation, revocation, and recovery.';
    } else if (!readiness.negotiatedRollout) {
      status = 'Compatibility gate missing';
      tone = 'amber';
      verdict =
        'The replacement path cannot yet negotiate or coexist with the current path, so fleet cutover is a flag day.';
      nextGate = 'Test a bounded dual-stack or dual-trust transition and downgrade behavior.';
    } else if (asset.harvestNowConcern && delayMonths > 6) {
      status = 'Classical-only exposure keeps growing';
      tone = 'amber';
      verdict = `${delayMonths} months of avoidable delay precede the modeled migration work for data with a ${asset.protectionHorizonYears}-year confidentiality horizon.`;
      nextGate = 'Prioritize data-in-motion protection while broader dependency work continues.';
    }

    return {
      asset,
      readiness,
      discoveredDeployments,
      unknownDeployments,
      migrationLeadMonths,
      classicalOnlyMonths,
      status,
      tone,
      verdict,
      nextGate,
    };
  }, [assetId, data, delayMonths, readinessId]);

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Migration inventory lab"
          title={data?.title ?? 'Turn cryptographic inventory into a migration decision'}
          description={
            data?.description
            ?? 'Load the modeled asset inventory, readiness state, and migration delay.'
          }
          icon={ShieldAlert}
          accent="amber"
          onReset={data ? () => reset(data) : undefined}
        />

        {!data || !view ? (
          <div className="flex min-h-[520px] items-center justify-center p-6">
            {error ? (
              <div className="max-w-md text-center">
                <TriangleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
                <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
                  Migration model could not be loaded
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={() => setReloadKey((current) => current + 1)}
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-neutral-700 dark:text-neutral-100"
                >
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                  Try again
                </button>
              </div>
            ) : (
              <div className="text-center" role="status">
                <Activity
                  aria-hidden="true"
                  className="mx-auto h-7 w-7 animate-pulse text-amber-500 motion-reduce:animate-none"
                />
                <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
                  Loading migration inventory...
                </p>
              </div>
            )}
          </div>
        ) : (
          <LearningLabBody
            controls={
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Asset to migrate
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.assets.map((asset) => (
                      <LabChoice
                        key={asset.id}
                        selected={asset.id === view.asset.id}
                        label={asset.label}
                        detail={asset.detail}
                        icon={assetIcon(asset)}
                        accent="amber"
                        onClick={() => setAssetId(asset.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Current readiness
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.readinessStates.map((readiness) => (
                      <LabChoice
                        key={readiness.id}
                        selected={readiness.id === view.readiness.id}
                        label={readiness.label}
                        detail={readiness.detail}
                        icon={readiness.rollbackReady ? CheckCircle2 : Search}
                        accent={readiness.rollbackReady ? 'emerald' : 'blue'}
                        onClick={() => setReadinessId(readiness.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="Avoidable start delay"
                  value={delayMonths}
                  output={formatMonths(delayMonths)}
                  {...data.bounds.delayMonths}
                  accent="rose"
                  lowLabel="start now"
                  highLabel="four-year delay"
                  onChange={setDelayMonths}
                />
              </div>
            }
          >
            <div aria-live="polite">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Inventory coverage"
                  value={`${view.readiness.discoveryCoveragePercent}%`}
                  detail={`${view.discoveredDeployments} found; ${view.unknownDeployments} still unknown.`}
                  icon={Search}
                  tone={view.unknownDeployments > 0 ? 'amber' : 'emerald'}
                />
                <LabMetric
                  label="Modeled lead time"
                  value={formatMonths(view.migrationLeadMonths)}
                  detail={`${view.asset.externalDependencies} external dependency gates.`}
                  icon={Timer}
                  tone="blue"
                />
                <LabMetric
                  label="Classical-only window"
                  value={formatMonths(view.classicalOnlyMonths)}
                  detail="Start delay plus modeled migration work; not a quantum-computer forecast."
                  icon={GitBranch}
                  tone={view.classicalOnlyMonths > 30 ? 'rose' : 'violet'}
                />
                <LabMetric
                  label="Protection horizon"
                  value={`${view.asset.protectionHorizonYears} yr`}
                  detail={
                    view.asset.harvestNowConcern
                      ? 'Retained ciphertext may outlive the current protection path.'
                      : 'Use this horizon to order work, not to predict attacker capability.'
                  }
                  icon={Archive}
                  tone={view.asset.harvestNowConcern ? 'amber' : 'neutral'}
                />
              </div>

              <section
                className={`mt-5 rounded-md border p-5 ${
                  view.tone === 'rose'
                    ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100'
                    : view.tone === 'amber'
                      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100'
                }`}
              >
                <div className="flex items-start gap-3">
                  {view.tone === 'emerald' ? (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  ) : (
                    <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  )}
                  <div>
                    <h4 className="font-semibold">{view.status}</h4>
                    <p className="mt-2 text-sm leading-6 opacity-85">{view.verdict}</p>
                  </div>
                </div>
              </section>

              <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/50">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                  <Network aria-hidden="true" className="h-4 w-4 text-blue-500" />
                  Next evidence gate
                </h4>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  {view.nextGate}
                </p>
                <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  The fixture models planning pressure only. Replace counts and lead times with
                  owned inventory, interoperability tests, and protocol-specific measurements.
                </p>
              </section>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}
