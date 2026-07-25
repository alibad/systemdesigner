'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRightIcon,
  DocumentTextIcon,
  PhotoIcon,
  CpuChipIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

interface Step {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  timing: string;
  details: string[];
}

export default function DataFlowDiagram() {
  const [selectedStep, setSelectedStep] = useState<string | null>(null);

  const steps: Step[] = [
    {
      id: 'input',
      title: 'Content Input',
      description: 'New text or image to check',
      icon: DocumentTextIcon,
      color: 'blue',
      timing: '~0ms',
      details: [
        'Dataset ID and content type validation',
        'Content preprocessing and normalization',
        'Request rate limiting and authentication'
      ]
    },
    {
      id: 'embedding',
      title: 'Embedding Generation',
      description: 'Convert to vector representation',
      icon: CpuChipIcon,
      color: 'purple',
      timing: '~100-200ms',
      details: [
        'Text: sentence-transformers/all-MiniLM-L6-v2',
        'Images: CLIP ViT-B/32 + perceptual hashing',
        'GPU batching for efficiency',
        'Embedding normalization and validation'
      ]
    },
    {
      id: 'search',
      title: 'Similarity Search',
      description: 'Find similar content in dataset',
      icon: MagnifyingGlassIcon,
      color: 'green',
      timing: '~50ms',
      details: [
        'HNSW approximate nearest neighbor search',
        'Top-K candidate retrieval (K=50)',
        'Dataset-specific index partitioning',
        'Distance metric optimization'
      ]
    },
    {
      id: 'evaluation',
      title: 'Threshold Evaluation',
      description: 'Apply similarity thresholds',
      icon: ClockIcon,
      color: 'orange',
      timing: '~10ms',
      details: [
        'Per-dataset threshold configuration',
        'Multi-metric similarity scoring',
        'Confidence interval calculation',
        'Business rule evaluation'
      ]
    },
    {
      id: 'result',
      title: 'Duplicate Decision',
      description: 'Return duplicate/unique result',
      icon: CheckCircleIcon,
      color: 'indigo',
      timing: '~5ms',
      details: [
        'Duplicate flag and confidence score',
        'List of similar items with scores',
        'Reasoning and explanation data',
        'Response formatting and logging'
      ]
    }
  ];

  const getColorClasses = (color: string, isSelected: boolean = false) => {
    const baseClasses = {
      blue: `border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300`,
      purple: `border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300`,
      green: `border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300`,
      orange: `border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300`,
      indigo: `border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300`
    };

    const defaultClasses = 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300';

    return isSelected || selectedStep === null ? (baseClasses[color as keyof typeof baseClasses] || defaultClasses) : defaultClasses;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Duplicate Detection Data Flow</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        End-to-end processing pipeline for real-time duplicate detection
      </p>

      {/* Flow Diagram */}
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={step.id}>
            {/* Step Card */}
            <motion.div
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                getColorClasses(step.color, selectedStep === step.id)
              }`}
              onMouseEnter={() => setSelectedStep(step.id)}
              onMouseLeave={() => setSelectedStep(null)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <step.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-medium">{step.title}</h4>
                    <p className="text-sm opacity-80">{step.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono font-medium">{step.timing}</div>
                  <div className="text-xs opacity-70">avg latency</div>
                </div>
              </div>

              {/* Expanded Details */}
              {selectedStep === step.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 pt-4 border-t border-current border-opacity-20"
                >
                  <ul className="space-y-2">
                    {step.details.map((detail, detailIndex) => (
                      <li key={detailIndex} className="text-sm flex items-start space-x-2">
                        <span className="text-current opacity-50">•</span>
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </motion.div>

            {/* Arrow between steps */}
            {index < steps.length - 1 && (
              <div className="flex justify-center py-2">
                <ArrowRightIcon className="w-5 h-5 text-gray-400 transform rotate-90" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Parallel Processing Note */}
      <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Optimization Strategies</h4>
        <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
          <li>• <strong>GPU Batching:</strong> Process multiple embeddings simultaneously</li>
          <li>• <strong>Index Partitioning:</strong> Search only relevant dataset partitions</li>
          <li>• <strong>Caching:</strong> Cache embeddings for recently processed content</li>
          <li>• <strong>Async Processing:</strong> Pipeline stages for higher throughput</li>
        </ul>
      </div>

      {/* Performance Summary */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-lg font-bold text-blue-600">~365ms</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Total latency</div>
          </div>
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-lg font-bold text-green-600">95%</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">&lt; 500ms SLA</div>
          </div>
          <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div className="text-lg font-bold text-purple-600">50</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">req/sec capacity</div>
          </div>
          <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <div className="text-lg font-bold text-orange-600">92%</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">accuracy target</div>
          </div>
        </div>
      </div>
    </div>
  );
}