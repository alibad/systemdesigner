'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  Banknote,
  BookOpenCheck,
  Bot,
  Check,
  CircleAlert,
  FileCheck2,
  Lightbulb,
  LoaderCircle,
  MessageSquareText,
  ShieldCheck,
  ShieldQuestion,
  UserCheck,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Risk = 'low' | 'medium' | 'high';

type Task = {
  id: string;
  label: string;
  detail: string;
  risk: Risk;
  riskLabel: string;
  modelConfidence: number;
  minimumEvidence: number;
  minimumValidator: number;
  humanApproval: boolean;
  proposedAnswer: string;
};

type EvidenceOption = {
  id: string;
  label: string;
  detail: string;
  supportScore: number;
  sourceLabel: string;
};

type Validator = {
  id: string;
  label: string;
  detail: string;
  level: number;
  resultLabel: string;
};

type ReleaseData = {
  title: string;
  description: string;
  defaults: {
    taskId: string;
    evidenceId: string;
    validatorId: string;
    confidenceFloor: number;
  };
  tasks: Task[];
  evidenceOptions: EvidenceOption[];
  validators: Validator[];
};

type Decision = 'release' | 'review' | 'block';

const BLOCK_ID = 'genai/llm-intro-answer-release-lab';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isReleaseData(value: unknown): value is ReleaseData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ReleaseData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && isFiniteNumber(candidate.defaults.confidenceFloor)
      && Array.isArray(candidate.tasks)
      && candidate.tasks.length > 0
      && candidate.tasks.every((task) => (
        task.id
        && task.label
        && isFiniteNumber(task.modelConfidence)
        && isFiniteNumber(task.minimumEvidence)
        && isFiniteNumber(task.minimumValidator)
      ))
      && Array.isArray(candidate.evidenceOptions)
      && candidate.evidenceOptions.length > 0
      && candidate.evidenceOptions.every((option) => option.id && isFiniteNumber(option.supportScore))
      && Array.isArray(candidate.validators)
      && candidate.validators.length > 0
      && candidate.validators.every((validator) => validator.id && isFiniteNumber(validator.level)),
  );
}

export default function LlmIntroAnswerReleaseLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ReleaseData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No answer-release scenarios were supplied.');
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
        if (!isReleaseData(payload)) throw new Error('Answer-release scenario data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load answer-release data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  return (
    <div data-content-block={BLOCK_ID}>
      {error ? <LoadError detail={error} /> : data ? <AnswerReleaseWorkbench data={data} /> : <LoadState />}
    </div>
  );
}

