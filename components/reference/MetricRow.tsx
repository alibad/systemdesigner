import type { PropsWithChildren } from 'react';

type MetricRowProps = PropsWithChildren<{
  label: string;
  value: string;
  barClassName?: string;
  barWidthPercent?: number; // 0-100
}>;

export default function MetricRow({ label, value, barClassName, barWidthPercent, children }: MetricRowProps) {
  return (
    <div className="grid grid-cols-[2fr_1fr_100px] items-center px-3 py-2 bg-gray-50 dark:bg-neutral-800/50 rounded-md">
      <span className="text-sm font-medium text-gray-800 dark:text-neutral-200">{label}</span>
      <span className="text-sm font-bold text-primary-600 dark:text-primary-300 text-right">{value}</span>
      <div className="w-[100px]">
        {typeof barWidthPercent === 'number' ? (
          <div className={`h-1.5 rounded ${barClassName ?? 'bg-primary-400'}`} style={{ width: `${barWidthPercent}%` }} />
        ) : null}
      </div>
      {children}
    </div>
  );
}


