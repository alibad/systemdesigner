'use client';

/**
 * A trade-off decision where MORE THAN ONE option can be correct depending on the
 * stated constraint. The server grades fit-to-constraint, not a canonical answer —
 * directly attacking the #1 interview failure mode (regurgitating memorized
 * "right" architectures). Which options are acceptable lives server-side.
 */

import { useState } from 'react';
import { useChallenge } from '@/hooks/useChallenge';
import GradeResultCard from './GradeResultCard';

export interface TradeoffOptionView {
  id: string;
  label: string;
}

export default function TradeoffChallenge({
  challengeId,
  prompt,
  constraint,
  options,
  title = 'Trade-off Decision',
}: {
  challengeId: string;
  prompt: string;
  constraint?: string;
  options: TradeoffOptionView[];
  title?: string;
}) {
  const [choice, setChoice] = useState<string | null>(null);
  const { submit, submitting, result, xpAwarded, error } = useChallenge(challengeId, 'tradeoff');

  const handleSubmit = async () => {
    if (!choice) return;
    await submit({ answers: { choice } });
  };

  return (
    <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-6 my-8">
      <div className="flex items-center gap-2 mb-2">
        <span className="rounded-full bg-violet-100 dark:bg-violet-900/40 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
          Graded Challenge
        </span>
        <h3 className="text-xl font-bold text-neutral-900 dark:text-white">{title}</h3>
      </div>
      <p className="text-sm text-neutral-700 dark:text-neutral-300">{prompt}</p>
      {constraint && (
        <p className="mt-2 mb-4 rounded-lg bg-violet-50 dark:bg-violet-900/15 px-3 py-2 text-sm text-violet-800 dark:text-violet-200">
          <strong>Constraint:</strong> {constraint}
        </p>
      )}

      <fieldset className="mt-2 space-y-2">
        {options.map((o) => (
          <label
            key={o.id}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors ${
              choice === o.id
                ? 'border-violet-400 bg-violet-50 dark:bg-violet-900/20'
                : 'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800'
            }`}
          >
            <input
              type="radio"
              name={`tradeoff-${challengeId}`}
              value={o.id}
              checked={choice === o.id}
              onChange={() => setChoice(o.id)}
              className="accent-violet-600"
            />
            <span className="text-neutral-800 dark:text-neutral-200">{o.label}</span>
          </label>
        ))}
      </fieldset>

      <div className="mt-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !choice}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Grading…' : result ? 'Try another' : 'Submit decision'}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-5">
          <GradeResultCard result={result} xpAwarded={xpAwarded} />
        </div>
      )}
    </section>
  );
}
