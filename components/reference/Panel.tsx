import type { PropsWithChildren } from 'react';

type PanelProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
}>;

export default function Panel({ title, subtitle, children }: PanelProps) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 md:p-5 shadow-sm">
      <div className="mb-2">
        <div className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{title}</div>
        {subtitle ? (
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{subtitle}</div>
        ) : null}
      </div>
      <div className="text-sm text-neutral-800 dark:text-neutral-200">
        {children}
      </div>
    </div>
  );
}


