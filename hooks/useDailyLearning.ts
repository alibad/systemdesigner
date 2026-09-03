"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  emptyPathProgress,
  localDay,
  PATH_STORAGE_KEY,
  readPathProgress,
  type PathProgress,
} from "@/lib/learning-path";

export function useDailyLearning() {
  const [progress, setProgress] = useState(emptyPathProgress);
  const current = useRef(progress);
  const [ready, setReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const canPersist = useRef(true);
  const [today, setToday] = useState("");

  useEffect(() => {
    const refresh = () => {
      try {
        if (canPersist.current) {
          current.current = readPathProgress(
            localStorage.getItem(PATH_STORAGE_KEY),
          );
          setProgress(current.current);
        }
      } catch {
        canPersist.current = false;
        setStorageAvailable(false);
      }
      setToday(localDay());
      setReady(true);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === PATH_STORAGE_KEY || event.key === null) refresh();
    };
    refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(() => setToday(localDay()), 30_000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
    };
  }, []);

  const update = useCallback(
    (change: (value: PathProgress) => PathProgress) => {
      let base = current.current;
      try {
        if (canPersist.current)
          base = readPathProgress(localStorage.getItem(PATH_STORAGE_KEY));
      } catch {
        /* Use this session's progress when storage is blocked. */
      }
      const next = change(base);
      current.current = next;
      setProgress(next);
      try {
        localStorage.setItem(PATH_STORAGE_KEY, JSON.stringify(next));
        canPersist.current = true;
        setStorageAvailable(true);
      } catch {
        canPersist.current = false;
        setStorageAvailable(false);
      }
      return next;
    },
    [],
  );

  return { progress, ready, today, storageAvailable, update };
}
