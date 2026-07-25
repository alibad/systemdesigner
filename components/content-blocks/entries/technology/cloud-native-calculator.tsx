'use client';

import { useState } from 'react';

export default function CloudNativeCalculator() {
  const [microservices, setMicroservices] = useState(10);

  const [requestsPerSecond, setRequestsPerSecond] = useState(1000);

  const [deploymentStrategy, setDeploymentStrategy] = useState('canary');

  const [observabilityLevel, setObservabilityLevel] = useState('standard');

  const calculateCloudNativeMetrics = () => {
      // Resource requirements calculations
      const baseMemoryPerService = 512; // MB
      const memoryOverhead = deploymentStrategy === 'blue-green' ? 2.0 :
                            deploymentStrategy === 'canary' ? 1.5 : 1.2;
      const totalMemory = Math.round(microservices * baseMemoryPerService * memoryOverhead);

      // Performance calculations
      const baseThroughput = 100; // RPS per service
      const orchestrationOverhead = microservices > 20 ? 0.85 : microservices > 10 ? 0.9 : 0.95;
      const maxThroughput = Math.round(microservices * baseThroughput * orchestrationOverhead);

      // Container and pod calculations
      const avgPodsPerService = deploymentStrategy === 'blue-green' ? 6 :
                               deploymentStrategy === 'canary' ? 4 : 3;
      const totalPods = microservices * avgPodsPerService;

      // Observability overhead
      const observabilityMultiplier = observabilityLevel === 'basic' ? 1.1 :
                                     observabilityLevel === 'standard' ? 1.2 :
                                     observabilityLevel === 'comprehensive' ? 1.4 : 1.6;
      const observabilityOverhead = Math.round((totalMemory * observabilityMultiplier) - totalMemory);

      // Network mesh overhead
      const serviceMeshOverhead = microservices > 5 ? 0.1 : 0.05; // 5-10% latency overhead
      const estimatedLatency = Math.round(10 + (microservices * 2) + (serviceMeshOverhead * 100));

      // Cost estimation (per month in USD)
      const computeCostPerGB = 30; // rough estimate
      const storageCostPerGB = 5;
      const networkCostPerTB = 90;

      const computeCost = Math.round((totalMemory + observabilityOverhead) / 1024 * computeCostPerGB);
      const storageCost = Math.round(microservices * 2 * storageCostPerGB); // 2GB storage per service
      const networkCost = Math.round((requestsPerSecond * 30 * 24 * 3600 / 1000000000) * networkCostPerTB); // rough network cost
      const totalMonthlyCost = computeCost + storageCost + networkCost;

      // Deployment frequency
      const deploymentFrequency = deploymentStrategy === 'blue-green' ? 'Daily' :
                                 deploymentStrategy === 'canary' ? 'Multiple/day' :
                                 deploymentStrategy === 'rolling' ? 'Hourly' : 'Continuous';

      return {
        totalMemory,
        maxThroughput,
        totalPods,
        observabilityOverhead,
        estimatedLatency,
        totalMonthlyCost,
        deploymentFrequency,
        computeCost,
        storageCost,
        networkCost
      };
    };

  const metrics = calculateCloudNativeMetrics();

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-6 mb-6">
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
                Cloud-Native Architecture Calculator
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      Number of Microservices: {microservices}
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="50"
                      step="1"
                      value={microservices}
                      onChange={(e) => setMicroservices(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      Requests per Second: {requestsPerSecond.toLocaleString()}
                    </label>
                    <input
                      type="range"
                      min="100"
                      max="10000"
                      step="100"
                      value={requestsPerSecond}
                      onChange={(e) => setRequestsPerSecond(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      Deployment Strategy
                    </label>
                    <select
                      value={deploymentStrategy}
                      onChange={(e) => setDeploymentStrategy(e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-3 py-2 text-sm"
                    >
                      <option value="rolling">Rolling Updates</option>
                      <option value="canary">Canary Deployment</option>
                      <option value="blue-green">Blue-Green Deployment</option>
                      <option value="feature-flags">Feature Flag Based</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      Observability Level
                    </label>
                    <select
                      value={observabilityLevel}
                      onChange={(e) => setObservabilityLevel(e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-3 py-2 text-sm"
                    >
                      <option value="basic">Basic (Logs only)</option>
                      <option value="standard">Standard (Metrics + Logs)</option>
                      <option value="comprehensive">Comprehensive (Full stack)</option>
                      <option value="enterprise">Enterprise (AI-powered)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {metrics.maxThroughput.toLocaleString()}
                    </div>
                    <div className="text-sm text-blue-800 dark:text-blue-300">Max RPS</div>
                  </div>
                  <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {metrics.totalMemory.toLocaleString()}MB
                    </div>
                    <div className="text-sm text-green-800 dark:text-green-300">Memory Required</div>
                  </div>
                  <div className="bg-purple-100 dark:bg-purple-900/30 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {metrics.totalPods}
                    </div>
                    <div className="text-sm text-purple-800 dark:text-purple-300">Total Pods</div>
                  </div>
                  <div className="bg-orange-100 dark:bg-orange-900/30 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      ${metrics.totalMonthlyCost}
                    </div>
                    <div className="text-sm text-orange-800 dark:text-orange-300">Monthly Cost</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid md:grid-cols-3 gap-4">
                <div className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    <strong>Latency:</strong> ~{metrics.estimatedLatency}ms
                  </p>
                </div>
                <div className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    <strong>Deployment Frequency:</strong> {metrics.deploymentFrequency}
                  </p>
                </div>
                <div className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    <strong>Observability Overhead:</strong> {metrics.observabilityOverhead}MB
                  </p>
                </div>
              </div>
            </div>
  );
}
