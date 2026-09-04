"use client";

import {
  doc,
  onSnapshot,
  runTransaction,
  type Firestore,
} from "firebase/firestore";
import type { Auth } from "firebase/auth";
import {
  emptyDailyLearning,
  mergeDailyLearning,
  parseDailyLearning,
} from "./daily-learning-data";
import type { DailyLearningCloud } from "./daily-learning-store";

export function createDailyLearningCloud(
  auth: Auth,
  db: Firestore,
): DailyLearningCloud {
  function assertOwner(owner: string) {
    if (
      !auth.currentUser ||
      auth.currentUser.isAnonymous ||
      auth.currentUser.uid !== owner
    )
      throw new Error("Learning account changed");
  }

  /** The existing users/{uid} rules restrict these fields to the account owner. */
  return {
    watch(owner, receive, failed) {
      assertOwner(owner);
      return onSnapshot(
        doc(db, "users", owner),
        (snapshot) => {
          if (auth.currentUser?.uid !== owner || auth.currentUser.isAnonymous)
            return;
          // Cached snapshots do not confirm a server save or a missing account document.
          if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites)
            return;
          try {
            const data = snapshot.data()?.dailyLearning;
            receive(
              data === undefined
                ? emptyDailyLearning()
                : parseDailyLearning(data),
            );
          } catch {
            failed();
          }
        },
        failed,
      );
    },
    async merge(owner, local) {
      assertOwner(owner);
      const reference = doc(db, "users", owner);
      return runTransaction(db, async (transaction) => {
        assertOwner(owner);
        const snapshot = await transaction.get(reference);
        assertOwner(owner);
        const stored = snapshot.data()?.dailyLearning;
        // Invalid/future schemas fail closed; never overwrite them with an empty state.
        const remote =
          stored === undefined
            ? emptyDailyLearning()
            : parseDailyLearning(stored);
        const merged = mergeDailyLearning(remote, local);
        // Account creation owns the profile defaults; retry if it has not finished yet.
        if (!snapshot.exists()) throw new Error("Waiting for account setup");
        if (JSON.stringify(remote) !== JSON.stringify(merged))
          transaction.update(reference, { dailyLearning: merged });
        return merged;
      });
    },
  };
}
