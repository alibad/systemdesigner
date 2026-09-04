"use client";

import { learningAssetUrl } from "@/lib/learning-assets";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Check, Compass } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InteractiveQuiz,
  type QuizAnswerEvidence,
} from "@/components/fundamentals/InteractiveLearning";
import {
  ALL_SKILLS,
  LEARNING_TRACKS,
  PracticeStepSchema,
  unitIsSatisfied,
  type LearningUnit,
  type PracticeStep,
  type TrackId,
} from "@/lib/learning-path";
import type { useDailyLearning } from "@/hooks/useDailyLearning";
import CodingExercise from "./CodingExercise";

export default function PlacementTest({
  courseId,
  learning,
  onClose,
  onStart,
}: {
  courseId: TrackId;
  learning: ReturnType<typeof useDailyLearning>;
  onClose: () => void;
  onStart: (unit: LearningUnit) => void;
}) {
  const course = LEARNING_TRACKS.find((course) => course.id === courseId)!;
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      course.units.findIndex(
        (unit) => !unitIsSatisfied(learning.progress, unit),
      ),
    ),
  );
  const [phase, setPhase] = useState<"intro" | "test" | "passed" | "practice">(
    "intro",
  );
  const [part, setPart] = useState(0);
  const [step, setStep] = useState<PracticeStep>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [draft, setDraft] = useState<string>();
  const [missed, setMissed] = useState<string[]>([]);
  const failed = useRef(new Set<string>());
  const passed = useRef<string[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const unit = course.units[index];
  const next = course.units
    .slice(index + 1)
    .find((unit) => !unitIsSatisfied(learning.progress, unit));
  const focusHeading = () =>
    requestAnimationFrame(() => heading.current?.focus());
  useEffect(() => {
    if (phase !== "test") return;
    const controller = new AbortController();
    setStep(undefined);
    setDraft(undefined);
    setError("");
    fetch(
      learningAssetUrl(
        `/api/learning/sessions/${unit.placementStepIds[part]}`,
        unit.steps.find((step) => step.id === unit.placementStepIds[part])!
          .revision,
      ),
      {
        signal: controller.signal,
      },
    )
      .then((response) => {
        if (!response.ok) throw new Error("This assessment could not load.");
        return response.json();
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          const parsed = PracticeStepSchema.parse(data);
          const expected = unit.steps.find(
            (step) => step.id === unit.placementStepIds[part],
          )!;
          if (
            parsed.id !== expected.id ||
            parsed.revision !== expected.revision
          )
            throw new Error("The curriculum changed. Reload to continue.");
          setStep(parsed);
          focusHeading();
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            "This assessment could not load. Check your connection and retry.",
          );
      });
    return () => controller.abort();
  }, [phase, unit.id, unit.placementStepIds, unit.steps, part, retry]);

  function report(
    answer:
      | QuizAnswerEvidence
      | { correct: boolean; skillId?: string; passed?: boolean },
  ) {
    if (!step) return;
    const id = answer.skillId || step.skillIds[0];
    if (!step.skillIds.includes(id)) return;
    const skill = ALL_SKILLS.find((skill) => skill.id === id)!;
    learning.recordAttempt({
      skillId: id,
      revision: skill.revision,
      correct: answer.correct,
      passed: "passed" in answer && Boolean(answer.passed),
    });
    if (!answer.correct) failed.current.add(id);
  }
  function finishPart(success: boolean) {
    if (!step) return;
    if (!success) {
      for (const skillId of failed.current) report({ skillId, correct: false });
      setMissed([...failed.current]);
      setPhase("practice");
      focusHeading();
      return;
    }
    for (const skillId of step.skillIds)
      report({ skillId, correct: true, passed: true });
    passed.current = [...new Set([...passed.current, step.id])];
    if (part + 1 < unit.placementStepIds.length) {
      setStep(undefined);
      setPart(part + 1);
      return;
    }
    try {
      learning.placeUnit(unit.id, passed.current, unit.revision);
      setPhase("passed");
      focusHeading();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not save placement. Please retry.",
      );
    }
  }
  function start() {
    passed.current = [];
    failed.current.clear();
    setMissed([]);
    setPart(0);
    setPhase("test");
    setRetry((value) => value + 1);
  }
  const primary =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 focus-visible:ring-4 focus-visible:ring-emerald-300";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="learning-session bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
        <div className="learning-session-header">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
            <Compass className="h-4 w-4" />
            {course.title} placement
          </p>
          <DialogTitle
            ref={heading}
            tabIndex={-1}
            className="text-2xl font-semibold outline-none"
          >
            {phase === "intro"
              ? "Find your starting point"
              : phase === "passed"
                ? "You can move forward."
                : phase === "practice"
                  ? "A good place to start."
                  : unit.title}
          </DialogTitle>
          <DialogDescription className="mt-2">
            {phase === "test"
              ? `Unit ${index + 1} of ${course.units.length}${course.id === "coding" ? ` · Coding task ${part + 1} of ${unit.placementStepIds.length}` : " · Answer each question once"}`
              : "Use what you already know to find the right level."}
          </DialogDescription>
        </div>
        <div className="learning-session-body">
          {phase === "intro" && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-700">
                <h2 className="font-semibold">Start with {unit.title}</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  {unit.description}
                </p>
              </div>
              <p className="text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                We check one unit at a time.{" "}
                {course.id === "coding"
                  ? "Each coding task must pass its first test run. Normal practice includes hints and retries."
                  : "Every skill in the unit is represented. Answer every question correctly to place out."}{" "}
                After a successful check, you can start learning or check the
                next unit.
              </p>
              <p className="text-sm text-neutral-500">
                Placed units are labeled separately. Placement adds no lesson XP
                or daily-goal credit.
              </p>
              <div className="learning-actions">
                <button onClick={start} className={primary}>
                  Start placement <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onStart(unit)}
                  className="block text-sm font-medium text-neutral-500 underline"
                >
                  I’d rather learn this unit
                </button>
              </div>
            </div>
          )}
          {phase === "test" && (
            <div className="space-y-5">
              {error ? (
                <div
                  role="alert"
                  className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                >
                  {error}
                  <button
                    className="ml-2 underline"
                    onClick={() => setRetry((value) => value + 1)}
                  >
                    Retry placement
                  </button>
                </div>
              ) : !step ? (
                <p role="status">Preparing your assessment…</p>
              ) : step.kind === "quiz" ? (
                <InteractiveQuiz
                  key={`${unit.id}:${part}:${retry}`}
                  title="Unit assessment"
                  questionsFile={step.questionsFile}
                  quizId={step.quizId}
                  sessionMode
                  assetRevision={step.revision}
                  revealAnswers={false}
                  onAnswer={report}
                  onComplete={({ score, total }) =>
                    finishPart(total > 0 && score === total)
                  }
                />
              ) : (
                <div className="space-y-4">
                  <div>
                    <h2 className="font-semibold">{step.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-neutral-500">
                      {step.summary}
                    </p>
                  </div>
                  <CodingExercise
                    key={step.id}
                    step={step}
                    draft={draft}
                    onDraftChange={setDraft}
                    allowHints={false}
                    onAttempt={(answer) => {
                      report(answer);
                      if (!answer.correct) finishPart(false);
                    }}
                    onPass={() => finishPart(true)}
                  />
                </div>
              )}
              {step && !error && (
                <button
                  className="text-sm font-medium text-neutral-500 underline"
                  onClick={() => {
                    for (const skillId of step.skillIds)
                      report({ skillId, correct: false });
                    finishPart(false);
                  }}
                >
                  I’m not sure yet
                </button>
              )}
            </div>
          )}
          {phase === "passed" && (
            <div className="space-y-5">
              <div className="rounded-2xl bg-emerald-50 p-5 dark:bg-emerald-950/40">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Check className="h-5 w-5 text-emerald-600" />
                  {unit.title} · Placed out
                </h2>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  You demonstrated the unit’s skills. They will return for a
                  recall check; you can revisit the lessons at any time.
                </p>
              </div>
              <div className="learning-actions">
                <button
                  onClick={() => (next ? onStart(next) : onClose())}
                  className={`${primary} w-full`}
                >
                  {next ? `Start: ${next.title}` : "Return to your course"}
                  <ArrowRight className="h-4 w-4" />
                </button>
                {next && (
                  <button
                    onClick={() => {
                      setIndex(
                        course.units.findIndex((unit) => unit.id === next.id),
                      );
                      setPhase("intro");
                    }}
                    className="w-full rounded-xl border border-neutral-200 px-5 py-3 text-sm font-semibold hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                  >
                    Check the next unit
                  </button>
                )}
              </div>
            </div>
          )}
          {phase === "practice" && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-700">
                <h2 className="text-lg font-semibold">{unit.title}</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  This unit gives you practice with the ideas that need another
                  look. Your earlier progress stays available.
                </p>
                {missed.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {missed.map((id) => {
                      const skill = ALL_SKILLS.find(
                        (skill) => skill.id === id,
                      )!;
                      return (
                        <li key={id}>
                          <Link
                            className="text-sm text-emerald-700 underline dark:text-emerald-400"
                            href={skill.lessonPath as Route}
                          >
                            {skill.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="learning-actions">
                <button
                  className={`${primary} w-full`}
                  onClick={() => onStart(unit)}
                >
                  Learn this unit <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  className="w-full text-sm text-neutral-500 underline"
                  onClick={onClose}
                >
                  Return to your course
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
