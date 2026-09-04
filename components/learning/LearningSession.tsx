"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { Route } from "next";
import { ArrowRight, BookOpen, Check, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { InteractiveQuiz } from "@/components/fundamentals/InteractiveLearning";
import CodingExercise from "./CodingExercise";
import SkillPractice from "./SkillPractice";
import LearningLab from "./LearningLab";
import SystemScene from "./SystemScene";
import type { SessionResume } from "@/lib/learning-resume";
import type { AttemptEvidence } from "@/lib/learning-evidence";
import { ALL_SKILLS } from "@/lib/learning-path";
import { STEP_XP, type PracticeStep } from "@/lib/learning-path";

const SourceExploration = dynamic(() => import("./SourceExploration"), {
  loading: () => <p role="status">Loading models…</p>,
});

export default function LearningSession({
  step,
  mastered,
  onClose,
  onComplete,
  draft,
  onDraftChange,
  reviewNumber = 0,
  onContinue,
  onEvidence,
  completionLabel,
  nextLessonTitle,
  draftHistory,
  savedSession,
  onSaveSession,
}: {
  draftHistory?: { value: string; updatedAt: number }[];
  savedSession?: SessionResume;
  onSaveSession: (value: SessionResume | null) => void;
  step: PracticeStep;
  mastered: boolean;
  onClose: () => void;
  onComplete: () => void;
  draft?: string;
  onDraftChange: (value: string) => void;
  reviewNumber?: number;
  onContinue?: () => void;
  onEvidence: (evidence: AttemptEvidence) => void;
  completionLabel?: string;
  nextLessonTitle?: string;
}) {
  const initial = useRef(
    savedSession?.revision === step.revision ? savedSession : undefined,
  );
  const resume = useRef<SessionResume>(
    initial.current || {
      revision: step.revision,
      review: reviewNumber,
      phase: "learn",
      failedSkills: [],
      lastScore: "",
    },
  );
  const review = resume.current.review;
  const save = (patch: Partial<SessionResume>) => {
    resume.current = { ...resume.current, ...patch };
    onSaveSession(resume.current);
  };
  const [phase, setPhaseState] = useState<
    "learn" | "practice" | "retry" | "done"
  >(resume.current.phase);
  const setPhase = (value: "learn" | "practice" | "retry" | "done") => {
    setPhaseState(value);
    if (value === "done") onSaveSession(null);
    else save({ phase: value });
  };
  const [attempt, setAttempt] = useState(0);
  const [lastScore, setLastScore] = useState(resume.current.lastScore);
  const [earnedXP, setEarnedXP] = useState(0);
  const [lessonProgress, setLessonProgress] = useState({
    completed: 0,
    total: 0,
  });
  const handleProgress = useCallback(
    (completed: number, total: number) =>
      setLessonProgress({ completed, total }),
    [],
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const failedSkills = useRef(new Set<string>(resume.current.failedSkills));
  const report = (
    correct: boolean,
    hinted = false,
    skillId = step.skillIds[0],
    passed = false,
  ) => {
    const skill = ALL_SKILLS.find((skill) => skill.id === skillId);
    if (skill)
      onEvidence({
        skillId,
        revision: skill.revision,
        correct,
        hinted,
        passed,
      });
    if (!correct) {
      failedSkills.current.add(skillId);
      save({ failedSkills: [...failedSkills.current] });
    }
  };
  const focusHeading = () =>
    requestAnimationFrame(() => heading.current?.focus());
  const finish = () => {
    for (const skillId of step.skillIds) report(true, false, skillId, true);
    setEarnedXP(mastered ? 0 : STEP_XP);
    onComplete();
    setPhase("done");
    focusHeading();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="learning-session bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const courseStep = document.getElementById(`step-${step.id}`);
          const target = courseStep?.getClientRects().length
            ? courseStep
            : document.querySelector<HTMLElement>(
                '.trail-stop-button[aria-current="step"], .trail-primary button',
              );
          target?.focus();
        }}
      >
        <div className="learning-session-header">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sky-700 dark:text-sky-400">
            <Sparkles className="h-4 w-4" />
            {step.minutes}-minute practice
          </div>
          <DialogTitle
            ref={heading}
            tabIndex={-1}
            className="text-xl font-bold leading-tight outline-none sm:text-2xl"
          >
            {phase === "done" ? "One step stronger." : step.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {phase === "done"
              ? "You put the concept into practice."
              : "Learn the idea. Try it yourself. Make it stick."}
          </DialogDescription>
          <div
            role="progressbar"
            aria-label="Lesson progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={
              phase === "done"
                ? 100
                : lessonProgress.total
                  ? Math.round(
                      (lessonProgress.completed / lessonProgress.total) * 100,
                    )
                  : 0
            }
            className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
          >
            <div
              className="h-full rounded-full bg-sky-500 transition-[width] duration-300"
              style={{
                width: `${phase === "done" ? 100 : lessonProgress.total ? (lessonProgress.completed / lessonProgress.total) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {phase === "learn"
              ? "Explore the idea, then make it work."
              : phase === "done"
                ? "Lesson complete"
                : lessonProgress.total
                  ? `${lessonProgress.completed} of ${lessonProgress.total} challenges complete`
                  : "Put the idea into practice."}
          </p>
        </div>
        <div className="learning-session-body">
          {phase === "learn" && (
            <>
              <section className="lesson-definition">
                <h2 className="mb-3 text-xl font-bold">{step.concept}</h2>
                <p className="text-[15px] leading-6 text-neutral-700 dark:text-neutral-200">
                  {step.summary}
                </p>
              </section>
              {step.lab ? (
                <LearningLab kind={step.lab} />
              ) : (
                <>
                  <div className="border-l-4 border-amber-400 pl-4">
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      {step.exampleLabel || "Try this mental picture"}
                    </p>
                    <p className="text-sm leading-relaxed">{step.example}</p>
                  </div>
                  <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                    {step.takeaway}
                  </p>
                </>
              )}
              {!step.lab && !!step.models?.length && (
                <SourceExploration
                  models={step.models}
                  revision={step.revision}
                />
              )}
              <details className="text-sm">
                <summary className="cursor-pointer py-2 font-medium text-slate-500">
                  Go a little deeper
                </summary>
                <p className="my-3 leading-6 text-slate-600 dark:text-slate-300">
                  {step.example}
                </p>
                <Link
                  href={step.lessonPath as Route}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 underline underline-offset-4 dark:text-emerald-400"
                >
                  <BookOpen className="h-4 w-4" />
                  Explore the full lesson
                </Link>
              </details>
              <div className="learning-actions">
                <button
                  onClick={() => {
                    setPhase("practice");
                    focusHeading();
                  }}
                  className="learning-primary"
                >
                  Let’s practice <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
          {phase === "practice" &&
            (step.kind === "coding" ? (
              <CodingExercise
                step={step}
                onPass={finish}
                draft={draft}
                history={draftHistory}
                onDraftChange={onDraftChange}
                onAttempt={({ correct, hinted }) => report(correct, hinted)}
              />
            ) : step.exercisesFile ? (
              <SkillPractice
                file={step.exercisesFile}
                revision={step.revision}
                review={review}
                initialResume={initial.current?.exercise}
                onResume={(exercise) => save({ exercise })}
                onAttempt={({ correct, hinted }) => report(correct, hinted)}
                onComplete={finish}
                onProgress={handleProgress}
              />
            ) : (
              <InteractiveQuiz
                key={attempt}
                title="Put it into practice"
                initialResume={resume.current.quiz}
                onResume={(quiz) => save({ quiz })}
                onProgress={handleProgress}
                sessionMode
                assetRevision={step.revision}
                quizId={step.quizId}
                questionsFile={step.questionsFile}
                questionCount={step.questionCount}
                questionOffset={review * (step.questionCount || 4)}
                onAnswer={(answer) => {
                  report(
                    answer.correct,
                    false,
                    answer.skillId || step.skillIds[0],
                  );
                }}
                onComplete={({ score, total }) => {
                  if (total > 0 && score === total) finish();
                  else {
                    for (const skillId of failedSkills.current)
                      report(false, false, skillId);
                    setLastScore(`${score} of ${total}`);
                    save({ lastScore: `${score} of ${total}` });
                    setPhase("retry");
                    focusHeading();
                  }
                }}
              />
            ))}
          {phase === "retry" && (
            <div className="space-y-5 py-3">
              <h2 className="text-xl font-bold">
                You’re learning. Keep going.
              </h2>
              <p className="text-neutral-600 dark:text-neutral-300">
                You got {lastScore} right. Get every answer correct to complete
                this step. You can retry as often as you need.
              </p>
              <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                {step.takeaway}
              </p>
              <div className="learning-actions">
                <button
                  className="w-full rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700"
                  onClick={() => {
                    setAttempt((value) => value + 1);
                    setLessonProgress({ completed: 0, total: 0 });
                    failedSkills.current.clear();
                    save({
                      quiz: undefined,
                      exercise: undefined,
                      failedSkills: [],
                      lastScore: "",
                    });
                    setPhase("practice");
                    focusHeading();
                  }}
                >
                  Try again
                </button>
                <button
                  className="w-full text-sm font-semibold underline"
                  onClick={() => {
                    setPhase("learn");
                    focusHeading();
                  }}
                >
                  Revisit the concept
                </button>
              </div>
            </div>
          )}
          {phase === "done" && (
            <div className="space-y-5 py-5 text-center">
              <div className="mx-auto grid h-24 w-24 place-items-center rounded-full border-b-8 border-emerald-700 bg-emerald-500 text-white">
                <Check className="h-12 w-12" strokeWidth={3} />
              </div>
              <h2 className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                {earnedXP > 0 ? `+${earnedXP} path XP` : "Review complete!"}
              </h2>
              {step.success && (
                <p className="text-2xl font-bold leading-8 tracking-tight">
                  {step.success}
                </p>
              )}
              {step.lab && <SystemScene compact />}
              {completionLabel && (
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  {completionLabel}
                </p>
              )}
              <p className="text-neutral-600 dark:text-neutral-300">
                {earnedXP > 0
                  ? "A little more capable than when you started."
                  : "Another useful repetition. Your next review will follow your practice."}
              </p>
              <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                {step.takeaway}
              </p>
              <div className="learning-actions">
                {onContinue && (
                  <button
                    onClick={onContinue}
                    aria-label="Continue learning"
                    className="learning-primary"
                  >
                    <span>
                      Continue learning
                      {nextLessonTitle && (
                        <span className="mt-1 block text-xs font-normal">
                          {nextLessonTitle}
                        </span>
                      )}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="w-full rounded-xl border border-neutral-200 px-5 py-3 font-semibold text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  {completionLabel ? "Back to my day" : "Back to my path"}
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
