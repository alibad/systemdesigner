'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Check,
  CircleAlert,
  Gavel,
  LockKeyhole,
  Scale,
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

const BLOCK_ID = 'fundamentals/ethical-ai-governance-platforms-calculator';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/ethical-ai-governance-platforms/data/governance-tier-policy.json';

type Impact = 'limited' | 'material' | 'rights-affecting';
type Authority = 'assist' | 'recommend' | 'decide';
type TierId = 'tier-1' | 'tier-2' | 'tier-3';

type UseCaseProfile = {
  id: string;
  label: string;
  detail: string;
  impact: Impact;
  authority: Authority;
  sensitiveData: boolean;
  affectedParty: string;
  failureConsequence: string;
};

type AuthorityOption = {
  id: Authority;
  label: string;
  detail: string;
};

type GovernanceTier = {
  id: TierId;
  label: string;
  summary: string;
  approver: string;
  controls: string[];
};

type GovernancePolicy = {
  title: string;
  description: string;
  policyNote: string;
  defaults: { profileId: string };
  profiles: UseCaseProfile[];
  authorities: AuthorityOption[];
  tiers: GovernanceTier[];
};

const impacts: Impact[] = ['limited', 'material', 'rights-affecting'];
const authorities: Authority[] = ['assist', 'recommend', 'decide'];
const tierIds: TierId[] = ['tier-1', 'tier-2', 'tier-3'];

function isGovernancePolicy(value: unknown): value is GovernancePolicy {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<GovernancePolicy>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.policyNote
      && candidate.defaults?.profileId
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length >= 3
      && candidate.profiles.every((profile) => (
        typeof profile.id === 'string'
        && typeof profile.label === 'string'
        && typeof profile.detail === 'string'
        && impacts.includes(profile.impact)
        && authorities.includes(profile.authority)
        && typeof profile.sensitiveData === 'boolean'
        && typeof profile.affectedParty === 'string'
        && typeof profile.failureConsequence === 'string'
      ))
      && Array.isArray(candidate.authorities)
      && candidate.authorities.length === 3
      && candidate.authorities.every((authority) => (
        authorities.includes(authority.id)
        && typeof authority.label === 'string'
        && typeof authority.detail === 'string'
      ))
      && Array.isArray(candidate.tiers)
      && candidate.tiers.length === 3
      && candidate.tiers.every((tier) => (
        tierIds.includes(tier.id)
        && typeof tier.label === 'string'
        && typeof tier.summary === 'string'
        && typeof tier.approver === 'string'
        && Array.isArray(tier.controls)
        && tier.controls.length >= 3
      )),
  );
}

export default function EthicalAIGovernanceTierLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [policy, setPolicy] = useState<GovernancePolicy | null>(null);
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
        if (!isGovernancePolicy(payload)) {
          throw new Error('The governance policy model is incomplete.');
        }
        setPolicy(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the policy.');
      });
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!policy ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Governance tier lab"
            title="Load the explicit policy model"
            description="The lesson-owned rules and control sets are loading."
            icon={Scale}
            accent="violet"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <GovernanceTierLab policy={policy} />
      )}
    </div>
  );
}

