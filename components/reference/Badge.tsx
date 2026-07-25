import type { PropsWithChildren } from 'react';

type BadgeProps = PropsWithChildren<{
  tone?: 'neutral' | 'success' | 'warning' | 'info';
}>;

export default function Badge({ tone = 'neutral', children }: BadgeProps) {
  const toneClass =
    tone === 'success'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
      : tone === 'warning'
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
      : tone === 'info'
      ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300'
      : 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300';
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${toneClass}`}>{children}</span>;
}


