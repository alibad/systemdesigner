"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';

const providers = [
  { name: 'Cloudflare', baseLatencyMs: 40, pricePerGB: 0.02 },
  { name: 'Akamai', baseLatencyMs: 50, pricePerGB: 0.04 },
  { name: 'Fastly', baseLatencyMs: 45, pricePerGB: 0.03 },
  { name: 'CloudFront', baseLatencyMs: 55, pricePerGB: 0.085 },
];

export default function CDNAnalyzerPage() {
  const [trafficGB, setTrafficGB] = useState(10_000);
  const [cacheHitRate, setCacheHitRate] = useState(0.9); // 90%
  const [originLatencyMs, setOriginLatencyMs] = useState(200);

  const results = useMemo(() => {
    return providers.map((p) => {
      const edgeLatency = p.baseLatencyMs * (0.8 + (1 - cacheHitRate) * 0.4); // worse with lower hit rate
      const avgLatency = cacheHitRate * edgeLatency + (1 - cacheHitRate) * originLatencyMs;
      const cost = trafficGB * p.pricePerGB * cacheHitRate + trafficGB * 0.09 * (1 - cacheHitRate); // origin egress $0.09/GB
      return { ...p, edgeLatency: Math.round(edgeLatency), avgLatency: Math.round(avgLatency), cost: Number(cost.toFixed(2)) };
    });
  }, [trafficGB, cacheHitRate, originLatencyMs]);

  const bestLatency = Math.min(...results.map(r => r.avgLatency));
  const bestCost = Math.min(...results.map(r => r.cost));

  return (
    <main className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <Link href="/sandbox" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">← Back to Tools</Link>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">CDN Performance Analyzer</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-2">Compare providers by latency and cost given your traffic and cache hit rate.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 space-y-4">
          <div>
            <label className="text-sm font-medium">Monthly Traffic (GB)</label>
            <input type="range" min={100} max={100_000} step={100} value={trafficGB} onChange={(e) => setTrafficGB(Number(e.target.value))} className="w-full" />
            <div className="text-xs text-neutral-500">{trafficGB.toLocaleString()} GB</div>
          </div>
          <div>
            <label className="text-sm font-medium">Cache Hit Rate</label>
            <input type="range" min={0.5} max={0.99} step={0.01} value={cacheHitRate} onChange={(e) => setCacheHitRate(Number(e.target.value))} className="w-full" />
            <div className="text-xs text-neutral-500">{Math.round(cacheHitRate * 100)}%</div>
          </div>
          <div>
            <label className="text-sm font-medium">Origin Latency (ms)</label>
            <input type="range" min={80} max={400} step={5} value={originLatencyMs} onChange={(e) => setOriginLatencyMs(Number(e.target.value))} className="w-full" />
            <div className="text-xs text-neutral-500">{originLatencyMs} ms</div>
          </div>
        </div>

        <div className="space-y-4">
          {results.map((r) => (
            <div key={r.name} className={`rounded-xl border p-5 ${r.avgLatency === bestLatency ? 'border-emerald-400' : 'border-neutral-200 dark:border-neutral-800'} bg-white dark:bg-neutral-900`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{r.name}</h3>
                {r.cost === bestCost && <span className="text-xs px-2 py-1 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded">Best Cost</span>}
              </div>
              <div className="grid sm:grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
                  <div className="text-neutral-500">Edge Latency</div>
                  <div className="font-semibold">{r.edgeLatency} ms</div>
                </div>
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
                  <div className="text-neutral-500">Avg User Latency</div>
                  <div className="font-semibold">{r.avgLatency} ms</div>
                </div>
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
                  <div className="text-neutral-500">Monthly Cost</div>
                  <div className="font-semibold">${r.cost.toLocaleString()}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
