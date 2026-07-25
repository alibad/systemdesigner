'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  CircleX,
  Code2,
  Cookie,
  Globe2,
  LockKeyhole,
  PanelTop,
  RefreshCw,
  Route,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type PolicyProfile = {
  id: string;
  label: string;
  detail: string;
  corsOrigins: string[];
  allowCredentials: boolean;
  sameSite: 'None' | 'Lax' | 'Strict';
  cspInline: boolean;
  requireScriptNonce: boolean;
  frameAncestors: 'any' | 'self' | 'none';
  csrfToken: boolean;
  fetchMetadata: boolean;
};

type BrowserScenario = {
  id: string;
  label: string;
  brief: string;
  kind: 'cors' | 'script' | 'frame' | 'csrf';
  origin?: string;
  credentialed?: boolean;
  inline?: boolean;
  hasNonce?: boolean;
  method?: string;
  expected: 'allow' | 'block';
  success: string;
  failure: string;
};

type BrowserPolicyData = {
  title: string;
  description: string;
  applicationOrigin: string;
  defaultScenarioId: string;
  defaultProfileId: string;
  profiles: PolicyProfile[];
  scenarios: BrowserScenario[];
};

type PolicyResult = {
  allowed: boolean;
  browserAction: string;
  serverReach: string;
  decisiveControl: string;
  explanation: string;
};

const BLOCK_ID = 'fundamentals/advanced-web-security-browser-policy-lab';

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isBrowserPolicyData(value: unknown): value is BrowserPolicyData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BrowserPolicyData>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.applicationOrigin
      && candidate.defaultScenarioId
      && candidate.defaultProfileId
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length >= 2
      && candidate.profiles.every((profile) => (
        typeof profile.id === 'string'
        && typeof profile.label === 'string'
        && typeof profile.detail === 'string'
        && isStringArray(profile.corsOrigins)
        && typeof profile.allowCredentials === 'boolean'
        && (profile.sameSite === 'None' || profile.sameSite === 'Lax' || profile.sameSite === 'Strict')
        && typeof profile.cspInline === 'boolean'
        && typeof profile.requireScriptNonce === 'boolean'
        && (profile.frameAncestors === 'any' || profile.frameAncestors === 'self' || profile.frameAncestors === 'none')
        && typeof profile.csrfToken === 'boolean'
        && typeof profile.fetchMetadata === 'boolean'
      ))
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length >= 2
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.brief === 'string'
        && (scenario.kind === 'cors' || scenario.kind === 'script' || scenario.kind === 'frame' || scenario.kind === 'csrf')
        && (scenario.expected === 'allow' || scenario.expected === 'block')
        && typeof scenario.success === 'string'
        && typeof scenario.failure === 'string'
      )),
  );
}

function scenarioIcon(kind: BrowserScenario['kind']): LucideIcon {
  if (kind === 'cors') return Globe2;
  if (kind === 'script') return Code2;
  if (kind === 'frame') return PanelTop;
  return Cookie;
}