function AnswerReleaseWorkbench({ data }: { data: ReleaseData }) {
  const initialTask = data.tasks.find((item) => item.id === data.defaults.taskId) ?? data.tasks[0];
  const initialEvidence = data.evidenceOptions.find((item) => item.id === data.defaults.evidenceId)
    ?? data.evidenceOptions[0];
  const initialValidator = data.validators.find((item) => item.id === data.defaults.validatorId)
    ?? data.validators[0];
  const [taskId, setTaskId] = useState(initialTask.id);
  const [evidenceId, setEvidenceId] = useState(initialEvidence.id);
  const [validatorId, setValidatorId] = useState(initialValidator.id);
  const [confidenceFloor, setConfidenceFloor] = useState(data.defaults.confidenceFloor);
  const [humanApproved, setHumanApproved] = useState(false);

  const task = data.tasks.find((item) => item.id === taskId) ?? data.tasks[0];
  const evidence = data.evidenceOptions.find((item) => item.id === evidenceId) ?? data.evidenceOptions[0];
  const validator = data.validators.find((item) => item.id === validatorId) ?? data.validators[0];

  const result = useMemo(() => {
    const blockers = [
      evidence.supportScore < task.minimumEvidence
        ? `Evidence support is ${evidence.supportScore}, below the task floor of ${task.minimumEvidence}.`
        : null,
      validator.level < task.minimumValidator
        ? `Validator level ${validator.level} is below the required level ${task.minimumValidator}.`
        : null,
    ].filter(Boolean) as string[];
    const reviewReasons = [
      task.modelConfidence < confidenceFloor
        ? `Modeled confidence is ${task.modelConfidence}%, below the ${confidenceFloor}% review floor.`
        : null,
      task.humanApproval && !humanApproved
        ? 'A human with payment authority has not approved the proposed action.'
        : null,
    ].filter(Boolean) as string[];
    const decision: Decision = blockers.length > 0 ? 'block' : reviewReasons.length > 0 ? 'review' : 'release';
    return { blockers, decision, reviewReasons };
  }, [confidenceFloor, evidence.supportScore, humanApproved, task, validator.level]);

  const reset = () => {
    setTaskId(initialTask.id);
    setEvidenceId(initialEvidence.id);
    setValidatorId(initialValidator.id);
    setConfidenceFloor(data.defaults.confidenceFloor);
    setHumanApproved(false);
  };

  const chooseTask = (id: string) => {
    setTaskId(id);
    setHumanApproved(false);
  };

  const decisionStyles: Record<Decision, { label: string; tone: 'emerald' | 'amber' | 'rose'; panel: string }> = {
    release: {
      label: 'Release permitted',
      tone: 'emerald',
      panel: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-50',
    },
    review: {
      label: 'Human review required',
      tone: 'amber',
      panel: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-50',
    },
    block: {
      label: 'Block the answer',
      tone: 'rose',
      panel: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-50',
    },
  };
  const decisionStyle = decisionStyles[result.decision];

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Answer release gate"
        title={data.title}
        description={data.description}
        icon={ShieldCheck}
        accent="emerald"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Product task</legend>
              <div className="mt-3 grid gap-2">
                {data.tasks.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === task.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.risk === 'low' ? Lightbulb : item.risk === 'medium' ? MessageSquareText : Banknote}
                    accent={item.risk === 'low' ? 'blue' : item.risk === 'medium' ? 'amber' : 'rose'}
                    onClick={() => chooseTask(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Evidence supplied</legend>
              <div className="mt-3 grid gap-2">
                {data.evidenceOptions.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === evidence.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.supportScore >= 90 ? BookOpenCheck : item.supportScore > 0 ? ShieldQuestion : CircleAlert}
                    accent={item.supportScore >= 90 ? 'emerald' : item.supportScore > 0 ? 'amber' : 'rose'}
                    onClick={() => setEvidenceId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">3. Downstream validator</legend>
              <div className="mt-3 grid gap-2">
                {data.validators.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === validator.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.level >= 2 ? FileCheck2 : item.level === 1 ? Check : CircleAlert}
                    accent={item.level >= 2 ? 'emerald' : item.level === 1 ? 'blue' : 'rose'}
                    onClick={() => setValidatorId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="4. Confidence review floor"
              value={confidenceFloor}
              output={`${confidenceFloor}%`}
              min={50}
              max={99}
              step={1}
              accent="amber"
              lowLabel="Lenient"
              highLabel="Strict"
              onChange={setConfidenceFloor}
            />

            {task.humanApproval ? (
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-300 bg-white p-4 text-neutral-800 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100">
                <input
                  type="checkbox"
                  checked={humanApproved}
                  onChange={(event) => setHumanApproved(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-emerald-600"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">Authorized human approved</span>
                  <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">This changes authority state; model confidence cannot replace it.</span>
                </span>
              </label>
            ) : null}
          </div>
        )}
      >
        <div className="min-w-0 space-y-6" aria-live="polite">
          <section aria-labelledby="proposed-answer-title">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Generated proposal</p>
            <div className="mt-2 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-start gap-3">
                <Bot aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" />
                <div className="min-w-0">
                  <h4 id="proposed-answer-title" className="text-base font-semibold text-neutral-950 dark:text-white">{task.label}</h4>
                  <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{task.proposedAnswer}</p>
                  <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">The text is fluent in every state below. Only the release controls change.</p>
                </div>
              </div>
            </div>
          </section>

          <section aria-labelledby="release-path-title">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Control path</p>
            <h4 id="release-path-title" className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">Trace evidence to authority</h4>
            <div className="mt-4 grid items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
              <GateNode icon={BookOpenCheck} label="Evidence" value={evidence.sourceLabel} state={evidence.supportScore >= task.minimumEvidence ? 'pass' : 'fail'} detail={`${evidence.supportScore} / ${task.minimumEvidence} required`} />
              <FlowArrow />
              <GateNode icon={Bot} label="Model" value={`${task.modelConfidence}% confidence`} state={task.modelConfidence >= confidenceFloor ? 'pass' : 'review'} detail="Confidence is not source support" />
              <FlowArrow />
              <GateNode icon={FileCheck2} label="Validator" value={validator.resultLabel} state={validator.level >= task.minimumValidator ? 'pass' : 'fail'} detail={`Level ${validator.level} / ${task.minimumValidator} required`} />
              <FlowArrow />
              <GateNode icon={UserCheck} label="Authority" value={task.humanApproval ? (humanApproved ? 'Approved' : 'Pending') : 'No extra approval'} state={task.humanApproval && !humanApproved ? 'review' : 'pass'} detail={task.riskLabel} />
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric label="Task impact" value={task.riskLabel} detail="Impact determines the required controls." icon={task.risk === 'high' ? Banknote : MessageSquareText} tone={task.risk === 'high' ? 'rose' : task.risk === 'medium' ? 'amber' : 'blue'} />
            <LabMetric label="Source support" value={`${evidence.supportScore} / 100`} detail={`Required: ${task.minimumEvidence}`} icon={BookOpenCheck} tone={evidence.supportScore >= task.minimumEvidence ? 'emerald' : 'rose'} />
            <LabMetric label="Release decision" value={decisionStyle.label} detail="Fluency never bypasses the gate." icon={result.decision === 'release' ? BadgeCheck : CircleAlert} tone={decisionStyle.tone} />
          </div>

          <div className={`rounded-md border p-4 ${decisionStyle.panel}`}>
            <div className="flex items-start gap-3">
              {result.decision === 'release' ? <BadgeCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
              <div>
                <p className="text-sm font-semibold">{decisionStyle.label}</p>
                {result.blockers.length + result.reviewReasons.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 opacity-85">
                    {[...result.blockers, ...result.reviewReasons].map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs leading-5 opacity-85">The modeled controls clear this task's release contract. Production still needs monitoring, audit evidence, and a tested rollback path.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function GateNode({
  icon: Icon,
  label,
  value,
  detail,
  state,
}: {
  icon: typeof Bot;
  label: string;
  value: string;
  detail: string;
  state: 'pass' | 'review' | 'fail';
}) {
  const styles = {
    pass: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-50',
    review: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-50',
    fail: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-50',
  }[state];
  return (
    <div className={`min-w-0 rounded-md border p-3 ${styles}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {label}
      </div>
      <p className="mt-2 break-words text-sm font-semibold">{value}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center text-neutral-400 dark:text-neutral-600" aria-hidden="true">
      <ArrowDown className="h-4 w-4 md:hidden" />
      <ArrowRight className="hidden h-4 w-4 md:block" />
    </div>
  );
}

function LoadState() {
  return (
    <div className="flex min-h-72 items-center justify-center rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
        Loading answer-release gate...
      </div>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div className="rounded-lg border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-50">
      <div className="flex items-start gap-3">
        <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">The answer-release gate could not load.</p>
          <p className="mt-1 text-sm opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
