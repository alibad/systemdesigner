'use client';

import { useEffect, useState } from 'react';
import {
  Braces,
  CheckCircle2,
  CircleAlert,
  Code2,
  FileWarning,
  Globe2,
  LoaderCircle,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Outcome = {
  status: 'match' | 'review' | 'reject';
  headline: string;
  explanation: string;
  actions: string[];
};

type Scenario = {
  id: string;
  label: string;
  detail: string;
  format: 'XML' | 'HTML';
  trust: string;
  contract: string;
  outcomes: Record<string, Outcome>;
};

type ParserProfile = {
  id: string;
  label: string;
  detail: string;
  parser: string;
  configuration: string[];
  safeguards: string[];
};

type ParserPolicyModel = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    profileId: string;
  };
  scenarios: Scenario[];
  profiles: ParserProfile[];
};

const BLOCK_ID = 'technology/lxml-parser-policy-lab';
const DEFAULT_DATA_FILE = '/api/content/technology/lxml/data/parser-policy-scenarios.json';

function isParserPolicyModel(value: unknown): value is ParserPolicyModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ParserPolicyModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.scenarioId
      && candidate.defaults.profileId
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length >= 4
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && (scenario.format === 'XML' || scenario.format === 'HTML')
        && scenario.outcomes
        && typeof scenario.outcomes === 'object'
      ))
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length >= 4
      && candidate.profiles.every((profile) => (
        typeof profile.id === 'string'
        && typeof profile.parser === 'string'
        && Array.isArray(profile.configuration)
        && profile.configuration.length > 0
        && Array.isArray(profile.safeguards)
      )),
  );
}

export default function LxmlParserPolicyLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ParserPolicyModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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
        if (!isParserPolicyModel(payload)) throw new Error('The parser-policy data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load parser-policy data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return (
      <LoadState
        error={error}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  return <PolicyWorkbench data={data} />;
}

function PolicyWorkbench({ data }: { data: ParserPolicyModel }) {
  const initialScenario = data.scenarios.find((item) => item.id === data.defaults.scenarioId)
    ?? data.scenarios[0];
  const initialProfile = data.profiles.find((item) => item.id === data.defaults.profileId)
    ?? data.profiles[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [profileId, setProfileId] = useState(initialProfile.id);
  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const profile = data.profiles.find((item) => item.id === profileId) ?? data.profiles[0];
  const outcome = scenario.outcomes[profile.id];

  function reset() {
    setScenarioId(initialScenario.id);
    setProfileId(initialProfile.id);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Parser boundary lab"
          title={data.title}
          description={data.description}
          icon={ShieldCheck}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Input contract
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.format === 'HTML' ? Globe2 : Braces}
                      accent={item.format === 'HTML' ? 'cyan' : 'blue'}
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Parser profile
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.profiles.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === profile.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id.includes('huge') ? FileWarning : Code2}
                      accent={item.id.includes('huge') ? 'rose' : 'violet'}
                      onClick={() => setProfileId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric label="Format" value={scenario.format} detail="Choose XML and HTML parsers deliberately" icon={Braces} tone="blue" />
              <LabMetric label="Trust boundary" value={scenario.trust} detail="Parser settings do not replace byte and time limits" icon={ShieldCheck} tone="amber" />
              <LabMetric label="Parser" value={profile.parser} detail={profile.label} icon={Code2} tone="violet" />
            </div>

            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              <section className="min-w-0 overflow-hidden rounded-md border border-neutral-200 bg-neutral-950 dark:border-neutral-800">
                <div className="border-b border-neutral-800 px-4 py-3">
                  <p className="text-xs font-semibold uppercase text-neutral-400">Explicit configuration</p>
                </div>
                <pre className="overflow-x-auto p-4 text-xs leading-6 text-cyan-200" tabIndex={0}>
                  <code>{profile.configuration.join('\n')}</code>
                </pre>
              </section>

              <section className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Required result</p>
                <h4 className="mt-2 text-base font-semibold text-neutral-950 dark:text-white">{scenario.contract}</h4>
                <p className="mt-4 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Profile boundaries</p>
                <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-neutral-700 marker:text-amber-500 dark:text-neutral-300">
                  {profile.safeguards.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </section>
            </div>

            <OutcomePanel outcome={outcome} />
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function OutcomePanel({ outcome }: { outcome: Outcome | undefined }) {
  if (!outcome) {
    return (
      <section className="rounded-md border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
        <h4 className="font-semibold">This scenario/profile outcome is missing</h4>
        <p className="mt-2 text-sm leading-6 opacity-80">The lesson data must define every selectable combination.</p>
      </section>
    );
  }

  const styles = {
    match: {
      label: 'Contract aligned',
      Icon: CheckCircle2,
      shell: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100',
    },
    review: {
      label: 'Explicit review required',
      Icon: TriangleAlert,
      shell: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100',
    },
    reject: {
      label: 'Contract mismatch',
      Icon: CircleAlert,
      shell: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100',
    },
  } as const;
  const style = styles[outcome.status];
  const StatusIcon = style.Icon;

  return (
    <section className={`rounded-md border p-5 ${style.shell}`}>
      <div className="flex items-start gap-3">
        <StatusIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase opacity-75">{style.label}</p>
          <h4 className="mt-1 text-lg font-semibold">{outcome.headline}</h4>
          <p className="mt-2 text-sm leading-6 opacity-85">{outcome.explanation}</p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-6 marker:text-current">
            {outcome.actions.map((action) => <li key={action}>{action}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Parser boundary lab"
          title={error ? 'Parser-policy lab unavailable' : 'Loading parser-policy lab'}
          description="The lab checks every input contract against an explicit parser profile."
          icon={ShieldCheck}
          accent="amber"
        />
        <LearningLabBody>
          <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
            {error
              ? <CircleAlert aria-hidden="true" className="h-7 w-7 text-rose-600 dark:text-rose-300" />
              : <LoaderCircle aria-hidden="true" className="h-7 w-7 animate-spin text-amber-600 motion-reduce:animate-none dark:text-amber-300" />}
            <p className="text-sm text-neutral-600 dark:text-neutral-300">{error ?? 'Loading parser profiles...'}</p>
            {error ? (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
              >
                Retry
              </button>
            ) : null}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
