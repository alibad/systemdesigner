"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";
import { createDailyLearningCloud } from "@/lib/daily-learning-cloud";
import {
  DailyLearningStore,
  type DailyLearningSnapshot,
} from "@/lib/daily-learning-store";
import {
  DAILY_STORAGE_PREFIX,
  dailyProgress,
  emptyDailyLearning,
  exportDailyLearning,
  type DailyLearningData,
} from "@/lib/daily-learning-data";
import { localDay, type PathProgress } from "@/lib/learning-path";
import type { SessionResume } from "@/lib/learning-resume";
import type { AttemptEvidence } from "@/lib/learning-evidence";

export function useDailyLearning() {
  const [snapshot, setSnapshot] = useState<DailyLearningSnapshot>({
    owner: undefined,
    data: emptyDailyLearning(),
    ready: false,
    status: "loading",
    storageAvailable: true,
  });
  const [today, setToday] = useState("");
  const [accountName, setAccountName] = useState("");
  const store = useRef<DailyLearningStore>();

  useEffect(() => {
    const current = new DailyLearningStore(
      {
        getItem: (key) => localStorage.getItem(key),
        setItem: (key, value) => localStorage.setItem(key, value),
      },
      createDailyLearningCloud(auth, db),
      setSnapshot,
    );
    store.current = current;
    current.setOnline(navigator.onLine);
    const unsubscribe = isFirebaseConfigured
      ? onAuthStateChanged(auth, (user) => {
          const owner = user && !user.isAnonymous ? user.uid : null;
          setAccountName(
            owner ? user?.email || user?.displayName || "your account" : "",
          );
          current.setOwner(owner);
        })
      : (() => {
          current.setOwner(null);
          return () => {};
        })();
    const refresh = () => {
      current.retry();
      setToday(localDay());
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith(DAILY_STORAGE_PREFIX))
        current.refresh();
    };
    const online = () => current.setOnline(navigator.onLine);
    setToday(localDay());
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    const timer = window.setInterval(() => setToday(localDay()), 30_000);
    return () => {
      unsubscribe();
      current.stop();
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
      window.clearInterval(timer);
    };
  }, []);

  const owner = snapshot.owner;
  return {
    ...snapshot,
    today,
    accountName,
    accountSyncAvailable: isFirebaseConfigured,
    progress: dailyProgress(snapshot.data),
    update: (change: (value: PathProgress) => PathProgress) =>
      store.current?.update(owner, change),
    saveDraft: (id: string, value: string) =>
      store.current?.saveDraft(owner, id, value),
    saveSession: (id: string, value: SessionResume | null) =>
      store.current?.saveSession(owner, id, value),
    recordAttempt: (attempt: AttemptEvidence) =>
      store.current?.recordAttempt(owner, attempt),
    placeUnit: (unitId: string, passedStepIds: string[], revision: string) =>
      store.current?.placeUnit(owner, unitId, passedStepIds, revision),
    enroll: (value: "guided" | "courses") =>
      store.current?.enroll(owner, value),
    finishJourneyTask: (dayId: string, stepId: string) =>
      store.current?.finishJourneyTask(owner, dayId, stepId),
    retry: () => store.current?.retry(),
    exportBackup: () => {
      const current = store.current;
      if (!current || current.snapshot.owner !== owner)
        throw new Error("Account changed");
      return exportDailyLearning(current.snapshot.data);
    },
    guestProgress: () => store.current?.guestProgress() || null,
    importBackup: (data: DailyLearningData) =>
      store.current?.import(owner, data),
  };
}
