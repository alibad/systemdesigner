import type { PropsWithChildren } from 'react';

type InsightRowProps = PropsWithChildren<{
  label: string;
  value: string;
  insight: string;
  widthPercent?: number; // 0-100, visual context only
  tone?: 'ok' | 'warn' | 'bad';
}>;

export default function InsightRow({ label, value, insight, widthPercent, tone = 'ok' }: InsightRowProps) {
  const barTone = tone === 'bad' ? 'bg-red-400/50' : tone === 'warn' ? 'bg-amber-400/50' : 'bg-indigo-400/50';
  return (
    <div className="relative overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2">
      {typeof widthPercent === 'number' ? (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-0 top-0 h-full opacity-30" style={{ width: `${Math.max(0, Math.min(100, widthPercent))}%` }}>
            <div className={`h-full ${barTone}`} />
          </div>
        </div>
      ) : null}
      <div className="relative grid grid-cols-[1fr_auto] items-baseline gap-2">
        <div>
          <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{label}</div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">{insight}</div>
        </div>
        <div className="text-sm font-semibold text-primary-600 dark:text-primary-300 tabular-nums">{value}</div>
      </div>
    </div>
  );
}


