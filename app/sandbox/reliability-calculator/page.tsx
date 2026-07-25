"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';

function percent(n: number) {
  return `${(n * 100).toFixed(3)}%`;
}

export default function ReliabilityCalculatorPage() {
  const [componentAvailability, setComponentAvailability] = useState(0.995);
  const [replicas, setReplicas] = useState(2);
  const [mttrHours, setMttrHours] = useState(1);
  const [mtbfHours, setMtbfHours] = useState(500);

  // Availability with N replicas in parallel: 1 - (1 - A)^N
  const serviceAvailability = useMemo(() => 1 - Math.pow(1 - componentAvailability, Math.max(1, replicas)), [componentAvailability, replicas]);

  // Expected downtime per year (hours)
  const annualDowntimeHours = useMemo(() => (1 - serviceAvailability) * 24 * 365, [serviceAvailability]);

  // From MTBF/MTTR approximation: Availability ≈ MTBF / (MTBF + MTTR)
  const availabilityFromMtbf = useMemo(() => mtbfHours / (mtbfHours + mttrHours), [mtbfHours, mttrHours]);

  return (
    <main className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <Link href="/sandbox" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">← Back to Tools</Link>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">Reliability Calculator</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-2">Estimate availability, downtime, and redundancy needs.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 space-y-4">
          <div>
            <label className="text-sm font-medium">Component Availability</label>
            <input type="range" min={0.9} max={0.9999} step={0.0005} value={componentAvailability} onChange={(e) => setComponentAvailability(Number(e.target.value))} className="w-full" />
            <div className="text-xs text-neutral-500">{percent(componentAvailability)}</div>
          </div>
          <div>
            <label className="text-sm font-medium">Replicas in parallel</label>
            <input type="range" min={1} max={5} step={1} value={replicas} onChange={(e) => setReplicas(Number(e.target.value))} className="w-full" />
            <div className="text-xs text-neutral-500">{replicas} replicas</div>
          </div>
          <div>
            <label className="text-sm font-medium">MTTR (hours)</label>
            <input type="range" min={0.1} max={24} step={0.1} value={mttrHours} onChange={(e) => setMttrHours(Number(e.target.value))} className="w-full" />
            <div className="text-xs text-neutral-500">{mttrHours} h</div>
          </div>
          <div>
            <label className="text-sm font-medium">MTBF (hours)</label>
            <input type="range" min={10} max={10000} step={10} value={mtbfHours} onChange={(e) => setMtbfHours(Number(e.target.value))} className="w-full" />
            <div className="text-xs text-neutral-500">{mtbfHours} h</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
            <h3 className="font-semibold mb-3">Service Availability</h3>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
                <div className="text-neutral-500">With redundancy</div>
                <div className="font-semibold">{percent(serviceAvailability)}</div>
              </div>
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
                <div className="text-neutral-500">Expected downtime / year</div>
                <div className="font-semibold">{annualDowntimeHours.toFixed(2)} h ({(annualDowntimeHours * 60).toFixed(0)} min)</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
            <h3 className="font-semibold mb-3">MTBF/MTTR Approximation</h3>
            <div className="text-sm text-neutral-700 dark:text-neutral-300">Estimated availability: <span className="font-semibold">{percent(availabilityFromMtbf)}</span></div>
            <p className="text-xs text-neutral-500 mt-2">Availability ≈ MTBF / (MTBF + MTTR)</p>
          </div>
        </div>
      </div>
    </main>
  );
}
