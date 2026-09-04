"use client";

import {
  ArrowRight,
  ArrowDown,
  BookOpen,
  Check,
  Clock3,
  Code2,
  Flag,
  LockKeyhole,
  Play,
  RotateCcw,
  Trophy,
} from "lucide-react";
import {
  FIRST_MONTH,
  currentJourneyDay,
  journeyDayDone,
  journeyTaskDone,
  type JourneyDay,
} from "@/lib/learning-journey";
import { ALL_STEPS, type LearningStep } from "@/lib/learning-path";
import type { useDailyLearning } from "@/hooks/useDailyLearning";
import { adaptiveReviewQueue } from "@/lib/learning-evidence";
import SystemScene from "./SystemScene";

export default function FirstMonth({
  learning,
  begin,
  onCourses,
  onPlacement,
  onSettings,
}: {
  learning: ReturnType<typeof useDailyLearning>;
  begin: (step: LearningStep, day?: JourneyDay) => void;
  onCourses: () => void;
  onPlacement: () => void;
  onSettings: () => void;
}) {
  const { data, progress, ready, today } = learning;
  const active = currentJourneyDay(progress, data.journey);
  const enrolled = data.journey.enrollment.value === "guided";
  const done = FIRST_MONTH.days.filter((day) =>
    journeyDayDone(progress, data.journey, day),
  );
  const milestones = FIRST_MONTH.days.filter((day) => day.milestone);
  const chapterIndex = active
    ? milestones.findIndex((day) => day.number >= active.number)
    : milestones.length - 1;
  const chapterEnd = milestones[chapterIndex];
  const chapterStart =
    chapterIndex === 0 ? 1 : milestones[chapterIndex - 1].number + 1;
  const chapterDays = FIRST_MONTH.days.filter(
    (day) => day.number >= chapterStart && day.number <= chapterEnd.number,
  );
  const due = today
    ? adaptiveReviewQueue(progress, today).filter((item) =>
        Boolean(progress.completed[item.step.id]),
      )
    : [];
  const activeStep =
    active &&
    ALL_STEPS.find(
      (step) =>
        step.id ===
        (active.stepIds.find(
          (id) => !journeyTaskDone(progress, data.journey, active, id),
        ) || active.stepIds[0]),
    );
  function start(step = activeStep, day = active) {
    if (!ready || !step) return;
    learning.enroll("guided");
    begin(step, day);
  }
  return (
    <section
      role="tabpanel"
      id="learning-today"
      aria-labelledby="tab-today"
      className="learning-trail"
    >
      <div className="trail-heading">
        <p className="learning-eyebrow">
          Chapter {chapterIndex + 1} · Design + code
        </p>
        <h1>
          {chapterIndex === 0
            ? "Build your first system"
            : chapterEnd.milestone}
        </h1>
        <p className="mt-3 max-w-lg text-base leading-6 text-slate-600 dark:text-slate-300">
          {chapterIndex === 0
            ? "From a web request to a working link service."
            : active?.objective ||
              "You connected the pieces. Keep building from here."}
        </p>
        {!enrolled && (
          <button
            onClick={() => {
              learning.enroll("guided");
              onPlacement();
            }}
            disabled={!ready}
            className="mt-4 min-h-11 text-sm font-medium text-sky-700 underline decoration-sky-200 underline-offset-4 dark:text-sky-400"
          >
            Have experience? Find my starting point
          </button>
        )}
      </div>

      {due.length > 0 && (
        <div className="trail-recall">
          <RotateCcw className="h-5 w-5 shrink-0 text-sky-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold">
              A little recall goes a long way
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {due.length} {due.length === 1 ? "skill is" : "skills are"} ready
              to revisit.
            </p>
          </div>
          <button
            onClick={() => begin(due[0].step)}
            className="min-h-11 px-2 text-sm font-semibold text-sky-700 dark:text-sky-400"
          >
            Practice
          </button>
        </div>
      )}

      {!active && (
        <div className="py-8 text-center">
          <Trophy className="mx-auto mb-4 h-12 w-12 text-amber-500" />
          <h2 className="text-2xl font-bold">Your first month is complete.</h2>
          <p className="mt-3 text-slate-500">
            You built your first system. Choose where to go next.
          </p>
        </div>
      )}
      <ol aria-label="Your learning path" className="trail-nodes">
        {chapterDays.map((day, index) => {
          const complete = journeyDayDone(progress, data.journey, day);
          const current = active?.id === day.id;
          const available = complete || current;
          const step = ALL_STEPS.find(
            (step) =>
              step.id ===
              (day.stepIds.find(
                (id) => !journeyTaskDone(progress, data.journey, day, id),
              ) || day.stepIds[0]),
          )!;
          const NodeIcon = complete
            ? Check
            : day.milestone
              ? Flag
              : current
                ? Play
                : day.kind === "review"
                  ? RotateCcw
                  : step.kind === "coding"
                    ? Code2
                    : BookOpen;
          return (
            <li
              key={day.id}
              className={`trail-stop ${current ? "trail-stop-current" : ""}`}
              style={
                {
                  "--trail-offset": `${[0, 24, 24, 0, 24, 24, 0][index % 7]}px`,
                } as React.CSSProperties
              }
            >
              {current && (
                <p className="trail-start-label">
                  {done.length ? "NEXT UP" : "START HERE"}
                  <ArrowDown className="h-4 w-4" />
                </p>
              )}
              <button
                id={`journey-${day.id}`}
                onClick={() => start(step, day)}
                disabled={!available || !ready}
                aria-current={current ? "step" : undefined}
                aria-label={`${complete ? "Revisit" : current ? "Start" : "Locked"}: ${day.title}`}
                className="trail-stop-button"
              >
                <span
                  className={`trail-node ${complete ? "trail-node-complete" : current ? "trail-node-current" : "trail-node-future"}`}
                >
                  <NodeIcon
                    aria-hidden
                    className={current ? "h-7 w-7" : "h-6 w-6"}
                    fill={current && !day.milestone ? "currentColor" : "none"}
                    strokeWidth={current && !day.milestone ? 0 : 2}
                  />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span
                    className={`block text-base font-semibold leading-6 ${current ? "text-slate-950 dark:text-white" : complete ? "text-slate-700 dark:text-slate-200" : "text-slate-500 dark:text-slate-400"}`}
                  >
                    {day.title}
                  </span>
                  <span className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    {complete ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Clock3 className="h-3.5 w-3.5" />
                    )}
                    {complete
                      ? "Completed · Practice again"
                      : `${day.stepIds.reduce((sum, id) => sum + ALL_STEPS.find((step) => step.id === id)!.minutes, 0)} min`}
                    {day.milestone ? " · Milestone" : ""}
                  </span>
                </span>
              </button>
              {current && chapterIndex === 0 && (
                <div className="trail-illustration">
                  <SystemScene compact />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {active && active.stepIds.length > 1 && (
        <section className="mt-5" aria-label="Today's review tasks">
          <h2 className="mb-3 text-sm font-semibold">Today’s recall</h2>
          {active.stepIds.map((id) => {
            const step = ALL_STEPS.find((step) => step.id === id)!;
            const complete = journeyTaskDone(
              progress,
              data.journey,
              active,
              id,
            );
            return (
              <button
                key={id}
                className="flex min-h-14 w-full items-center gap-3 border-b border-slate-200 py-3 text-left text-sm dark:border-slate-800"
                onClick={() => start(step)}
              >
                {complete ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <RotateCcw className="h-4 w-4 text-sky-600" />
                )}
                <span className="flex-1">{step.title}</span>
                <span className="text-xs text-slate-500">
                  {complete ? "Complete" : `${step.minutes} min`}
                </span>
              </button>
            );
          })}
        </section>
      )}

      <details className="trail-all-days">
        <summary>
          Explore the 30-day path <ArrowRight className="h-4 w-4" />
        </summary>
        <p className="mb-4 text-sm leading-6 text-slate-500">
          Study at your own pace. Completed lessons stay open for practice.
        </p>
        <ol aria-label="Thirty study days">
          {FIRST_MONTH.days.map((day) => {
            const complete = journeyDayDone(progress, data.journey, day);
            const available = complete || day.id === active?.id;
            const step = ALL_STEPS.find((step) => step.id === day.stepIds[0])!;
            return (
              <li key={day.id}>
                <button
                  className="flex min-h-14 w-full items-center gap-3 border-b border-slate-100 py-3 text-left text-sm disabled:text-slate-400 dark:border-slate-800"
                  disabled={!available}
                  onClick={() => start(step, day)}
                >
                  <span className="w-6 text-center">
                    {complete ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      day.number
                    )}
                  </span>
                  <span className="flex-1">{day.title}</span>
                  {!available && <LockKeyhole className="h-3.5 w-3.5" />}
                </button>
              </li>
            );
          })}
        </ol>
      </details>
      <div className="mt-5 flex items-center justify-between text-xs text-slate-500">
        <span>{done.length} of 30 study days complete</span>
        <span>{Math.round((done.length / 30) * 100)}%</span>
      </div>
      <div
        role="progressbar"
        aria-label="First month progress"
        aria-valuenow={done.length}
        aria-valuemin={0}
        aria-valuemax={30}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
      >
        <div
          className="h-full bg-sky-500"
          style={{ width: `${(done.length / 30) * 100}%` }}
        />
      </div>
      <div className="sr-only">
        {active
          ? `Study day ${active.number} of 30`
          : "All 30 study days complete"}
      </div>
      <div className="mt-6 flex justify-center gap-6 text-sm">
        <button
          className="min-h-11 text-slate-500 underline underline-offset-4"
          onClick={onCourses}
        >
          Browse all courses
        </button>
        <button
          className="min-h-11 text-slate-500 underline underline-offset-4"
          onClick={onSettings}
        >
          Learning settings
        </button>
      </div>
      <div className="trail-primary">
        <button
          disabled={!ready}
          className="learning-primary"
          onClick={() => (active ? start() : onCourses())}
        >
          {active
            ? activeStep && data.sessions[activeStep.id]?.value
              ? "Resume lesson"
              : activeStep?.kind === "coding"
                ? "Start coding"
                : active.kind === "review"
                  ? "Start review"
                  : "Start lesson"
            : "Keep learning"}
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </section>
  );
}