function evaluatePolicy(
  scenario: BrowserScenario,
  profile: PolicyProfile,
  applicationOrigin: string,
): PolicyResult {
  if (scenario.kind === 'cors') {
    const originAllowed = Boolean(scenario.origin && profile.corsOrigins.includes(scenario.origin));
    const credentialsAllowed = !scenario.credentialed || profile.allowCredentials;
    const allowed = originAllowed && credentialsAllowed;
    return {
      allowed,
      browserAction: allowed ? 'Expose response' : 'Withhold response',
      serverReach: 'Request may arrive',
      decisiveControl: 'CORS allowlist',
      explanation: allowed
        ? `${scenario.origin} exactly matches an allowed response origin.`
        : 'CORS does not authorize the server operation; it controls whether browser code may read the response.',
    };
  }

  if (scenario.kind === 'script') {
    const nonceAccepted = Boolean(scenario.hasNonce && profile.requireScriptNonce);
    const allowed = profile.cspInline || nonceAccepted;
    return {
      allowed,
      browserAction: allowed ? 'Execute script' : 'Block script',
      serverReach: 'No API call required',
      decisiveControl: 'CSP script-src',
      explanation: allowed
        ? 'This profile permits the inline code or recognizes its nonce.'
        : 'The response policy does not grant this inline script permission to execute.',
    };
  }

  if (scenario.kind === 'frame') {
    const allowed = profile.frameAncestors === 'any'
      || (profile.frameAncestors === 'self' && scenario.origin === applicationOrigin);
    return {
      allowed,
      browserAction: allowed ? 'Render frame' : 'Cancel frame',
      serverReach: 'Navigation may arrive',
      decisiveControl: 'CSP frame-ancestors',
      explanation: allowed
        ? 'The embedding ancestor matches this response policy.'
        : 'Every ancestor must match frame-ancestors, so the hostile embed is cancelled.',
    };
  }

  const cookieSent = profile.sameSite === 'None';
  const serverRejects = (profile.csrfToken || profile.fetchMetadata) && scenario.origin !== applicationOrigin;
  const allowed = cookieSent && !serverRejects;
  return {
    allowed,
    browserAction: cookieSent ? 'Attach session cookie' : 'Withhold session cookie',
    serverReach: serverRejects ? 'Server rejects intent' : 'Server accepts request',
    decisiveControl: serverRejects
      ? profile.fetchMetadata ? 'Fetch Metadata policy' : 'CSRF token'
      : `SameSite=${profile.sameSite}`,
    explanation: allowed
      ? 'Ambient authentication reaches the state-changing handler without independent proof of intent.'
      : cookieSent
        ? 'The cookie is present, but the server rejects missing cross-site intent evidence.'
        : `SameSite=${profile.sameSite} withholds this session cookie on a cross-site ${scenario.method ?? 'POST'}.`,
  };
}

export default function AdvancedWebSecurityBrowserPolicyLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<BrowserPolicyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No browser-policy scenario file was supplied.');
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
        if (!isBrowserPolicyData(payload)) throw new Error('Browser-policy data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (error) return <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />;
  if (!data) return <LoadState error={null} onRetry={() => setReloadKey((key) => key + 1)} />;
  return <BrowserPolicyLab data={data} />;
}

