'use client';

import type { GradeResult } from '@/lib/challenges/types';

/**
 * Presentational scorecard for any GradeResult. Shows the deterministic score,
 * pass/fail, every rubric criterion with met/unmet + the learner-facing "why",
 * the optional (non-scoring) AI coaching note, and XP earned. No grading logic
 * lives here — it only renders what the server returned.
 */
export default function GradeResultCard({
  result,
  xpAwarded,
}: {
  result: GradeResult;
  xpAwarded?: number | null;
}) {
  const pct = Math.round(result.score * 100);
  const passed = result.passed;

  return (
    <div
      className={`rounded-2xl border p-5 ${
        passed
          ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/15'
          : 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/15'
      }`}
    >
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white ${
              passed ? 'bg-emerald-600' : 'bg-amber-600'
            }`}
            aria-label={`Score ${pct} percent`}
          >
            {pct}%
          </div>
          <div>
            <div
              className={`text-lg font-semibold ${
                passed
                  ? 'text-emerald-900 dark:text-emerald-100'
                  : 'text-amber-900 dark:text-amber-100'
              }`}
            >
              {passed ? 'Passed — design holds up' : 'Not yet — iterate and resubmit'}
            </div>
            <div className="text-xs text-neutral-600 dark:text-neutral-400">
              Attempt {result.attempt}
              {typeof xpAwarded === 'number' && xpAwarded > 0 && (
                <span className="ml-2 font-medium text-indigo-600 dark:text-indigo-400">
                  +{xpAwarded} XP
                </span>
              )}
              {typeof xpAwarded === 'number' && xpAwarded === 0 && passed && (
                <span className="ml-2 text-neutral-500">already mastered</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <ul className="space-y-2">
        {result.perCriterion.map((c) => (
          <li key={c.id} className="flex items-start gap-2 text-sm">
            <span aria-hidden className={c.met ? 'text-emerald-600' : 'text-neutral-400'}>
              {c.met ? '✓' : '○'}
            </span>
            <span>
              <span
                className={`font-medium ${
                  c.met
                    ? 'text-neutral-800 dark:text-neutral-200'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                {c.label}
              </span>
              <span className="text-neutral-500 dark:text-neutral-400"> — {c.why}</span>
            </span>
          </li>
        ))}
      </ul>

      {result.feedback && (
        <div className="mt-4 rounded-lg border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50 dark:bg-indigo-900/15 p-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
            Interviewer note
          </div>
          <p className="text-sm text-indigo-900 dark:text-indigo-100">{result.feedback}</p>
        </div>
      )}
    </div>
  );
}
