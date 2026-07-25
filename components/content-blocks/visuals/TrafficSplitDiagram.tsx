'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, Database, Gauge, Server, TriangleAlert, Zap } from 'lucide-react';

interface TrafficSplitData {
  title: string;
  description?: string;
  totalRps: number;
  defaultHitRate: number;
  minHitRate: number;
  maxHitRate: number;
  sourceLabel: string;
  hitLabel: string;
  missLabel: string;
  warningThresholdRps: number;
}

function isTrafficSplitData(value: unknown): value is TrafficSplitData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TrafficSplitData>;
  return (
    typeof candidate.title === 'string' &&
    typeof candidate.totalRps === 'number' &&
    candidate.totalRps > 0 &&
    typeof candidate.defaultHitRate === 'number' &&
    typeof candidate.minHitRate === 'number' &&
    typeof candidate.maxHitRate === 'number' &&
    candidate.minHitRate >= 0 &&
    candidate.maxHitRate <= 100 &&
    candidate.minHitRate < candidate.maxHitRate &&
    candidate.defaultHitRate >= candidate.minHitRate &&
    candidate.defaultHitRate <= candidate.maxHitRate &&
    typeof candidate.sourceLabel === 'string' &&
    typeof candidate.hitLabel === 'string' &&
    typeof candidate.missLabel === 'string' &&
    typeof candidate.warningThresholdRps === 'number' &&
    candidate.warningThresholdRps > 0
  );
}

function formatRate(rate: number) {
  if (rate >= 1_000_000) return `${(rate / 1_000_000).toFixed(1)}M`;
  if (rate >= 1_000) return `${Math.round(rate / 1_000)}K`;
  return Math.round(rate).toLocaleString();
}

