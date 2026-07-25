'use client';

import { useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  CircleAlert,
  EyeOff,
  FileText,
  Globe2,
  ScanSearch,
  Shield,
  UserCheck,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type ActionId = 'allow' | 'limit' | 'review' | 'remove';
type ScenarioId = 'quoted-language' | 'credible-threat' | 'health-claim' | 'coded-meme' | 'model-outage';

type Scenario = {
  id: ScenarioId;
  label: string;
  signal: string;
  expected: ActionId;
  explanation: string;
  needsContext?: boolean;
  needsSpecialist?: boolean;
};

const actions: Array<{ id: ActionId; label: string; detail: string; icon: typeof Shield }> = [
  { id: 'allow', label: 'Allow', detail: 'Publish normally.', icon: CheckCircle2 },
  { id: 'limit', label: 'Limit', detail: 'Reduce reach or add friction.', icon: EyeOff },
  { id: 'review', label: 'Quarantine and review', detail: 'Hold or restrict pending a person.', icon: UserCheck },
  { id: 'remove', label: 'Remove', detail: 'Block visibility and enforce policy.', icon: Ban },
];

const scenarios: Scenario[] = [
  {
    id: 'quoted-language',
    label: 'Quoted slur in a discussion',
    signal: 'A high-risk phrase appears inside a longer post that may be condemnation, reporting, or targeted abuse.',
    expected: 'review',
    needsContext: true,
    explanation: 'The phrase alone is insufficient evidence. Quarantine the uncertain item and give a language-aware reviewer the surrounding conversation.',
  },
  {
    id: 'credible-threat',
    label: 'Credible imminent threat',
    signal: 'Text, location, and recent behavior jointly indicate a specific and time-bound threat against a named person.',
    expected: 'remove',
    needsSpecialist: true,
    explanation: 'Contain visibility immediately, preserve evidence, and route the case to an urgent specialist workflow rather than the ordinary review queue.',
  },
  {
    id: 'health-claim',
    label: 'Disputed medical claim',
    signal: 'A confident health claim conflicts with trusted guidance but does not call for immediate physical harm.',
    expected: 'limit',
    needsContext: true,
    explanation: 'Limit algorithmic amplification and attach product friction while the policy and evidence context are checked. Immediate deletion may be disproportionate.',
  },
  {
    id: 'coded-meme',
    label: 'Coded multimodal meme',
    signal: 'The caption and image look benign separately, but the combination may target a protected group using an evolving coded reference.',
    expected: 'review',
    needsContext: true,
    explanation: 'A multimodal and culture-aware review is needed because independent text and image classifiers miss the composed meaning.',
  },
  {
    id: 'model-outage',
    label: 'Specialist classifier outage',
    signal: 'The ordinary model reports elevated risk, but the required language specialist model is unavailable.',
    expected: 'review',
    explanation: 'Quarantine uncertainty and preserve the job for replay. An outage must not turn an unavailable safety dependency into automatic approval.',
  },
];

const severity: Record<ActionId, number> = {
  allow: 0,
  limit: 1,
  review: 2,
  remove: 3,
};

function SafeguardSwitch({
  checked,
  label,
  detail,
  onChange,
}: {
  checked: boolean;
  label: string;
  detail: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="flex w-full items-center justify-between gap-4 rounded-md border border-neutral-200 bg-white p-3 text-left transition-colors hover:border-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-600"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-neutral-950 dark:text-white">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</span>
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-cyan-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </span>
    </button>
  );
}

export default function ContentModerationPolicyResponseLab() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('quoted-language');
  const [action, setAction] = useState<ActionId>('review');
  const [contextAvailable, setContextAvailable] = useState(true);
  const [decisionTrace, setDecisionTrace] = useState(true);
  const [appealPath, setAppealPath] = useState(true);
  const [specialistEscalation, setSpecialistEscalation] = useState(false);

  const model = useMemo(() => {
    const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];
    const severityDelta = severity[action] - severity[scenario.expected];
    const actionFit = severityDelta === 0 ? 100 : Math.abs(severityDelta) === 1 ? 55 : 15;
    const safeguards = [
      { label: 'Context available', required: Boolean(scenario.needsContext), met: !scenario.needsContext || contextAvailable },
      { label: 'Decision trace preserved', required: true, met: decisionTrace },
      { label: 'Appeal and restoration path', required: true, met: appealPath },
      { label: 'Urgent specialist escalation', required: Boolean(scenario.needsSpecialist), met: !scenario.needsSpecialist || specialistEscalation },
    ];
    const required = safeguards.filter((item) => item.required);
    const safeguardsMet = required.filter((item) => item.met).length;
    const readiness = Math.round((actionFit * 0.6) + ((safeguardsMet / required.length) * 40));
    const missing = required.filter((item) => !item.met).map((item) => item.label);

    const outcome = severityDelta < 0
      ? {
          title: 'Risk is not contained',
          detail: `The selected action is weaker than the policy response supported by this evidence. ${scenario.explanation}`,
          classes: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50',
          icon: CircleAlert,
        }
      : severityDelta > 0
        ? {
            title: 'The response over-enforces',
            detail: `A more severe action can suppress legitimate speech and increase successful appeals. ${scenario.explanation}`,
            classes: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50',
            icon: CircleAlert,
          }
        : missing.length > 0
          ? {
              title: 'The action fits, but the controls do not',
              detail: `Add ${missing.join(' and ').toLowerCase()} before executing this response.`,
              classes: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50',
              icon: FileText,
            }
          : {
              title: 'Defensible policy response',
              detail: scenario.explanation,
              classes: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50',
              icon: CheckCircle2,
            };

    return { actionFit, missing, outcome, readiness, safeguards, scenario };
  }, [action, appealPath, contextAvailable, decisionTrace, scenarioId, specialistEscalation]);

  const chooseScenario = (id: ScenarioId) => {
    const next = scenarios.find((scenario) => scenario.id === id) ?? scenarios[0];
    setScenarioId(id);
    setAction(next.expected);
    setContextAvailable(true);
    setDecisionTrace(true);
    setAppealPath(true);
    setSpecialistEscalation(false);
  };

  const reset = () => {
    setScenarioId('quoted-language');
    setAction('review');
    setContextAvailable(true);
    setDecisionTrace(true);
    setAppealPath(true);
    setSpecialistEscalation(false);
  };

  const OutcomeIcon = model.outcome.icon;

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Policy response lab"
        title="Choose an action the evidence can defend"
        description="A risk score is not an enforcement decision. Match the response to the scenario, then preserve the context, trace, and recovery controls it needs."
        icon={Shield}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <fieldset>
            <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Inspect a scenario</legend>
            <div className="mt-3 space-y-2">
              {scenarios.map((scenario) => (
                <LabChoice
                  key={scenario.id}
                  selected={scenario.id === scenarioId}
                  label={scenario.label}
                  detail={scenario.signal}
                  icon={scenario.needsSpecialist ? CircleAlert : scenario.needsContext ? Globe2 : ScanSearch}
                  accent="cyan"
                  onClick={() => chooseScenario(scenario.id)}
                />
              ))}
            </div>
          </fieldset>
        )}
      >
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Observed evidence</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-neutral-950 dark:text-white">{model.scenario.signal}</p>
        </div>

        <fieldset className="mt-6">
          <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Choose the product action</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {actions.map((item) => (
              <LabChoice
                key={item.id}
                selected={item.id === action}
                label={item.label}
                detail={item.detail}
                icon={item.icon}
                accent={item.id === 'remove' ? 'rose' : item.id === 'review' ? 'violet' : item.id === 'limit' ? 'amber' : 'emerald'}
                onClick={() => setAction(item.id)}
              />
            ))}
          </div>
        </fieldset>

        <div className="mt-6">
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">3. Set the decision controls</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <SafeguardSwitch
              checked={contextAvailable}
              label="Language and regional context"
              detail="Provide conversation, culture, and jurisdiction when meaning depends on them."
              onChange={() => setContextAvailable((value) => !value)}
            />
            <SafeguardSwitch
              checked={decisionTrace}
              label="Versioned decision trace"
              detail="Record policy, model, evidence, reason code, and action."
              onChange={() => setDecisionTrace((value) => !value)}
            />
            <SafeguardSwitch
              checked={appealPath}
              label="Appeal and restoration"
              detail="Let a user contest the action and reverse it without data repair."
              onChange={() => setAppealPath((value) => !value)}
            />
            <SafeguardSwitch
              checked={specialistEscalation}
              label="Urgent specialist escalation"
              detail="Bypass ordinary queue order for imminent-harm workflows."
              onChange={() => setSpecialistEscalation((value) => !value)}
            />
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <LabMetric
            label="Action fit"
            value={`${model.actionFit}%`}
            detail="Severity compared with the evidence-backed response."
            icon={Shield}
            tone={model.actionFit === 100 ? 'emerald' : model.actionFit > 50 ? 'amber' : 'rose'}
          />
          <LabMetric
            label="Controls met"
            value={`${model.safeguards.filter((item) => item.required && item.met).length}/${model.safeguards.filter((item) => item.required).length}`}
            detail="Required context, trace, recovery, and escalation controls."
            icon={FileText}
            tone={model.missing.length === 0 ? 'emerald' : 'amber'}
          />
          <LabMetric
            label="Decision readiness"
            value={`${model.readiness}%`}
            detail="Action fit plus required operational safeguards."
            icon={ScanSearch}
            tone={model.readiness === 100 ? 'emerald' : model.readiness >= 70 ? 'amber' : 'rose'}
          />
        </div>

        <div className={`mt-5 rounded-lg border p-4 ${model.outcome.classes}`} role="status" aria-live="polite">
          <div className="flex items-start gap-3">
            <OutcomeIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">{model.outcome.title}</p>
              <p className="mt-1 text-sm leading-6 opacity-80">{model.outcome.detail}</p>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
