"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Code2,
  Flame,
  LockKeyhole,
  Network,
  RotateCcw,
  Sparkles,
  Star,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { useDailyLearning } from "@/hooks/useDailyLearning";
import {
  completePathStep,
  duePathSteps,
  LEARNING_TRACKS,
  pathStreak,
  shiftDay,
  STEP_XP,
  stepIsUnlocked,
  type PracticeStep,
} from "@/lib/learning-path";
import LearningSession from "./LearningSession";

export default function DailyLearningPath() {
  const { progress, ready, today, storageAvailable, update } =
    useDailyLearning();
  const [session, setSession] = useState<PracticeStep | null>(null);
  const track = LEARNING_TRACKS.find((item) => item.id === progress.track)!;
  const next = track.steps.find((step) => !progress.completed[step.id]);
  const done = track.steps.filter((step) => progress.completed[step.id]).length;
  const due = today ? duePathSteps(progress, today) : [];
  const dailyCount = progress.activity[today]?.length || 0;
  const goalMet = dailyCount >= progress.dailyGoal;
  const completedCount = Object.keys(progress.completed).length;
  const begin = (step: PracticeStep) => {
    if (!ready || !stepIsUnlocked(progress, step.id)) return;
    const target = LEARNING_TRACKS.find((item) =>
      item.steps.some((candidate) => candidate.id === step.id),
    )!;
    if (target.id !== progress.track)
      update((value) => ({ ...value, track: target.id }));
    setSession(step);
  };

  return (
    <div className="mx-auto max-w-6xl py-6 sm:py-9">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-emerald-700 dark:text-emerald-400">
            <Sparkles className="h-4 w-4" />A little practice goes a long way
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Build your daily learning habit.
          </h1>
          <p className="mt-3 max-w-xl text-neutral-500 dark:text-neutral-400">
            Small lessons. Real challenges. One step closer to the engineer you
            want to be.
          </p>
        </div>
        <Link
          href="/learn/my-plans"
          className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-600 hover:text-emerald-700 dark:text-neutral-300"
        >
          My learning plans <ArrowRight className="h-4 w-4" />
        </Link>
      </header>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <div
            role="group"
            aria-label="Learning track"
            className="mb-6 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3"
          >
            {LEARNING_TRACKS.map((item) => {
              const selected = item.id === track.id;
              const Icon = item.id === "design" ? Network : Code2;
              return (
                <button
                  key={item.id}
                  disabled={!ready}
                  aria-pressed={selected}
                  onClick={() =>
                    update((value) => ({ ...value, track: item.id }))
                  }
                  className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300 ${selected ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100" : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"}`}
                >
                  <Icon className="h-6 w-6 shrink-0" />
                  <span>
                    <span className="block text-sm font-bold sm:text-base">
                      {item.title}
                    </span>
                    <span className="mt-1 hidden text-xs sm:block">
                      {item.subtitle}
                    </span>
                  </span>
                  {selected && (
                    <Check className="ml-auto hidden h-4 w-4 sm:block" />
                  )}
                </button>
              );
            })}
          </div>
          <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <div className="relative overflow-hidden bg-emerald-700 p-6 text-white sm:p-7">
              <div className="relative z-10 max-w-[85%]">
                <p className="mb-3 text-xs font-bold uppercase tracking-[.15em] text-emerald-100">
                  Unit 1 · Beginner
                </p>
                <h2 className="text-2xl font-extrabold tracking-tight">
                  {track.unit}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-emerald-50">
                  {track.description}
                </p>
              </div>
              <Network
                aria-hidden="true"
                className="absolute -right-7 top-5 h-40 w-40 rotate-12 text-emerald-600"
                strokeWidth={1}
              />
              <div className="relative mt-6 flex items-center gap-3">
                <div
                  className="h-2 flex-1 overflow-hidden rounded-full bg-emerald-900/50"
                  role="progressbar"
                  aria-label="Unit progress"
                  aria-valuemin={0}
                  aria-valuemax={track.steps.length}
                  aria-valuenow={done}
                >
                  <div
                    className="h-full rounded-full bg-lime-300 transition-all motion-reduce:transition-none"
                    style={{ width: `${(done / track.steps.length) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold">
                  {done}/{track.steps.length} steps
                </span>
              </div>
            </div>
            <div className="px-5 py-7 sm:px-10">
              <div className="mb-5 flex items-center justify-between text-xs font-semibold text-neutral-400">
                <span>YOUR LEARNING PATH</span>
                <span>
                  {track.id === "coding"
                    ? "Write · Run · Improve"
                    : "Learn · Practice · Remember"}
                </span>
              </div>
              <ol className="relative mx-auto max-w-md space-y-1">
                {track.steps.map((step, index) => {
                  const complete = Boolean(progress.completed[step.id]);
                  const unlocked = stepIsUnlocked(progress, step.id);
                  const active = !complete && unlocked;
                  const Icon = complete
                    ? Check
                    : !unlocked
                      ? LockKeyhole
                      : step.kind === "coding"
                        ? Code2
                        : index === 0
                          ? Star
                          : Network;
                  return (
                    <li
                      key={step.id}
                      className={`relative flex items-center gap-5 py-5 ${index % 2 === 1 ? "ml-8 sm:ml-16" : ""}`}
                    >
                      {index < track.steps.length - 1 && (
                        <div
                          aria-hidden="true"
                          className={`absolute left-10 top-24 h-12 w-1 rounded bg-neutral-100 dark:bg-neutral-800 ${index % 2 === 1 ? "origin-top rotate-[28deg]" : "rotate-[-28deg]"}`}
                        />
                      )}
                      <button
                        id={`step-${step.id}`}
                        disabled={!ready || !unlocked}
                        onClick={() => begin(step)}
                        aria-label={`${complete ? "Review" : unlocked ? "Start" : "Locked"}: ${step.title}`}
                        aria-current={active ? "step" : undefined}
                        aria-describedby={`step-description-${step.id}`}
                        className={`relative z-10 grid h-[76px] w-[76px] shrink-0 place-items-center rounded-[28px] border-b-[7px] transition-transform enabled:hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300 motion-reduce:transition-none ${complete ? "border-amber-500 bg-amber-300 text-amber-950" : active ? "border-emerald-800 bg-emerald-500 text-white shadow-[0_0_0_7px_#ecfdf5] dark:shadow-[0_0_0_7px_#064e3b]" : "border-neutral-200 bg-neutral-100 text-neutral-400 dark:border-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-500"}`}
                      >
                        <Icon className="h-8 w-8" strokeWidth={2.5} />
                      </button>
                      <div className="min-w-0">
                        <p
                          className={`mb-1 text-[10px] font-bold uppercase tracking-widest ${active ? "text-emerald-700 dark:text-emerald-400" : "text-neutral-400"}`}
                        >
                          {complete
                            ? "Completed · practice again"
                            : active
                              ? "Up next"
                              : `Step ${index + 1}`}
                        </p>
                        <h3
                          className={`font-bold ${!unlocked ? "text-neutral-500" : "text-neutral-900 dark:text-neutral-100"}`}
                        >
                          {step.title}
                        </h3>
                        <p
                          id={`step-description-${step.id}`}
                          className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400"
                        >
                          {unlocked
                            ? `${step.minutes} min · ${complete ? "Skill review" : `+${STEP_XP} XP`}`
                            : `Complete “${track.steps[index - 1].title}” to unlock`}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 dark:border-neutral-700 dark:bg-neutral-800/40">
                <div className="flex items-start gap-3">
                  <Trophy
                    className={`mt-1 h-6 w-6 shrink-0 ${done === track.steps.length ? "text-amber-500" : "text-neutral-400"}`}
                  />
                  <div>
                    <h3 className="font-bold">
                      {done === track.steps.length
                        ? "Starter unit complete!"
                        : "A strong foundation starts here."}
                    </h3>
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                      {done === track.steps.length
                        ? "Try the other track, review a skill, or go deeper in the lesson library."
                        : `Finish these ${track.steps.length} steps to complete your first unit.`}
                    </p>
                  </div>
                </div>
                {next ? (
                  <button
                    disabled={!ready}
                    onClick={() => begin(next)}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-b-4 border-emerald-800 bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {done ? "Continue my path" : "Start my first step"}{" "}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      update((value) => ({
                        ...value,
                        track: track.id === "design" ? "coding" : "design",
                      }))
                    }
                    className="mt-4 text-sm font-bold text-emerald-700 underline underline-offset-4 dark:text-emerald-400"
                  >
                    Explore {track.id === "design" ? "coding" : "system design"}{" "}
                    →
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
        <aside className="space-y-5">
          <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3">
            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950/30">
              <Flame className="mb-2 h-6 w-6 text-orange-500" />
              <p className="text-2xl font-extrabold">
                {ready ? pathStreak(progress, today) : "—"}
              </p>
              <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                day streak
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
              <Zap className="mb-2 h-6 w-6 text-amber-500" />
              <p className="text-2xl font-extrabold">
                {ready ? completedCount * STEP_XP : "—"}
              </p>
              <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                path XP earned
              </p>
            </div>
          </div>
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-emerald-600" />
              <h2 className="font-bold">Your daily goal</h2>
            </div>
            <label
              htmlFor="daily-goal"
              className="mb-2 block text-xs text-neutral-500 dark:text-neutral-400"
            >
              Make it manageable
            </label>
            <select
              id="daily-goal"
              value={progress.dailyGoal}
              disabled={!ready}
              onChange={(event) => {
                const goal = Number(event.target.value) as 1 | 2 | 3;
                update((value) => ({ ...value, dailyGoal: goal }));
              }}
              className="mb-5 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            >
              <option value={1}>Casual · 1 step a day</option>
              <option value={2}>Steady · 2 steps a day</option>
              <option value={3}>Focused · 3 steps a day</option>
            </select>
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-semibold">
                {goalMet ? "Goal complete!" : "A small win for today"}
              </span>
              <span>
                {Math.min(dailyCount, progress.dailyGoal)}/{progress.dailyGoal}
              </span>
            </div>
            <div
              className="h-3 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"
              role="progressbar"
              aria-label="Daily goal"
              aria-valuemin={0}
              aria-valuemax={progress.dailyGoal}
              aria-valuenow={Math.min(dailyCount, progress.dailyGoal)}
            >
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{
                  width: `${Math.min(dailyCount / progress.dailyGoal, 1) * 100}%`,
                }}
              />
            </div>
            <div
              className="mt-5 flex justify-between"
              aria-label="Activity in the last seven days"
            >
              {today &&
                Array.from({ length: 7 }, (_, index) => {
                  const day = shiftDay(today, index - 6);
                  const active = Boolean(progress.activity[day]?.length);
                  const date = new Date(`${day}T12:00:00`);
                  return (
                    <div
                      key={day}
                      title={`${day}: ${active ? "practiced" : "no practice"}`}
                      className="text-center"
                    >
                      <span className="text-[10px] text-neutral-500">
                        {date.toLocaleDateString("en", { weekday: "narrow" })}
                      </span>
                      <div
                        className={`mt-1 grid h-7 w-7 place-items-center rounded-full ${active ? "bg-emerald-500 text-white" : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800"} ${day === today ? "ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-neutral-900" : ""}`}
                      >
                        <span className="sr-only">
                          {day}: {active ? "practiced" : "no practice"}
                        </span>
                        {active ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <span aria-hidden="true" className="text-[10px]">
                            {date.getDate()}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
            <p className="mt-5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
              A completed step or skill review keeps your streak going. Each
              step counts once a day.
            </p>
          </section>
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-3 flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-sky-600" />
              <h2 className="font-bold">Keep it fresh</h2>
              {due.length > 0 && (
                <span className="ml-auto rounded-full bg-sky-100 px-2 py-1 text-xs font-bold text-sky-800">
                  {due.length} due
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
              {due.length
                ? "A quick practice will help these concepts stick."
                : completedCount
                  ? "You’re all caught up. Your first reviews return the day after you complete a step."
                  : "Completed skills return here for a quick review, just when you need them."}
            </p>
            {due.map((step) => (
              <button
                key={step.id}
                onClick={() => begin(step)}
                className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl bg-sky-50 p-3 text-left text-sm font-semibold text-sky-800 hover:bg-sky-100 dark:bg-sky-950 dark:text-sky-200"
              >
                {step.title}
                <ArrowRight className="h-4 w-4 shrink-0" />
              </button>
            ))}
          </section>
          <p
            className="px-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400"
            role="status"
          >
            {storageAvailable
              ? "Daily-path progress and coding drafts are saved in this browser. Path XP is separate from your account XP."
              : "Browser storage is unavailable. Your progress will last for this visit only."}
          </p>
        </aside>
      </div>
      <section className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-neutral-400" />
          <div>
            <h2 className="font-bold">
              Curiosity doesn’t have to follow a path.
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Explore the full lessons, architecture tools, and practice
              problems.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
          <Link href="/fundamentals" className="hover:underline">
            Lesson library →
          </Link>
          <Link href="/practice" className="hover:underline">
            Design practice →
          </Link>
          <Link href="/roadmap" className="hover:underline">
            Product roadmap →
          </Link>
        </div>
      </section>
      {session && (
        <LearningSession
          key={session.id}
          step={session}
          mastered={Boolean(progress.completed[session.id])}
          onClose={() => setSession(null)}
          onComplete={() =>
            update((value) => completePathStep(value, session.id))
          }
        />
      )}
    </div>
  );
}