export default function TrafficSplitDiagram({ dataFile }: { dataFile: string }) {
  const [data, setData] = useState<TrafficSplitData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [hitRate, setHitRate] = useState(90);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setLoadError(false);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Traffic split request failed: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isTrafficSplitData(payload)) throw new Error('Traffic split data is invalid');
        setData(payload);
        setHitRate(payload.defaultHitRate);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(true);
      });

    return () => controller.abort();
  }, [dataFile]);

  const rates = useMemo(() => {
    if (!data) return { hits: 0, misses: 0 };
    const hits = Math.round(data.totalRps * (hitRate / 100));
    return { hits, misses: data.totalRps - hits };
  }, [data, hitRate]);

  if (loadError) {
    return (
      <div className="not-prose my-7 flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300">
        <TriangleAlert aria-hidden="true" className="h-5 w-5 shrink-0" />
        The traffic model could not be loaded.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="not-prose my-7 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
        <div className="h-32 animate-pulse bg-neutral-950" />
        <div className="h-[470px] animate-pulse bg-neutral-100 dark:bg-neutral-900" />
      </div>
    );
  }

  const warning = rates.misses > data.warningThresholdRps;
  const hitWidth = Math.max(12, hitRate * 0.62);
  const missWidth = Math.max(10, (100 - hitRate) * 0.62);

  return (
    <section
      className="not-prose my-7 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
      data-content-block={`traffic-split:${dataFile}`}
    >
      <header className="bg-neutral-950 px-5 py-5 text-white md:px-6 md:py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">
              <Gauge aria-hidden="true" className="h-4 w-4" />
              Live capacity model
            </div>
            <h3 className="mt-2 text-xl font-semibold text-white md:text-2xl">{data.title}</h3>
            {data.description ? <p className="mt-2 text-sm leading-6 text-neutral-400">{data.description}</p> : null}
          </div>
          <div className="min-w-0 lg:w-[340px]">
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="traffic-hit-rate" className="text-sm font-semibold text-white">
                Cache hit rate
              </label>
              <output htmlFor="traffic-hit-rate" className="text-lg font-bold tabular-nums text-emerald-300">
                {hitRate}%
              </output>
            </div>
            <input
              id="traffic-hit-rate"
              type="range"
              min={data.minHitRate}
              max={data.maxHitRate}
              step={1}
              value={hitRate}
              onChange={(event) => setHitRate(Number(event.target.value))}
              className="mt-3 h-2 w-full cursor-pointer accent-emerald-400"
            />
            <div className="mt-1 flex justify-between text-xs text-neutral-500">
              <span>{data.minHitRate}% degraded</span>
              <span>{data.maxHitRate}% warm</span>
            </div>
          </div>
        </div>
      </header>

      <div className="grid border-b border-neutral-200 sm:grid-cols-3 dark:border-neutral-800">
        <div className="flex items-center gap-3 border-b border-neutral-200 px-5 py-4 sm:border-b-0 sm:border-r dark:border-neutral-800">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <Zap aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <p className="text-lg font-bold tabular-nums text-neutral-950 dark:text-white">{formatRate(data.totalRps)}/s</p>
            <p className="text-xs font-medium text-neutral-500">Peak redirects</p>
          </div>
        </div>
        <div className="flex items-center gap-3 border-b border-neutral-200 px-5 py-4 sm:border-b-0 sm:border-r dark:border-neutral-800">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <Server aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <p className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{formatRate(rates.hits)}/s</p>
            <p className="text-xs font-medium text-neutral-500">Cache hits</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-5 py-4">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${warning ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>
            <Database aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <p className={`text-lg font-bold tabular-nums ${warning ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'}`}>
              {formatRate(rates.misses)}/s
            </p>
            <p className="text-xs font-medium text-neutral-500">Store fallbacks</p>
          </div>
        </div>
      </div>

      <div className="bg-neutral-50 p-5 sm:hidden dark:bg-neutral-900/50">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-950">
          <div>
            <p className="text-xs font-semibold uppercase text-blue-600 dark:text-blue-300">Incoming traffic</p>
            <p className="mt-1 text-sm font-medium text-blue-950 dark:text-blue-100">{data.sourceLabel}</p>
          </div>
          <p className="text-xl font-bold tabular-nums text-blue-950 dark:text-white">{formatRate(data.totalRps)}/s</p>
        </div>

        <div className="relative mx-auto h-10 w-1/2" aria-hidden="true">
          <span className="absolute left-1/2 top-0 h-5 w-0.5 -translate-x-1/2 bg-neutral-300 dark:bg-neutral-700" />
          <span className="absolute left-0 right-0 top-5 h-0.5 bg-neutral-300 dark:bg-neutral-700" />
          <span className="absolute left-0 top-5 h-5 w-0.5 bg-emerald-400" />
          <span className={`absolute right-0 top-5 h-5 w-0.5 ${warning ? 'bg-rose-400' : 'bg-amber-400'}`} />
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                <Server aria-hidden="true" className="h-4 w-4" />
                {data.hitLabel}
              </div>
              <p className="font-bold tabular-nums text-emerald-800 dark:text-emerald-200">{formatRate(rates.hits)}/s</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900">
              <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${hitRate}%` }} />
            </div>
          </div>

          <div className={`rounded-lg border p-4 ${warning ? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950' : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950'}`}>
            <div className="flex items-center justify-between gap-4">
              <div className={`flex items-center gap-2 text-sm font-semibold ${warning ? 'text-rose-900 dark:text-rose-100' : 'text-amber-900 dark:text-amber-100'}`}>
                <Database aria-hidden="true" className="h-4 w-4" />
                {data.missLabel}
              </div>
              <p className={`font-bold tabular-nums ${warning ? 'text-rose-800 dark:text-rose-200' : 'text-amber-800 dark:text-amber-200'}`}>{formatRate(rates.misses)}/s</p>
            </div>
            <div className={`mt-3 h-2 overflow-hidden rounded-full ${warning ? 'bg-rose-100 dark:bg-rose-900' : 'bg-amber-100 dark:bg-amber-900'}`}>
              <div className={`h-full rounded-full transition-[width] ${warning ? 'bg-rose-500' : 'bg-amber-500'}`} style={{ width: `${100 - hitRate}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="hidden overflow-x-auto overscroll-x-contain bg-neutral-50 scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-transparent sm:block dark:bg-neutral-900/50 dark:scrollbar-thumb-neutral-700">
        <div className="min-w-[650px] px-4 py-5 md:px-6">
          <svg
            viewBox="0 0 800 330"
            role="img"
            aria-label={`${formatRate(data.totalRps)} redirects per second split into ${formatRate(rates.hits)} cache hits and ${formatRate(rates.misses)} mapping-store reads`}
            className="h-auto w-full"
          >
            <path d="M 164 165 C 360 165, 410 93, 626 93" fill="none" stroke="#d4d4d4" strokeWidth="68" strokeLinecap="round" opacity="0.35" />
            <path d="M 164 165 C 360 165, 410 93, 626 93" fill="none" stroke="#34d399" strokeWidth={hitWidth} strokeLinecap="round" opacity="0.82" />
            <path d="M 164 165 C 360 165, 410 93, 626 93" fill="none" stroke="#d1fae5" strokeWidth="4" strokeDasharray="3 20" strokeLinecap="round" className="content-flow-dash" />

            <path d="M 164 165 C 360 165, 410 244, 626 244" fill="none" stroke="#d4d4d4" strokeWidth="68" strokeLinecap="round" opacity="0.35" />
            <path d="M 164 165 C 360 165, 410 244, 626 244" fill="none" stroke={warning ? '#fb7185' : '#f59e0b'} strokeWidth={missWidth} strokeLinecap="round" opacity="0.86" />
            <path d="M 164 165 C 360 165, 410 244, 626 244" fill="none" stroke={warning ? '#ffe4e6' : '#fef3c7'} strokeWidth="4" strokeDasharray="3 20" strokeLinecap="round" className="content-flow-dash" />

            <g>
              <rect x="38" y="112" width="152" height="106" rx="8" fill="#eff6ff" stroke="#60a5fa" strokeWidth="2" />
              <circle cx="70" cy="144" r="16" fill="#dbeafe" />
              <path d="M63 144h14M70 137l7 7-7 7" fill="none" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <text x="98" y="147" fill="#1e3a8a" className="text-[13px] font-semibold">Incoming</text>
              <text x="62" y="181" fill="#172554" className="text-[25px] font-bold">{formatRate(data.totalRps)}/s</text>
              <text x="62" y="201" fill="#64748b" className="text-[11px] font-medium">{data.sourceLabel}</text>
            </g>

            <g>
              <rect x="610" y="40" width="164" height="106" rx="8" fill="#ecfdf5" stroke="#34d399" strokeWidth="2" />
              <circle cx="642" cy="72" r="16" fill="#d1fae5" />
              <path d="M635 72l5 5 9-10" fill="none" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <text x="670" y="76" fill="#065f46" className="text-[13px] font-semibold">Fast path</text>
              <text x="632" y="108" fill="#064e3b" className="text-[24px] font-bold">{formatRate(rates.hits)}/s</text>
              <text x="632" y="128" fill="#047857" className="text-[11px] font-medium">{data.hitLabel}</text>
            </g>

            <g>
              <rect x="610" y="191" width="164" height="106" rx="8" fill={warning ? '#fff1f2' : '#fffbeb'} stroke={warning ? '#fb7185' : '#f59e0b'} strokeWidth="2" />
              <circle cx="642" cy="223" r="16" fill={warning ? '#ffe4e6' : '#fef3c7'} />
              <path d="M636 217h12v12h-12zM636 221h12M640 217v12" fill="none" stroke={warning ? '#be123c' : '#b45309'} strokeWidth="1.8" />
              <text x="670" y="227" fill={warning ? '#9f1239' : '#92400e'} className="text-[13px] font-semibold">Fallback</text>
              <text x="632" y="259" fill={warning ? '#881337' : '#78350f'} className="text-[24px] font-bold">{formatRate(rates.misses)}/s</text>
              <text x="632" y="279" fill={warning ? '#be123c' : '#b45309'} className="text-[11px] font-medium">{data.missLabel}</text>
            </g>
          </svg>
        </div>
      </div>

      <footer className={`flex items-start gap-3 border-t px-5 py-4 md:px-6 ${warning ? 'border-rose-200 bg-rose-50 dark:border-rose-900/70 dark:bg-rose-950/25' : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/70 dark:bg-emerald-950/20'}`}>
        {warning ? (
          <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />
        ) : (
          <Activity aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
        )}
        <p className={`text-sm font-medium leading-6 ${warning ? 'text-rose-900 dark:text-rose-200' : 'text-emerald-900 dark:text-emerald-200'}`}>
          {warning
            ? `Store traffic is now above the ${formatRate(data.warningThresholdRps)}/s protection threshold. Shed suspicious redirects, coalesce duplicate misses, and cap fallback concurrency.`
            : `The cache absorbs ${hitRate}% of peak traffic, leaving ${formatRate(rates.misses)}/s for the authoritative store. Test this fallback load with headroom.`}
        </p>
      </footer>
    </section>
  );
}
