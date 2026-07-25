'use client';

/**
 * Back-of-envelope estimation as a checkable skill. The learner enters their derived
 * figures (QPS, storage, bandwidth…); the server checks each against an acceptable
 * band (the bands live server-side in the rubric, never shipped here) and explains why
 * the number forces an architectural choice. Grades the reasoning chain, not a single
 * golden figure.
 */

import { useState } from 'react';
import { useChallenge } from '@/hooks/useChallenge';
import GradeResultCard from './GradeResultCard';

export interface CapacityField {
  key: string;
  label: string;
  unit?: string;
  placeholder?: string;
}

export default function CapacityChallenge({
  challengeId,
  prompt,
  fields,
  title = 'Capacity Estimate',
}: {
  challengeId: string;
  prompt: string;
  fields: CapacityField[];
  title?: string;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const { submit, submitting, result, xpAwarded, error } = useChallenge(challengeId, 'capacity');

  const handleSubmit = async () => {
    const answers: Record<string, number> = {};
    for (const f of fields) {
      const n = Number(values[f.key]);
      if (Number.isFinite(n)) answers[f.key] = n;
    }
    await submit({ answers });
  };

  return (
    <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-6 my-8">
      <div className="flex items-center gap-2 mb-2">
        <span className="rounded-full bg-cyan-100 dark:bg-cyan-900/40 px-2.5 py-0.5 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
          Graded Challenge
        </span>
        <h3 className="text-xl font-bold text-neutral-900 dark:text-white">{title}</h3>
      </div>
      <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-4">{prompt}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f.key} className="block text-sm">
            <span className="mb-1 block font-medium text-neutral-700 dark:text-neutral-300">
              {f.label}
              {f.unit && <span className="text-neutral-400"> ({f.unit})</span>}
            </span>
            <input
              type="number"
              inputMode="decimal"
              value={values[f.key] ?? ''}
              placeholder={f.placeholder}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 p-2 text-neutral-900 dark:text-neutral-100"
            />
          </label>
        ))}
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Checking…' : result ? 'Recheck' : 'Check my estimate'}
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
