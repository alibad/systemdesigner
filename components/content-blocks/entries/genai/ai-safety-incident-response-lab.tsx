'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Archive,
  CheckCircle2,
  CircleAlert,
  Clock3,
  LoaderCircle,
  PauseCircle,
  RotateCcw,
  ShieldAlert,
  Siren,
  TimerReset,
  UsersRound,
  XCircle,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Tone = 'emerald' | 'amber' | 'rose' | 'violet';

interface IncidentAction {
  id: string;
  label: string;
  detail: string;
  containmentMinutes: number;
  remainingExposureRatio: number;
}

interface EvidencePlan {
  id: string;
  label: string;
  detail: string;
  evidenceIds: string[];
}

interface IncidentScenario {
  id: string;
  label: string;
  detail: string;
  severity: string;
  exposedUsersPerMinute: number;
  recommendedActionId: string;
  owner: string;
  requiredEvidenceIds: string[];
  why: string;
}

interface IncidentResponseModel {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    actionId: string;
    evidenceId: string;
    responseDelayMinutes: number;
  };
  actions: IncidentAction[];
  evidencePlans: EvidencePlan[];
  scenarios: IncidentScenario[];
}

const BLOCK_ID = 'genai/ai-safety-incident-response-lab';

function isIncidentResponseModel(value: unknown): value is IncidentResponseModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<IncidentResponseModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && Array.isArray(candidate.actions)
      && candidate.actions.length > 0
      && Array.isArray(candidate.evidencePlans)
      && candidate.evidencePlans.length > 0
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0,
  );
}

export default function AiSafetyIncidentResponseLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<IncidentResponseModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No incident response model was supplied.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isIncidentResponseModel(payload)) {
          throw new Error('Incident response data is incomplete.');
        }
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load incident response data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabError detail={loadError} />;
  if (!data) return <LabLoading />;
  return <IncidentResponseLab data={data} />;
}

