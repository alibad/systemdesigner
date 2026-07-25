type Item = {
  label: string;
  leftLabel: string; // e.g., Origin / Without CDN
  rightLabel: string; // e.g., Edge / With CDN
  leftValue: number; // numeric value on same scale
  rightValue: number; // numeric value on same scale
  unit?: string; // ms, %, etc.
};

export default function CompareBars({ items, max }: { items: Item[]; max?: number }) {
  const maxValue = max ?? Math.max(...items.map(i => Math.max(i.leftValue, i.rightValue, 1)));
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / maxValue) * 100))}%`;
  return (
    <div className="grid gap-3">
      {items.map((i) => (
        <div key={i.label} className="grid gap-2">
          <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{i.label}</div>
          <div className="grid grid-cols-[1fr_auto] items-center gap-3">
            <div className="h-2 rounded-full bg-red-200 dark:bg-red-900/40 overflow-hidden">
              <div className="h-full bg-red-500" style={{ width: pct(i.leftValue) }} />
            </div>
            <div className="text-xs text-red-700 dark:text-red-300 tabular-nums">
              {i.leftValue}
              {i.unit}
              <span className="ml-1 text-neutral-500">{i.leftLabel}</span>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-center gap-3">
            <div className="h-2 rounded-full bg-emerald-200 dark:bg-emerald-900/40 overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: pct(i.rightValue) }} />
            </div>
            <div className="text-xs text-emerald-700 dark:text-emerald-300 tabular-nums">
              {i.rightValue}
              {i.unit}
              <span className="ml-1 text-neutral-500">{i.rightLabel}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}


