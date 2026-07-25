"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Context = {
  dau: number; // daily active users
  peakRps: number; // peak requests per second
  readRatio: number; // 0..1 (reads / (reads+writes))
  latencyTargetMs: number; // p95 target
  strictConsistency: boolean;
  schemaFlexibility: number; // 0..1
  globalUsers: boolean;
  writeHeavy: boolean;
};

function Slider({ label, value, setValue, min, max, step = 1, format }: { label: string; value: number; setValue: (n: number) => void; min: number; max: number; step?: number; format?: (n: number) => string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{label}</label>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">{format ? format(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => setValue(Number(e.target.value))} className="w-full" />
    </div>
  );
}

export default function ArchitectureGuidePage() {
  const router = useRouter();
  const [ctx, setCtx] = useState<Context>({
    dau: 1_000_000,
    peakRps: 5_000,
    readRatio: 0.9,
    latencyTargetMs: 150,
    strictConsistency: false,
    schemaFlexibility: 0.6,
    globalUsers: true,
    writeHeavy: false,
  });

  const set = <K extends keyof Context>(key: K, value: Context[K]) => setCtx((prev) => ({ ...prev, [key]: value }));

  // Heuristics → Recommendations
  const dbChoice = useMemo(() => {
    if (ctx.strictConsistency && ctx.schemaFlexibility < 0.5) return 'SQL (PostgreSQL/MySQL) with leader-replica';
    if (ctx.writeHeavy && ctx.schemaFlexibility >= 0.5) return 'NoSQL (Cassandra/DynamoDB) with wide-column or key-value model';
    if (ctx.schemaFlexibility >= 0.7) return 'Document DB (MongoDB/DocumentDB)';
    return 'SQL (PostgreSQL) to start; add read replicas as needed';
  }, [ctx.strictConsistency, ctx.schemaFlexibility, ctx.writeHeavy]);

  const caching = useMemo(() => {
    const list: string[] = [];
    if (ctx.readRatio > 0.7) list.push('Redis cache for hot keys and session/state');
    if (ctx.globalUsers || ctx.latencyTargetMs < 120) list.push('CDN + edge caching for static and cacheable API');
    if (ctx.peakRps > 8000) list.push('Write-through or write-back cache for heavy read paths');
    return list;
  }, [ctx.readRatio, ctx.globalUsers, ctx.latencyTargetMs, ctx.peakRps]);

  const queues = useMemo(() => {
    const list: string[] = [];
    if (ctx.writeHeavy || ctx.peakRps > 7000) list.push('Message queue (Kafka/Pulsar) + outbox for async work');
    if (ctx.latencyTargetMs < 120) list.push('Background jobs for non-critical processing');
    return list;
  }, [ctx.writeHeavy, ctx.peakRps, ctx.latencyTargetMs]);

  const partitioning = useMemo(() => {
    if (ctx.peakRps > 6000) return 'Hash partition by userId/tenant; 16–64 shards to start; rebalance with consistent hashing';
    return 'Single shard to start; prepare shard key (userId/tenant) for future scale';
  }, [ctx.peakRps]);

  const deployment = useMemo(() => {
    if (ctx.globalUsers) return 'Multi-region: per-region read replicas; single-writer per region with async cross-region replication';
    return 'Single region to start; enable multi-AZ for HA';
  }, [ctx.globalUsers]);

  const componentsForWhiteboard = useMemo(() => {
    const comps = ['user', 'api', 'balancer', 'server'];
    if (caching.length) comps.push('cache');
    comps.push('database');
    if (queues.length) comps.push('queue');
    if (ctx.globalUsers) comps.push('cdn');
    comps.push('monitor');
    return comps;
  }, [caching.length, queues.length, ctx.globalUsers]);

  const openInWhiteboard = () => {
    try {
      const payload = { components: componentsForWhiteboard, note: 'Generated from Architecture Guide' };
      localStorage.setItem('architecture-guide-components', JSON.stringify(payload));
      router.push('/whiteboard');
    } catch {}
  };

  return (
    <main className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <Link href="/sandbox" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">← Back to Tools</Link>
      </div>

      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">Architecture Decision Tree</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2">Provide context and get concrete recommendations with links and a whiteboard bootstrap.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigator.clipboard.writeText(JSON.stringify({ ctx, dbChoice, caching, queues, partitioning, deployment }, null, 2))} className="px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm">Copy Plan JSON</button>
          <button onClick={openInWhiteboard} className="px-3 py-2 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700">Open in Whiteboard</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 space-y-4">
          <h2 className="text-lg font-semibold">Your Context</h2>
          <Slider label="Daily Active Users" value={ctx.dau} setValue={(n) => set('dau', n)} min={10_000} max={100_000_000} step={10_000} format={(n) => n.toLocaleString()} />
          <Slider label="Peak RPS" value={ctx.peakRps} setValue={(n) => set('peakRps', n)} min={100} max={100_000} step={100} format={(n) => `${n.toLocaleString()} req/s`} />
          <Slider label="Read Ratio" value={ctx.readRatio} setValue={(n) => set('readRatio', n)} min={0.2} max={0.99} step={0.01} format={(n) => `${Math.round(n * 100)}% reads`} />
          <Slider label="Latency Target (p95)" value={ctx.latencyTargetMs} setValue={(n) => set('latencyTargetMs', n)} min={50} max={500} step={5} format={(n) => `${n} ms`} />
          <Slider label="Schema Flexibility" value={ctx.schemaFlexibility} setValue={(n) => set('schemaFlexibility', n)} min={0} max={1} step={0.05} format={(n) => (n < 0.33 ? 'Rigid' : n < 0.66 ? 'Moderate' : 'High')} />
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => set('strictConsistency', !ctx.strictConsistency)} className={`px-3 py-2 rounded border text-sm ${ctx.strictConsistency ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-800' : 'border-neutral-200 dark:border-neutral-800'}`}>Strict consistency</button>
            <button onClick={() => set('globalUsers', !ctx.globalUsers)} className={`px-3 py-2 rounded border text-sm ${ctx.globalUsers ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-800' : 'border-neutral-200 dark:border-neutral-800'}`}>Global users</button>
            <button onClick={() => set('writeHeavy', !ctx.writeHeavy)} className={`px-3 py-2 rounded border text-sm ${ctx.writeHeavy ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-800' : 'border-neutral-200 dark:border-neutral-800'}`}>Write-heavy workload</button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
            <h2 className="text-lg font-semibold mb-3">Recommendations</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
                <div className="text-xs text-neutral-500 mb-1">Primary Data Store</div>
                <div className="font-semibold">{dbChoice}</div>
              </div>
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
                <div className="text-xs text-neutral-500 mb-1">Partitioning</div>
                <div className="font-semibold">{partitioning}</div>
              </div>
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
                <div className="text-xs text-neutral-500 mb-1">Deployment</div>
                <div className="font-semibold">{deployment}</div>
              </div>
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
                <div className="text-xs text-neutral-500 mb-1">Queues/Async</div>
                <div className="font-semibold">{queues.length ? queues.join('; ') : 'Not required initially'}</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
            <h3 className="font-semibold mb-2">Caching & Edge</h3>
            <ul className="text-sm text-neutral-700 dark:text-neutral-300 space-y-1">
              {(caching.length ? caching : ['Basic HTTP caching and client-side caching to start']).map((c) => (
                <li key={c}>• {c}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
            <h3 className="font-semibold mb-2">Next Steps Checklist</h3>
            <ul className="text-sm text-neutral-700 dark:text-neutral-300 space-y-1">
              <li>• Define SLOs for p95/p99 latency, error rate, and availability</li>
              <li>• Capacity plan for 6–12 months; set shard key and migration plan</li>
              <li>• Add observability: metrics, tracing, logs, SLO alerts</li>
              <li>• Design data retention and backup/restore processes</li>
            </ul>
          </div>

          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
            <h3 className="font-semibold mb-2">Deep Dives</h3>
            <ul className="text-sm text-indigo-600 dark:text-indigo-400 space-y-1">
              <li><Link href="/reference/sql-vs-nosql">SQL vs NoSQL</Link></li>
              <li><Link href="/reference/caching-strategies">Caching strategies</Link></li>
              <li><Link href="/reference/load-balancing">Load balancing</Link></li>
              <li><Link href="/reference/message-queues">Message queues</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
