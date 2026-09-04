"use client";

import { useRef, useState } from "react";
import { Download, Upload, Cloud, HardDrive } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import SignInModal from "@/components/ui/SignInModal";
import type { useDailyLearning } from "@/hooks/useDailyLearning";
import {
  dailyProgress,
  importDailyLearning,
  MAX_BACKUP_BYTES,
  mergeDailyLearning,
  type DailyLearningData,
} from "@/lib/daily-learning-data";
import { ALL_STEPS, LEARNING_TRACKS, STEP_XP } from "@/lib/learning-path";
import { currentJourneyDay } from "@/lib/learning-journey";

const button =
  "rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800";

export default function LearningProgressControls({
  learning,
}: {
  learning: ReturnType<typeof useDailyLearning>;
}) {
  const [preview, setPreview] = useState<{
    data: DailyLearningData;
    guest: boolean;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [signIn, setSignIn] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const signedIn = learning.owner != null;
  const summary = preview ? dailyProgress(preview.data) : null;
  let merged = null;
  let mergedData: DailyLearningData | null = null;
  let mergeError = "";
  if (preview) {
    try {
      mergedData = mergeDailyLearning(learning.data, preview.data);
      merged = dailyProgress(mergedData);
    } catch {
      mergeError =
        "These progress files are too large to combine. Nothing was imported.";
    }
  }
  const newSteps = merged
    ? Object.keys(merged.completed).length -
      Object.keys(learning.progress.completed).length
    : 0;
  const status = {
    loading: "Loading your progress…",
    local: "Saved in this browser. Export a backup to take it with you.",
    syncing: "Syncing your progress…",
    saved: "Saved to your account.",
    offline: "Offline. Changes will sync when you reconnect.",
    error: "Account sync is paused. Your changes will retry automatically.",
  }[learning.status];

  function download() {
    try {
      const url = URL.createObjectURL(
        new Blob([learning.exportBackup()], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `systemdesigner-learning-${learning.today}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setMessage("Progress backup downloaded.");
      setError("");
    } catch {
      setError("Could not export progress. Please try again.");
    }
  }

  return (
    <section
      className="space-y-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800"
      aria-label="Save and restore progress"
    >
      <h2 className="flex items-center gap-2 font-bold">
        {signedIn ? (
          <Cloud className="h-4 w-4" />
        ) : (
          <HardDrive className="h-4 w-4" />
        )}
        Your progress
      </h2>
      {signedIn && (
        <p className="break-words text-xs text-neutral-500">
          {learning.accountName}
        </p>
      )}
      <p
        role="status"
        className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400"
      >
        {!learning.storageAvailable
          ? `Browser storage is unavailable. ${learning.status === "saved" ? "Your progress is saved to your account." : "Export a backup before leaving this visit."}`
          : status}
      </p>
      {signedIn && (
        <button
          type="button"
          onClick={learning.retry}
          className="text-xs font-semibold text-emerald-700 underline dark:text-emerald-400"
        >
          Sync now
        </button>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={button}
          disabled={!learning.ready}
          onClick={download}
        >
          <Download className="mr-1 inline h-4 w-4" />
          Export backup
        </button>
        <button
          type="button"
          className={button}
          disabled={!learning.ready}
          onClick={() => file.current?.click()}
        >
          <Upload className="mr-1 inline h-4 w-4" />
          Import backup
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          aria-label="Progress backup file"
          className="sr-only"
          onChange={async (event) => {
            const selected = event.target.files?.[0];
            event.target.value = "";
            setPreview(null);
            setError("");
            setMessage("");
            if (!selected) return;
            try {
              if (selected.size > MAX_BACKUP_BYTES)
                throw new Error(
                  "Choose a progress backup smaller than 750 KB.",
                );
              setPreview({
                data: importDailyLearning(await selected.text()),
                guest: false,
              });
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Could not read this backup.",
              );
            }
          }}
        />
      </div>
      {signedIn ? (
        <button
          type="button"
          className="text-left text-xs font-semibold text-emerald-700 underline dark:text-emerald-400"
          onClick={() => {
            try {
              const guest = learning.guestProgress();
              if (guest) {
                setPreview({ data: guest, guest: true });
                setError("");
                setMessage("");
              } else
                setMessage("There is no anonymous browser progress to add.");
            } catch {
              setError("Could not read browser progress.");
            }
          }}
        >
          Review anonymous browser progress
        </button>
      ) : (
        learning.accountSyncAvailable && (
          <button
            type="button"
            className="text-left text-xs font-semibold text-emerald-700 underline dark:text-emerald-400"
            onClick={() => setSignIn(true)}
          >
            Sign in to sync across devices
          </button>
        )
      )}
      <p className="text-xs leading-relaxed text-neutral-500">
        Path XP is separate from account XP. Anonymous browser progress is
        shared by people using this browser; account progress stays with that
        account.
      </p>
      {message && (
        <p
          role="status"
          className="text-xs text-emerald-700 dark:text-emerald-400"
        >
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      {mergeError && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {mergeError}
        </p>
      )}
      {preview && summary && merged && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setPreview(null);
          }}
        >
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <DialogTitle>
              {preview.guest
                ? "Add browser progress to this account?"
                : "Review progress backup"}
            </DialogTitle>
            <DialogDescription>
              Destination:{" "}
              {signedIn
                ? learning.accountName
                : "this browser’s anonymous learning path"}
              . Only continue if this is your learning data.
            </DialogDescription>
            <p className="text-sm">
              This backup contains {Object.keys(summary.completed).length}{" "}
              completed steps, {Object.keys(preview.data.placements).length}{" "}
              placed units, {Object.keys(preview.data.evidence).length} skill
              practice records, {Object.keys(summary.activity).length} practice
              days, {Object.keys(preview.data.drafts).length} coding drafts, and{" "}
              {Object.keys(preview.data.journey.tasks).length} study-day task
              completions.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {ALL_STEPS.filter(
                (step) =>
                  summary.completed[step.id] || preview.data.drafts[step.id],
              ).map((step) => (
                <li key={step.id}>
                  {step.title}
                  {summary.completed[step.id] ? " · completed" : ""}
                  {preview.data.drafts[step.id] ? " · coding draft" : ""}
                </li>
              ))}
            </ul>
            <p className="text-sm">
              Adds {newSteps} new completed steps ({newSteps * STEP_XP} path
              XP). Existing completions and practice days are kept. Reimporting
              the same backup adds no extra rewards.
            </p>
            <p className="text-sm">
              After merging: {merged.dailyGoal} step
              {merged.dailyGoal === 1 ? "" : "s"} per day,{" "}
              {
                LEARNING_TRACKS.find((course) => course.id === merged.track)
                  ?.title
              }{" "}
              track. Newer settings and coding drafts are kept.
            </p>
            {mergedData && (
              <p className="text-sm">
                Learning plan after merging:{" "}
                {mergedData.journey.enrollment.value === "guided"
                  ? `guided journey, ${currentJourneyDay(merged, mergedData.journey) ? `next study day ${currentJourneyDay(merged, mergedData.journey)!.number}` : "all study days complete"}`
                  : mergedData.journey.enrollment.value === "courses"
                    ? "explore courses"
                    : "choose a plan when ready"}
                . Completed review tasks are kept.
              </p>
            )}
            {Object.keys(preview.data.drafts).some(
              (id) =>
                learning.data.drafts[id] &&
                learning.data.drafts[id].value !==
                  preview.data.drafts[id].value,
            ) && (
              <p className="text-sm font-medium">
                Some coding drafts differ. Recent alternatives are kept in the
                exercise’s code versions. Export first to keep a complete copy.
              </p>
            )}
            {preview.guest && (
              <p className="text-sm">
                The anonymous browser copy will remain available when signed
                out. Account-only progress is never copied back to it.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={button}
                onClick={() => setPreview(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={button}
                onClick={() => {
                  try {
                    learning.importBackup(preview.data);
                    setPreview(null);
                    setError("");
                    setMessage(
                      "Progress imported. Your learning path is ready.",
                    );
                  } catch (cause) {
                    setPreview(null);
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "Could not import progress.",
                    );
                  }
                }}
              >
                Confirm import
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      <SignInModal isOpen={signIn} onClose={() => setSignIn(false)} />
    </section>
  );
}
