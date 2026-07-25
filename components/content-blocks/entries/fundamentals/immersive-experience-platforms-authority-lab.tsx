'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock3,
  Radio,
  RefreshCw,
  Server,
  ShieldCheck,
  TriangleAlert,
  Users,
  Wifi,
  Zap,
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
type EntityScenario = {
  id: string;
  label: string;
  detail: string;
  invariant: string;
  recommendedAuthorityId: string;
  exclusive: boolean;
  durable: boolean;
};
type AuthorityMode = {
  id: string;
  label: string;
  detail: string;
  requestTrips: number;
  supportsExclusiveOwnership: boolean;
  supportsDurableValidation: boolean;
};
type AuthorityModel = {
  defaults: {
    entityId: string;
    authorityId: string;
    roundTripMs: number;
    simultaneousClaims: boolean;
    anticipation: boolean;
  };
  bounds: { roundTripMs: Bound };
  entities: EntityScenario[];
  authorityModes: AuthorityMode[];
};

const BLOCK_ID = 'fundamentals/immersive-experience-platforms-authority-lab';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/immersive-experience-platforms/data/shared-authority-model.json';

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return typeof candidate.min === 'number'
    && typeof candidate.max === 'number'
    && typeof candidate.step === 'number';
}

function isAuthorityModel(value: unknown): value is AuthorityModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AuthorityModel>;
  return Boolean(
    candidate.defaults?.entityId
      && candidate.defaults.authorityId
      && typeof candidate.defaults.roundTripMs === 'number'
      && typeof candidate.defaults.simultaneousClaims === 'boolean'
      && typeof candidate.defaults.anticipation === 'boolean'
      && isBound(candidate.bounds?.roundTripMs)
      && Array.isArray(candidate.entities)
      && candidate.entities.length >= 3
      && Array.isArray(candidate.authorityModes)
      && candidate.authorityModes.length >= 3,
  );
}

function formatMs(value: number) {
  return `${Math.round(value)} ms`;
}

function entityIcon(entityId: string) {
  if (entityId === 'head-and-hands') return Radio;
  if (entityId === 'held-tool') return Users;
  return ShieldCheck;
}

function authorityIcon(authorityId: string) {
  if (authorityId === 'local-sampled') return Zap;
  if (authorityId === 'owner-lease') return Users;
  return Server;
}

