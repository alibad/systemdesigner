'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  ChartPieIcon,
  EyeIcon,
  DocumentArrowDownIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  CloudArrowDownIcon
} from '@heroicons/react/24/outline';

interface MockupProps {
  title: string;
  description?: string;
}

export default function DashboardMockup({ title, description }: MockupProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const diversityMetrics = [
    { label: 'Topic Coverage', value: 87, status: 'good', target: 85 },
    { label: 'Prompt Variety', value: 73, status: 'warning', target: 80 },
    { label: 'Response Length', value: 92, status: 'good', target: 75 },
    { label: 'Complexity Balance', value: 68, status: 'warning', target: 70 }
  ];

  const topicDistribution = [
    { topic: 'Technology', percentage: 22, color: 'bg-blue-500' },
    { topic: 'Science', percentage: 18, color: 'bg-green-500' },
    { topic: 'Education', percentage: 15, color: 'bg-purple-500' },
    { topic: 'Business', percentage: 14, color: 'bg-orange-500' },
    { topic: 'Health', percentage: 12, color: 'bg-red-500' },
    { topic: 'Arts', percentage: 10, color: 'bg-yellow-500' },
    { topic: 'Sports', percentage: 9, color: 'bg-indigo-500' }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />;
      case 'error':
        return <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />;
      default:
        return <InformationCircleIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{title}</h3>
        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
        )}
      </div>

      {/* Dashboard Header */}
      <div className="p-6 pb-0">
        {/* Simulated Header */}
        <div className="flex items-center justify-between mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
              <ChartBarIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Dataset: Customer_AI_Training_v2.1</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">10,000 prompt-response pairs • Last updated 2 hours ago</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <AdjustmentsHorizontalIcon className="w-5 h-5" />
            </button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2">
              <DocumentArrowDownIcon className="w-4 h-4" />
              <span className="text-sm">Export Report</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-6 border-b border-gray-200 dark:border-gray-600">
          {[
            { id: 'overview', label: 'Overview', icon: ChartBarIcon },
            { id: 'topics', label: 'Topic Analysis', icon: ChartPieIcon },
            { id: 'patterns', label: 'Linguistic Patterns', icon: MagnifyingGlassIcon },
            { id: 'samples', label: 'Sample Explorer', icon: EyeIcon }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-1 py-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Overall Score */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 p-6 rounded-xl border border-green-200 dark:border-green-800"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-green-600 dark:text-green-400">Diversity Score: 82/100</h3>
                  <p className="text-green-700 dark:text-green-300">Ready for Delivery</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Meets quality thresholds across all dimensions</p>
                </div>
                <div className="w-20 h-20 relative">
                  {/* Circular Progress Indicator */}
                  <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-200 dark:text-gray-700" />
                    <circle
                      cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="8" fill="transparent"
                      strokeDasharray={`${82 * 2.01} 201`}
                      className="text-green-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-green-600 dark:text-green-400">82</div>
                </div>
              </div>
            </motion.div>

            {/* Diversity Metrics Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {diversityMetrics.map((metric, index) => (
                <motion.div
                  key={metric.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    hoveredCard === metric.label
                      ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                  }`}
                  onMouseEnter={() => setHoveredCard(metric.label)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{metric.label}</span>
                    {getStatusIcon(metric.status)}
                  </div>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{metric.value}</span>
                    <span className="text-sm text-gray-500">/100</span>
                  </div>
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          metric.status === 'good' ? 'bg-green-500' :
                          metric.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${metric.value}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Target: {metric.target}+</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'topics' && (
          <div className="space-y-6">
            {/* Topic Distribution */}
            <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white mb-4">Topic Distribution</h4>
              <div className="space-y-3">
                {topicDistribution.map((item, index) => (
                  <div key={item.topic} className="flex items-center">
                    <div className="w-24 text-sm font-medium text-gray-700 dark:text-gray-300">{item.topic}</div>
                    <div className="flex-1 mx-4">
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
                        <motion.div
                          className={`h-3 rounded-full ${item.color}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${item.percentage}%` }}
                          transition={{ delay: index * 0.1, duration: 0.5 }}
                        />
                      </div>
                    </div>
                    <div className="w-12 text-sm font-medium text-gray-700 dark:text-gray-300 text-right">{item.percentage}%</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trending Issues */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
              <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Areas for Improvement</h4>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                <li>• Business topics are over-represented (14% vs 10% target)</li>
                <li>• Arts and Sports topics are under-represented (&lt;12% each)</li>
                <li>• Consider adding more diverse cultural perspectives</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'patterns' && (
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">Prompt Starters</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">"Can you..."</span>
                    <span className="font-medium text-red-600">23%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">"How to..."</span>
                    <span className="font-medium text-yellow-600">18%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">"What is..."</span>
                    <span className="font-medium text-green-600">15%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">"Write a..."</span>
                    <span className="font-medium text-red-600">12%</span>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">Response Lengths</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Short (&lt;100 words)</span>
                    <span className="font-medium text-green-600">35%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Medium (100-300)</span>
                    <span className="font-medium text-green-600">45%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Long (&gt;300 words)</span>
                    <span className="font-medium text-green-600">20%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'samples' && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Random Sample Explorer</h4>
              <div className="space-y-4">
                <div className="p-3 bg-white dark:bg-gray-800 rounded border">
                  <div className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">Prompt:</div>
                  <div className="text-sm text-gray-700 dark:text-gray-300 mb-2">"Can you give me one piece of advice to prepare for an interview?"</div>
                  <div className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">Response:</div>
                  <div className="text-sm text-gray-700 dark:text-gray-300">"One piece of advice is to research the company you are interviewing for!"</div>
                  <div className="text-xs text-gray-500 mt-2">Category: Business • Length: 14 words</div>
                </div>
                <button className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600">
                  Load More Samples
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <CheckCircleIcon className="w-4 h-4 text-green-500" />
            <span>Quality thresholds met</span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <CloudArrowDownIcon className="w-4 h-4 text-blue-500" />
            <span>Last sync: 2 hours ago</span>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
            Request Changes
          </button>
          <button className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
            Approve Dataset
          </button>
        </div>
      </div>
    </div>
  );
}