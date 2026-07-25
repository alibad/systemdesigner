'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  BadgeCheck,
  Ban,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  Fingerprint,
  Gauge,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  Scale,
  ShieldCheck,
  UserRoundCheck,
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

const BLOCK_ID =
  'fundamentals/autonomous-data-governance-authority-envelope-lab';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/autonomous-data-governance/data/authority-envelope-model.json';

type GovernanceEvent = {
  id: string;
  label: string;
  detail: string;
  classification: 'public' | 'internal' | 'confidential' | 'restricted';
  risk: number;
  policyMatch: boolean;
  policyConflict: boolean;
  owner: string;
};

type GovernanceAction = {
  id: string;
  label: string;
  detail: string;
  impact: number;
  reversible: boolean;
  requiresPolicyMatch: boolean;
  requiredEvidence: string[];
};

type AuthorityEnvelope = {
  id: string;
  label: string;
  detail: string;
  maxRisk: number;
  maxImpact: number;
  minimumConfidence: number;
  requiresReversible: boolean;
  allowAutomaticEnforcement: boolean;
  approvalRole: string;
};

type AuthorityEnvelopeModel = {
  kind: 'autonomous-governance-authority-envelope';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  modelNote: string;
  defaults: {
    eventId: string;
    actionId: string;
    envelopeId: string;
    confidence: number;
  };
  events: GovernanceEvent[];
  actions: GovernanceAction[];
  envelopes: AuthorityEnvelope[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isAuthorityEnvelopeModel(
  value: unknown,
): value is AuthorityEnvelopeModel {
  if (
    !isRecord(value)
    || value.kind !== 'autonomous-governance-authority-envelope'
    || value.blockId !== BLOCK_ID
    || typeof value.title !== 'string'
    || typeof value.description !== 'string'
    || typeof value.modelNote !== 'string'
    || !isRecord(value.defaults)
    || typeof value.defaults.eventId !== 'string'
    || typeof value.defaults.actionId !== 'string'
    || typeof value.defaults.envelopeId !== 'string'
    || typeof value.defaults.confidence !== 'number'
    || !Array.isArray(value.events)
    || value.events.length < 3
    || !Array.isArray(value.actions)
    || value.actions.length < 3
    || !Array.isArray(value.envelopes)
    || value.envelopes.length < 3
  ) {
    return false;
  }

  const validEvents = value.events.every((event) => (
    isRecord(event)
    && typeof event.id === 'string'
    && typeof event.label === 'string'
    && typeof event.detail === 'string'
    && ['public', 'internal', 'confidential', 'restricted'].includes(
      String(event.classification),
    )
    && typeof event.risk === 'number'
    && typeof event.policyMatch === 'boolean'
    && typeof event.policyConflict === 'boolean'
    && typeof event.owner === 'string'
  ));
  const validActions = value.actions.every((action) => (
    isRecord(action)
    && typeof action.id === 'string'
    && typeof action.label === 'string'
    && typeof action.detail === 'string'
    && typeof action.impact === 'number'
    && typeof action.reversible === 'boolean'
    && typeof action.requiresPolicyMatch === 'boolean'
    && isStringArray(action.requiredEvidence)
  ));
  const validEnvelopes = value.envelopes.every((envelope) => (
    isRecord(envelope)
    && typeof envelope.id === 'string'
    && typeof envelope.label === 'string'
    && typeof envelope.detail === 'string'
    && typeof envelope.maxRisk === 'number'
    && typeof envelope.maxImpact === 'number'
    && typeof envelope.minimumConfidence === 'number'
    && typeof envelope.requiresReversible === 'boolean'
    && typeof envelope.allowAutomaticEnforcement === 'boolean'
    && typeof envelope.approvalRole === 'string'
  ));

  if (!validEvents || !validActions || !validEnvelopes) return false;

  const defaults = value.defaults as AuthorityEnvelopeModel['defaults'];
  return (
    defaults.confidence >= 0
    && defaults.confidence <= 100
    && value.events.some((item) => item.id === defaults.eventId)
    && value.actions.some((item) => item.id === defaults.actionId)
    && value.envelopes.some((item) => item.id === defaults.envelopeId)
  );
}

function eventIcon(id: string) {
  if (id === 'public-catalog') return Activity;
  if (id === 'employee-export') return Fingerprint;
  if (id === 'health-transfer') return ShieldCheck;
  return RotateCcw;
}

export default function AutonomousDataGovernanceAuthorityEnvelopeLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<AuthorityEnvelopeModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}.`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isAuthorityEnvelopeModel(payload)) {
          throw new Error('The authority-envelope contract is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the authority model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Automation authority lab"
            title="Set the decision boundary before enforcement"
            description="Loading events, actions, and approved authority envelopes."
            icon={Scale}
            accent="cyan"
          />
          <LearningLabBody>
            <LoadState
              error={error}
              onRetry={() => setReloadKey((value) => value + 1)}
            />
          </LearningLabBody>
        </LearningLab>
      </div>
    );
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <AuthorityEnvelopeLab model={model} />
    </div>
  );
}

function AuthorityEnvelopeLab({ model }: { model: AuthorityEnvelopeModel }) {
  const [eventId, setEventId] = useState(model.defaults.eventId);
  const [actionId, setActionId] = useState(model.defaults.actionId);
  const [envelopeId, setEnvelopeId] = useState(model.defaults.envelopeId);
  const [confidence, setConfidence] = useState(model.defaults.confidence);

  const event = model.events.find((item) => item.id === eventId)
    ?? model.events[0];
  const action = model.actions.find((item) => item.id === actionId)
    ?? model.actions[0];
  const envelope = model.envelopes.find((item) => item.id === envelopeId)
    ?? model.envelopes[0];

  const result = useMemo(() => {
    const policyReady =
      !event.policyConflict
      && (!action.requiresPolicyMatch || event.policyMatch);
    const confidenceReady = confidence >= envelope.minimumConfidence;
    const riskReady = event.risk <= envelope.maxRisk;
    const impactReady = action.impact <= envelope.maxImpact;
    const reversibilityReady =
      !envelope.requiresReversible || action.reversible;
    const automaticReady = envelope.allowAutomaticEnforcement;

    const blockers = [
      event.policyConflict
        ? 'Applicable policies conflict and need an accountable interpretation.'
        : null,
      action.requiresPolicyMatch && !event.policyMatch
        ? 'No approved policy authorizes this action for the observed context.'
        : null,
      !confidenceReady
        ? `Confidence is ${confidence}%; this envelope requires ${envelope.minimumConfidence}%.`
        : null,
      !riskReady
        ? `Event risk ${event.risk} exceeds the envelope maximum of ${envelope.maxRisk}.`
        : null,
      !impactReady
        ? `Action impact ${action.impact} exceeds the envelope maximum of ${envelope.maxImpact}.`
        : null,
      !reversibilityReady
        ? 'The envelope permits automatic enforcement only for reversible actions.'
        : null,
      !automaticReady
        ? 'This envelope can observe or recommend, but cannot change production state.'
        : null,
    ].filter((item): item is string => Boolean(item));

    let decision: 'enforce' | 'contain' | 'human' | 'observe';
    if (!automaticReady) {
      decision = envelope.id === 'observe' ? 'observe' : 'human';
    } else if (!policyReady) {
      decision = 'contain';
    } else if (
      confidenceReady
      && riskReady
      && impactReady
      && reversibilityReady
    ) {
      decision = 'enforce';
    } else {
      decision = 'human';
    }

    const decisionCopy = {
      enforce: {
        label: 'Bounded enforcement allowed',
        detail: `${action.label} may execute under ${envelope.label}.`,
        tone: 'emerald' as const,
        icon: BadgeCheck,
      },
      contain: {
        label: 'Contain and escalate',
        detail: `Freeze the request and route it to ${event.owner}.`,
        tone: 'rose' as const,
        icon: Ban,
      },
      human: {
        label: 'Human approval required',
        detail: `Keep the request contained for ${envelope.approvalRole}.`,
        tone: 'amber' as const,
        icon: UserRoundCheck,
      },
      observe: {
        label: 'Recommendation only',
        detail: 'Record the proposed action without changing production state.',
        tone: 'blue' as const,
        icon: Activity,
      },
    }[decision];

    return {
      decision,
      decisionCopy,
      policyReady,
      confidenceReady,
      riskReady,
      impactReady,
      reversibilityReady,
      automaticReady,
      blockers,
    };
  }, [action, confidence, envelope, event]);

  function reset() {
    setEventId(model.defaults.eventId);
    setActionId(model.defaults.actionId);
    setEnvelopeId(model.defaults.envelopeId);
    setConfidence(model.defaults.confidence);
  }

  const StatusIcon = result.decisionCopy.icon;

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Automation authority lab"
        title={model.title}
        description={model.description}
        icon={Scale}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-6">
            <ChoiceGroup label="1. Governed event">
              {model.events.map((item) => {
                const Icon = eventIcon(item.id);
                return (
                  <LabChoice
                    key={item.id}
                    selected={item.id === event.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Icon}
                    accent="blue"
                    onClick={() => setEventId(item.id)}
                  />
                );
              })}
            </ChoiceGroup>

            <ChoiceGroup label="2. Requested action">
              {model.actions.map((item) => (
                <LabChoice
                  key={item.id}
                  selected={item.id === action.id}
                  label={item.label}
                  detail={`${item.reversible ? 'Reversible' : 'Irreversible'} · impact ${item.impact}/4`}
                  icon={item.reversible ? RotateCcw : LockKeyhole}
                  accent="violet"
                  onClick={() => setActionId(item.id)}
                />
              ))}
            </ChoiceGroup>

            <ChoiceGroup label="3. Authority envelope">
              {model.envelopes.map((item) => (
                <LabChoice
                  key={item.id}
                  selected={item.id === envelope.id}
                  label={item.label}
                  detail={item.detail}
                  icon={ShieldCheck}
                  accent="cyan"
                  onClick={() => setEnvelopeId(item.id)}
                />
              ))}
            </ChoiceGroup>

            <LabRange
              label="Observed classifier confidence"
              value={confidence}
              output={`${confidence}%`}
              min={50}
              max={100}
              step={1}
              lowLabel="Ambiguous"
              highLabel="Strong evidence"
              accent="cyan"
              onChange={setConfidence}
            />
          </div>
        )}
      >
        <div className="space-y-6">
          <div
            className={`rounded-lg border p-5 ${
              result.decision === 'enforce'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50'
                : result.decision === 'contain'
                  ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50'
                  : result.decision === 'human'
                    ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50'
                    : 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <StatusIcon aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
              <div>
                <p className="text-xs font-semibold uppercase opacity-70">
                  Decision
                </p>
                <h4 className="mt-1 text-xl font-semibold">
                  {result.decisionCopy.label}
                </h4>
                <p className="mt-2 text-sm leading-6 opacity-80">
                  {result.decisionCopy.detail}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <LabMetric
              label="Event risk"
              value={`${event.risk} / 4`}
              detail={event.classification}
              icon={Gauge}
              tone={result.riskReady ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Action impact"
              value={`${action.impact} / 4`}
              detail={action.reversible ? 'Reversible' : 'Irreversible'}
              icon={Activity}
              tone={result.impactReady && result.reversibilityReady ? 'emerald' : 'amber'}
            />
            <LabMetric
              label="Confidence"
              value={`${confidence}%`}
              detail={`Envelope floor: ${envelope.minimumConfidence}%`}
              icon={Fingerprint}
              tone={result.confidenceReady ? 'emerald' : 'rose'}
            />
          </div>

          <div>
            <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
              Decision path
            </h4>
            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <DecisionStage
                label="Policy"
                detail={result.policyReady ? 'Version matched' : 'Conflict or gap'}
                ready={result.policyReady}
              />
              <DecisionStage
                label="Evidence"
                detail={result.confidenceReady ? 'Threshold met' : 'Below threshold'}
                ready={result.confidenceReady}
              />
              <DecisionStage
                label="Authority"
                detail={result.automaticReady ? 'May enforce' : 'Human owns action'}
                ready={result.automaticReady}
              />
              <DecisionStage
                label="Outcome"
                detail={
                  result.decision === 'enforce'
                    ? 'Execute and verify'
                    : result.decision === 'observe'
                      ? 'Record only'
                      : 'Contain pending decision'
                }
                ready={result.decision === 'enforce'}
              />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(240px,0.72fr)]">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                <CircleAlert aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                Boundary explanation
              </h4>
              {result.blockers.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  {result.blockers.map((blocker) => (
                    <li key={blocker} className="flex gap-2">
                      <XCircle aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                      <span>{blocker}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 flex gap-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  <CheckCircle2 aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  The event, action, evidence, and approved authority all fit the
                  bounded-enforcement contract.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                <FileCheck2 aria-hidden="true" className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                Evidence to retain
              </h4>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                {action.requiredEvidence.map((artifact) => (
                  <li key={artifact} className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500"
                    />
                    {artifact}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            {model.modelNote}
          </p>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function ChoiceGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </legend>
      <div className="mt-3 space-y-2">{children}</div>
    </fieldset>
  );
}

function DecisionStage({
  label,
  detail,
  ready,
}: {
  label: string;
  detail: string;
  ready: boolean;
}) {
  return (
    <div
      className={`relative rounded-md border p-3 ${
        ready
          ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
          : 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200'
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase">
        {ready ? (
          <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
        ) : (
          <CircleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
        )}
        {label}
      </div>
      <p className="mt-2 text-xs leading-5 opacity-80">{detail}</p>
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
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50">
        <div className="flex items-start gap-3">
          <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h4 className="font-semibold">Authority model unavailable</h4>
            <p className="mt-1 text-sm opacity-80">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-32 items-center justify-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
      <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
      Loading authority model
    </div>
  );
}
