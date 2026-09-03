"use client";

import { useRef, useState } from "react";
import Link from "next/link";
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
import { STEP_XP, type PracticeStep } from "@/lib/learning-path";

export default function LearningSession({
  step,
  mastered,
  onClose,
  onComplete,
}: {
  step: PracticeStep;
  mastered: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [phase, setPhase] = useState<"learn" | "practice" | "retry" | "done">(
    "learn",
  );
  const [attempt, setAttempt] = useState(0);
  const [lastScore, setLastScore] = useState("");
  const [earnedXP, setEarnedXP] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusHeading = () =>
    requestAnimationFrame(() => heading.current?.focus());
  const finish = () => {
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
        className="max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto rounded-3xl border-neutral-200 bg-white p-5 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 sm:p-8"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById(`step-${step.id}`)?.focus();
        }}
      >
        <div className="pr-7">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
            <Sparkles className="h-4 w-4" />
            {step.minutes}-minute practice
          </div>
          <DialogTitle
            ref={heading}
            tabIndex={-1}
            className="text-2xl font-bold leading-tight outline-none"
          >
            {phase === "done" ? "One step stronger." : step.title}
          </DialogTitle>
          <DialogDescription className="mt-2 text-neutral-500 dark:text-neutral-400">
            {phase === "done"
              ? "You put the concept into practice."
              : "Learn the idea. Try it yourself. Make it stick."}
          </DialogDescription>
        </div>
        <div
          className="flex gap-2"
          aria-label={`Session stage: ${phase === "learn" ? "Learn" : phase === "done" ? "Complete" : "Practice"}`}
        >
          {["Learn", "Practice", "Complete"].map((label, index) => (
            <div key={label} className="flex-1">
              <div
                className={`h-2 rounded-full ${index <= (phase === "learn" ? 0 : phase === "done" ? 2 : 1) ? "bg-emerald-500" : "bg-neutral-100 dark:bg-neutral-800"}`}
              />
              <span className="mt-1 block text-[10px] text-neutral-500 dark:text-neutral-400">
                {label}
              </span>
            </div>
          ))}
        </div>
        {phase === "learn" && (
          <>
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/50">
              <h2 className="mb-3 text-xl font-bold">{step.concept}</h2>
              <p className="leading-relaxed text-neutral-700 dark:text-neutral-200">
                {step.summary}
              </p>
            </section>
            <div className="border-l-4 border-amber-400 pl-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Try this mental picture
              </p>
              <p className="text-sm leading-relaxed">{step.example}</p>
            </div>
            <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
              {step.takeaway}
            </p>
            <Link
              href={step.lessonPath as Route}
              className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 underline underline-offset-4 dark:text-emerald-400"
            >
              <BookOpen className="h-4 w-4" />
              Explore the full lesson
            </Link>
            <button
              onClick={() => {
                setPhase("practice");
                focusHeading();
              }}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-b-4 border-emerald-800 bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700"
            >
              Let’s practice <ArrowRight className="h-4 w-4" />
            </button>
          </>
        )}
        {phase === "practice" &&
          (step.kind === "coding" ? (
            <CodingExercise step={step} onPass={finish} />
          ) : (
            <InteractiveQuiz
              key={attempt}
              title="Put it into practice"
              sessionMode
              quizId={step.quizId}
              onComplete={({ score, total }) => {
                if (total > 0 && score === total) finish();
                else {
                  setLastScore(`${score} of ${total}`);
                  setPhase("retry");
                  focusHeading();
                }
              }}
            />
          ))}
        {phase === "retry" && (
          <div className="space-y-5 py-3">
            <h2 className="text-xl font-bold">You’re learning. Keep going.</h2>
            <p className="text-neutral-600 dark:text-neutral-300">
              You got {lastScore} right. Get every answer correct to complete
              this step. You can retry as often as you need.
            </p>
            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              {step.takeaway}
            </p>
            <button
              className="w-full rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700"
              onClick={() => {
                setAttempt((value) => value + 1);
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
        )}
        {phase === "done" && (
          <div className="space-y-5 py-5 text-center">
            <div className="mx-auto grid h-24 w-24 place-items-center rounded-full border-b-8 border-emerald-700 bg-emerald-500 text-white">
              <Check className="h-12 w-12" strokeWidth={3} />
            </div>
            <h2 className="text-3xl font-extrabold">
              {earnedXP > 0 ? `+${earnedXP} path XP` : "Review complete!"}
            </h2>
            <p className="text-neutral-600 dark:text-neutral-300">
              {earnedXP > 0
                ? "Your progress is recorded and the next step is ready."
                : "You strengthened a skill. Reviews count toward your daily goal once per step each day."}
            </p>
            <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
              {step.takeaway}
            </p>
            <button
              onClick={onClose}
              className="w-full rounded-xl border-b-4 border-emerald-800 bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700"
            >
              Back to my path
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
