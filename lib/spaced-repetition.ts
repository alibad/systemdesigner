/**
 * SM-2-lite spaced-repetition scheduler — pure and framework-agnostic so it can be
 * unit-tested in isolation. Retention beats cramming (the spacing effect); this powers
 * the daily "review what you've mastered" loop. `nowMs` is injected (never read from the
 * clock here) to keep scheduling deterministic and testable.
 */

export type ReviewOutcome = 'again' | 'good' | 'easy';

export interface SrsState {
  intervalDays: number;
  ease: number; // difficulty multiplier, floored at 1.3
  reps: number; // consecutive successful reviews
  dueAt: number; // epoch ms
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function initialSrs(nowMs: number): SrsState {
  return { intervalDays: 0, ease: 2.5, reps: 0, dueAt: nowMs };
}

/**
 * Compute the next schedule from a review outcome.
 * - again: reset to relearning, nudge ease down, due immediately-ish (10 min)
 * - good:  expand the interval at the current ease
 * - easy:  expand faster and bump ease
 */
export function schedule(
  prev: Pick<SrsState, 'intervalDays' | 'ease' | 'reps'>,
  outcome: ReviewOutcome,
  nowMs: number
): SrsState {
  let { intervalDays, ease, reps } = prev;

  if (outcome === 'again') {
    reps = 0;
    intervalDays = 0;
    ease = Math.max(1.3, ease - 0.2);
    return { intervalDays, ease, reps, dueAt: nowMs + 10 * 60 * 1000 };
  }

  reps += 1;
  if (outcome === 'easy') ease = Math.min(3.0, ease + 0.15);

  if (reps === 1) intervalDays = outcome === 'easy' ? 3 : 1;
  else if (reps === 2) intervalDays = outcome === 'easy' ? 7 : 4;
  else intervalDays = Math.round(Math.max(1, intervalDays) * ease * (outcome === 'easy' ? 1.3 : 1));

  return { intervalDays, ease, reps, dueAt: nowMs + intervalDays * DAY_MS };
}

export function isDue(state: SrsState, nowMs: number): boolean {
  return state.dueAt <= nowMs;
}
