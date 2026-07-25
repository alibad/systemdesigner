'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReviewOutcome } from '@/lib/spaced-repetition';
import { getDueAtoms, getQueue, recordReview, type ReviewAtom } from '@/lib/challenges/review-queue';

/**
 * React surface over the local spaced-review queue. Reads run only on the client
 * (localStorage) so we hydrate after mount to avoid SSR mismatch.
 */
export function useReviewQueue() {
  const [due, setDue] = useState<ReviewAtom[]>([]);
  const [total, setTotal] = useState(0);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    setDue(getDueAtoms());
    setTotal(getQueue().length);
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const review = useCallback(
    (id: string, outcome: ReviewOutcome) => {
      recordReview(id, outcome);
      refresh();
    },
    [refresh]
  );

  return { due, total, ready, review, refresh };
}
