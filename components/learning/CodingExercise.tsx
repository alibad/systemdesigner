"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, Play, RotateCcw } from "lucide-react";
import { runCode, type CodeRunResult } from "@/lib/coding-runner";
import type { CodingStep } from "@/lib/learning-path";
import { MAX_DRAFT_LENGTH } from "@/lib/daily-learning-data";
import { learningAssetUrl } from "@/lib/learning-assets";

export default function CodingExercise({
  step,
  onPass,
  draft,
  onDraftChange,
  onAttempt,
  allowHints = true,
  history = [],
}: {
  history?: { value: string; updatedAt: number }[];
  step: CodingStep;
  onPass: () => void;
  draft?: string;
  onDraftChange: (value: string) => void;
  onAttempt?: (result: { correct: boolean; hinted: boolean }) => void;
  allowHints?: boolean;
}) {
  const [code, setCode] = useState("");
  const [starter, setStarter] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [running, setRunning] = useState(false);
  const [hint, setHint] = useState(false);
  const usedHint = useRef(false);
  const [result, setResult] = useState<CodeRunResult | null>(null);
  const controller = useRef<AbortController | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setLoadError(false);
    fetch(learningAssetUrl(step.starterFile, step.revision), {
      signal: abort.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load starter code");
        return response.text();
      })
      .then((source) => {
        setStarter(source);
        setCode(draftRef.current ?? source);
        setLoading(false);
      })
      .catch(() => {
        if (!abort.signal.aborted) {
          setLoadError(true);
          setLoading(false);
        }
      });
    return () => {
      abort.abort();
      controller.current?.abort();
    };
  }, [retry, step.starterFile, step.revision]);

  useEffect(() => {
    if (draft !== undefined) {
      controller.current?.abort();
      setRunning(false);
      setCode(draft);
      setResult(null);
    }
  }, [draft]);

  const edit = (value: string) => {
    controller.current?.abort();
    setRunning(false);
    setCode(value);
    setResult(null);
    onDraftChange(value);
  };
  const run = async () => {
    if (running) return;
    setRunning(true);
    setResult(null);
    const abort = new AbortController();
    controller.current = abort;
    const outcome = await runCode(code, step, abort.signal);
    if (!abort.signal.aborted && controller.current === abort) {
      setResult(outcome);
      setRunning(false);
      onAttempt?.({
        correct:
          outcome.results.length === step.tests.length &&
          outcome.results.every((test) => test.passed),
        hinted: usedHint.current,
      });
    }
  };
  const passed =
    result?.results.length === step.tests.length &&
    result.results.every((test) => test.passed);

  if (loading) return <p role="status">Loading your coding exercise…</p>;
  if (loadError)
    return (
      <div role="alert">
        Couldn’t load the exercise.{" "}
        <button
          className="underline"
          onClick={() => setRetry((value) => value + 1)}
        >
          Try again
        </button>
      </div>
    );

  return (
    <div className="space-y-5">
      <details
        open
        className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700"
      >
        <summary className="cursor-pointer text-sm font-semibold">
          Requirements
        </summary>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
          {step.instruction}
        </p>
      </details>
      <div className="overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-950">
        <div className="flex items-center justify-between border-b border-neutral-700 px-4 py-3 text-xs text-neutral-300">
          <label htmlFor="daily-code">JavaScript · {step.functionName}</label>
          <button
            onClick={() => edit(starter)}
            disabled={running}
            className="flex items-center gap-1 hover:text-white"
          >
            <RotateCcw className="h-3 w-3" /> Reset code
          </button>
        </div>
        <textarea
          maxLength={MAX_DRAFT_LENGTH}
          id="daily-code"
          aria-describedby="code-editor-help"
          value={code}
          onChange={(event) => edit(event.target.value)}
          disabled={running}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          wrap="off"
          className="min-h-[280px] w-full resize-y overflow-auto bg-neutral-950 p-4 font-mono text-sm leading-7 text-emerald-200 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400"
        />
      </div>
      {allowHints && history.some((entry) => entry.value !== code) && (
        <details className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
          <summary className="min-h-11 cursor-pointer text-sm font-semibold">
            Recent code versions
          </summary>
          <p className="mb-3 text-xs text-neutral-500">
            Recover a recent edit, including alternatives kept when devices
            sync.
          </p>
          {history
            .filter((entry) => entry.value !== code)
            .map((entry) => (
              <div
                key={`${entry.updatedAt}:${entry.value}`}
                className="mb-4 border-t pt-3"
              >
                <p className="text-xs text-neutral-500">
                  {new Date(entry.updatedAt).toLocaleString()}
                </p>
                <pre className="my-2 max-h-40 overflow-auto rounded-lg bg-neutral-100 p-3 text-xs dark:bg-neutral-800">
                  <code>{entry.value}</code>
                </pre>
                <button
                  className="min-h-11 text-sm font-semibold underline"
                  disabled={running}
                  onClick={() => edit(entry.value)}
                >
                  Restore this version
                </button>
              </div>
            ))}
        </details>
      )}
      <p
        id="code-editor-help"
        className="text-xs text-neutral-500 dark:text-neutral-400"
      >
        Edit the function, then run the tests. Tab moves to the next control.
      </p>
      <div className="flex items-center justify-between gap-3">
        {allowHints && (
          <button
            className="text-sm font-semibold underline underline-offset-4"
            aria-expanded={hint}
            onClick={() => {
              setHint(!hint);
              if (!hint) {
                usedHint.current = true;
                onAttempt?.({ correct: true, hinted: true });
              }
            }}
          >
            {hint ? "Hide hint" : "Need a hint?"}
          </button>
        )}
        <div className="learning-actions">
          <button
            onClick={passed ? onPass : run}
            disabled={running || !code.trim()}
            className="inline-flex items-center gap-2 rounded-xl border-b-4 border-emerald-800 bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            {passed
              ? "All tests passed · Complete step"
              : running
                ? "Running…"
                : "Run tests"}
          </button>
        </div>
      </div>
      {hint && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {step.hint}
        </p>
      )}
      <div aria-live="polite">
        {result?.error && (
          <p
            role="alert"
            className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200"
          >
            {result.error}
          </p>
        )}
        <ul className="space-y-2">
          {step.tests.map((test, index) => {
            const outcome = result?.results[index];
            return (
              <li
                key={test.label}
                className="rounded-xl border border-neutral-200 p-3 text-sm dark:border-neutral-700"
              >
                <div className="flex items-center gap-2">
                  {outcome?.passed ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-neutral-400" />
                  )}
                  <span>{test.label}</span>
                  <span className="ml-auto text-xs">
                    {outcome
                      ? outcome.passed
                        ? "Passed"
                        : "Try again"
                      : "Not run"}
                  </span>
                </div>
                {outcome && !outcome.passed && (
                  <p className="mt-2 break-words font-mono text-xs text-rose-700 dark:text-rose-300">
                    Expected {outcome.expected}; got {outcome.actual}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