function BrowserPolicyLab({ data }: { data: BrowserPolicyData }) {
  const initialScenario = data.scenarios.find((item) => item.id === data.defaultScenarioId)
    ?? data.scenarios[0];
  const initialProfile = data.profiles.find((item) => item.id === data.defaultProfileId)
    ?? data.profiles[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [profileId, setProfileId] = useState(initialProfile.id);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const profile = data.profiles.find((item) => item.id === profileId) ?? data.profiles[0];
  const result = useMemo(
    () => evaluatePolicy(scenario, profile, data.applicationOrigin),
    [data.applicationOrigin, profile, scenario],
  );
  const targetMet = scenario.expected === 'allow' ? result.allowed : !result.allowed;

  function reset() {
    setScenarioId(initialScenario.id);
    setProfileId(initialProfile.id);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Browser policy workbench"
          title={data.title}
          description={data.description}
          icon={Globe2}
          accent="blue"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Browser action
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((item) => {
                    const Icon = scenarioIcon(item.kind);
                    return (
                      <LabChoice
                        key={item.id}
                        selected={item.id === scenario.id}
                        label={item.label}
                        detail={item.brief}
                        icon={Icon}
                        accent="blue"
                        onClick={() => setScenarioId(item.id)}
                      />
                    );
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Response policy
                </legend>
                <div className="mt-3 space-y-2">
                  {data.profiles.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === profile.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'permissive' ? CircleAlert : ShieldCheck}
                      accent={item.id === 'permissive' ? 'rose' : item.id === 'sensitive-surface' ? 'emerald' : 'amber'}
                      onClick={() => setProfileId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div aria-live="polite" className="min-w-0">
            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Browser action"
                value={result.browserAction}
                detail={result.explanation}
                icon={result.allowed ? Route : LockKeyhole}
                tone={result.allowed ? 'blue' : 'emerald'}
              />
              <LabMetric
                label="Server path"
                value={result.serverReach}
                detail="Browser policy and server authorization remain separate controls."
                icon={Globe2}
                tone="violet"
              />
              <LabMetric
                label="Product expectation"
                value={targetMet ? 'Met' : 'Violated'}
                detail={`${scenario.expected === 'allow' ? 'This legitimate flow should work.' : 'This hostile flow should be blocked.'}`}
                icon={targetMet ? CheckCircle2 : CircleX}
                tone={targetMet ? 'emerald' : 'rose'}
              />
            </div>

            <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Effective response envelope
                  </p>
                  <h4 className="mt-1 font-semibold text-neutral-950 dark:text-white">{profile.label}</h4>
                </div>
                <span className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                  Decides at {result.decisiveControl}
                </span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <PolicyChip label="CORS" value={`${profile.corsOrigins.length} exact origin${profile.corsOrigins.length === 1 ? '' : 's'}`} />
                <PolicyChip label="Cookie" value={`SameSite=${profile.sameSite}`} />
                <PolicyChip label="Scripts" value={profile.cspInline ? 'Inline allowed' : profile.requireScriptNonce ? 'Nonce required' : 'External only'} />
                <PolicyChip label="Frames" value={`Ancestors: ${profile.frameAncestors}`} />
              </div>
            </section>

            <div className="mt-5 grid items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
              <PathStage
                icon={scenarioIcon(scenario.kind)}
                label="Initiating context"
                detail={scenario.origin ?? 'Injected page content'}
                state="active"
              />
              <PathConnector />
              <PathStage
                icon={ShieldCheck}
                label={result.decisiveControl}
                detail={result.browserAction}
                state={targetMet ? 'protected' : 'failed'}
              />
              <PathConnector />
              <PathStage
                icon={Globe2}
                label="Application outcome"
                detail={targetMet ? scenario.success : scenario.failure}
                state={targetMet ? 'protected' : 'failed'}
              />
            </div>

            <section className={`mt-5 rounded-md border p-4 ${
              targetMet
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30'
            }`}>
              <div className="flex items-start gap-3">
                {targetMet ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                ) : (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />
                )}
                <div>
                  <h4 className="font-semibold text-neutral-950 dark:text-white">
                    {targetMet ? 'Policy matches the intended flow' : 'Policy and product intent disagree'}
                  </h4>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    {targetMet ? scenario.success : scenario.failure}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function PolicyChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-[11px] font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">{value}</p>
    </div>
  );
}

function PathStage({
  icon: Icon,
  label,
  detail,
  state,
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
  state: 'active' | 'protected' | 'failed';
}) {
  const styles = {
    active: 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-50',
    protected: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-50',
    failed: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-50',
  };
  return (
    <div className={`rounded-md border p-4 ${styles[state]}`}>
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <h4 className="text-sm font-semibold">{label}</h4>
      </div>
      <p className="mt-2 text-xs leading-5 opacity-80">{detail}</p>
    </div>
  );
}

function PathConnector() {
  return (
    <div aria-hidden="true" className="flex h-5 items-center justify-center md:h-auto">
      <div className="h-full w-px bg-neutral-300 md:h-px md:w-7 dark:bg-neutral-700" />
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <div className="flex min-h-[320px] items-center justify-center p-6 text-center">
          <div className="max-w-md">
            {error ? (
              <CircleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
            ) : (
              <Activity aria-hidden="true" className="mx-auto h-7 w-7 animate-pulse text-blue-500 motion-reduce:animate-none" />
            )}
            <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
              {error ? 'Browser-policy data could not be loaded' : 'Loading browser policies...'}
            </p>
            {error ? (
              <>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{error}</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-500"
                >
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                  Try again
                </button>
              </>
            ) : null}
          </div>
        </div>
      </LearningLab>
    </div>
  );
}
