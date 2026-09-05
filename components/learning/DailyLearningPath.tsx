"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Flame,
  GraduationCap,
  Layers3,
  LockKeyhole,
  RotateCcw,
  Settings2,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDailyLearning } from "@/hooks/useDailyLearning";
import {
  ALL_STEPS,
  completePathStep,
  LEARNING_TRACKS,
  pathStreak,
  shiftDay,
  STEP_XP,
  stepIsUnlocked,
  unitForStep,
  unitIsUnlocked,
  unitIsPlaced,
  unitIsSatisfied,
  stepIsSatisfied,
  type LearningStep,
  type TrackId,
} from "@/lib/learning-path";
import LearningSessionLoader from "./LearningSessionLoader";
import LearningProgressControls from "./LearningProgressControls";
import PlacementTest from "./PlacementTest";
import AdaptiveReviewPanel from "./AdaptiveReviewPanel";
import FirstMonth from "./FirstMonth";
import LearningInstall, { useLearningInstall } from "./LearningInstall";
import {
  currentJourneyDay,
  journeyTaskDone,
  type JourneyDay,
} from "@/lib/learning-journey";
import { adaptiveReviewQueue } from "@/lib/learning-evidence";

const courseIcons = {
  design: Layers3,
  coding: Code2,
  genai: Sparkles,
  ml: BrainCircuit,
};
const menuClass =
  "min-w-[260px] rounded-2xl border-neutral-200 bg-white p-2 shadow-xl dark:border-neutral-700 dark:bg-neutral-900";
const optionClass =
  "cursor-pointer rounded-xl py-3 pl-9 pr-4 focus:bg-neutral-100 dark:focus:bg-neutral-800";

