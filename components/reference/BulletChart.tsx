import type { PropsWithChildren } from 'react';

type Range = {
  to: number; // numeric value cutoff mapped to the same scale as value/max
  tone: 'ok' | 'warn' | 'bad';
};

type BulletChartProps = PropsWithChildren<{
  title: string;
  value: number;
  unit: string;
  max: number; // upper bound of the scale
  target?: number; // optional target value to mark
  ranges?: Range[]; // optional qualitative ranges
}>;

export default function BulletChart({ title, value, unit, max, target, ranges }: BulletChartProps) {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const valuePct = clamp((value / max) * 100);
  const targetPct = typeof target === 'number' ? clamp((target / max) * 100) : undefined;

  const toneToClass = (tone: Range['tone']) =>
    tone === 'bad'
      ? 'from-rose-200 to-rose-300 dark:from-rose-900/30 dark:to-rose-800/30'
      : tone === 'warn'
      ? 'from-amber-200 to-amber-300 dark:from-amber-900/30 dark:to-amber-800/30'
      : 'from-emerald-200 to-emerald-300 dark:from-emerald-900/30 dark:to-emerald-800/30';

  let last = 0;
  const bands = (ranges ?? []).map((r, idx) => {
    const toPct = clamp((r.to / max) * 100);
    const width = clamp(toPct - last);
    const el = (
      <div
        key={idx}
        className={`absolute left-[${last}%] top-0 h-full bg-gradient-to-r ${toneToClass(r.tone)}`}
        style={{ left: `${last}%`, width: `${width}%` }}
      />
    );
    last = toPct;
    return el;
  });

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{title}</div>
        <div className="text-sm text-neutral-600 dark:text-neutral-300">
          {value}
          {unit}
        </div>
      </div>
      <div className="relative h-6 rounded-md bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
        {bands}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-3 rounded bg-neutral-400/60 dark:bg-neutral-500/60" style={{ width: `${valuePct}%` }} />
        {typeof targetPct === 'number' ? (
          <div className="absolute top-0 h-full w-[2px] bg-neutral-700 dark:bg-neutral-200" style={{ left: `${targetPct}%` }} aria-label="target" />
        ) : null}
      </div>
    </div>
  );
}


