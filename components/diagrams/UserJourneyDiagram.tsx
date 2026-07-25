'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  UserCircleIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  DocumentCheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ChatBubbleBottomCenterTextIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';

interface JourneyStep {
  id: string;
  title: string;
  description: string;
  duration: string;
  actions: string[];
  thoughts: string[];
  painPoints?: string[];
  icon: React.ComponentType<any>;
  color: string;
}

export default function UserJourneyDiagram() {
  const [selectedStep, setSelectedStep] = useState<string | null>(null);

  const journeySteps: JourneyStep[] = [
    {
      id: 'arrival',
      title: 'Initial Assessment',
      description: 'Customer opens dashboard for first impression',
      duration: '30 seconds',
      actions: [
        'Opens dataset diversity dashboard',
        'Views overall diversity score',
        'Checks dataset status indicator',
        'Scans key metrics at a glance'
      ],
      thoughts: [
        '"Is this dataset good enough for our AI model?"',
        '"Can I trust this quality assessment?"',
        '"Do I need to dig deeper or approve quickly?"'
      ],
      painPoints: [
        'Information overload on first visit',
        'Unclear what score means in business context'
      ],
      icon: UserCircleIcon,
      color: 'blue'
    },
    {
      id: 'investigation',
      title: 'Deep Dive Investigation',
      description: 'Explores specific areas showing concerns',
      duration: '2-5 minutes',
      actions: [
        'Clicks into yellow/red flagged metrics',
        'Explores topic distribution breakdown',
        'Reviews linguistic pattern analysis',
        'Identifies specific problem areas'
      ],
      thoughts: [
        '"Why is prompt variety scored low?"',
        '"Are we missing important topics?"',
        '"Is the linguistic diversity sufficient?"'
      ],
      painPoints: [
        'Too much drill-down required for simple questions',
        'Hard to understand business impact of technical metrics'
      ],
      icon: MagnifyingGlassIcon,
      color: 'purple'
    },
    {
      id: 'validation',
      title: 'Quality Validation',
      description: 'Samples actual content to verify metrics',
      duration: '5-10 minutes',
      actions: [
        'Uses sample explorer to view examples',
        'Manually reviews flagged content areas',
        'Compares samples across different topics',
        'Validates diversity claims with real data'
      ],
      thoughts: [
        '"Do these samples match the diversity claims?"',
        '"Is the quality actually good enough?"',
        '"Should I request specific improvements?"'
      ],
      painPoints: [
        'Sample selection may not be representative',
        'Hard to spot-check large datasets manually'
      ],
      icon: EyeIcon,
      color: 'green'
    },
    {
      id: 'decision',
      title: 'Decision & Action',
      description: 'Makes final approval or requests changes',
      duration: '1-2 minutes',
      actions: [
        'Reviews summary of findings',
        'Exports detailed report for records',
        'Either approves dataset or flags issues',
        'Communicates decision to delivery team'
      ],
      thoughts: [
        '"Is this ready for our production model?"',
        '"What specific changes do we need?"',
        '"When can we expect the improved version?"'
      ],
      painPoints: [
        'Unclear how to communicate specific change requests',
        'No visibility into timeline for improvements'
      ],
      icon: DocumentCheckIcon,
      color: 'orange'
    }
  ];

  const getColorClasses = (color: string) => {
    const colorMap = {
      blue: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
      purple: 'border-purple-500 bg-purple-50 dark:bg-purple-900/20',
      green: 'border-green-500 bg-green-50 dark:bg-green-900/20',
      orange: 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
    };
    return colorMap[color as keyof typeof colorMap] || 'border-gray-200 bg-gray-50';
  };

  const getIconColor = (color: string) => {
    const colorMap = {
      blue: 'text-blue-600',
      purple: 'text-purple-600',
      green: 'text-green-600',
      orange: 'text-orange-600'
    };
    return colorMap[color as keyof typeof colorMap] || 'text-gray-600';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Customer User Journey</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Typical flow for external customers reviewing dataset diversity and quality
        </p>
      </div>

      {/* Journey Timeline */}
      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute left-8 top-12 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-600 hidden md:block" />

        {/* Journey Steps */}
        <div className="space-y-8">
          {journeySteps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.2 }}
              className="relative"
            >
              {/* Step Circle */}
              <div className="absolute left-6 w-4 h-4 bg-white dark:bg-gray-800 rounded-full border-2 border-gray-300 dark:border-gray-600 hidden md:block z-10" />

              {/* Step Content */}
              <div className="md:ml-16">
                <motion.div
                  className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedStep === step.id
                      ? getColorClasses(step.color)
                      : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                  }`}
                  onClick={() => setSelectedStep(selectedStep === step.id ? null : step.id)}
                  whileHover={{ scale: 1.01 }}
                >
                  {/* Step Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <step.icon className={`w-6 h-6 ${getIconColor(step.color)}`} />
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">{step.title}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{step.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <ClockIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{step.duration}</span>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {selectedStep === step.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-t border-gray-200 dark:border-gray-600 pt-4"
                    >
                      <div className="grid md:grid-cols-3 gap-6">
                        {/* Actions */}
                        <div>
                          <h5 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                            <CheckCircleIcon className="w-4 h-4 text-green-500 mr-2" />
                            Actions Taken
                          </h5>
                          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                            {step.actions.map((action, actionIndex) => (
                              <li key={actionIndex} className="flex items-start">
                                <span className="text-gray-400 mr-2">•</span>
                                {action}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Thoughts */}
                        <div>
                          <h5 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                            <ChatBubbleBottomCenterTextIcon className="w-4 h-4 text-blue-500 mr-2" />
                            Customer Thoughts
                          </h5>
                          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                            {step.thoughts.map((thought, thoughtIndex) => (
                              <li key={thoughtIndex} className="italic">
                                {thought}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Pain Points */}
                        <div>
                          <h5 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                            <ExclamationTriangleIcon className="w-4 h-4 text-red-500 mr-2" />
                            Pain Points
                          </h5>
                          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                            {step.painPoints?.map((painPoint, painIndex) => (
                              <li key={painIndex} className="flex items-start">
                                <span className="text-red-400 mr-2">⚠</span>
                                {painPoint}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              </div>

              {/* Arrow to next step */}
              {index < journeySteps.length - 1 && (
                <div className="hidden md:flex justify-center mt-4">
                  <ArrowRightIcon className="w-5 h-5 text-gray-400 transform rotate-90" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Success Metrics */}
      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-600">
        <h4 className="font-medium text-gray-900 dark:text-white mb-4">Success Metrics</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-lg font-bold text-blue-600">&lt;15 min</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Total review time</div>
          </div>
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-lg font-bold text-green-600">90%</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Find dashboard useful</div>
          </div>
          <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div className="text-lg font-bold text-purple-600">85%</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Confident in quality</div>
          </div>
          <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <div className="text-lg font-bold text-orange-600">40%</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Fewer revisions</div>
          </div>
        </div>
      </div>
    </div>
  );
}