export default function ImmersiveExperiencePlatformsAuthorityLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<AuthorityModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [entityId, setEntityId] = useState('held-tool');
  const [authorityId, setAuthorityId] = useState('owner-lease');
  const [roundTripMs, setRoundTripMs] = useState(80);
  const [simultaneousClaims, setSimultaneousClaims] = useState(true);
  const [anticipation, setAnticipation] = useState(true);

  function reset(model: AuthorityModel) {
    setEntityId(model.defaults.entityId);
    setAuthorityId(model.defaults.authorityId);
    setRoundTripMs(model.defaults.roundTripMs);
    setSimultaneousClaims(model.defaults.simultaneousClaims);
    setAnticipation(model.defaults.anticipation);
  }

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isAuthorityModel(payload)) throw new Error('The authority model is incomplete.');
        setData(payload);
        reset(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load authority data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const result = useMemo(() => {
    if (!data) return null;
    const entity = data.entities.find((candidate) => candidate.id === entityId) ?? data.entities[0];
    const authority = data.authorityModes.find((candidate) => candidate.id === authorityId)
      ?? data.authorityModes[0];
    const immediateLocalVisual = authority.id === 'local-sampled'
      || authority.id === 'owner-lease'
      || anticipation;
    const visibleResponseMs = immediateLocalVisual ? 0 : roundTripMs * authority.requestTrips;
    const authoritativeResultMs = authority.id === 'local-sampled'
      ? roundTripMs / 2
      : roundTripMs * authority.requestTrips;
    const ownershipSafe = !entity.exclusive || authority.supportsExclusiveOwnership;
    const durabilitySafe = !entity.durable || authority.supportsDurableValidation;
    const converges = ownershipSafe && durabilitySafe;
    const conflictRisk = simultaneousClaims && entity.exclusive && !authority.supportsExclusiveOwnership;
    const correctionLikely = anticipation
      && authority.id === 'session-authority'
      && simultaneousClaims
      && entity.exclusive;
    const matchesRecommendation = authority.id === entity.recommendedAuthorityId;
    const status = !converges
      ? 'The replicas can disagree about accepted state'
      : correctionLikely
        ? 'Responsive locally, with a visible correction path'
        : matchesRecommendation
          ? 'Authority matches the entity invariant'
          : 'Correct, but more coordination than this entity needs';
    const tone: 'emerald' | 'amber' | 'rose' = !converges
      ? 'rose'
      : matchesRecommendation && !correctionLikely
        ? 'emerald'
        : 'amber';
    const explanation = !ownershipSafe
      ? 'Two participants can accept incompatible ownership changes because no lease or session authority serializes the claim.'
      : !durabilitySafe
        ? 'The selected path distributes visual state but does not provide a validated durable commit for a consequential change.'
        : correctionLikely
          ? 'The client can show anticipated motion immediately, but it must reconcile to the session result when another claim wins.'
          : matchesRecommendation
            ? 'The fastest path that still protects this entity\'s ownership and durability requirements is selected.'
            : 'The design converges, but its extra round trip or authority service may add latency without protecting a required invariant.';

    return {
      authoritativeResultMs,
      authority,
      conflictRisk,
      converges,
      correctionLikely,
      entity,
      explanation,
      immediateLocalVisual,
      matchesRecommendation,
      status,
      tone,
      visibleResponseMs,
    };
  }, [anticipation, authorityId, data, entityId, roundTripMs, simultaneousClaims]);

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Shared-state authority lab"
          title="Decide who may make the shared world true"
          description="Choose an entity and authority contract, then add network delay and competing claims. Compare immediate local feedback with the later state that every participant must accept."
          icon={Users}
          accent="violet"
          onReset={data ? () => reset(data) : undefined}
        />

        {!data || !result ? (
          <div className="flex min-h-[360px] items-center justify-center p-6">
            {error ? (
              <div className="max-w-md text-center">
                <TriangleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
                <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
                  Authority model could not be loaded
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{error}</p>
                <button
                  type="button"
                  onClick={() => setReloadKey((current) => current + 1)}
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-500"
                >
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                  Try again
                </button>
              </div>
            ) : (
              <div className="text-center" role="status">
                <Activity aria-hidden="true" className="mx-auto h-7 w-7 animate-pulse text-violet-500 motion-reduce:animate-none" />
                <p className="mt-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">
                  Loading authority scenarios...
                </p>
              </div>
            )}
          </div>
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Entity contract
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.entities.map((entity) => (
                      <LabChoice
                        key={entity.id}
                        selected={entity.id === result.entity.id}
                        label={entity.label}
                        detail={entity.detail}
                        icon={entityIcon(entity.id)}
                        accent="blue"
                        onClick={() => setEntityId(entity.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Authority contract
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.authorityModes.map((mode) => (
                      <LabChoice
                        key={mode.id}
                        selected={mode.id === result.authority.id}
                        label={mode.label}
                        detail={mode.detail}
                        icon={authorityIcon(mode.id)}
                        accent="violet"
                        onClick={() => setAuthorityId(mode.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="Network round trip"
                  value={roundTripMs}
                  output={formatMs(roundTripMs)}
                  {...data.bounds.roundTripMs}
                  accent="amber"
                  lowLabel="same site"
                  highLabel="poor remote path"
                  onChange={setRoundTripMs}
                />

                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
                  <input
                    type="checkbox"
                    checked={simultaneousClaims}
                    onChange={(event) => setSimultaneousClaims(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-rose-500"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-neutral-900 dark:text-white">
                      Competing participant acts now
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                      Stress exclusive ownership instead of testing only the happy path.
                    </span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
                  <input
                    type="checkbox"
                    checked={anticipation}
                    onChange={(event) => setAnticipation(event.target.checked)}
                    disabled={result.authority.id !== 'session-authority'}
                    className="mt-0.5 h-4 w-4 accent-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-neutral-900 dark:text-white">
                      Anticipate local visual state
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                      Relevant to session authority: respond now, then reconcile to the accepted result.
                    </span>
                  </span>
                </label>
              </div>
            )}
          >
            <div aria-live="polite">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Visible response"
                  value={result.visibleResponseMs === 0 ? 'Immediate' : formatMs(result.visibleResponseMs)}
                  detail={result.immediateLocalVisual ? 'Local visual state changes before remote confirmation.' : 'The user waits for accepted state.'}
                  icon={Zap}
                  tone={result.visibleResponseMs === 0 ? 'cyan' : 'amber'}
                />
                <LabMetric
                  label="Accepted result"
                  value={formatMs(result.authoritativeResultMs)}
                  detail={result.authority.id === 'local-sampled' ? 'Remote sample arrival, not a durable commit.' : 'Estimated authority response.'}
                  icon={Clock3}
                  tone="blue"
                />
                <LabMetric
                  label="Replica outcome"
                  value={result.converges ? 'Converges' : 'Can diverge'}
                  detail={result.conflictRisk ? 'Competing ownership claims remain possible.' : 'The declared invariant has a resolution path.'}
                  icon={result.converges ? CheckCircle2 : TriangleAlert}
                  tone={result.tone}
                />
                <LabMetric
                  label="Reconciliation"
                  value={result.correctionLikely ? 'Correction likely' : 'Stable path'}
                  detail={result.correctionLikely ? 'The anticipated visual may lose to another accepted claim.' : 'No contradictory anticipated claim in this scenario.'}
                  icon={Wifi}
                  tone={result.correctionLikely ? 'amber' : 'emerald'}
                />
              </div>

              <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Event trace
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {[
                    {
                      label: '1. Participant input',
                      time: '0 ms',
                      detail: result.immediateLocalVisual ? 'Render an immediate local response.' : 'Hold visual state while the request travels.',
                    },
                    {
                      label: '2. Authority decision',
                      time: result.authority.id === 'local-sampled' ? 'No shared commit' : formatMs(result.authoritativeResultMs),
                      detail: result.authority.id === 'local-sampled'
                        ? 'Each device publishes samples; no exclusive winner is chosen.'
                        : result.authority.id === 'owner-lease'
                          ? 'The current lease determines whose update is accepted.'
                          : 'The session validates order, policy, and durable state.',
                    },
                    {
                      label: '3. Reconcile replicas',
                      time: result.converges ? 'One accepted state' : 'Conflicting states',
                      detail: result.correctionLikely
                        ? 'Smooth or explain the correction; never keep the rejected local state as truth.'
                        : result.converges
                          ? 'Remote views apply the accepted update and continue interpolation.'
                          : 'Participants can see different owners or durable values.',
                    },
                  ].map((step) => (
                    <div key={step.label} className="min-w-0 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{step.label}</p>
                      <p className="mt-2 break-words text-base font-semibold text-neutral-950 dark:text-white">{step.time}</p>
                      <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{step.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`mt-5 rounded-md border p-4 ${
                result.tone === 'emerald'
                  ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'
                  : result.tone === 'amber'
                    ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'
                    : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40'
              }`}>
                <div className="flex items-start gap-3">
                  {result.converges ? (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                  ) : (
                    <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />
                  )}
                  <div>
                    <p className="font-semibold text-neutral-950 dark:text-white">{result.status}</p>
                    <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                      {result.explanation}
                    </p>
                    <p className="mt-3 text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                      Invariant: {result.entity.invariant}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}
