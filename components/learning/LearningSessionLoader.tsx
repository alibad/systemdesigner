"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PracticeStepSchema,
  type LearningStep,
  type PracticeStep,
} from "@/lib/learning-path";
import LearningSession from "./LearningSession";
import { learningAssetUrl } from "@/lib/learning-assets";

export default function LearningSessionLoader({
  step,
  ...props
}: Omit<React.ComponentProps<typeof LearningSession>, "step"> & {
  step: LearningStep;
}) {
  const [detail, setDetail] = useState<PracticeStep | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    fetch(
      learningAssetUrl(
        `/api/learning/sessions/${encodeURIComponent(step.id)}`,
        step.revision,
      ),
      {
        signal: controller.signal,
      },
    )
      .then((response) => {
        if (!response.ok) throw new Error("Session unavailable");
        return response.json();
      })
      .then((data) => {
        const parsed = PracticeStepSchema.parse(data);
        if (parsed.id !== step.id || parsed.revision !== step.revision)
          throw new Error("The curriculum changed. Reload to continue.");
        if (!controller.signal.aborted) setDetail(parsed);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [step.id, step.revision, attempt]);
  if (detail) return <LearningSession step={detail} {...props} />;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent className="w-[calc(100%-2rem)] rounded-2xl bg-white dark:bg-neutral-900">
        <DialogTitle>{step.title}</DialogTitle>
        <DialogDescription>
          {error
            ? "This lesson couldn’t load. Connect and retry. If the course has changed, reload the page."
            : "Preparing your lesson…"}
        </DialogDescription>
        {error && (
          <button
            className="rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry loading lesson
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
