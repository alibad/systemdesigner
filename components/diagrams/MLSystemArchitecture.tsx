'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ServerIcon,
  CircleStackIcon,
  CloudIcon,
  CpuChipIcon,
  ArrowRightIcon,
  ArrowDownIcon,
  BoltIcon,
  ChatBubbleOvalLeftIcon,
  PhotoIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

interface ArchitectureProps {
  title: string;
  description?: string;
}

export default function MLSystemArchitecture({ title, description }: ArchitectureProps) {
  const [hoveredComponent, setHoveredComponent] = useState<string | null>(null);

  const components = {
    'api-gateway': {
      name: 'API Gateway',
      description: 'Load balancing and request routing',
      icon: ServerIcon,
      color: 'blue',
      metrics: '50 req/sec peak'
    },
    'embedding-service': {
      name: 'Embedding Service',
      description: 'Text & image model inference',
      icon: CpuChipIcon,
      color: 'purple',
      metrics: '100ms text, 200ms image'
    },
    'vector-db': {
      name: 'Vector Database',
      description: 'HNSW index for similarity search',
      icon: CircleStackIcon,
      color: 'green',
      metrics: '50M vectors, <50ms search'
    },
    'metadata-store': {
      name: 'Metadata Store',
      description: 'PostgreSQL for dataset info',
      icon: CircleStackIcon,
      color: 'indigo',
      metrics: '50M records'
    },
    'threshold-manager': {
      name: 'Threshold Manager',
      description: 'Adaptive similarity thresholds',
      icon: AdjustmentsHorizontalIcon,
      color: 'orange',
      metrics: 'Per-dataset config'
    },
    'feedback-processor': {
      name: 'Feedback Processor',
      description: 'Human feedback ingestion',
      icon: ChartBarIcon,
      color: 'pink',
      metrics: 'Weekly model updates'
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{description}</p>
      )}

      {/* Architecture Diagram */}
      <div className="relative">
        {/* Client Layer */}
        <div className="mb-8">
          <div className="text-center mb-4">
            <div className="inline-flex items-center space-x-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <ChatBubbleOvalLeftIcon className="w-6 h-6 text-blue-500" />
              <span className="font-medium">Text Input</span>
              <PhotoIcon className="w-6 h-6 text-green-500" />
              <span className="font-medium">Image Input</span>
            </div>
          </div>
          <div className="flex justify-center">
            <ArrowDownIcon className="w-5 h-5 text-gray-400" />
          </div>
        </div>

        {/* API Gateway Layer */}
        <div className="mb-8">
          <motion.div
            className={`mx-auto w-64 p-4 rounded-lg border-2 cursor-pointer transition-all ${
              hoveredComponent === 'api-gateway'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
            }`}
            onMouseEnter={() => setHoveredComponent('api-gateway')}
            onMouseLeave={() => setHoveredComponent(null)}
            whileHover={{ scale: 1.02 }}
          >
            <div className="flex items-center justify-center space-x-3">
              <ServerIcon className="w-6 h-6 text-blue-500" />
              <div>
                <div className="font-medium">API Gateway</div>
                <div className="text-xs text-gray-500">Load balancing & routing</div>
              </div>
            </div>
          </motion.div>
          <div className="flex justify-center mt-4">
            <ArrowDownIcon className="w-5 h-5 text-gray-400" />
          </div>
        </div>

        {/* Processing Layer */}
        <div className="mb-8">
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Embedding Service */}
            <motion.div
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                hoveredComponent === 'embedding-service'
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
              }`}
              onMouseEnter={() => setHoveredComponent('embedding-service')}
              onMouseLeave={() => setHoveredComponent(null)}
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center space-x-3">
                <CpuChipIcon className="w-6 h-6 text-purple-500" />
                <div>
                  <div className="font-medium">Embedding Service</div>
                  <div className="text-xs text-gray-500">GPU inference</div>
                  <div className="text-xs text-purple-600 font-mono">~100ms text</div>
                </div>
              </div>
            </motion.div>

            {/* Threshold Manager */}
            <motion.div
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                hoveredComponent === 'threshold-manager'
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                  : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
              }`}
              onMouseEnter={() => setHoveredComponent('threshold-manager')}
              onMouseLeave={() => setHoveredComponent(null)}
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center space-x-3">
                <AdjustmentsHorizontalIcon className="w-6 h-6 text-orange-500" />
                <div>
                  <div className="font-medium">Threshold Manager</div>
                  <div className="text-xs text-gray-500">Adaptive thresholds</div>
                  <div className="text-xs text-orange-600 font-mono">Per-dataset</div>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="flex justify-center">
            <ArrowDownIcon className="w-5 h-5 text-gray-400" />
          </div>
        </div>

        {/* Storage Layer */}
        <div className="mb-8">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Vector Database */}
            <motion.div
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                hoveredComponent === 'vector-db'
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
              }`}
              onMouseEnter={() => setHoveredComponent('vector-db')}
              onMouseLeave={() => setHoveredComponent(null)}
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center space-x-3">
                <CircleStackIcon className="w-6 h-6 text-green-500" />
                <div>
                  <div className="font-medium">Vector Database</div>
                  <div className="text-xs text-gray-500">HNSW indexing</div>
                  <div className="text-xs text-green-600 font-mono">50M vectors</div>
                </div>
              </div>
              <div className="mt-2 flex items-center space-x-2">
                <MagnifyingGlassIcon className="w-4 h-4 text-green-400" />
                <span className="text-xs text-green-600">&lt;50ms search</span>
              </div>
            </motion.div>

            {/* Metadata Store */}
            <motion.div
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                hoveredComponent === 'metadata-store'
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
              }`}
              onMouseEnter={() => setHoveredComponent('metadata-store')}
              onMouseLeave={() => setHoveredComponent(null)}
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center space-x-3">
                <CircleStackIcon className="w-6 h-6 text-indigo-500" />
                <div>
                  <div className="font-medium">Metadata Store</div>
                  <div className="text-xs text-gray-500">PostgreSQL</div>
                  <div className="text-xs text-indigo-600 font-mono">50M records</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Feedback Loop */}
        <div className="border-t border-gray-200 dark:border-gray-600 pt-6">
          <motion.div
            className={`mx-auto w-80 p-4 rounded-lg border-2 cursor-pointer transition-all ${
              hoveredComponent === 'feedback-processor'
                ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20'
                : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
            }`}
            onMouseEnter={() => setHoveredComponent('feedback-processor')}
            onMouseLeave={() => setHoveredComponent(null)}
            whileHover={{ scale: 1.02 }}
          >
            <div className="flex items-center justify-center space-x-3">
              <ChartBarIcon className="w-6 h-6 text-pink-500" />
              <div>
                <div className="font-medium">Feedback & Learning Pipeline</div>
                <div className="text-xs text-gray-500">Human feedback → Model updates</div>
                <div className="text-xs text-pink-600 font-mono">Weekly retraining</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Data Flow Arrows - Hidden on mobile */}
        <div className="hidden md:block absolute inset-0 pointer-events-none">
          {/* Curved arrows showing data flow */}
          <svg className="w-full h-full" viewBox="0 0 400 600">
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7"
                      refX="0" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="rgb(156 163 175)" />
              </marker>
            </defs>

            {/* Feedback loop arrow */}
            <path
              d="M 350 500 Q 380 400 350 100"
              stroke="rgb(156 163 175)"
              strokeWidth="2"
              strokeDasharray="5,5"
              fill="none"
              markerEnd="url(#arrowhead)"
            />
          </svg>
        </div>
      </div>

      {/* Component Details */}
      {hoveredComponent && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
        >
          <div className="flex items-center space-x-3 mb-2">
            {(() => {
              const Component = components[hoveredComponent as keyof typeof components].icon;
              return <Component className="w-5 h-5 text-blue-500" />;
            })()}
            <span className="font-medium">
              {components[hoveredComponent as keyof typeof components].name}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {components[hoveredComponent as keyof typeof components].description}
          </p>
          <div className="text-xs font-mono text-blue-600 dark:text-blue-400">
            {components[hoveredComponent as keyof typeof components].metrics}
          </div>
        </motion.div>
      )}

      {/* Performance Metrics */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            <div className="text-lg font-bold text-blue-600">50 req/s</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Peak throughput</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
            <div className="text-lg font-bold text-green-600">&lt;500ms</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">P95 latency</div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
            <div className="text-lg font-bold text-purple-600">50M</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Total vectors</div>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
            <div className="text-lg font-bold text-orange-600">92%</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Accuracy target</div>
          </div>
        </div>
      </div>
    </div>
  );
}