"use client";
import Link from 'next/link';
import { useState, useMemo } from 'react';
import CompareBars from '@/components/reference/CompareBars';

export default function CapacityCalculatorPage() {
  const [inputs, setInputs] = useState({
    currentUsers: 10000,
    growthRate: 20, // % per year
    timeHorizon: 24, // months
    avgDataPerUser: 50, // MB
    activeUserRatio: 0.1, // 10% active at any time
    requestsPerActiveUser: 10, // requests per minute
    avgResponseSize: 5, // KB
    replicationFactor: 3,
    dataRetention: 24, // months
    peakTrafficMultiplier: 3
  });

  const calculations = useMemo(() => {
    const monthlyGrowthRate = Math.pow(1 + inputs.growthRate / 100, 1/12) - 1;
    const futureUsers = inputs.currentUsers * Math.pow(1 + monthlyGrowthRate, inputs.timeHorizon);
    
    // Storage calculations
    const totalDataMB = futureUsers * inputs.avgDataPerUser;
    const totalDataGB = totalDataMB / 1024;
    const totalDataTB = totalDataGB / 1024;
    const replicatedStorageTB = totalDataTB * inputs.replicationFactor;
    
    // Traffic calculations
    const activeUsers = futureUsers * inputs.activeUserRatio;
    const requestsPerSecond = (activeUsers * inputs.requestsPerActiveUser) / 60;
    const peakRPS = requestsPerSecond * inputs.peakTrafficMultiplier;
    
    // Bandwidth calculations
    const avgBandwidthMbps = (requestsPerSecond * inputs.avgResponseSize * 8) / 1000; // Convert KB/s to Mbps
    const peakBandwidthMbps = avgBandwidthMbps * inputs.peakTrafficMultiplier;
    
    // Cost estimates (rough AWS pricing)
    const storageCostPerTB = 23; // S3 standard per month
    const bandwidthCostPerGB = 0.09; // Data transfer out
    const monthlyStotageCost = replicatedStorageTB * storageCostPerTB;
    const monthlyBandwidthGB = (avgBandwidthMbps * 60 * 60 * 24 * 30) / 8 / 1000; // Convert to GB/month
    const monthlyBandwidthCost = monthlyBandwidthGB * bandwidthCostPerGB;
    
    return {
      currentUsers: inputs.currentUsers,
      futureUsers: Math.round(futureUsers),
      userGrowth: Math.round(((futureUsers - inputs.currentUsers) / inputs.currentUsers) * 100),
      
      // Storage
      totalDataTB: Math.round(totalDataTB * 100) / 100,
      replicatedStorageTB: Math.round(replicatedStorageTB * 100) / 100,
      
      // Traffic
      activeUsers: Math.round(activeUsers),
      avgRPS: Math.round(requestsPerSecond),
      peakRPS: Math.round(peakRPS),
      
      // Bandwidth
      avgBandwidthMbps: Math.round(avgBandwidthMbps * 100) / 100,
      peakBandwidthMbps: Math.round(peakBandwidthMbps * 100) / 100,
      
      // Costs
      monthlyStotageCost: Math.round(monthlyStotageCost),
      monthlyBandwidthCost: Math.round(monthlyBandwidthCost),
      totalMonthlyCost: Math.round(monthlyStotageCost + monthlyBandwidthCost)
    };
  }, [inputs]);

  const updateInput = (key: string, value: string | number) => {
    setInputs(prev => ({
      ...prev,
      [key]: typeof value === 'string' ? parseFloat(value) || 0 : value
    }));
  };

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
          Capacity Planning Calculator
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-6">
          Plan your system's storage, bandwidth, and cost requirements based on user growth projections.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-6">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">System Parameters</h2>
          
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Current Users
                </label>
                <input
                  type="number"
                  value={inputs.currentUsers}
                  onChange={(e) => updateInput('currentUsers', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Growth Rate (% per year)
                </label>
                <input
                  type="number"
                  value={inputs.growthRate}
                  onChange={(e) => updateInput('growthRate', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Time Horizon (months)
                </label>
                <input
                  type="number"
                  value={inputs.timeHorizon}
                  onChange={(e) => updateInput('timeHorizon', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Data per User (MB)
                </label>
                <input
                  type="number"
                  value={inputs.avgDataPerUser}
                  onChange={(e) => updateInput('avgDataPerUser', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Active User Ratio (0-1)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={inputs.activeUserRatio}
                  onChange={(e) => updateInput('activeUserRatio', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Requests per Active User/min
                </label>
                <input
                  type="number"
                  value={inputs.requestsPerActiveUser}
                  onChange={(e) => updateInput('requestsPerActiveUser', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Avg Response Size (KB)
                </label>
                <input
                  type="number"
                  value={inputs.avgResponseSize}
                  onChange={(e) => updateInput('avgResponseSize', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Replication Factor
                </label>
                <input
                  type="number"
                  value={inputs.replicationFactor}
                  onChange={(e) => updateInput('replicationFactor', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Peak Traffic Multiplier
              </label>
              <input
                type="number"
                value={inputs.peakTrafficMultiplier}
                onChange={(e) => updateInput('peakTrafficMultiplier', e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              />
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                How much higher is peak traffic vs average (e.g., 3x means peak is 3 times average)
              </p>
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="space-y-6">
          {/* User Growth */}
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-6">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">User Growth Projection</h3>
            <CompareBars
              max={calculations.futureUsers}
              items={[
                { 
                  label: 'User Growth', 
                  leftLabel: 'current', 
                  rightLabel: 'projected', 
                  leftValue: calculations.currentUsers, 
                  rightValue: calculations.futureUsers, 
                  unit: ' users' 
                },
              ]}
            />
            <div className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
              <strong>{calculations.userGrowth}% growth</strong> over {inputs.timeHorizon} months
            </div>
          </div>

          {/* Storage Requirements */}
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-6">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Storage Requirements</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{calculations.totalDataTB} TB</div>
                <div className="text-sm text-neutral-600 dark:text-neutral-400">Raw Data</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{calculations.replicatedStorageTB} TB</div>
                <div className="text-sm text-neutral-600 dark:text-neutral-400">With Replication</div>
              </div>
            </div>
          </div>

          {/* Traffic Analysis */}
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-6">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Traffic Analysis</h3>
            <CompareBars
              max={calculations.peakRPS}
              items={[
                { 
                  label: 'Requests/Second', 
                  leftLabel: 'average', 
                  rightLabel: 'peak', 
                  leftValue: calculations.avgRPS, 
                  rightValue: calculations.peakRPS, 
                  unit: ' RPS' 
                },
                { 
                  label: 'Bandwidth', 
                  leftLabel: 'average', 
                  rightLabel: 'peak', 
                  leftValue: calculations.avgBandwidthMbps, 
                  rightValue: calculations.peakBandwidthMbps, 
                  unit: ' Mbps' 
                },
              ]}
            />
            <div className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
              <strong>{calculations.activeUsers.toLocaleString()}</strong> active users at any time
            </div>
          </div>

          {/* Cost Estimate */}
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-6">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Monthly Cost Estimate (AWS)</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-neutral-600 dark:text-neutral-400">Storage</span>
                <span className="font-semibold">${calculations.monthlyStotageCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-600 dark:text-neutral-400">Bandwidth</span>
                <span className="font-semibold">${calculations.monthlyBandwidthCost.toLocaleString()}</span>
              </div>
              <div className="border-t border-neutral-200 dark:border-neutral-700 pt-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">Total Monthly</span>
                  <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                    ${calculations.totalMonthlyCost.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
              * Estimates based on AWS S3 and data transfer pricing. Does not include compute costs.
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="mt-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-6">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Scaling Recommendations</h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <strong className="text-neutral-900 dark:text-neutral-100">Storage Strategy:</strong>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              {calculations.replicatedStorageTB > 100 
                ? "Consider object storage with tiered pricing. Implement data lifecycle policies."
                : calculations.replicatedStorageTB > 10
                ? "Use managed database services with automated backups and scaling."
                : "Standard database setup with regular backups should be sufficient."
              }
            </p>
          </div>
          <div>
            <strong className="text-neutral-900 dark:text-neutral-100">Traffic Handling:</strong>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              {calculations.peakRPS > 10000
                ? "Implement CDN, load balancing, and auto-scaling. Consider caching layers."
                : calculations.peakRPS > 1000
                ? "Use load balancer with multiple servers. Implement caching for static content."
                : "Single server with proper monitoring should handle the load."
              }
            </p>
          </div>
          <div>
            <strong className="text-neutral-900 dark:text-neutral-100">Cost Optimization:</strong>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              {calculations.totalMonthlyCost > 10000
                ? "Consider reserved instances, spot instances, and multi-cloud strategies."
                : calculations.totalMonthlyCost > 1000
                ? "Use reserved capacity for predictable workloads. Monitor usage patterns."
                : "Pay-as-you-go pricing is likely most cost-effective."
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
