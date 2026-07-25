'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  Clock3,
  DatabaseZap,
  RefreshCw,
  ShieldCheck,
  Siren,
  TriangleAlert,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/ml-systems-design/data/incident-response-lab.json';

type Incident = {
  id: string;
  label: string;
  detail: string;
  signal: string;
  cause: string;
  recommendedResponseId: string;
  baseRecoveryMinutes: number;
  severity: number;
  affectedStage: 'Serve' | 'Observe' | 'Learn';
};

type Response = {
  id: string;
  label: string;
  detail: string;
  recoveryFactor: number;
  exposureFactor: number;
  evidenceScore: number;
};

type LabData = {
  title: string;
  description: string;
  defaults: { incidentId: string; responseId: string };
  incidents: Incident[];
  responses: Response[];
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      data.defaults &&
      typeof data.defaults.incidentId === 'string' &&
      typeof data.defaults.responseId === 'string' &&
      Array.isArray(data.incidents) &&
      data.incidents.length >= 3 &&
      Array.isArray(data.responses) &&
      data.responses.length >= 3,
  );
}

function formatRecovery(minutes: number) {
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`;
  return `${(minutes / 60).toFixed(minutes < 600 ? 1 : 0)} hr`;
}

export default function MlSystemsDesignIncidentResponseLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [responseId, setResponseId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load lab data (${response.status}).`);
        return response.json();
      })
      .then((value: unknown) => {
        if (!isLabData(value)) throw new Error('The incident lab data is invalid.');
        setData(value);
        setIncidentId(value.defaults.incidentId);
        setResponseId(value.defaults.responseId);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') {
          setError(fetchError instanceof Error ? fetchError.message : 'Could not load lab data.');
        }
      });

    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    if (!data || !incidentId || !responseId) return null;
    const incident = data.incidents.find((item) => item.id === incidentId) ?? data.incidents[0];
    const response = data.responses.find((item) => item.id === responseId) ?? data.responses[0];
    const recommended =
      data.responses.find((item) => item.id === incident.recommendedResponseId) ?? data.responses[0];
    const matched = response.id === recommended.id;
    const mismatchPenalty = matched ? 1 : 1.75;
    const recoveryMinutes = incident.baseRecoveryMinutes * response.recoveryFactor * mismatchPenalty;
    const exposure = Math.min(
      100,
      Math.round(incident.severity * 18 * response.exposureFactor * mismatchPenalty),
    );
    const evidenceScore = Math.max(
      10,
      Math.round(response.evidenceScore - (matched ? 0 : incident.severity * 9)),
    );
    const containment = Math.max(5, Math.round(100 - exposure));

    return {
      incident,
      response,
      recommended,
      matched,
      recoveryMinutes,
      exposure,
      evidenceScore,
      containment,
    };
  }, [data, incidentId, responseId]);

  const chooseIncident = (incident: Incident) => {
    setIncidentId(incident.id);
    setResponseId(incident.recommendedResponseId);
  };

  const reset = () => {
    if (!data) return;
    setIncidentId(data.defaults.incidentId);
    setResponseId(data.defaults.responseId);
  };

  if (error) {
    return (
      <p className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
        {error}
      </p>
    );
  }

  if (!data || !result) {
    return (
      <div
        className="not-prose my-7 h-72 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading incident response lab"
      />
    );
  }

  const statusClass = result.matched
    ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
    : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40';
  const StatusIcon = result.matched ? CheckCircle2 : TriangleAlert;
  const stages = [
    { label: 'Detect', detail: result.incident.signal, icon: Activity },
    { label: 'Contain', detail: result.response.label, icon: ShieldCheck },
    { label: 'Correct', detail: result.incident.cause, icon: RefreshCw },
    {
      label: 'Learn',
      detail: result.matched
        ? 'Preserve trustworthy evidence and add a regression gate.'
        : 'Revisit the diagnosis before training or promoting another artifact.',
      icon: DatabaseZap,
    },
  ];

  return (
    <div data-content-block="ml-systems/ml-systems-design-incident-response-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Operating loop lab"
          title={data.title}
          description={data.description}
          icon={Siren}
          accent="rose"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Inject an incident
                </legend>
                <div className="mt-3 space-y-2">
                  {data.incidents.map((incident) => (
                    <LabChoice
                      key={incident.id}
                      selected={incidentId === incident.id}
                      label={incident.label}
                      detail={incident.detail}
                      icon={Siren}
                      accent="rose"
                      onClick={() => chooseIncident(incident)}
                    />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Choose the first response
                </legend>
                <div className="mt-3 space-y-2">
                  {data.responses.map((response) => (
                    <LabChoice
                      key={response.id}
                      selected={responseId === response.id}
                      label={response.label}
                      detail={response.detail}
                      icon={ShieldCheck}
                      accent="emerald"
                      onClick={() => setResponseId(response.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          }
        >
          <div aria-live="polite">
            <div className={`rounded-md border p-4 ${statusClass}`}>
              <div className="flex items-start gap-3">
                <StatusIcon
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-neutral-800 dark:text-neutral-100"
                />
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                    {result.matched
                      ? 'The response targets the failing boundary.'
                      : 'The response does not match the observed evidence.'}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    Recommended first response: <strong>{result.recommended.label}</strong>. The signal
                    points to <strong>{result.incident.affectedStage.toLowerCase()}</strong>, not to a
                    generic model-quality problem.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Containment"
                value={`${result.containment}%`}
                detail="Modeled reduction in user exposure"
                icon={ShieldCheck}
                tone={result.containment >= 75 ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Recovery time"
                value={formatRecovery(result.recoveryMinutes)}
                detail="Illustrative time to restore a safe path"
                icon={Clock3}
                tone={result.matched ? 'cyan' : 'amber'}
              />
              <LabMetric
                label="User exposure"
                value={`${result.exposure}%`}
                detail="Relative impact before containment"
                icon={Siren}
                tone={result.exposure <= 30 ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Evidence retained"
                value={`${result.evidenceScore}%`}
                detail="Usable signal for the durable correction"
                icon={DatabaseZap}
                tone={result.evidenceScore >= 85 ? 'violet' : 'amber'}
              />
            </div>

            <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Incident loop
              </p>
              <div className="mt-4 flex flex-col items-stretch gap-2 md:flex-row md:items-stretch">
                {stages.map((stage, index) => {
                  const Icon = stage.icon;
                  const isAffected = stage.label === result.incident.affectedStage;
                  return (
                    <div key={stage.label} className="contents">
                      <div
                        className={`min-h-36 flex-1 rounded-md border p-3 ${
                          isAffected
                            ? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/35'
                            : 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-950'
                        }`}
                      >
                        <Icon
                          aria-hidden="true"
                          className={`h-5 w-5 ${isAffected ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300'}`}
                        />
                        <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
                          {stage.label}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                          {stage.detail}
                        </p>
                      </div>
                      {index < stages.length - 1 ? (
                        <>
                          <ArrowDown aria-hidden="true" className="mx-auto h-4 w-4 shrink-0 text-emerald-500 md:hidden" />
                          <ArrowRight aria-hidden="true" className="hidden h-4 w-4 shrink-0 self-center text-emerald-500 md:block" />
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
