import type { PropsWithChildren } from 'react';

type RelativeBarProps = PropsWithChildren<{
  valueLabel: string;
  widthPercent: number; // 0-100
  tone?: 'ok' | 'warn' | 'bad';
}>;

export default function RelativeBar({ valueLabel, widthPercent, tone = 'ok' }: RelativeBarProps) {
  const toneClass =
    tone === 'bad' ? 'from-rose-400 to-red-500' : tone === 'warn' ? 'from-amber-400 to-yellow-500' : 'from-indigo-400 to-blue-500';
  return (
    <div className="grid grid-cols-[2fr_1fr_140px] items-center gap-3">
      <div className="h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${toneClass}`} style={{ width: `${Math.max(0, Math.min(100, widthPercent))}%` }} />
      </div>
      <div className="text-right text-sm font-medium text-neutral-700 dark:text-neutral-300">{valueLabel}</div>
      <div className="text-xs text-neutral-500 dark:text-neutral-400">relative</div>
    </div>
  );
}


