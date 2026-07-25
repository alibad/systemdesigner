"use client";
import Link from 'next/link';
import { useState, useMemo } from 'react';
import CompareBars from '@/components/reference/CompareBars';

export default function LoadSimulatorPage() {
  const [inputs, setInputs] = useState({
    baselineRPS: 1000,
    peakRPS: 5000,
    avgResponseTime: 50, // ms
    serverCount: 3,
    cpuThreshold: 80, // %
    memoryThreshold: 85, // %
    dbConnections: 100,
    cacheHitRate: 90, // %
    errorThreshold: 1, // %
    timeoutMs: 5000
  });

  const calculations = useMemo(() => {
    // Server capacity calculations
    const rpsPerServer = Math.floor(inputs.peakRPS / inputs.serverCount);
    const cpuUtilization = Math.min(100, (inputs.peakRPS / (inputs.serverCount * 20))); // Rough estimate: 20 RPS per % CPU
    const memoryUtilization = Math.min(100, (inputs.peakRPS / (inputs.serverCount * 25))); // Rough estimate
    
    // Database load
    const dbQueriesPerSecond = inputs.peakRPS * 1.5; // Assume 1.5 queries per request
    const dbConnectionUtilization = Math.min(100, (dbQueriesPerSecond / inputs.dbConnections) * 100);
    
    // Response time under load
    const loadFactor = inputs.peakRPS / inputs.baselineRPS;
    const responseTimeUnderLoad = inputs.avgResponseTime * Math.pow(loadFactor, 1.5);
    const p99ResponseTime = responseTimeUnderLoad * 3; // P99 typically 3x average under load
    
    // Cache performance
    const cacheHits = inputs.peakRPS * (inputs.cacheHitRate / 100);
    const cacheMisses = inputs.peakRPS - cacheHits;
    const effectiveDbLoad = cacheMisses * 1.5;
    
    // Error rate prediction
    let predictedErrorRate = 0;
    if (cpuUtilization > inputs.cpuThreshold) predictedErrorRate += (cpuUtilization - inputs.cpuThreshold) * 0.1;
    if (memoryUtilization > inputs.memoryThreshold) predictedErrorRate += (memoryUtilization - inputs.memoryThreshold) * 0.15;
    if (dbConnectionUtilization > 90) predictedErrorRate += (dbConnectionUtilization - 90) * 0.2;
    if (responseTimeUnderLoad > inputs.timeoutMs) predictedErrorRate += 10;
    
    predictedErrorRate = Math.min(50, predictedErrorRate); // Cap at 50%
    
    // Recommendations
    const bottlenecks = [];
    if (cpuUtilization > inputs.cpuThreshold) bottlenecks.push('CPU');
    if (memoryUtilization > inputs.memoryThreshold) bottlenecks.push('Memory');
    if (dbConnectionUtilization > 90) bottlenecks.push('Database Connections');
    if (responseTimeUnderLoad > inputs.timeoutMs) bottlenecks.push('Response Time');
    
    const recommendedServers = Math.ceil(inputs.peakRPS / (inputs.baselineRPS / inputs.serverCount * 0.7)); // Target 70% utilization
    
    return {
      rpsPerServer,
      cpuUtilization: Math.round(cpuUtilization),
      memoryUtilization: Math.round(memoryUtilization),
      dbConnectionUtilization: Math.round(dbConnectionUtilization),
      responseTimeUnderLoad: Math.round(responseTimeUnderLoad),
      p99ResponseTime: Math.round(p99ResponseTime),
      cacheHits: Math.round(cacheHits),
      cacheMisses: Math.round(cacheMisses),
      effectiveDbLoad: Math.round(effectiveDbLoad),
      predictedErrorRate: Math.round(predictedErrorRate * 100) / 100,
      bottlenecks,
      recommendedServers,
      loadFactor: Math.round(loadFactor * 100) / 100
    };
  }, [inputs]);

  const updateInput = (key: string, value: string | number) => {
    setInputs(prev => ({
      ...prev,
      [key]: typeof value === 'string' ? parseFloat(value) || 0 : value
    }));
  };

  const getPerformanceStatus = () => {
    if (calculations.predictedErrorRate > inputs.errorThreshold && calculations.bottlenecks.length > 0) {
      return { status: 'critical', color: 'red', message: 'System likely to fail under load' };
    } else if (calculations.bottlenecks.length > 0) {
      return { status: 'warning', color: 'amber', message: 'Performance degradation expected' };
    } else {
      return { status: 'good', color: 'emerald', message: 'System should handle load well' };
    }
  };

  const status = getPerformanceStatus();

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <Link 
          href="/sandbox"
          className="inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mb-4"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Tools
        </Link>
        
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
          Load Testing Simulator
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-6">
          Model how your system will perform under different load scenarios and identify potential bottlenecks.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-6">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Load Test Configuration</h2>
          
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Baseline RPS
                </label>
                <input
                  type="number"
                  value={inputs.baselineRPS}
                  onChange={(e) => updateInput('baselineRPS', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Normal traffic load</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Peak RPS
                </label>
                <input
                  type="number"
                  value={inputs.peakRPS}
                  onChange={(e) => updateInput('peakRPS', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Maximum expected load</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Avg Response Time (ms)
                </label>
                <input
                  type="number"
                  value={inputs.avgResponseTime}
                  onChange={(e) => updateInput('avgResponseTime', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Under normal load</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Server Count
                </label>
                <input
                  type="number"
                  value={inputs.serverCount}
                  onChange={(e) => updateInput('serverCount', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  CPU Threshold (%)
                </label>
                <input
                  type="number"
                  value={inputs.cpuThreshold}
                  onChange={(e) => updateInput('cpuThreshold', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Memory Threshold (%)
                </label>
                <input
                  type="number"
                  value={inputs.memoryThreshold}
                  onChange={(e) => updateInput('memoryThreshold', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  DB Connections
                </label>
                <input
                  type="number"
                  value={inputs.dbConnections}
                  onChange={(e) => updateInput('dbConnections', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Cache Hit Rate (%)
                </label>
                <input
                  type="number"
                  value={inputs.cacheHitRate}
                  onChange={(e) => updateInput('cacheHitRate', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Error Threshold (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={inputs.errorThreshold}
                  onChange={(e) => updateInput('errorThreshold', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Timeout (ms)
                </label>
                <input
                  type="number"
                  value={inputs.timeoutMs}
                  onChange={(e) => updateInput('timeoutMs', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="space-y-6">
          {/* Performance Status */}
          <div className={`rounded-2xl border border-${status.color}-200 dark:border-${status.color}-900/40 bg-${status.color}-50 dark:bg-${status.color}-900/10 p-6`}>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Performance Prediction</h3>
            <div className={`text-2xl font-bold text-${status.color}-600 dark:text-${status.color}-400 mb-2`}>
              {status.status.toUpperCase()}
            </div>
            <p className={`text-sm text-${status.color}-600 dark:text-${status.color}-400`}>
              {status.message}
            </p>
            <div className="mt-3 text-sm">
              <strong>Load Factor:</strong> {calculations.loadFactor}x baseline
            </div>
          </div>

          {/* Resource Utilization */}
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-6">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Resource Utilization</h3>
            <CompareBars
              max={100}
              items={[
                { 
                  label: 'CPU Usage', 
                  leftLabel: 'current', 
                  rightLabel: 'threshold', 
                  leftValue: calculations.cpuUtilization, 
                  rightValue: inputs.cpuThreshold, 
                  unit: '%' 
                },
                { 
                  label: 'Memory Usage', 
                  leftLabel: 'current', 
                  rightLabel: 'threshold', 
                  leftValue: calculations.memoryUtilization, 
                  rightValue: inputs.memoryThreshold, 
                  unit: '%' 
                },
                { 
                  label: 'DB Connections', 
                  leftLabel: 'used', 
                  rightLabel: 'available', 
                  leftValue: calculations.dbConnectionUtilization, 
                  rightValue: 100, 
                  unit: '%' 
                },
              ]}
            />
          </div>

          {/* Response Time Analysis */}
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-6">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Response Time Analysis</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{inputs.avgResponseTime}ms</div>
                <div className="text-sm text-neutral-600 dark:text-neutral-400">Baseline</div>
              </div>
              <div className="text-center">
                <div className={`text-xl font-bold ${calculations.responseTimeUnderLoad > inputs.timeoutMs ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {calculations.responseTimeUnderLoad}ms
                </div>
                <div className="text-sm text-neutral-600 dark:text-neutral-400">Under Load</div>
              </div>
              <div className="text-center">
                <div className={`text-xl font-bold ${calculations.p99ResponseTime > inputs.timeoutMs ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {calculations.p99ResponseTime}ms
                </div>
                <div className="text-sm text-neutral-600 dark:text-neutral-400">P99</div>
              </div>
            </div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">
              <strong>Predicted Error Rate:</strong> {calculations.predictedErrorRate}%
            </div>
          </div>

          {/* Cache Performance */}
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-6">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Cache & Database Load</h3>
            <CompareBars
              max={inputs.peakRPS}
              items={[
                { 
                  label: 'Cache Performance', 
                  leftLabel: 'hits', 
                  rightLabel: 'misses', 
                  leftValue: calculations.cacheHits, 
                  rightValue: calculations.cacheMisses, 
                  unit: ' RPS' 
                },
              ]}
            />
            <div className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
              <strong>Effective DB Load:</strong> {calculations.effectiveDbLoad} queries/sec
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="mt-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-6">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Optimization Recommendations</h3>
        
        {calculations.bottlenecks.length > 0 && (
          <div className="mb-4 p-3 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10">
            <strong className="text-red-700 dark:text-red-300">Identified Bottlenecks:</strong>
            <span className="text-red-600 dark:text-red-400 ml-2">{calculations.bottlenecks.join(', ')}</span>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <strong className="text-neutral-900 dark:text-neutral-100">Scaling:</strong>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              Consider scaling to <strong>{calculations.recommendedServers} servers</strong> for better performance.
              Current: {calculations.rpsPerServer} RPS per server.
            </p>
          </div>
          <div>
            <strong className="text-neutral-900 dark:text-neutral-100">Caching:</strong>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              {inputs.cacheHitRate < 85 
                ? "Improve cache hit rate to reduce database load. Consider cache warming strategies."
                : "Cache performance is good. Monitor cache expiration and invalidation patterns."
              }
            </p>
          </div>
          <div>
            <strong className="text-neutral-900 dark:text-neutral-100">Database:</strong>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              {calculations.dbConnectionUtilization > 80
                ? "Consider connection pooling, read replicas, or database sharding."
                : "Database connections are within acceptable limits."
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
