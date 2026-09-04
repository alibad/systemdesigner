"use client";

import {
  ArrowRight,
  ArrowDown,
  BookOpen,
  BrainCircuit,
  Check,
  Clock3,
  Code2,
  Flag,
  Flame,
  LockKeyhole,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
} from "lucide-react";
import {
  JOURNEY,
  JOURNEY_DAYS,
  JOURNEY_MILESTONES,
  currentJourneyDay,
  journeyDayDone,
  journeyPartFor,
  journeyTaskDone,
  type JourneyDay,
} from "@/lib/learning-journey";
import {
  ALL_STEPS,
  pathStreak,
  type LearningStep,
  type TrackId,
} from "@/lib/learning-path";
import type { useDailyLearning } from "@/hooks/useDailyLearning";
import { adaptiveReviewQueue } from "@/lib/learning-evidence";
import { DAILY_REVIEW_SET } from "./AdaptiveReviewPanel";
import SystemScene from "./SystemScene";

export default function FirstMonth({
  learning,
  begin,
  onCourses,
  onCourse,
  onPlacement,
  onSettings,
}: {
  learning: ReturnType<typeof useDailyLearning>;
  begin: (step: LearningStep, day?: JourneyDay) => void;
  onCourses: () => void;
  onCourse?: (id: TrackId) => void;
  onPlacement: () => void;
  onSettings: () => void;
}) {
  const { data, progress, ready, today } = learning;
  const active = currentJourneyDay(progress, data.journey);
  const enrolled = data.journey.enrollment.value === "guided";
  const isDone = (day: JourneyDay) =>
    journeyDayDone(progress, data.journey, day);
  const done = JOURNEY_DAYS.filter(isDone);
  const part = active ? journeyPartFor(active) : JOURNEY.parts.at(-1)!;
  const partIndex = JOURNEY.parts.indexOf(part);
  const partDone = part.days.filter(isDone).length;
  const chapterIndex = active
    ? JOURNEY_MILESTONES.findIndex((day) => day.number >= active.number)
    : JOURNEY_MILESTONES.length - 1;
  const chapterEnd = JOURNEY_MILESTONES[chapterIndex];
  const chapterStart =
    chapterIndex === 0 ? 1 : JOURNEY_MILESTONES[chapterIndex - 1].number + 1;
  const chapterDays = JOURNEY_DAYS.filter(
    (day) => day.number >= chapterStart && day.number <= chapterEnd.number,
  );
  const opensPart = chapterStart === part.days[0].number;
  const streak = today ? pathStreak(progress, today) : 0;
  const dailyCount = today ? progress.activity[today]?.length || 0 : 0;
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
        <div className="flex items-center justify-between gap-3">
          <p className="learning-eyebrow">
            Chapter {chapterIndex + 1} · Design + code
          </p>
          {(streak > 0 || dailyCount > 0) && (
            <p
              className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300"
              aria-label={`${streak} day streak, ${Math.min(dailyCount, progress.dailyGoal)} of ${progress.dailyGoal} sessions today`}
            >
              <Flame className="h-4 w-4 text-orange-500" aria-hidden />
              {streak}
              <span className="ml-1 text-slate-400">·</span>
              <span className="ml-1">
                {Math.min(dailyCount, progress.dailyGoal)}/{progress.dailyGoal}{" "}
                today
              </span>
            </p>
          )}
        </div>
        <h1>{opensPart ? part.title : chapterEnd.milestone}</h1>
        <p className="mt-3 max-w-lg text-base leading-6 text-slate-600 dark:text-slate-300">
          {opensPart
            ? part.description
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
              {due.length > DAILY_REVIEW_SET
                ? `Today’s set: ${DAILY_REVIEW_SET} of ${due.length} due skills.`
                : `${due.length} ${due.length === 1 ? "skill is" : "skills are"} ready to revisit.`}
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
          <h2 className="text-2xl font-bold">You built complete systems.</h2>
          <p className="mt-3 text-slate-500">
            All {JOURNEY_DAYS.length} study days are complete. Keep your skills
            sharp with reviews, or start a new course.
          </p>
          {onCourse && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["genai", "Generative AI", Sparkles],
                  ["ml", "Machine learning", BrainCircuit],
                ] as const
              ).map(([id, title, Icon]) => (
                <button
                  key={id}
                  onClick={() => onCourse(id)}
                  className="flex min-h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-left text-sm font-semibold hover:border-sky-400 dark:border-slate-700 dark:bg-slate-900"
                >
                  <Icon className="h-5 w-5 text-sky-600" aria-hidden />
                  Start {title}
                  <ArrowRight className="ml-auto h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <ol aria-label="Your learning path" className="trail-nodes">
        {chapterDays.map((day, index) => {
          const complete = isDone(day);
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
          Explore the full path <ArrowRight className="h-4 w-4" />
        </summary>
        <p className="mb-4 text-sm leading-6 text-slate-500">
          {JOURNEY.parts.length} parts, {JOURNEY_DAYS.length} study days. Study
          at your own pace. Completed lessons stay open for practice.
        </p>
        {JOURNEY.parts.map((item, index) => (
          <details
            key={item.id}
            open={item.id === part.id}
            className="border-t border-slate-100 dark:border-slate-800"
          >
            <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 py-3 text-sm font-semibold">
              <span>
                Part {index + 1} · {item.title}
              </span>
              <span className="text-xs font-normal text-slate-500">
                {item.days.filter(isDone).length}/{item.days.length}
              </span>
            </summary>
            <p className="mb-2 text-xs leading-5 text-slate-500">
              {item.description}
            </p>
            <ol aria-label={`Part ${index + 1} study days`}>
              {item.days.map((day) => {
                const complete = isDone(day);
                const available = complete || day.id === active?.id;
                const step = ALL_STEPS.find(
                  (step) => step.id === day.stepIds[0],
                )!;
                return (
                  <li key={day.id}>
                    <button
                      className="flex min-h-14 w-full items-center gap-3 border-b border-slate-100 py-3 text-left text-sm disabled:text-slate-400 dark:border-slate-800"
                      disabled={!available}
                      onClick={() => start(step, day)}
                    >
                      <span className="w-8 text-center">
                        {complete ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          day.number
                        )}
                      </span>
                      <span className="flex-1">{day.title}</span>
                      {day.milestone && (
                        <Flag
                          className="h-3.5 w-3.5 text-amber-500"
                          aria-label="Milestone"
                        />
                      )}
                      {!available && <LockKeyhole className="h-3.5 w-3.5" />}
                    </button>
                  </li>
                );
              })}
            </ol>
          </details>
        ))}
      </details>
      <div className="mt-5 flex items-center justify-between gap-3 text-xs text-slate-500">
        <span className="truncate">
          Part {partIndex + 1} of {JOURNEY.parts.length} · {part.title}
        </span>
        <span className="shrink-0">
          {partDone} of {part.days.length} days
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`Part ${partIndex + 1} progress`}
        aria-valuenow={partDone}
        aria-valuemin={0}
        aria-valuemax={part.days.length}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
      >
        <div
          className="h-full bg-sky-500"
          style={{ width: `${(partDone / part.days.length) * 100}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {done.length} of {JOURNEY_DAYS.length} study days complete
      </p>
      <div className="sr-only">
        {active
          ? `Study day ${active.number} of ${JOURNEY_DAYS.length}`
          : "All study days complete"}
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
