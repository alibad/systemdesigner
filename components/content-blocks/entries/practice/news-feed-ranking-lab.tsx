'use client';

import { useMemo, useState } from 'react';
import { Activity, Clock3, Heart, RefreshCw, ShieldCheck, SlidersHorizontal, Sparkles, Users } from 'lucide-react';

type Weights = {
  recency: number;
  relationship: number;
  engagement: number;
};

type Post = {
  id: string;
  author: string;
  copy: string;
  age: string;
  recency: number;
  relationship: number;
  engagement: number;
  safe: boolean;
};

const posts: Post[] = [
  { id: 'friend', author: 'Maya', copy: 'Shipping the first prototype today.', age: '2m', recency: 0.96, relationship: 0.92, engagement: 0.45, safe: true },
  { id: 'news', author: 'World Brief', copy: 'A fast-moving update with broad interest.', age: '18m', recency: 0.78, relationship: 0.22, engagement: 0.95, safe: true },
  { id: 'creator', author: 'Design Notes', copy: 'A deep breakdown of interface latency.', age: '1h', recency: 0.58, relationship: 0.61, engagement: 0.75, safe: true },
  { id: 'spam', author: 'Growth Bot', copy: 'Guaranteed followers in one click.', age: '1m', recency: 0.99, relationship: 0.08, engagement: 0.82, safe: false },
];

const presets: Array<{ label: string; weights: Weights }> = [
  { label: 'Balanced', weights: { recency: 40, relationship: 35, engagement: 25 } },
  { label: 'Latest', weights: { recency: 75, relationship: 15, engagement: 10 } },
  { label: 'Close network', weights: { recency: 20, relationship: 65, engagement: 15 } },
  { label: 'Trending', weights: { recency: 25, relationship: 10, engagement: 65 } },
];

const controls: Array<{ key: keyof Weights; label: string; icon: typeof Clock3; tone: string }> = [
  { key: 'recency', label: 'Recency', icon: Clock3, tone: 'text-blue-500' },
  { key: 'relationship', label: 'Relationship', icon: Users, tone: 'text-violet-500' },
  { key: 'engagement', label: 'Engagement', icon: Heart, tone: 'text-rose-500' },
];

export default function NewsFeedRankingLab() {
  const [weights, setWeights] = useState<Weights>(presets[0].weights);
  const [safetyFilter, setSafetyFilter] = useState(true);

  const ranked = useMemo(() => {
    const total = weights.recency + weights.relationship + weights.engagement || 1;
    return posts
      .map((post) => ({
        ...post,
        filtered: safetyFilter && !post.safe,
        score:
          ((post.recency * weights.recency +
            post.relationship * weights.relationship +
            post.engagement * weights.engagement) /
            total) *
          100,
      }))
      .sort((left, right) => Number(left.filtered) - Number(right.filtered) || right.score - left.score);
  }, [safetyFilter, weights]);

  const activePreset = presets.find(
    (preset) =>
      preset.weights.recency === weights.recency &&
      preset.weights.relationship === weights.relationship &&
      preset.weights.engagement === weights.engagement,
  )?.label;

  return (
    <section className="not-prose my-7 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <header className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 text-white md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-300">
              <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
              Live ranking mixer
            </div>
            <h3 className="mt-2 text-xl font-semibold md:text-2xl">Change what the feed optimizes</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Ranking is a policy, not one score. Adjust the signal weights and watch the candidate order change while safety remains a hard filter.
            </p>
          </div>
          <button
            type="button"
            aria-pressed={safetyFilter}
            onClick={() => setSafetyFilter((value) => !value)}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded border px-3 text-sm font-semibold ${
              safetyFilter
                ? 'border-emerald-400 bg-emerald-400/15 text-emerald-200'
                : 'border-rose-400 bg-rose-400/15 text-rose-200'
            }`}
          >
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
            Safety {safetyFilter ? 'enforced' : 'disabled'}
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="border-b border-neutral-200 bg-neutral-50 p-5 lg:border-b-0 lg:border-r md:p-6 dark:border-neutral-800 dark:bg-neutral-900/50">
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                aria-pressed={activePreset === preset.label}
                onClick={() => setWeights(preset.weights)}
                className={`rounded border px-3 py-2 text-xs font-semibold transition-colors ${
                  activePreset === preset.label
                    ? 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-200'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-6">
            {controls.map((control) => {
              const Icon = control.icon;
              return (
                <label key={control.key} className="block">
                  <span className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-white">
                      <Icon aria-hidden="true" className={`h-4 w-4 ${control.tone}`} />
                      {control.label}
                    </span>
                    <output className="font-bold tabular-nums text-neutral-900 dark:text-white">{weights[control.key]}</output>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={weights[control.key]}
                    onChange={(event) =>
                      setWeights((current) => ({ ...current, [control.key]: Number(event.target.value) }))
                    }
                    className="mt-3 h-2 w-full cursor-pointer accent-violet-500"
                  />
                </label>
              );
            })}
          </div>

          <div className="mt-7 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-white">
              <Activity aria-hidden="true" className="h-4 w-4 text-emerald-500" />
              Hard constraints run first
            </div>
            <p className="mt-2 text-xs leading-5 text-neutral-500">
              Blocks, visibility, moderation, and legal restrictions should remove ineligible candidates before soft ranking scores are compared.
            </p>
          </div>
        </div>

        <div className="min-w-0 p-5 md:p-6">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Resulting timeline</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Scores update immediately; filtered posts move out of the eligible slate.</p>
            </div>
            <button
              type="button"
              onClick={() => setWeights(presets[0].weights)}
              className="inline-flex h-9 items-center gap-2 rounded border border-neutral-200 px-3 text-xs font-semibold text-neutral-600 hover:border-neutral-400 dark:border-neutral-800 dark:text-neutral-300"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Reset
            </button>
          </div>

          <ol className="mt-5 space-y-3">
            {ranked.map((post, index) => (
              <li
                key={post.id}
                className={`grid grid-cols-[42px_minmax(0,1fr)_64px] items-center gap-3 rounded-lg border p-3 transition-all md:p-4 ${
                  post.filtered
                    ? 'border-neutral-200 bg-neutral-100 opacity-55 dark:border-neutral-800 dark:bg-neutral-900'
                    : index === 0
                      ? 'border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/40'
                      : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'
                }`}
              >
                <span className={`flex h-10 w-10 items-center justify-center rounded-md font-bold ${post.filtered ? 'bg-neutral-200 text-neutral-500 dark:bg-neutral-800' : 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'}`}>
                  {post.filtered ? 'x' : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-neutral-950 dark:text-white">{post.author}</span>
                    <span className="text-xs text-neutral-500">{post.age}</span>
                    {index === 0 && !post.filtered ? (
                      <span className="inline-flex items-center gap-1 rounded bg-violet-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:bg-violet-900 dark:text-violet-200">
                        <Sparkles aria-hidden="true" className="h-3 w-3" /> Top
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block line-clamp-2 text-sm leading-5 text-neutral-600 dark:text-neutral-400">{post.copy}</span>
                  {post.filtered ? <span className="mt-1 block text-xs font-semibold text-rose-600 dark:text-rose-300">Removed by safety policy</span> : null}
                </span>
                <span className="text-right">
                  <span className="block text-lg font-bold tabular-nums text-neutral-950 dark:text-white">{post.score.toFixed(0)}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">score</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
