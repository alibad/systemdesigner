"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';

type NumberInputProps = {
  label: string;
  value: number;
  setValue: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
};

function NumberInput({ label, value, setValue, min = 0, max = 1_000_000, step = 1, suffix }: NumberInputProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{label}</label>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">{value.toLocaleString()} {suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

export default function DatabaseCalculatorPage() {
  const [readQps, setReadQps] = useState(2000);
  const [writeQps, setWriteQps] = useState(200);
  const [rowSizeBytes, setRowSizeBytes] = useState(800);
  const [replicas, setReplicas] = useState(2);
  const [retentionDays, setRetentionDays] = useState(365);
  const [p99SloMs, setP99SloMs] = useState(150);

  const dailyWrites = useMemo(() => writeQps * 60 * 60 * 24, [writeQps]);
  const dailyStorageBytes = useMemo(() => dailyWrites * rowSizeBytes, [dailyWrites, rowSizeBytes]);
  const yearlyStorageGB = useMemo(() => (dailyStorageBytes * retentionDays) / (1024 ** 3), [dailyStorageBytes, retentionDays]);

  const readHeavy = readQps / Math.max(1, writeQps) >= 5;
  const writeHeavy = writeQps / Math.max(1, readQps) >= 0.5;

  const recommendations = useMemo(() => {
    const recs: string[] = [];
    if (readHeavy) recs.push('Add read replicas to offload reads');
    if (p99SloMs < 100) recs.push('Introduce Redis cache for hot keys');
    if (writeQps > 5_000) recs.push('Partition by user/shard key to scale writes horizontally');
    if (yearlyStorageGB > 1024) recs.push('Move cold data to cheaper storage (S3 + Athena/BigQuery)');
    if (replicas < 2) recs.push('Increase replication factor for HA');
    if (writeHeavy) recs.push('Consider log-structured stores (LSM) for high write throughput');
    return recs;
  }, [readHeavy, p99SloMs, writeQps, yearlyStorageGB, replicas, writeHeavy]);

  const primaryWriteCapacity = 3_000; // illustrative baseline
  const needsSharding = writeQps > primaryWriteCapacity;
  const estReadCapacityPerReplica = 5_000; // baseline per replica
  const totalReadCapacity = estReadCapacityPerReplica * (1 + replicas);

  return (
    <main className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <Link href="/sandbox" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">← Back to Tools</Link>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">Database Scaling Calculator</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-2">Estimate capacity needs and get actionable scaling suggestions.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 space-y-4">
          <h2 className="text-lg font-semibold">Workload Inputs</h2>
          <NumberInput label="Read QPS" value={readQps} setValue={setReadQps} max={100_000} step={100} suffix="req/s" />
          <NumberInput label="Write QPS" value={writeQps} setValue={setWriteQps} max={50_000} step={50} suffix="req/s" />
          <NumberInput label="Row size" value={rowSizeBytes} setValue={setRowSizeBytes} max={8192} step={8} suffix="bytes" />
          <NumberInput label="Replication factor (replicas)" value={replicas} setValue={setReplicas} max={6} step={1} />
          <NumberInput label="Retention window" value={retentionDays} setValue={setRetentionDays} max={1825} step={1} suffix="days" />
          <NumberInput label="p99 latency SLO" value={p99SloMs} setValue={setP99SloMs} max={1000} step={5} suffix="ms" />
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
            <h3 className="font-semibold mb-3">Capacity Summary</h3>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
                <div className="text-neutral-500">Daily writes</div>
                <div className="font-semibold">{dailyWrites.toLocaleString()}</div>
              </div>
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
                <div className="text-neutral-500">Storage/year</div>
                <div className="font-semibold">{yearlyStorageGB.toFixed(1)} GB</div>
              </div>
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
                <div className="text-neutral-500">Read capacity (est)</div>
                <div className={`font-semibold ${totalReadCapacity < readQps ? 'text-amber-600' : 'text-emerald-600'}`}>{totalReadCapacity.toLocaleString()} r/s</div>
              </div>
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
                <div className="text-neutral-500">Write capacity on primary</div>
                <div className={`font-semibold ${needsSharding ? 'text-amber-600' : 'text-emerald-600'}`}>{primaryWriteCapacity.toLocaleString()} w/s</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
            <h3 className="font-semibold mb-3">Recommendations</h3>
            <ul className="text-sm text-neutral-700 dark:text-neutral-300 space-y-2">
              {recommendations.length === 0 ? (
                <li>Looks good. Monitor growth and latency; add caching if p99 degrades.</li>
              ) : (
                recommendations.map((r) => <li key={r}>• {r}</li>)
              )}
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
