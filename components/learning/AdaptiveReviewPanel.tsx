"use client";

import { ArrowRight, Check, RotateCcw } from "lucide-react";
import { adaptiveReviewQueue } from "@/lib/learning-evidence";
import {
  ALL_SKILLS,
  unitForStep,
  type LearningStep,
  type PathProgress,
} from "@/lib/learning-path";

export default function AdaptiveReviewPanel({
  progress,
  today,
  begin,
  onBack,
}: {
  progress: PathProgress;
  today: string;
  begin: (step: LearningStep) => void;
  onBack: () => void;
}) {
  const due = today ? adaptiveReviewQueue(progress, today) : [];
  const states = Object.values(progress.skillReview || {});
  const nextDate = states
    .map((state) => state.reviewOn)
    .filter((day) => day > today)
    .sort()[0];
  const practiced = states.length || Object.keys(progress.completed).length;
  return (
    <section role="tabpanel" id="learning-review" aria-labelledby="tab-review">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Review your skills</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Mistakes return sooner. Successful recall earns longer gaps.
        </p>
      </div>
      {states.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          {(["needs-practice", "building", "strong"] as const).map(
            (status, index) => (
              <div
                key={status}
                className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800"
              >
                <p className="text-2xl font-semibold">
                  {states.filter((state) => state.status === status).length}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {
                    ["Needs practice", "Building recall", "Strong recall"][
                      index
                    ]
                  }
                </p>
              </div>
            ),
          )}
        </div>
      )}
      {due.length ? (
        <div className="space-y-3">
          {due.map(({ step, reason, status }) => (
            <button
              key={step.id}
              onClick={() => begin(step)}
              className="flex w-full items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-5 text-left hover:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <RotateCcw
                className={`h-5 w-5 shrink-0 ${status === "needs-practice" ? "text-amber-600" : "text-emerald-600"}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{step.title}</span>
                <span className="mt-1 block text-xs leading-5 text-neutral-500">
                  {reason}
                </span>
                <span className="mt-1 block text-xs text-neutral-400">
                  {unitForStep(step.id)?.title} · {step.minutes} min
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-neutral-400" />
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-8 dark:border-neutral-700">
          <Check className="mb-4 h-7 w-7 text-emerald-500" />
          <h3 className="font-semibold">
            {practiced ? "You’re up to date." : "Build a foundation first."}
          </h3>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            {nextDate
              ? `Your next recall check is ${new Date(`${nextDate}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}.`
              : practiced
                ? "Your skills will return here when they need another check."
                : "Complete a lesson or take placement to build your review plan."}
          </p>
          <button
            onClick={onBack}
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400"
          >
            Back to learning
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
      {states.length > 0 && (
        <details className="mt-6 text-sm text-neutral-500">
          <summary className="cursor-pointer font-medium">
            How your review plan changes
          </summary>
          <p className="mt-3 leading-6">
            An unsuccessful attempt returns for another try. A hint or a
            corrected mistake brings the next check closer. Correct recall on
            later days gradually extends the gap, up to 30 days. Repeating an
            exercise on the same day cannot raise its recall level.
          </p>
          <p className="mt-2 leading-6">
            This plan follows your recent practice across {ALL_SKILLS.length}{" "}
            course skills. “Strong recall” describes your recent results, not a
            professional certification.
          </p>
        </details>
      )}
    </section>
  );
}