export default function DailyLearningPath() {
  const learning = useDailyLearning();
  const installState = useLearningInstall();
  const { progress, ready, today, update, owner } = learning;
  const [session, setSession] = useState<LearningStep | null>(null);
  const [sessionOwner, setSessionOwner] = useState<string | null>();
  const [sessionReview, setSessionReview] = useState(0);
  const [settings, setSettings] = useState(false);
  const [placement, setPlacement] = useState(false);
  const [tab, setTab] = useState<"today" | "path" | "review">("today");
  const [sessionDay, setSessionDay] = useState<JourneyDay>();
  const [expanded, setExpanded] = useState("");
  const course = LEARNING_TRACKS.find((item) => item.id === progress.track)!;
  const next = course.steps.find(
    (step) =>
      !stepIsSatisfied(progress, step) && stepIsUnlocked(progress, step.id),
  );
  const currentUnit = next ? unitForStep(next.id)! : course.units.at(-1)!;
  const completed = course.steps.filter(
    (step) => progress.completed[step.id],
  ).length;
  const completedUnits = course.units.filter((unit) =>
    unitIsSatisfied(progress, unit),
  ).length;
  const currentIndex = course.units.findIndex(
    (unit) => unit.id === currentUnit.id,
  );
  const due = today ? adaptiveReviewQueue(progress, today) : [];
  const placedUnits = course.units.filter((unit) =>
    unitIsPlaced(progress, unit),
  ).length;
  const covered = course.steps.filter((step) =>
    stepIsSatisfied(progress, step),
  ).length;
  const dailyCount = progress.activity[today]?.length || 0;
  const totalCompleted = Object.keys(progress.completed).length;
  const Icon = courseIcons[course.id];
  const visibleUnit = expanded || currentUnit.id;
  const previousOwner = useRef(owner);
  useEffect(() => {
    const prior = previousOwner.current;
    previousOwner.current = owner;
    // Initial hydration must not undo navigation the learner has just chosen.
    if (prior === undefined) return;
    setSession(null);
    setSettings(false);
    setPlacement(false);
    setSessionDay(undefined);
    setTab("today");
  }, [owner]);
  useEffect(() => {
    setExpanded("");
  }, [course.id]);
  useEffect(() => {
    if (ready && learning.data.journey.enrollment.value === "courses")
      setTab("path");
  }, [ready, owner, learning.data.journey.enrollment.value]);

  function begin(step: LearningStep, day?: JourneyDay) {
    if (!ready || !stepIsUnlocked(progress, step.id)) return;
    const target = LEARNING_TRACKS.find((item) =>
      item.steps.some((candidate) => candidate.id === step.id),
    )!;
    if (target.id !== course.id)
      update((value) => ({ ...value, track: target.id }));
    setExpanded(unitForStep(step.id)!.id);
    setSessionReview(
      Math.max(
        progress.completed[step.id]
          ? progress.completed[step.id].reviews + 1
          : 0,
        ...step.skillIds.map(
          (id) => progress.skillReview?.[id]?.practiceDays || 0,
        ),
      ),
    );
    setSessionDay(day);
    setSession(step);
    setSessionOwner(owner);
  }

  return (
    <div
      className={`learning-shell learning-view-${tab} mx-auto max-w-6xl pb-28 pt-5 sm:pb-12 sm:pt-8`}
    >
      {tab !== "today" && (
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3 sm:mb-8">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[.16em] text-neutral-400">
              A LITTLE PROGRESS, EVERY DAY
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
              Learn by doing.
            </h1>
          </div>
          <div className="flex items-center gap-5">
            <span
              className="flex items-center gap-1.5 text-sm font-semibold"
              title="Consecutive days with successful practice"
            >
              <Flame className="h-5 w-5 text-orange-500" />
              {today ? pathStreak(progress, today) : 0}
              <span className="font-normal text-neutral-500">day streak</span>
            </span>
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <Zap className="h-4 w-4 text-amber-500" />
              {totalCompleted * STEP_XP}
              <span className="font-normal text-neutral-500">XP</span>
            </span>
            <button
              onClick={() => setSettings(true)}
              aria-label="Learning settings"
              className="rounded-xl p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:bg-neutral-800 dark:hover:text-white"
            >
              <Settings2 className="h-5 w-5" />
            </button>
          </div>
        </header>
      )}

      <div className="learning-navigation mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              disabled={!ready}
              aria-label="Choose course"
              className={`course-picker group items-center gap-3 rounded-xl pr-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${tab === "today" ? "hidden sm:flex" : "flex"}`}
            >
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
                <Icon className="h-6 w-6 text-emerald-700 dark:text-emerald-400" />
              </span>
              <span>
                <span className="flex items-center gap-2 text-lg font-semibold">
                  {course.title}
                  <ChevronDown className="h-4 w-4 text-neutral-400 transition-transform group-data-[state=open]:rotate-180" />
                </span>
                <span className="mt-0.5 block text-xs text-neutral-500">
                  {course.units.length} units · {course.steps.length} sessions
                </span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={12}
            className={`${menuClass} w-[min(360px,calc(100vw-2rem))]`}
          >
            <DropdownMenuLabel className="px-3 pb-2 pt-1 text-xs font-medium text-neutral-500">
              Your courses
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={course.id}
              onValueChange={(value) => {
                update((state) => ({ ...state, track: value as TrackId }));
                setTab("path");
              }}
            >
              {LEARNING_TRACKS.map((item) => {
                const CourseIcon = courseIcons[item.id];
                return (
                  <DropdownMenuRadioItem
                    key={item.id}
                    value={item.id}
                    className={optionClass}
                  >
                    <span className="flex items-center gap-3">
                      <CourseIcon className="h-5 w-5 shrink-0 text-neutral-500" />
                      <span>
                        <span className="block text-sm font-semibold">
                          {item.title}
                        </span>
                        <span className="mt-1 block text-xs text-neutral-500">
                          {item.units.length} units · {item.steps.length}{" "}
                          sessions
                        </span>
                      </span>
                    </span>
                  </DropdownMenuRadioItem>
                );
              })}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator className="my-2" />
            <p className="px-3 py-1 text-xs text-neutral-500">
              {ALL_STEPS.length} learning sessions. Pick your direction.
            </p>
          </DropdownMenuContent>
        </DropdownMenu>
        <div
          role="tablist"
          aria-label="Learning views"
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            const tabs = ["today", "path", "review"] as const;
            const value =
              event.key === "Home"
                ? tabs[0]
                : event.key === "End"
                  ? tabs[2]
                  : tabs[
                      (tabs.indexOf(tab) +
                        (event.key === "ArrowRight" ? 1 : 2)) %
                        3
                    ];
            setTab(value);
            document.getElementById(`tab-${value}`)?.focus();
          }}
          className="learning-tabs fixed inset-x-0 bottom-0 z-40 flex justify-around gap-1 border-t border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-950 sm:static sm:rounded-xl sm:border-0 sm:bg-neutral-100 sm:p-1 sm:dark:bg-neutral-900"
        >
          {(
            [
              ["today", "Learn"],
              ["path", "Courses"],
              ["review", "Practice"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              disabled={!ready}
              tabIndex={tab === id ? 0 : -1}
              aria-selected={tab === id}
              aria-controls={`learning-${id}`}
              id={`tab-${id}`}
              onClick={() => setTab(id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === id ? "bg-white text-neutral-950 shadow-sm dark:bg-neutral-800 dark:text-white" : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"}`}
            >
              {id === "today" ? (
                <BookOpen className="h-5 w-5" />
              ) : id === "path" ? (
                <Layers3 className="h-5 w-5" />
              ) : (
                <RotateCcw className="h-5 w-5" />
              )}
              <span>{label}</span>
              {id === "review" && due.length > 0 && (
                <span className="ml-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                  {due.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {!learning.storageAvailable && (
        <p
          role="alert"
          className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          Browser storage is unavailable. Open learning settings to save a
          backup before leaving.
        </p>
      )}

      <div
        className={
          tab === "today"
            ? "mx-auto max-w-xl"
            : "grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_272px]"
        }
      >
        <div className="min-w-0">
          {tab === "today" ? (
            <FirstMonth
              learning={learning}
              begin={begin}
              onSettings={() => setSettings(true)}
              onCourses={() => setTab("path")}
              onPlacement={() => {
                update((value) => ({ ...value, track: "design" }));
                setPlacement(true);
              }}
            />
          ) : tab === "path" ? (
            <div role="tabpanel" id="learning-path" aria-labelledby="tab-path">
              <section className="relative mb-8 overflow-hidden rounded-3xl border border-emerald-200 bg-emerald-50/70 p-6 dark:border-emerald-900 dark:bg-emerald-950/30 sm:p-7">
                <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.13em] text-emerald-700 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {next
                    ? `UP NEXT · UNIT ${currentIndex + 1} OF ${course.units.length}`
                    : "COURSE COMPLETE"}
                </p>
                <h2 className="text-2xl font-semibold tracking-tight">
                  {next
                    ? currentUnit.title
                    : placedUnits
                      ? `You covered ${course.title}.`
                      : `You completed ${course.title}.`}
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                  {next
                    ? currentUnit.description
                    : "Review your skills or choose another course to keep building."}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-4">
                  {next ? (
                    <button
                      disabled={!ready}
                      onClick={() => begin(next)}
                      className="inline-flex min-h-11 items-center gap-3 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:opacity-50 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
                    >
                      {covered ? "Continue learning" : "Start learning"}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => setTab("review")}
                      className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white"
                    >
                      Review your skills
                    </button>
                  )}
                  {next && (
                    <span className="text-xs text-neutral-500">
                      {next.title}
                      <span className="mx-2">·</span>
                      {next.minutes} min
                    </span>
                  )}
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-emerald-200/70 pt-4 dark:border-emerald-900">
                  <span className="text-xs text-neutral-500">
                    Already have experience?
                  </span>
                  <button
                    disabled={!ready}
                    onClick={() => setPlacement(true)}
                    className="rounded-lg px-2 py-1 text-xs font-semibold text-emerald-800 underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-300"
                  >
                    Take placement test
                  </button>
                </div>
              </section>

              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Course content</h2>
                  <p className="mt-1 text-xs text-neutral-500">
                    A clear path from foundations to complete systems.
                  </p>
                </div>
                <span className="shrink-0 text-xs text-neutral-500">
                  {completedUnits} / {course.units.length} units
                </span>
              </div>
              <ol className="space-y-3" aria-label={`${course.title} units`}>
                {course.units.map((unit, index) => {
                  const done = unitIsSatisfied(progress, unit);
                  const placed = unitIsPlaced(progress, unit);
                  const unlocked = unitIsUnlocked(progress, unit);
                  const count = unit.steps.filter(
                    (step) => progress.completed[step.id],
                  ).length;
                  const open = visibleUnit === unit.id;
                  return (
                    <li
                      key={unit.id}
                      className={`overflow-hidden rounded-2xl border bg-white dark:bg-neutral-900/40 ${open ? "border-neutral-300 dark:border-neutral-600" : "border-neutral-200 dark:border-neutral-800"}`}
                    >
                      <button
                        aria-expanded={open}
                        aria-controls={`unit-content-${unit.id}`}
                        onClick={() =>
                          setExpanded(open ? "collapsed" : unit.id)
                        }
                        className="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 dark:hover:bg-neutral-900 sm:px-5"
                      >
                        <span
                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-semibold ${done ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : open ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"}`}
                        >
                          {done ? (
                            <Check className="h-5 w-5" />
                          ) : (
                            String(index + 1).padStart(2, "0")
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold sm:text-base">
                            {unit.title}
                          </span>
                          <span className="mt-1 block text-xs text-neutral-500">
                            {unit.steps.length - 1}{" "}
                            {course.id === "coding" ? "exercises" : "lessons"} ·{" "}
                            {course.id === "coding"
                              ? "1 coding project"
                              : "1 checkpoint"}
                            {placed
                              ? " · Placed out"
                              : count > 0
                                ? ` · ${count}/${unit.steps.length} complete`
                                : ""}
                          </span>
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
                        />
                      </button>
                      {open && (
                        <div
                          id={`unit-content-${unit.id}`}
                          className="border-t border-neutral-100 px-4 pb-4 pt-3 dark:border-neutral-800 sm:px-5"
                        >
                          <p className="mb-4 text-xs leading-5 text-neutral-500">
                            {unit.description}
                            {!unlocked && !done && (
                              <span className="mt-1 block">
                                Complete the previous unit to unlock these
                                sessions. You can explore the full lessons at
                                any time.
                              </span>
                            )}
                          </p>
                          <ol className="space-y-1">
                            {unit.steps.map((step, stepIndex) => {
                              const complete = Boolean(
                                progress.completed[step.id],
                              );
                              const canStart = stepIsUnlocked(
                                progress,
                                step.id,
                              );
                              const active = next?.id === step.id;
                              const StepIcon = complete
                                ? Check
                                : !canStart
                                  ? LockKeyhole
                                  : step.isCheckpoint
                                    ? Trophy
                                    : step.kind === "coding"
                                      ? Code2
                                      : BookOpen;
                              return (
                                <li
                                  key={step.id}
                                  className={`relative flex items-center gap-3 rounded-xl px-3 py-3 ${active ? "bg-emerald-50 dark:bg-emerald-950/50" : ""}`}
                                >
                                  {stepIndex < unit.steps.length - 1 && (
                                    <span
                                      aria-hidden
                                      className="absolute left-[27px] top-11 h-6 w-px bg-neutral-200 dark:bg-neutral-700"
                                    />
                                  )}
                                  <span
                                    className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ${complete ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" : active ? "bg-emerald-600 text-white" : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800"}`}
                                  >
                                    <StepIcon className="h-4 w-4" />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span
                                      className={`block text-sm font-medium ${canStart ? "" : "text-neutral-500"}`}
                                    >
                                      {step.isCheckpoint
                                        ? course.id === "coding"
                                          ? `Project: ${step.title}`
                                          : "Unit checkpoint"
                                        : step.title}
                                    </span>
                                    <span className="mt-0.5 block text-[11px] text-neutral-400">
                                      {step.minutes} min
                                      {complete
                                        ? " · Completed"
                                        : placed
                                          ? " · Placed out"
                                          : step.isCheckpoint
                                            ? " · Put it together"
                                            : step.kind === "coding"
                                              ? " · Write and run code"
                                              : step.hasExercises
                                                ? " · Interactive practice"
                                                : " · Learn and practice"}
                                    </span>
                                  </span>
                                  {canStart ? (
                                    <button
                                      id={`step-${step.id}`}
                                      disabled={!ready}
                                      onClick={() => begin(step)}
                                      aria-label={`${complete || placed ? "Review" : "Start"}: ${step.title}`}
                                      className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 ${active ? "bg-emerald-600 text-white hover:bg-emerald-700" : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
                                    >
                                      {complete ? (
                                        <RotateCcw className="h-4 w-4" />
                                      ) : (
                                        "Start"
                                      )}
                                    </button>
                                  ) : (
                                    <Link
                                      href={step.lessonPath as Route}
                                      aria-label={`Explore lesson: ${step.title}`}
                                      title="Explore the full lesson"
                                      className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
                                    >
                                      <ArrowUpRight className="h-4 w-4" />
                                    </Link>
                                  )}
                                </li>
                              );
                            })}
                          </ol>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : (
            <AdaptiveReviewPanel
              progress={progress}
              today={today}
              begin={(step) => begin(step)}
              onBack={() => setTab("path")}
            />
          )}
        </div>

        <aside
          className={`${tab === "today" ? "hidden" : ""} space-y-6 lg:sticky lg:top-24`}
        >
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900/40">
            <h2 className="text-sm font-semibold">Your week</h2>
            <div className="my-5 grid grid-cols-7 gap-1">
              {Array.from({ length: 7 }, (_, i) => {
                if (!today) return <div key={i} className="h-12" />;
                const weekday =
                  (new Date(`${today}T12:00:00`).getDay() + 6) % 7;
                const date = shiftDay(today, i - weekday);
                const practiced = Boolean(progress.activity[date]?.length);
                return (
                  <div key={date} className="text-center">
                    <span className="mb-2 block text-[10px] font-medium text-neutral-400">
                      {["M", "T", "W", "T", "F", "S", "S"][i]}
                    </span>
                    <span
                      aria-label={`${date}${practiced ? ": practiced" : date === today ? ": today" : ": no practice"}`}
                      className={`mx-auto grid h-7 w-7 place-items-center rounded-full text-xs ${practiced ? "bg-emerald-600 text-white" : date === today ? "border-2 border-emerald-500 font-semibold text-emerald-700 dark:text-emerald-400" : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800"}`}
                    >
                      {practiced ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        Number(date.slice(-2))
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mb-2 flex justify-between text-xs">
              <span className="text-neutral-500">Today’s goal</span>
              <span className="font-medium">
                {Math.min(dailyCount, progress.dailyGoal)} /{" "}
                {progress.dailyGoal}
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"
              role="progressbar"
              aria-label="Daily goal"
              aria-valuemin={0}
              aria-valuemax={progress.dailyGoal}
              aria-valuenow={Math.min(dailyCount, progress.dailyGoal)}
            >
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{
                  width: `${Math.min(100, (dailyCount / progress.dailyGoal) * 100)}%`,
                }}
              />
            </div>
            {dailyCount >= progress.dailyGoal && (
              <p className="mt-3 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Daily goal complete.
              </p>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  disabled={!ready}
                  aria-label="Change daily goal"
                  className="mt-5 flex w-full items-center justify-between rounded-xl border border-neutral-200 px-3 py-2.5 text-xs font-medium hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  {progress.dailyGoal}{" "}
                  {progress.dailyGoal === 1 ? "session" : "sessions"} a day
                  <ChevronDown className="h-4 w-4 text-neutral-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className={menuClass}
              >
                <DropdownMenuLabel className="px-3 text-xs font-medium text-neutral-500">
                  Daily learning goal
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={String(progress.dailyGoal)}
                  onValueChange={(value) =>
                    update((state) => ({
                      ...state,
                      dailyGoal: Number(value) as 1 | 2 | 3,
                    }))
                  }
                >
                  {[1, 2, 3].map((goal) => (
                    <DropdownMenuRadioItem
                      key={goal}
                      value={String(goal)}
                      className={optionClass}
                    >
                      <span>
                        <span className="block text-sm font-medium">
                          {goal} {goal === 1 ? "session" : "sessions"} a day
                        </span>
                        <span className="mt-1 block text-xs text-neutral-500">
                          {
                            [
                              "A small daily step.",
                              "Build steady momentum.",
                              "Make more time to practice.",
                            ][goal - 1]
                          }
                        </span>
                      </span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </section>
          <section className="px-1">
            <h2 className="mb-3 text-sm font-semibold">Your progress</h2>
            <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
              <span>{course.title}</span>
              <span>{Math.round((covered / course.steps.length) * 100)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${(covered / course.steps.length) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-neutral-400">
              {completed} of {course.steps.length} sessions practiced
              {placedUnits > 0
                ? ` · ${placedUnits} ${placedUnits === 1 ? "unit" : "units"} placed out`
                : ""}
            </p>
            <p className="mt-4 text-xs leading-5 text-neutral-500">
              Finish a unit or demonstrate its skills in placement to unlock the
              next part of your course.
            </p>
          </section>
          <div className="border-t border-neutral-200 pt-5 dark:border-neutral-800">
            <Link
              href="/fundamentals"
              className="flex items-center justify-between text-sm font-medium text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
            >
              <span className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Explore the full library
              </span>
              <ChevronRight className="h-4 w-4" />
            </Link>
            <p className="mt-2 text-xs leading-5 text-neutral-400">
              Go deeper with interactive labs, architecture tools, and worked
              examples.
            </p>
          </div>
        </aside>
      </div>

      {placement && ready && (
        <PlacementTest
          key={`${owner}:${course.id}`}
          courseId={course.id}
          learning={learning}
          onClose={() => setPlacement(false)}
          onStart={(unit) => {
            setPlacement(false);
            setTab("path");
            setExpanded(unit.id);
            const step =
              unit.steps.find(
                (step) =>
                  !progress.completed[step.id] &&
                  stepIsUnlocked(progress, step.id),
              ) || unit.steps[0];
            begin(step);
          }}
        />
      )}
      {settings && (
        <Dialog open onOpenChange={setSettings}>
          <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl bg-white dark:bg-neutral-900">
            <DialogTitle>Learning settings</DialogTitle>
            <DialogDescription>
              Manage your account sync and saved progress.
            </DialogDescription>
            <LearningInstall state={installState} />
            <LearningProgressControls
              key={owner ?? "guest"}
              learning={learning}
            />
            <Link
              href="/learn/my-plans"
              className="text-sm text-neutral-500 underline"
            >
              Custom learning plans
            </Link>
          </DialogContent>
        </Dialog>
      )}
      {session && ready && sessionOwner === owner && (
        <LearningSessionLoader
          key={`${owner}:${session.id}`}
          step={session}
          mastered={Boolean(progress.completed[session.id])}
          reviewNumber={sessionReview}
          draftHistory={learning.data.draftHistory[session.id]}
          savedSession={learning.data.sessions[session.id]?.value ?? undefined}
          onSaveSession={(value) => learning.saveSession(session.id, value)}
          draft={learning.data.drafts[session.id]?.value}
          onDraftChange={(value) => learning.saveDraft(session.id, value)}
          onClose={() => setSession(null)}
          onEvidence={learning.recordAttempt}
          onComplete={() => {
            update((value) => completePathStep(value, session.id));
            if (sessionDay)
              learning.finishJourneyTask(sessionDay.id, session.id);
          }}
          completionLabel={
            sessionDay
              ? `Study day ${sessionDay.number} · ${sessionDay.title}`
              : undefined
          }
          nextLessonTitle={
            sessionDay
              ? currentJourneyDay(progress, learning.data.journey)?.title
              : next?.title
          }
          onContinue={
            sessionDay
              ? (() => {
                  const active = currentJourneyDay(
                    progress,
                    learning.data.journey,
                  );
                  const nextId = sessionDay.stepIds.find(
                    (id) =>
                      id !== session.id &&
                      !journeyTaskDone(
                        progress,
                        learning.data.journey,
                        sessionDay,
                        id,
                      ),
                  );
                  return nextId && active?.id === sessionDay.id
                    ? () =>
                        begin(
                          ALL_STEPS.find((step) => step.id === nextId)!,
                          sessionDay,
                        )
                    : active && active.id !== sessionDay.id
                      ? () =>
                          begin(
                            ALL_STEPS.find(
                              (step) =>
                                step.id ===
                                (active.stepIds.find(
                                  (id) =>
                                    !journeyTaskDone(
                                      progress,
                                      learning.data.journey,
                                      active,
                                      id,
                                    ),
                                ) || active.stepIds[0]),
                            )!,
                            active,
                          )
                      : undefined;
                })()
              : next && next.id !== session.id
                ? () => begin(next)
                : undefined
          }
        />
      )}
    </div>
  );
}
