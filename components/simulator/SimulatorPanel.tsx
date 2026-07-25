"use client";

import React, { useMemo, useState } from 'react';

export default function SimulatorPanel({ onClose }: { onClose: () => void }) {
  const [rps, setRps] = useState(1000);
  const [cacheHit, setCacheHit] = useState(0.8);
  const [apiCapacity, setApiCapacity] = useState(3000); // req/s
  const [appCapacity, setAppCapacity] = useState(2000);
  const [dbCapacity, setDbCapacity] = useState(800);
  const [netClientMs, setNetClientMs] = useState(40);
  const [netDatacenterMs, setNetDatacenterMs] = useState(10);
  const [procApiMs, setProcApiMs] = useState(10);
  const [procAppMs, setProcAppMs] = useState(15);
  const [procDbMs, setProcDbMs] = useState(12);

  const utilization = (arrival: number, capacity: number) => Math.min(0.999, arrival / Math.max(1, capacity));
  const mm1_p95 = (serviceMs: number, rho: number) => {
    const mu = 1000 / serviceMs;
    const lambda = mu * rho;
    const w = (rho / (mu - lambda)) * 1000; // ms, waiting
    const sojourn = w + serviceMs;
    return sojourn * 3; // crude p95 multiplier
  };

  const results = useMemo(() => {
    const hit = cacheHit;
    const miss = 1 - hit;

    const apiRho = utilization(rps, apiCapacity);
    const appRho = utilization(rps * miss, appCapacity); // only miss path hits app
    const dbRho = utilization(rps * miss, dbCapacity);

    const p95_api = mm1_p95(procApiMs + netDatacenterMs, apiRho);
    const p95_app = mm1_p95(procAppMs + netDatacenterMs, appRho);
    const p95_db = mm1_p95(procDbMs + netDatacenterMs, dbRho);

    const p95_hit = netClientMs + p95_api; // cache hit path
    const p95_miss = netClientMs + p95_api + p95_app + p95_db;
    const p95_overall = hit * p95_hit + miss * p95_miss;

    return {
      apiRho, appRho, dbRho,
      p95_hit: Math.round(p95_hit),
      p95_miss: Math.round(p95_miss),
      p95_overall: Math.round(p95_overall),
    };
  }, [rps, cacheHit, apiCapacity, appCapacity, dbCapacity, netClientMs, netDatacenterMs, procApiMs, procAppMs, procDbMs]);

  return (
    <div className="absolute top-0 right-0 h-full w-[360px] bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 p-4 overflow-y-auto z-20">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">Performance Simulator</div>
        <button onClick={onClose} className="text-sm px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700">Close</button>
      </div>

      <div className="space-y-3 text-sm">
        <div>
          <div className="flex items-center justify-between"><span>Traffic (RPS)</span><span>{rps}</span></div>
          <input type="range" min={10} max={100000} step={10} value={rps} onChange={(e)=>setRps(Number(e.target.value))} className="w-full" />
        </div>
        <div>
          <div className="flex items-center justify-between"><span>Cache hit rate</span><span>{Math.round(cacheHit*100)}%</span></div>
          <input type="range" min={0.5} max={0.99} step={0.01} value={cacheHit} onChange={(e)=>setCacheHit(Number(e.target.value))} className="w-full" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-neutral-500">API capacity</div>
            <input type="number" value={apiCapacity} onChange={e=>setApiCapacity(Number(e.target.value))} className="w-full px-2 py-1 rounded border" />
          </div>
          <div>
            <div className="text-xs text-neutral-500">App capacity</div>
            <input type="number" value={appCapacity} onChange={e=>setAppCapacity(Number(e.target.value))} className="w-full px-2 py-1 rounded border" />
          </div>
          <div>
            <div className="text-xs text-neutral-500">DB capacity</div>
            <input type="number" value={dbCapacity} onChange={e=>setDbCapacity(Number(e.target.value))} className="w-full px-2 py-1 rounded border" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-neutral-500">Client net (ms)</div>
            <input type="number" value={netClientMs} onChange={e=>setNetClientMs(Number(e.target.value))} className="w-full px-2 py-1 rounded border" />
          </div>
          <div>
            <div className="text-xs text-neutral-500">DC net (ms)</div>
            <input type="number" value={netDatacenterMs} onChange={e=>setNetDatacenterMs(Number(e.target.value))} className="w-full px-2 py-1 rounded border" />
          </div>
          <div>
            <div className="text-xs text-neutral-500">API proc (ms)</div>
            <input type="number" value={procApiMs} onChange={e=>setProcApiMs(Number(e.target.value))} className="w-full px-2 py-1 rounded border" />
          </div>
          <div>
            <div className="text-xs text-neutral-500">App proc (ms)</div>
            <input type="number" value={procAppMs} onChange={e=>setProcAppMs(Number(e.target.value))} className="w-full px-2 py-1 rounded border" />
          </div>
          <div>
            <div className="text-xs text-neutral-500">DB proc (ms)</div>
            <input type="number" value={procDbMs} onChange={e=>setProcDbMs(Number(e.target.value))} className="w-full px-2 py-1 rounded border" />
          </div>
        </div>

        <div className="mt-4 p-3 rounded border border-neutral-200 dark:border-neutral-800">
          <div className="font-medium mb-2">Results</div>
          <div className="text-xs text-neutral-500 mb-1">Utilization</div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>API: {(results.apiRho*100).toFixed(0)}%</div>
            <div>App: {(results.appRho*100).toFixed(0)}%</div>
            <div>DB: {(results.dbRho*100).toFixed(0)}%</div>
          </div>
          <div className="text-xs text-neutral-500 mt-3 mb-1">Latency (p95)</div>
          <div className="space-y-1">
            <div>Hit path: {results.p95_hit} ms</div>
            <div>Miss path: {results.p95_miss} ms</div>
            <div className="font-semibold">Overall: {results.p95_overall} ms</div>
          </div>
        </div>
      </div>
    </div>
  );
}
