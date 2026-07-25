/**
 * Local, client-side spaced-review queue. Atoms enter the queue when the learner
 * *masters* something (passes a graded challenge — see hooks/useChallenge.ts), so what
 * resurfaces is keyed to demonstrated learning, not page visits. Persisted in
 * localStorage to stay dependency-free; a future iteration can sync to Firestore.
 */

import { initialSrs, schedule, isDue, type ReviewOutcome, type SrsState } from '@/lib/spaced-repetition';

export interface ReviewAtom {
  id: string;
  title: string;
  /** Where to go to actually review this concept. */
  path?: string;
  srs: SrsState;
}

const STORAGE_KEY = 'sd:review-queue:v1';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function load(): Record<string, ReviewAtom> {
  if (!canUseStorage()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ReviewAtom>) : {};
  } catch {
    return {};
  }
}

function save(map: Record<string, ReviewAtom>): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota / private mode — non-fatal */
  }
}

function prettify(id: string): string {
  return id.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Add an atom to the review queue (no-op if already present). */
export function enqueueAtom(atom: { id: string; title?: string; path?: string }, nowMs = Date.now()): void {
  const map = load();
  if (map[atom.id]) return;
  map[atom.id] = {
    id: atom.id,
    title: atom.title || prettify(atom.id),
    path: atom.path,
    srs: initialSrs(nowMs),
  };
  save(map);
}

export function getQueue(): ReviewAtom[] {
  return Object.values(load());
}

export function getDueAtoms(nowMs = Date.now(), limit?: number): ReviewAtom[] {
  const due = Object.values(load())
    .filter((a) => isDue(a.srs, nowMs))
    .sort((a, b) => a.srs.dueAt - b.srs.dueAt);
  return typeof limit === 'number' ? due.slice(0, limit) : due;
}

export function dueCount(nowMs = Date.now()): number {
  return getDueAtoms(nowMs).length;
}

/** Record a self-rated review outcome and reschedule the atom. */
export function recordReview(id: string, outcome: ReviewOutcome, nowMs = Date.now()): void {
  const map = load();
  const atom = map[id];
  if (!atom) return;
  atom.srs = schedule(atom.srs, outcome, nowMs);
  save(map);
}
