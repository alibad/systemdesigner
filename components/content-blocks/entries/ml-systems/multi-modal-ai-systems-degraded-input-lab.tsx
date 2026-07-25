'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Eye,
  EyeOff,
  FileWarning,
  MessageSquareText,
  Presentation,
  Route,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Warehouse,
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

const BLOCK_ID = 'ml-systems/multi-modal-ai-systems-degraded-input-lab';
const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/multi-modal-ai-systems/data/degraded-input-model.json';

type EvidenceState = 'healthy' | 'missing' | 'stale' | 'conflict' | 'untrusted';
type Impact = 'medium' | 'high';
type PolicyId = 'silent-substitute' | 'aware-fallback' | 'human-review';

type EvidenceDefinition = {
  label: string;
  required: boolean;
  weightPct: number;
};

type Scenario = {
  id: string;
  label: string;
  detail: string;
  primary: EvidenceDefinition;
  supporting: EvidenceDefinition;
  baselineConfidencePct: number;
  impact: Impact;
  safeFallback: string;
};

type Incident = {
  id: string;
  label: string;
  detail: string;
  primaryState: EvidenceState;
  supportingState: EvidenceState;
  confidencePenaltyPct: number;
  trustRisk: number;
  instructionRisk: boolean;
};

type Policy = {
  id: PolicyId;
  label: string;
  detail: string;
  recoveryPct: number;
  exposesState: boolean;
  requiresReview: boolean;
};

