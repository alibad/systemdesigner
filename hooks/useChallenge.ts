'use client';

/**
 * The single client entry point for every gradeable block. Submits a learner
 * artifact to /api/grade, stores the deterministic GradeResult, and — only when the
 * learner passes — routes evidence-based XP through the gamification context. All
 * grading and XP authority lives server-side; this hook just orchestrates and
 * surfaces feedback. Gamification is best-effort and never blocks the result.
 */

import { useCallback, useState } from 'react';
import { useGamification } from '@/contexts/GamificationContext';
import { enqueueAtom } from '@/lib/challenges/review-queue';
import type { ChallengeKind, GradeRequest, GradeResult } from '@/lib/challenges/types';

export interface ChallengeSubmitInput {
  records?: unknown;
  answers?: Record<string, unknown>;
  narration?: string;
}

export function useChallenge(challengeId: string, kind: ChallengeKind, reviewPath?: string) {
  const { trackChallengeCompletion } = useGamification();
  const [attempt, setAttempt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [xpAwarded, setXpAwarded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (input: ChallengeSubmitInput): Promise<GradeResult | null> => {
      setSubmitting(true);
      setError(null);
      const nextAttempt = attempt + 1;
      setAttempt(nextAttempt);

      try {
        const payload: GradeRequest = { challengeId, kind, attempt: nextAttempt, ...input };
        const res = await fetch('/api/grade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `Grading failed (${res.status})`);
        }

        const graded: GradeResult = await res.json();
        setResult(graded);

        // On mastery, queue this concept for spaced review (keyed to demonstrated learning).
        if (graded.passed) {
          enqueueAtom({ id: challengeId, path: reviewPath });
        }

        // Evidence-based XP — best-effort; a gamification hiccup must never hide feedback.
        try {
          const { xpAwarded: xp } = await trackChallengeCompletion(challengeId, {
            passed: graded.passed,
            score: graded.score,
            kind: graded.kind,
            xpWeight: graded.xpWeight,
          });
          setXpAwarded(xp);
        } catch {
          /* ignore */
        }

        return graded;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong grading your work.');
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [attempt, challengeId, kind, reviewPath, trackChallengeCompletion]
  );

  const reset = useCallback(() => {
    setResult(null);
    setXpAwarded(null);
    setError(null);
  }, []);

  return { submit, reset, submitting, result, xpAwarded, attempt, error };
}
