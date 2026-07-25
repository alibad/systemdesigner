'use client';

/**
 * The daily spaced-review nudge. Surfaces concepts the learner has mastered and that
 * are now due for review, and lets them self-rate recall (Again / Good / Easy), which
 * reschedules each atom. The streak we care about is "cleared today's reviews" — a real
 * learning act — not "opened the app". Renders nothing until there's something to review,
 * so it stays out of the way for new users.
 */

import Link from 'next/link';
import { useReviewQueue } from '@/hooks/useReviewQueue';
import type { ReviewOutcome } from '@/lib/spaced-repetition';

const OUTCOMES: { id: ReviewOutcome; label: string; cls: string }[] = [
  { id: 'again', label: 'Again', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  { id: 'good', label: 'Good', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  { id: 'easy', label: 'Easy', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
];

export default function DailyReviewCard({ limit = 3 }: { limit?: number }) {
  const { due, ready, review } = useReviewQueue();

  // Render nothing until hydrated, and nothing when there's no queue at all.
  if (!ready) return null;
  if (due.length === 0) return null;

  const batch = due.slice(0, limit);

  return (
    <section className="rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 p-5 my-8">
      <div className="mb-3 flex items-center gap-2">
        <span aria-hidden className="text-lg">🔁</span>
        <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
          Daily review — {due.length} due
        </h3>
      </div>
      <p className="mb-4 text-sm text-amber-800 dark:text-amber-200">
        Quick recall keeps mastered concepts from fading. Rate how well each came back.
      </p>

      <ul className="space-y-3">
        {batch.map((atom) => (
          <li
            key={atom.id}
            className="flex flex-col gap-2 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-white dark:bg-neutral-900 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {atom.path ? (
                <Link href={atom.path as any} className="hover:underline">
                  {atom.title}
                </Link>
              ) : (
                atom.title
              )}
            </div>
            <div className="flex gap-2">
              {OUTCOMES.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => review(atom.id, o.id)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80 ${o.cls}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