function GovernanceTierLab({ policy }: { policy: GovernancePolicy }) {
  const initialProfile = policy.profiles.find(
    (profile) => profile.id === policy.defaults.profileId,
  ) ?? policy.profiles[0];
  const [profileId, setProfileId] = useState(initialProfile.id);
  const [authority, setAuthority] = useState<Authority>(initialProfile.authority);
  const [sensitiveData, setSensitiveData] = useState(initialProfile.sensitiveData);

  const profile = policy.profiles.find((item) => item.id === profileId) ?? policy.profiles[0];

  const decision = useMemo(() => {
    const matchedRules: string[] = [];
    let tierId: TierId;

    if (profile.impact === 'rights-affecting') {
      matchedRules.push('Rights-affecting intended use');
    }
    if (profile.impact === 'material' && authority === 'decide') {
      matchedRules.push('Autonomous material decision');
    }

    if (matchedRules.length > 0) {
      tierId = 'tier-3';
    } else {
      if (profile.impact === 'material') matchedRules.push('Material impact');
      if (authority !== 'assist') matchedRules.push('Recommendation or decision authority');
      if (sensitiveData) matchedRules.push('Sensitive data in scope');
      tierId = matchedRules.length > 0 ? 'tier-2' : 'tier-1';
    }

    const tier = policy.tiers.find((item) => item.id === tierId) ?? policy.tiers[0];
    return { matchedRules, tier };
  }, [authority, policy.tiers, profile.impact, sensitiveData]);

  function applyProfile(nextProfile: UseCaseProfile) {
    setProfileId(nextProfile.id);
    setAuthority(nextProfile.authority);
    setSensitiveData(nextProfile.sensitiveData);
  }

  function reset() {
    applyProfile(initialProfile);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Governance tier lab"
        title={policy.title}
        description={policy.description}
        icon={Scale}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Intended use
              </legend>
              <div className="mt-3 grid gap-2">
                {policy.profiles.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === profile.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Users}
                    accent="violet"
                    onClick={() => applyProfile(item)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Decision authority
              </legend>
              <div className="mt-3 grid gap-2">
                {policy.authorities.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === authority}
                    label={item.label}
                    detail={item.detail}
                    icon={Gavel}
                    accent="blue"
                    onClick={() => setAuthority(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <button
              type="button"
              aria-pressed={sensitiveData}
              onClick={() => setSensitiveData((current) => !current)}
              className={`w-full rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${sensitiveData
                ? 'border-amber-300 bg-amber-50 text-amber-950 ring-1 ring-amber-500 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50'
                : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'}`}
            >
              <span className="flex items-start gap-3">
                <LockKeyhole aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <span className="block text-sm font-semibold">
                    Sensitive data {sensitiveData ? 'in scope' : 'out of scope'}
                  </span>
                  <span className="mt-1 block text-xs leading-5 opacity-75">
                    Toggle personal, health, financial, biometric, or similarly sensitive context.
                  </span>
                </span>
              </span>
            </button>
          </div>
        )}
      >
        <DecisionPanel
          policy={policy}
          profile={profile}
          authority={authority}
          sensitiveData={sensitiveData}
          decision={decision}
        />
      </LearningLabBody>
    </LearningLab>
  );
}

function DecisionPanel({
  policy,
  profile,
  authority,
  sensitiveData,
  decision,
}: {
  policy: GovernancePolicy;
  profile: UseCaseProfile;
  authority: Authority;
  sensitiveData: boolean;
  decision: { matchedRules: string[]; tier: GovernanceTier };
}) {
  const highImpact = decision.tier.id === 'tier-3';
  const standard = decision.tier.id === 'tier-1';

  return (
    <div className="min-w-0 space-y-6" aria-live="polite">
      <div className={`rounded-md border p-5 ${highImpact
        ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
        : standard
          ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
          : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'}`}
      >
        <div className="flex items-start gap-3">
          {highImpact ? (
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          ) : standard ? (
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase opacity-70">Policy decision</p>
            <h4 className="mt-1 text-xl font-semibold">{decision.tier.label}</h4>
            <p className="mt-2 text-sm leading-6 opacity-80">{decision.tier.summary}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <LabMetric
          label="Impact class"
          value={profile.impact === 'rights-affecting' ? 'Rights-affecting' : profile.impact}
          detail={profile.affectedParty}
          icon={Users}
          tone={profile.impact === 'rights-affecting' ? 'rose' : 'cyan'}
        />
        <LabMetric
          label="Authority"
          value={authority}
          detail={authority === 'decide' ? 'No pre-impact human checkpoint' : 'A person remains in the decision path'}
          icon={Gavel}
          tone={authority === 'decide' ? 'rose' : 'blue'}
        />
        <LabMetric
          label="Matched rules"
          value={String(decision.matchedRules.length)}
          detail={decision.matchedRules.length === 0 ? 'Default standard tier' : 'Highest matching rule wins'}
          icon={Scale}
          tone={decision.matchedRules.length === 0 ? 'neutral' : 'violet'}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            Why this tier?
          </p>
          {decision.matchedRules.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {decision.matchedRules.map((rule) => (
                <li key={rule} className="flex items-start gap-2 text-sm text-neutral-800 dark:text-neutral-200">
                  <BadgeCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
              No elevated rule matched. The use remains assistive, limited impact, and
              outside the sensitive-data condition in this teaching policy.
            </p>
          )}
          <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Failure to govern
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
              {profile.failureConsequence}
            </p>
          </div>
        </section>

        <section className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            Required controls
          </p>
          <ul className="mt-3 space-y-2">
            {decision.tier.controls.map((control) => (
              <li key={control} className="flex items-start gap-2 text-sm text-neutral-800 dark:text-neutral-200">
                <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                <span>{control}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-50">
            <p className="text-xs font-semibold uppercase opacity-70">Approval authority</p>
            <p className="mt-1 text-sm font-semibold">{decision.tier.approver}</p>
          </div>
        </section>
      </div>

      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
        <div className="flex items-start gap-3">
          <Scale aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-neutral-600 dark:text-neutral-300" />
          <div>
            <p className="text-sm font-semibold text-neutral-950 dark:text-white">Model assumption</p>
            <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
              {policy.policyNote} Sensitive data is currently {sensitiveData ? 'included' : 'excluded'}.
            </p>
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
              <p className="text-sm font-semibold">Governance policy unavailable</p>
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
          Loading governance policy…
        </div>
      )}
    </div>
  );
}
