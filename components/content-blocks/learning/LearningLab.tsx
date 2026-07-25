'use client';

import type { ReactNode } from 'react';
import { RefreshCw, type LucideIcon } from 'lucide-react';

type Accent = 'cyan' | 'violet' | 'emerald' | 'amber' | 'rose' | 'blue';

const accents: Record<Accent, { eyebrow: string; focus: string }> = {
  cyan: {
    eyebrow: 'text-cyan-300',
    focus: 'focus-visible:ring-cyan-400',
  },
  violet: {
    eyebrow: 'text-violet-300',
    focus: 'focus-visible:ring-violet-400',
  },
  emerald: {
    eyebrow: 'text-emerald-300',
    focus: 'focus-visible:ring-emerald-400',
  },
  amber: {
    eyebrow: 'text-amber-300',
    focus: 'focus-visible:ring-amber-400',
  },
  rose: {
    eyebrow: 'text-rose-300',
    focus: 'focus-visible:ring-rose-400',
  },
  blue: {
    eyebrow: 'text-blue-300',
    focus: 'focus-visible:ring-blue-400',
  },
};

const metricTones: Record<Accent | 'neutral', string> = {
  cyan: 'border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-50',
  violet:
    'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-50',
  emerald:
    'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50',
  amber:
    'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50',
  rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50',
  blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-50',
  neutral:
    'border-neutral-200 bg-neutral-50 text-neutral-950 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-50',
};

export function LearningLab({ children }: { children: ReactNode }) {
  return (
    <section className="not-prose my-7 min-w-0 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      {children}
    </section>
  );
}

export function LearningLabHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  accent = 'cyan',
  onReset,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent?: Accent;
  onReset?: () => void;
}) {
  const styles = accents[accent];

  return (
    <header className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 text-white md:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          <div
            className={`flex items-center gap-2 text-xs font-semibold uppercase ${styles.eyebrow}`}
          >
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            {eyebrow}
          </div>
          <h3 className="mt-2 text-xl font-semibold text-white md:text-2xl">{title}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-300">{description}</p>
        </div>
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-neutral-700 px-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 ${styles.focus}`}
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Reset
          </button>
        ) : null}
      </div>
    </header>
  );
}

export function LearningLabBody({
  children,
  controls,
}: {
  children: ReactNode;
  controls?: ReactNode;
}) {
  if (!controls) {
    return <div className="min-w-0 p-5 md:p-6">{children}</div>;
  }

  return (
    <div className="grid min-w-0 lg:grid-cols-[minmax(260px,360px)_minmax(0,1fr)]">
      <div className="min-w-0 border-b border-neutral-200 bg-neutral-50 p-5 lg:border-b-0 lg:border-r md:p-6 dark:border-neutral-800 dark:bg-neutral-900/50">
        {controls}
      </div>
      <div className="min-w-0 p-5 md:p-6">{children}</div>
    </div>
  );
}

export function LabMetric({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  detail?: string;
  icon?: LucideIcon;
  tone?: Accent | 'neutral';
}) {
  return (
    <div className={`min-w-0 rounded-md border p-4 ${metricTones[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
        {Icon ? <Icon aria-hidden="true" className="h-4 w-4 shrink-0" /> : null}
        <span>{label}</span>
      </div>
      <p className="mt-2 break-words text-2xl font-semibold tabular-nums">{value}</p>
      {detail ? <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p> : null}
    </div>
  );
}

export function LabChoice({
  selected,
  label,
  detail,
  icon: Icon,
  accent = 'cyan',
  onClick,
}: {
  selected: boolean;
  label: string;
  detail?: string;
  icon?: LucideIcon;
  accent?: Accent;
  onClick: () => void;
}) {
  const selectedStyle = metricTones[accent];

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`w-full rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 ${
        selected
          ? `${selectedStyle} ring-1 ring-current`
          : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'
      }`}
    >
      <span className="flex items-start gap-3">
        {Icon ? <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /> : null}
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{label}</span>
          {detail ? <span className="mt-1 block text-xs leading-5 opacity-75">{detail}</span> : null}
        </span>
      </span>
    </button>
  );
}

export function LabRange({
  label,
  value,
  output,
  min,
  max,
  step = 1,
  accent = 'cyan',
  lowLabel,
  highLabel,
  onChange,
}: {
  label: string;
  value: number;
  output: string;
  min: number;
  max: number;
  step?: number;
  accent?: Accent;
  lowLabel?: string;
  highLabel?: string;
  onChange: (value: number) => void;
}) {
  const accentClass: Record<Accent, string> = {
    cyan: 'accent-cyan-500',
    violet: 'accent-violet-500',
    emerald: 'accent-emerald-500',
    amber: 'accent-amber-500',
    rose: 'accent-rose-500',
    blue: 'accent-blue-500',
  };

  return (
    <label className="block">
      <span className="flex items-center justify-between gap-4">
        <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
          {label}
        </span>
        <output className="shrink-0 text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">
          {output}
        </output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`mt-3 h-2 w-full cursor-pointer ${accentClass[accent]}`}
      />
      {lowLabel || highLabel ? (
        <span className="mt-2 flex justify-between gap-4 text-xs text-neutral-500 dark:text-neutral-400">
          <span>{lowLabel}</span>
          <span className="text-right">{highLabel}</span>
        </span>
      ) : null}
    </label>
  );
}
