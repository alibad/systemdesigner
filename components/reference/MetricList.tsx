import type { PropsWithChildren } from 'react';

export type MetricItem = {
  label: string;
  value: string;
  insight?: string;
  tone?: 'ok' | 'warn' | 'bad';
  widthPercent?: number; // optional background bar (0-100)
};

export default function MetricList({ items }: PropsWithChildren<{ items: MetricItem[] }>) {
  const toneToColor = (tone?: MetricItem['tone']) =>
    tone === 'bad' ? 'bg-rose-500/15' : tone === 'warn' ? 'bg-amber-500/15' : 'bg-indigo-500/15';

  return (
    <div className="grid gap-2">
      {items.map((it) => (
        <div key={`${it.label}-${it.value}`} className="relative overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 group">
          {typeof it.widthPercent === 'number' ? (
            <div className={`absolute inset-y-0 left-0 ${toneToColor(it.tone)} transition-all`} style={{ width: `${Math.max(0, Math.min(100, it.widthPercent))}%` }} />
          ) : null}
          <div className="relative grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-2">
            <div>
              <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{it.label}</div>
              {it.insight ? (
                <div className="text-xs text-neutral-500 dark:text-neutral-400 leading-snug">{it.insight}</div>
              ) : null}
            </div>
            <div className="text-sm font-semibold text-indigo-600 dark:text-indigo-300 tabular-nums">{it.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}


