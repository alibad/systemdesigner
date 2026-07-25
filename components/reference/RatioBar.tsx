type RatioBarProps = {
  leftLabel: string;
  rightLabel: string;
  leftPercent: number; // 0-100
};

export default function RatioBar({ leftLabel, rightLabel, leftPercent }: RatioBarProps) {
  const left = Math.max(0, Math.min(100, leftPercent));
  const right = 100 - left;
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs mb-1 text-neutral-600 dark:text-neutral-300">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800">
        <div className="h-full bg-indigo-500" style={{ width: `${left}%` }} />
        <div className="h-full bg-neutral-400/70 -mt-2" style={{ width: `${right}%` }} />
      </div>
    </div>
  );
}


