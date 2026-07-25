'use client';

import { useEffect, useMemo, useState } from 'react';
import { CircleCheck, ClipboardCheck, RotateCcw, ShieldAlert, TriangleAlert } from 'lucide-react';

interface ChecklistItemData {
  id: string;
  text: string;
}

interface ChecklistGroupData {
  id: string;
  title: string;
  tone: 'positive' | 'warning';
  items: ChecklistItemData[];
}

interface ChecklistData {
  groups: ChecklistGroupData[];
}

const GROUP_STYLES = {
  positive: {
    border: 'border-emerald-200 dark:border-emerald-900/70',
    header: 'bg-emerald-50 dark:bg-emerald-950/30',
    icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300',
    checkbox: 'accent-emerald-600 dark:accent-emerald-500',
    checked: 'bg-emerald-50/70 dark:bg-emerald-950/20',
  },
  warning: {
    border: 'border-rose-200 dark:border-rose-900/70',
    header: 'bg-rose-50 dark:bg-rose-950/30',
    icon: 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300',
    checkbox: 'accent-rose-600 dark:accent-rose-500',
    checked: 'bg-rose-50/70 dark:bg-rose-950/20',
  },
} as const;

function isChecklistData(value: unknown): value is ChecklistData {
  if (!value || typeof value !== 'object' || !('groups' in value) || !Array.isArray(value.groups)) {
    return false;
  }

  return value.groups.every(
    (group) =>
      group &&
      typeof group === 'object' &&
      'id' in group &&
      typeof group.id === 'string' &&
      'title' in group &&
      typeof group.title === 'string' &&
      'tone' in group &&
      (group.tone === 'positive' || group.tone === 'warning') &&
      'items' in group &&
      Array.isArray(group.items) &&
      group.items.every(
        (item: unknown) =>
          item &&
          typeof item === 'object' &&
          'id' in item &&
          typeof item.id === 'string' &&
          'text' in item &&
          typeof item.text === 'string'
      )
  );
}

export default function InteractiveChecklist({
  checklistId,
  dataFile,
}: {
  checklistId: string;
  dataFile: string;
}) {
  const [data, setData] = useState<ChecklistData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setLoadError(false);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Checklist request failed: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isChecklistData(payload)) throw new Error('Checklist data is invalid');
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(true);
      });

    return () => controller.abort();
  }, [dataFile]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(`content-checklist:${checklistId}`);
      const values = stored ? (JSON.parse(stored) as unknown) : [];
      setCompleted(new Set(Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string') : []));
    } catch {
      setCompleted(new Set());
    } finally {
      setStorageReady(true);
    }
  }, [checklistId]);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(`content-checklist:${checklistId}`, JSON.stringify([...completed]));
    } catch {
      // The checklist remains usable when browser storage is unavailable.
    }
  }, [checklistId, completed, storageReady]);

  const allItemIds = useMemo(
    () => data?.groups.flatMap((group) => group.items.map((item) => item.id)) ?? [],
    [data]
  );
  const verifiedCount = allItemIds.filter((id) => completed.has(id)).length;
  const percentage = allItemIds.length === 0 ? 0 : Math.round((verifiedCount / allItemIds.length) * 100);

  const toggleItem = (id: string) => {
    setCompleted((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loadError) {
    return (
      <div className="not-prose my-7 flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300">
        <TriangleAlert aria-hidden="true" className="h-5 w-5 shrink-0" />
        The production checklist could not be loaded.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="not-prose my-7 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
        <div className="h-24 animate-pulse bg-neutral-900" />
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <div className="h-72 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
          <div className="h-72 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
        </div>
      </div>
    );
  }

  return (
    <section
      className="not-prose my-7 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
      data-content-block={`interactive-checklist:${checklistId}`}
    >
      <header className="bg-neutral-950 px-6 py-5 text-white dark:bg-black">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-500 text-white">
              <ClipboardCheck aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-lg font-semibold text-white">Production verification</h3>
              <p className="mt-1 text-sm text-neutral-400">
                {verifiedCount} of {allItemIds.length} checks verified
              </p>
            </div>
          </div>
          <button
            type="button"
            title="Reset checklist"
            aria-label="Reset checklist"
            disabled={verifiedCount === 0}
            onClick={() => setCompleted(new Set())}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-neutral-700 text-neutral-300 transition-colors hover:border-neutral-500 hover:bg-neutral-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <div
          className="mt-5 h-2 overflow-hidden rounded-full bg-neutral-800"
          role="progressbar"
          aria-label="Checklist progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage}
        >
          <div className="h-full rounded-full bg-emerald-400 transition-[width] duration-300" style={{ width: `${percentage}%` }} />
        </div>
      </header>

      <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
        {data.groups.map((group) => {
          const style = GROUP_STYLES[group.tone];
          const GroupIcon = group.tone === 'positive' ? CircleCheck : ShieldAlert;
          const groupVerified = group.items.filter((item) => completed.has(item.id)).length;

          return (
            <section key={group.id} className={`overflow-hidden rounded-lg border ${style.border}`}>
              <header className={`flex items-center justify-between gap-4 border-b px-4 py-4 ${style.border} ${style.header}`}>
                <div className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-md ${style.icon}`}>
                    <GroupIcon aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <h4 className="text-base font-semibold text-neutral-950 dark:text-white">{group.title}</h4>
                </div>
                <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
                  {groupVerified}/{group.items.length}
                </span>
              </header>

              <div>
                {group.items.map((item) => {
                  const checked = completed.has(item.id);
                  const inputId = `${checklistId}-${group.id}-${item.id}`;

                  return (
                    <label
                      key={item.id}
                      htmlFor={inputId}
                      className={`flex min-h-14 cursor-pointer items-start gap-3 border-t border-neutral-200 px-4 py-3.5 first:border-t-0 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900 ${checked ? style.checked : ''}`}
                    >
                      <input
                        id={inputId}
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleItem(item.id)}
                        className={`mt-1 h-5 w-5 shrink-0 cursor-pointer ${style.checkbox}`}
                      />
                      <span
                        className={`text-sm leading-6 transition-colors ${
                          checked
                            ? 'text-neutral-400 line-through decoration-2 dark:text-neutral-500'
                            : 'text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        {item.text}
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