type DegradedInputData = {
  kind: 'degraded-input';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  note: string;
  defaults: {
    scenarioId: string;
    incidentId: string;
    policyId: PolicyId;
    confidenceFloorPct: number;
  };
  ranges: {
    confidenceFloorPct: {
      min: number;
      max: number;
      step: number;
    };
  };
  scenarios: Scenario[];
  incidents: Incident[];
  policies: Policy[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isEvidenceState(value: unknown): value is EvidenceState {
  return (
    value === 'healthy'
    || value === 'missing'
    || value === 'stale'
    || value === 'conflict'
    || value === 'untrusted'
  );
}

function isPolicyId(value: unknown): value is PolicyId {
  return (
    value === 'silent-substitute'
    || value === 'aware-fallback'
    || value === 'human-review'
  );
}

function isEvidenceDefinition(value: unknown): value is EvidenceDefinition {
  return (
    isRecord(value)
    && typeof value.label === 'string'
    && typeof value.required === 'boolean'
    && isNumber(value.weightPct)
  );
}

function isDegradedInputData(value: unknown): value is DegradedInputData {
  if (
    !isRecord(value)
    || value.kind !== 'degraded-input'
    || value.blockId !== BLOCK_ID
    || typeof value.title !== 'string'
    || typeof value.description !== 'string'
    || typeof value.note !== 'string'
    || !isRecord(value.defaults)
    || typeof value.defaults.scenarioId !== 'string'
    || typeof value.defaults.incidentId !== 'string'
    || !isPolicyId(value.defaults.policyId)
    || !isNumber(value.defaults.confidenceFloorPct)
    || !isRecord(value.ranges)
    || !isRecord(value.ranges.confidenceFloorPct)
    || !isNumber(value.ranges.confidenceFloorPct.min)
    || !isNumber(value.ranges.confidenceFloorPct.max)
    || !isNumber(value.ranges.confidenceFloorPct.step)
    || !Array.isArray(value.scenarios)
    || value.scenarios.length < 2
    || !Array.isArray(value.incidents)
    || value.incidents.length < 3
    || !Array.isArray(value.policies)
    || value.policies.length < 2
  ) {
    return false;
  }

  const scenariosValid = value.scenarios.every((scenario) => (
    isRecord(scenario)
    && typeof scenario.id === 'string'
    && typeof scenario.label === 'string'
    && typeof scenario.detail === 'string'
    && isEvidenceDefinition(scenario.primary)
    && isEvidenceDefinition(scenario.supporting)
    && isNumber(scenario.baselineConfidencePct)
    && (scenario.impact === 'medium' || scenario.impact === 'high')
    && typeof scenario.safeFallback === 'string'
  ));
  const incidentsValid = value.incidents.every((incident) => (
    isRecord(incident)
    && typeof incident.id === 'string'
    && typeof incident.label === 'string'
    && typeof incident.detail === 'string'
    && isEvidenceState(incident.primaryState)
    && isEvidenceState(incident.supportingState)
    && isNumber(incident.confidencePenaltyPct)
    && isNumber(incident.trustRisk)
    && typeof incident.instructionRisk === 'boolean'
  ));
  const policiesValid = value.policies.every((policy) => (
    isRecord(policy)
    && isPolicyId(policy.id)
    && typeof policy.label === 'string'
    && typeof policy.detail === 'string'
    && isNumber(policy.recoveryPct)
    && typeof policy.exposesState === 'boolean'
    && typeof policy.requiresReview === 'boolean'
  ));
  const defaults = value.defaults;

  return (
    scenariosValid
    && incidentsValid
    && policiesValid
    && value.scenarios.some((item) => item.id === defaults.scenarioId)
    && value.incidents.some((item) => item.id === defaults.incidentId)
    && value.policies.some((item) => item.id === defaults.policyId)
  );
}

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.max(minimum, Math.min(maximum, value));
}

function evidenceCredit(state: EvidenceState) {
  if (state === 'healthy') return 1;
  if (state === 'stale') return 0.35;
  if (state === 'conflict') return 0.45;
  if (state === 'untrusted') return 0.2;
  return 0;
}

const scenarioIcons = {
  'visual-support': MessageSquareText,
  'meeting-summary': Presentation,
  'warehouse-inspection': Warehouse,
};

const incidentIcons = {
  healthy: CheckCircle2,
  'missing-primary': XCircle,
  'stale-supporting': Clock3,
  contradictory: AlertOctagon,
  'embedded-instruction': FileWarning,
};

const policyIcons: Record<PolicyId, typeof Eye> = {
  'silent-substitute': EyeOff,
  'aware-fallback': Route,
  'human-review': UserCheck,
};

export default function MultiModalAISystemsDegradedInputLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<DegradedInputData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load the degradation model (${response.status}).`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isDegradedInputData(payload)) {
          throw new Error('The degraded-input data contract is invalid.');
        }
        setData(payload);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Could not load the degradation lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!data ? (
        <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
      ) : (
        <DegradedInputLab data={data} />
      )}
    </div>
  );
}

function DegradedInputLab({ data }: { data: DegradedInputData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [incidentId, setIncidentId] = useState(data.defaults.incidentId);
  const [policyId, setPolicyId] = useState<PolicyId>(data.defaults.policyId);
  const [confidenceFloorPct, setConfidenceFloorPct] = useState(
    data.defaults.confidenceFloorPct,
  );

  const scenario =
    data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const incident =
    data.incidents.find((item) => item.id === incidentId) ?? data.incidents[0];
  const policy =
    data.policies.find((item) => item.id === policyId) ?? data.policies[0];

  const result = useMemo(() => {
    const requiredMissing = (
      scenario.primary.required && incident.primaryState === 'missing'
    ) || (
      scenario.supporting.required && incident.supportingState === 'missing'
    );
    const evidenceCoveragePct = Math.round(
      scenario.primary.weightPct * evidenceCredit(incident.primaryState)
      + scenario.supporting.weightPct * evidenceCredit(incident.supportingState),
    );
    const confidencePct = clamp(
      scenario.baselineConfidencePct - incident.confidencePenaltyPct + policy.recoveryPct,
    );
    const incidentPresent = incident.id !== 'healthy';
    const hiddenRisk = incidentPresent && !policy.exposesState;
    const riskScore = clamp(
      incident.trustRisk
      + (hiddenRisk ? 20 : 0)
      + (scenario.impact === 'high' ? 10 : 0)
      - (policy.requiresReview ? 30 : 0),
    );

    let action = 'Proceed with the bounded task';
    let actionDetail = 'Evidence is aligned and the fixture confidence clears the selected floor.';
    let ready = confidencePct >= confidenceFloorPct;

    if (policy.requiresReview && incidentPresent) {
      action = 'Route the evidence bundle to review';
      actionDetail = 'Automation pauses while a reviewer sees both modality states and the requested action.';
      ready = true;
    } else if (incident.instructionRisk) {
      action = policy.exposesState
        ? 'Quarantine the embedded instruction'
        : 'Proceed with hidden instruction risk';
      actionDetail = policy.exposesState
        ? 'Treat extracted media text as untrusted content; it cannot change policy or tool authority.'
        : 'The application hides the trust-state violation and may grant content more authority than intended.';
      ready = policy.exposesState;
    } else if (requiredMissing) {
      action = policy.exposesState
        ? 'Abstain: required evidence is absent'
        : 'Proceed with a hidden evidence gap';
      actionDetail = policy.exposesState
        ? scenario.safeFallback
        : 'A substitute value keeps the tensor shape valid but does not restore the missing evidence.';
      ready = policy.exposesState;
    } else if (incidentPresent && policy.exposesState) {
      action = confidencePct >= confidenceFloorPct
        ? 'Use a labeled degraded fallback'
        : 'Abstain below the evidence floor';
      actionDetail = confidencePct >= confidenceFloorPct
        ? scenario.safeFallback
        : 'The remaining evidence does not clear the selected confidence floor.';
      ready = true;
    } else if (confidencePct < confidenceFloorPct) {
      action = 'Block below the confidence floor';
      actionDetail = 'The policy does not have enough evidence to continue.';
      ready = false;
    }

    return {
      action,
      actionDetail,
      confidencePct,
      evidenceCoveragePct,
      hiddenRisk,
      ready,
      requiredMissing,
      riskScore,
    };
  }, [confidenceFloorPct, incident, policy, scenario]);

  function reset() {
    setScenarioId(data.defaults.scenarioId);
    setIncidentId(data.defaults.incidentId);
    setPolicyId(data.defaults.policyId);
    setConfidenceFloorPct(data.defaults.confidenceFloorPct);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Degraded-input lab"
        title={data.title}
        description={data.description}
        icon={ShieldAlert}
        accent="rose"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Product context
              </legend>
              <div className="mt-3 space-y-2">
                {data.scenarios.map((item) => {
                  const Icon = scenarioIcons[item.id as keyof typeof scenarioIcons] ?? MessageSquareText;
                  return (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Icon}
                      accent={item.impact === 'high' ? 'rose' : 'blue'}
                      onClick={() => setScenarioId(item.id)}
                    />
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Failure injection
              </legend>
              <div className="mt-3 space-y-2">
                {data.incidents.map((item) => {
                  const Icon = incidentIcons[item.id as keyof typeof incidentIcons] ?? CircleAlert;
                  return (
                    <LabChoice
                      key={item.id}
                      selected={item.id === incident.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Icon}
                      accent={item.id === 'healthy' ? 'emerald' : item.instructionRisk ? 'rose' : 'amber'}
                      onClick={() => setIncidentId(item.id)}
                    />
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Response policy
              </legend>
              <div className="mt-3 space-y-2">
                {data.policies.map((item) => {
                  const Icon = policyIcons[item.id];
                  return (
                    <LabChoice
                      key={item.id}
                      selected={item.id === policy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Icon}
                      accent={item.id === 'silent-substitute' ? 'rose' : item.id === 'human-review' ? 'violet' : 'emerald'}
                      onClick={() => setPolicyId(item.id)}
                    />
                  );
                })}
              </div>
            </fieldset>

            <LabRange
              label="4. Evidence confidence floor"
              value={confidenceFloorPct}
              output={`${confidenceFloorPct}%`}
              min={data.ranges.confidenceFloorPct.min}
              max={data.ranges.confidenceFloorPct.max}
              step={data.ranges.confidenceFloorPct.step}
              lowLabel="More automation"
              highLabel="More abstention"
              accent="rose"
              onChange={setConfidenceFloorPct}
            />
          </div>
        )}
      >
        <div className="min-h-[780px] min-w-0">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Evidence coverage"
              value={`${result.evidenceCoveragePct}%`}
              detail="Weighted usable evidence remaining in this fixture"
              icon={Eye}
              tone={result.evidenceCoveragePct >= 75 ? 'emerald' : result.evidenceCoveragePct >= 45 ? 'amber' : 'rose'}
            />
            <LabMetric
              label="Fixture confidence"
              value={`${result.confidencePct}%`}
              detail={`Selected floor: ${confidenceFloorPct}%`}
              icon={CircleAlert}
              tone={result.confidencePct >= confidenceFloorPct ? 'blue' : 'rose'}
            />
            <LabMetric
              label="Trust risk"
              value={`${result.riskScore} / 100`}
              detail={result.hiddenRisk ? 'The selected policy hides the incident state' : 'The incident state remains visible'}
              icon={result.hiddenRisk ? EyeOff : ShieldCheck}
              tone={result.riskScore >= 70 ? 'rose' : result.riskScore >= 40 ? 'amber' : 'emerald'}
            />
            <LabMetric
              label="System decision"
              value={result.ready ? 'Bounded' : 'Blocked'}
              detail={policy.requiresReview ? 'Human authority takes over' : result.requiredMissing ? 'Required evidence policy applied' : 'Automated policy applied'}
              icon={result.ready ? CheckCircle2 : XCircle}
              tone={result.ready ? 'emerald' : 'rose'}
            />
          </div>

          <section className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Evidence bundle
                </p>
                <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                  {scenario.label}
                </h4>
              </div>
              <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                {scenario.impact} impact
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <EvidenceStatus
                label={scenario.primary.label}
                required={scenario.primary.required}
                weightPct={scenario.primary.weightPct}
                state={incident.primaryState}
              />
              <EvidenceStatus
                label={scenario.supporting.label}
                required={scenario.supporting.required}
                weightPct={scenario.supporting.weightPct}
                state={incident.supportingState}
              />
            </div>
          </section>

          <section className={`mt-6 rounded-lg border p-5 ${result.hiddenRisk ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50' : result.ready ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50' : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'}`}>
            <div className="flex items-start gap-3">
              {result.hiddenRisk ? (
                <AlertOctagon aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
              ) : result.ready ? (
                <ShieldCheck aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
              ) : (
                <ShieldAlert aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase opacity-75">Product action</p>
                <h4 className="mt-1 text-lg font-semibold">{result.action}</h4>
                <p className="mt-2 text-sm leading-6 opacity-85">{result.actionDetail}</p>
              </div>
            </div>
          </section>

          <section className="mt-6">
            <h4 className="text-base font-semibold text-neutral-950 dark:text-white">
              What the policy makes observable
            </h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <PolicyCheck
                passes={policy.exposesState}
                label="Availability and freshness state"
                detail="Downstream logic can distinguish healthy, missing, stale, conflicting, and untrusted evidence."
              />
              <PolicyCheck
                passes={policy.exposesState}
                label="User-visible degraded mode"
                detail="The response can state what evidence was unavailable or excluded."
              />
              <PolicyCheck
                passes={!incident.instructionRisk || policy.exposesState}
                label="Instruction boundary"
                detail="Content extracted from media cannot grant policy or tool authority."
              />
              <PolicyCheck
                passes={policy.requiresReview || !result.requiredMissing}
                label="Required-evidence owner"
                detail="A named automated or human path owns the decision when required evidence disappears."
              />
            </div>
          </section>

          <p className="mt-5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            {data.note}
          </p>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function EvidenceStatus({
  label,
  required,
  weightPct,
  state,
}: {
  label: string;
  required: boolean;
  weightPct: number;
  state: EvidenceState;
}) {
  const stateStyles: Record<EvidenceState, string> = {
    healthy: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50',
    missing: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50',
    stale: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50',
    conflict: 'border-orange-300 bg-orange-50 text-orange-950 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-50',
    untrusted: 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-50',
  };
  const StateIcon = state === 'healthy'
    ? CheckCircle2
    : state === 'missing'
      ? XCircle
      : state === 'stale'
        ? Clock3
        : state === 'untrusted'
          ? FileWarning
          : AlertOctagon;

  return (
    <div className={`rounded-md border p-4 ${stateStyles[state]}`}>
      <div className="flex items-start justify-between gap-3">
        <StateIcon aria-hidden="true" className="h-5 w-5 shrink-0" />
        <span className="text-xs font-semibold uppercase opacity-75">{state}</span>
      </div>
      <p className="mt-3 text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs opacity-75">
        {required ? 'Required' : 'Supporting'} evidence · {weightPct}% fixture weight
      </p>
    </div>
  );
}

function PolicyCheck({
  passes,
  label,
  detail,
}: {
  passes: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-start gap-3">
        {passes ? (
          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <XCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
          <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
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
  if (error) {
    return (
      <div className="not-prose my-7 rounded-lg border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100" role="alert">
        <p className="font-semibold">Degraded-input lab unavailable</p>
        <p className="mt-1">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md border border-current px-3 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      className="not-prose my-7 h-[520px] animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900"
      aria-label="Loading degraded-input lab"
      role="status"
    />
  );
}