function IncidentResponseLab({ data }: { data: IncidentResponseModel }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [actionId, setActionId] = useState(data.defaults.actionId);
  const [evidenceId, setEvidenceId] = useState(data.defaults.evidenceId);
  const [responseDelayMinutes, setResponseDelayMinutes] = useState(
    data.defaults.responseDelayMinutes,
  );

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const action = data.actions.find((item) => item.id === actionId) ?? data.actions[0];
  const evidence = data.evidencePlans.find((item) => item.id === evidenceId) ?? data.evidencePlans[0];

  const result = useMemo(() => {
    const evidenceSet = new Set(evidence.evidenceIds);
    const evidenceCoverage = scenario.requiredEvidenceIds.filter((id) => evidenceSet.has(id)).length
      / scenario.requiredEvidenceIds.length;
    const exposureBeforeAction = scenario.exposedUsersPerMinute * responseDelayMinutes;
    const exposureDuringContainment = scenario.exposedUsersPerMinute
      * action.containmentMinutes
      * action.remainingExposureRatio;
    const exposedUsers = Math.round(exposureBeforeAction + exposureDuringContainment);
    const responseMatches = action.id === scenario.recommendedActionId;
    const rawDump = evidence.id === 'raw-dump';

    let verdict = 'Response leaves avoidable risk';
    let tone: Tone = 'rose';
    if (responseMatches && evidenceCoverage === 1 && !rawDump && responseDelayMinutes <= 10) {
      verdict = 'Contained with attributable evidence';
      tone = 'emerald';
    } else if (responseMatches && evidenceCoverage >= 0.75 && !rawDump) {
      verdict = 'Containment is sound; evidence or speed needs work';
      tone = 'amber';
    } else if (rawDump) {
      verdict = 'Evidence capture creates a second privacy risk';
      tone = 'violet';
    } else if (action.id === 'observe') {
      verdict = 'Observation keeps active harm exposed';
    } else {
      verdict = 'Containment does not match the failure boundary';
    }

    return {
      evidenceCoverage,
      exposedUsers,
      responseMatches,
      responseMinutes: responseDelayMinutes + action.containmentMinutes,
      tone,
      verdict,
    };
  }, [action, evidence, responseDelayMinutes, scenario]);

  const reset = () => {
    setScenarioId(data.defaults.scenarioId);
    setActionId(data.defaults.actionId);
    setEvidenceId(data.defaults.evidenceId);
    setResponseDelayMinutes(data.defaults.responseDelayMinutes);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Incident escalation drill"
          title={data.title}
          description={data.description}
          icon={Siren}
          accent="rose"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Inject a failure
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={scenario.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={ShieldAlert}
                      accent={item.severity === 'Critical' ? 'rose' : item.severity === 'High' ? 'amber' : 'violet'}
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. First containment action
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.actions.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={action.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'shutdown' ? RotateCcw : item.id === 'restrict' ? PauseCircle : Activity}
                      accent={item.id === 'shutdown' ? 'rose' : item.id === 'restrict' ? 'amber' : 'blue'}
                      onClick={() => setActionId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Evidence plan
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.evidencePlans.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={evidence.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Archive}
                      accent={item.id === 'versioned-trace' ? 'emerald' : item.id === 'raw-dump' ? 'rose' : 'blue'}
                      onClick={() => setEvidenceId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Time before response begins"
                value={responseDelayMinutes}
                output={`${responseDelayMinutes} min`}
                min={0}
                max={45}
                step={1}
                accent="rose"
                lowLabel="Immediate"
                highLabel="45 minutes"
                onChange={setResponseDelayMinutes}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Incident severity"
                value={scenario.severity}
                detail={`${scenario.exposedUsersPerMinute} users/min at current traffic`}
                icon={ShieldAlert}
                tone={scenario.severity === 'Critical' ? 'rose' : scenario.severity === 'High' ? 'amber' : 'violet'}
              />
              <LabMetric
                label="Users exposed"
                value={`${result.exposedUsers}`}
                detail="Modeled before containment completes"
                icon={UsersRound}
                tone={result.exposedUsers === 0 ? 'emerald' : result.exposedUsers <= 100 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Time to containment"
                value={`${result.responseMinutes} min`}
                detail={`${action.containmentMinutes} min after action starts`}
                icon={TimerReset}
                tone={result.responseMinutes <= 15 ? 'emerald' : result.responseMinutes <= 30 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Required evidence"
                value={`${Math.round(result.evidenceCoverage * 100)}%`}
                detail="Coverage of the incident evidence contract"
                icon={Archive}
                tone={result.evidenceCoverage === 1 ? 'emerald' : 'amber'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Escalation contract
                  </p>
                  <h4 className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">
                    {scenario.owner}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                    {scenario.why}
                  </p>
                </div>
                <span className={`shrink-0 rounded-md border px-3 py-2 text-sm font-semibold ${result.responseMatches
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
                  : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200'}`}
                >
                  {result.responseMatches ? 'Action matches' : 'Action mismatch'}
                </span>
              </div>
            </section>

            <section>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Response timeline
              </p>
              <ol className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: 'Detect', detail: scenario.label, icon: CircleAlert, complete: true },
                  { label: 'Start response', detail: `After ${responseDelayMinutes} minutes`, icon: Clock3, complete: responseDelayMinutes <= 10 },
                  { label: 'Contain', detail: action.label, icon: PauseCircle, complete: result.responseMatches },
                  { label: 'Preserve', detail: evidence.label, icon: Archive, complete: result.evidenceCoverage === 1 && evidence.id !== 'raw-dump' },
                ].map((step, index) => (
                  <li key={step.label} className="relative min-w-0 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                    <div className="flex items-start gap-3">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${step.complete
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'}`}
                      >
                        {step.complete ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : <XCircle aria-hidden="true" className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                          {index + 1}. {step.label}
                        </p>
                        <p className="mt-1 text-sm font-semibold leading-5 text-neutral-950 dark:text-white">
                          {step.detail}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className={`rounded-md border p-5 ${result.tone === 'emerald'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
              : result.tone === 'amber'
                ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
                : result.tone === 'violet'
                  ? 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'}`}
            >
              <div className="flex items-start gap-3">
                <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Observed outcome</p>
                  <p className="mt-2 text-lg font-semibold">{result.verdict}</p>
                  <p className="mt-2 text-sm leading-6 opacity-85">
                    Fast containment and versioned, minimized evidence are separate requirements. One does not compensate for the other.
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

function LabLoading() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 flex min-h-64 items-center justify-center rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
        Loading incident response model...
      </div>
    </div>
  );
}

function LabError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
      <div className="flex items-start gap-3">
        <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Incident response lab unavailable</p>
          <p className="mt-1 text-sm opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
