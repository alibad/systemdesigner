'use client';

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle2, Lightbulb, Target, Timer, Trophy } from 'lucide-react';
import { useQuizProgress } from '@/hooks/useQuizProgress';
import { useGamification } from '@/contexts/GamificationContext';
import { userStorage } from '@/lib/unified-storage';
import { useAuth } from '@/hooks/useAuth';

interface CalculatorProps {
  title: string;
  description?: string;
  type: 'scaling' | 'sla';
  fields: {
    label: string;
    key: string;
    type: 'number' | 'select';
    unit?: string;
    options?: { value: string | number; label: string }[];
    defaultValue?: number | string;
    min?: number;
    max?: number;
  }[];
}

export function InteractiveCalculator({ title, description, type, fields }: CalculatorProps) {
  const [inputs, setInputs] = useState<Record<string, number | string>>(
    fields.reduce((acc, field) => ({
      ...acc,
      [field.key]: field.defaultValue || (field.type === 'number' ? 0 : field.options?.[0]?.value || '')
    }), {})
  );

  const handleInputChange = (key: string, value: number | string) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };

  const calculateResult = () => {
    if (type === 'scaling') {
      const scaleFactor = (inputs.targetUsers as number) / (inputs.currentUsers as number);
      const baseCost = inputs.currentCost as number;
      
      // Calculate both vertical and horizontal scaling results
      const verticalCost = baseCost * Math.pow(scaleFactor, 1.5);
      const horizontalServers = Math.ceil(scaleFactor);
      const horizontalCost = baseCost * horizontalServers;
      
      return {
        vertical: {
          result: Math.round(verticalCost),
          unit: '$/month',
          explanation: `Vertical scaling becomes ${Math.round((verticalCost / baseCost) * 10) / 10}x more expensive due to premium hardware costs`,
          breakdown: [
            { label: 'Scale Factor', value: `${Math.round(scaleFactor * 10) / 10}x` },
            { label: 'Cost Multiplier', value: `${Math.round(Math.pow(scaleFactor, 1.5) * 10) / 10}x` },
            { label: 'Total Servers', value: '1 (bigger)' }
          ]
        },
        horizontal: {
          result: Math.round(horizontalCost),
          unit: '$/month',
          explanation: `Horizontal scaling requires ${horizontalServers} servers but costs scale linearly`,
          breakdown: [
            { label: 'Scale Factor', value: `${Math.round(scaleFactor * 10) / 10}x` },
            { label: 'Number of Servers', value: horizontalServers.toString() },
            { label: 'Cost per Server', value: `$${baseCost}` }
          ]
        }
      };
    } else if (type === 'sla') {
      const availability = inputs.availability as number;
      const revenuePerHour = inputs.revenuePerHour as number;
      const infraCost = inputs.infraCost as number;
      
      const downtimePercentage = (100 - availability) / 100;
      const hoursPerYear = 365 * 24;
      const downtimeHours = hoursPerYear * downtimePercentage;
      const revenueLoss = downtimeHours * revenuePerHour;
      const costMultiplier = availability >= 99.99 ? 3 : availability >= 99.9 ? 2 : 1;
      const totalInfraCost = infraCost * costMultiplier;
      
      return {
        result: Math.round(downtimeHours * 100) / 100,
        unit: 'hours/year',
        explanation: `${availability}% availability means ${Math.round(downtimeHours * 100) / 100} hours downtime per year`,
        breakdown: [
          { label: 'Downtime/Year', value: `${Math.round(downtimeHours * 100) / 100} hours` },
          { label: 'Revenue Loss', value: `$${Math.round(revenueLoss).toLocaleString()}` },
          { label: 'Infra Cost Multiplier', value: `${costMultiplier}x` },
          { label: 'Total Infra Cost', value: `$${Math.round(totalInfraCost).toLocaleString()}/month` }
        ]
      };
    }
    
    return { result: 0, unit: '', explanation: '', breakdown: [] };
  };

  const result = calculateResult();

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-6 mb-6">
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
        🧮 {title}
      </h3>
      {description && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">{description}</p>
      )}
      
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h4 className="font-medium text-neutral-900 dark:text-neutral-100">Inputs</h4>
          {fields.map(field => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {field.label}
              </label>
              {field.type === 'number' ? (
                <div className="relative">
                  <input
                    type="number"
                    value={inputs[field.key] as number}
                    onChange={(e) => handleInputChange(field.key, Number(e.target.value))}
                    min={field.min}
                    max={field.max}
                    className={`w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      field.unit ? 'pr-24' : 'pr-8'
                    } [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {field.unit && (
                      <span className="text-sm text-neutral-500 dark:text-neutral-400 pointer-events-none mr-1">
                        {field.unit}
                      </span>
                    )}
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => handleInputChange(field.key, Math.min((inputs[field.key] as number) + 1, field.max || Infinity))}
                        className="w-5 h-3 flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 text-xs leading-none hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-t"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInputChange(field.key, Math.max((inputs[field.key] as number) - 1, field.min || 0))}
                        className="w-5 h-3 flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 text-xs leading-none hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-b"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <select
                  value={inputs[field.key] as string}
                  onChange={(e) => handleInputChange(field.key, e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {field.options?.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <h4 className="font-medium text-neutral-900 dark:text-neutral-100">
            {type === 'scaling' ? 'Scaling Comparison' : 'Result'}
          </h4>
          {type === 'scaling' && result.vertical && result.horizontal ? (
            <div className="space-y-4">
              {/* Vertical Scaling Result */}
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/10 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-semibold text-emerald-700 dark:text-emerald-300">Vertical Scaling</h5>
                  <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                    {result.vertical.result} {result.vertical.unit}
                  </div>
                </div>
                <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-3">
                  {result.vertical.explanation}
                </p>
                <div className="space-y-1">
                  {result.vertical.breakdown.map((item, index) => (
                    <div key={index} className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
                      <span>{item.label}:</span>
                      <span>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Horizontal Scaling Result */}
              <div className="rounded-lg border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/10 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-semibold text-blue-700 dark:text-blue-300">Horizontal Scaling</h5>
                  <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
                    {result.horizontal.result} {result.horizontal.unit}
                  </div>
                </div>
                <p className="text-sm text-blue-600 dark:text-blue-400 mb-3">
                  {result.horizontal.explanation}
                </p>
                <div className="space-y-1">
                  {result.horizontal.breakdown.map((item, index) => (
                    <div key={index} className="flex justify-between text-xs text-blue-600 dark:text-blue-400">
                      <span>{item.label}:</span>
                      <span>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cost Comparison */}
              <div className="rounded-lg border border-purple-200 dark:border-purple-900/40 bg-purple-50 dark:bg-purple-900/10 p-3">
                <div className="text-sm text-purple-700 dark:text-purple-300">
                  <strong>💡 Quick Comparison:</strong> 
                  {result.horizontal.result < result.vertical.result 
                    ? ` Horizontal scaling is ${Math.round((result.vertical.result / result.horizontal.result) * 10) / 10}x cheaper for this scenario`
                    : ` Vertical scaling is ${Math.round((result.horizontal.result / result.vertical.result) * 10) / 10}x cheaper for this scenario`
                  }
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50 dark:bg-indigo-900/10 p-4">
              <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300 mb-2">
                {result.result} {result.unit}
              </div>
              {result.explanation && (
                <p className="text-sm text-indigo-600 dark:text-indigo-400 mb-3">
                  {result.explanation}
                </p>
              )}
              {result.breakdown && (
                <div className="space-y-1">
                  {result.breakdown.map((item, index) => (
                    <div key={index} className="flex justify-between text-xs text-indigo-600 dark:text-indigo-400">
                      <span>{item.label}:</span>
                      <span>{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ScenarioProps {
  title: string;
  description: string;
  category?: string; // Add category prop for proper progress tracking
  scenarios: {
    name: string;
    description: string;
    metrics: { label: string; value: string; color?: string }[];
    outcome: string;
    lessons: string[];
  }[];
}

export function ScenarioAnalysis({ title, description, category = 'fundamentals', scenarios }: ScenarioProps) {
  const [selectedScenario, setSelectedScenario] = useState(0);
  const [readTimes, setReadTimes] = useState<Record<number, number>>({});
  const [completedScenarios, setCompletedScenarios] = useState<Set<number>>(new Set());
  const [previousScenario, setPreviousScenario] = useState<number | null>(null);
  const [isClient, setIsClient] = useState(false);
  const { user } = useAuth();

  // Ensure client-side only and load saved completion status from UnifiedStorage
  useEffect(() => {
    setIsClient(true);

    const loadProgress = async () => {
      try {
        // Set user for UnifiedStorage
        if (user !== undefined) {
          await userStorage.setUser(user);
        }

        // Get scenario progress from UnifiedStorage using the correct category
        const progressData = await userStorage.getProgress(category);
        const scenarioBaseId = title.replace(/\s+/g, '-').toLowerCase();

        // Check for individual scenario completions
        const completedIndices: number[] = [];
        scenarios.forEach((_, index) => {
          const scenarioItemId = `${scenarioBaseId}-scenario-${index}`;
          if (progressData[scenarioItemId]?.completed) {
            completedIndices.push(index);
          }
        });

        setCompletedScenarios(new Set(completedIndices));
      } catch (error) {
        console.log('Failed to load scenario completion status:', error);
      }
    };

    loadProgress();
  }, [title, user, scenarios, category]);

  // Track if this is the initial load to prevent saving on mount
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const previousCompletedCount = useRef(0);

  // Save completion status to UnifiedStorage only on actual user changes
  useEffect(() => {
    // Only save if user has actually interacted and the completion count changed
    const currentCount = completedScenarios.size;
    const shouldSave = hasUserInteracted && currentCount !== previousCompletedCount.current;

    if (!isClient || !shouldSave) {
      previousCompletedCount.current = currentCount;
      return;
    }

    const saveProgress = async () => {
      console.log('💾 SCENARIO SAVE: User interaction - saving', completedScenarios.size, 'completed scenarios');
      try {
        const scenarioBaseId = title.replace(/\s+/g, '-').toLowerCase();
        const completedArray = Array.from(completedScenarios);

        // Only save the scenarios that are actually completed
        for (const completedIndex of completedArray) {
          const scenarioItemId = `${scenarioBaseId}-scenario-${completedIndex}`;
          const progressData: any = {
            completed: true,
            timeSpent: readTimes[completedIndex] || 0,
            score: 100,
            completedAt: new Date().toISOString()
          };

          await userStorage.setProgress(category, scenarioItemId, progressData);
        }
      } catch (error) {
        console.log('Failed to save scenario progress:', error);
      }
    };

    saveProgress();
    previousCompletedCount.current = currentCount;
  }, [completedScenarios, isClient, title, scenarios, hasUserInteracted, readTimes, category]);

  // Track reading time for selected scenario (client-side only)
  useEffect(() => {
    if (!isClient) return;
    
    const startTime = Date.now();
    
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setReadTimes(prev => ({ ...prev, [selectedScenario]: elapsed }));
      
      // Auto-complete after 20s on same scenario
      if (elapsed >= 20 && !completedScenarios.has(selectedScenario)) {
        setCompletedScenarios(prev => new Set([...prev, selectedScenario]));
        setHasUserInteracted(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [selectedScenario, completedScenarios, isClient]);

  // Handle scenario switching with auto-completion
  useEffect(() => {
    if (!isClient) return;
    
    if (previousScenario !== null && previousScenario !== selectedScenario) {
      const timeSpent = readTimes[previousScenario] || 0;
      // Auto-complete previous scenario if spent 10+ seconds
      if (timeSpent >= 10 && !completedScenarios.has(previousScenario)) {
        setCompletedScenarios(prev => new Set([...prev, previousScenario]));
      }
    }
    setPreviousScenario(selectedScenario);
  }, [selectedScenario, readTimes, completedScenarios, previousScenario, isClient]);

  const toggleScenarioCompletion = (index: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection
    setCompletedScenarios(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-4 md:p-6 mb-6">
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
        🎯 {title}
      </h3>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">{description}</p>

      {/* Mobile: Accordion-style expandable list */}
      <div className="md:hidden space-y-3">
        {scenarios.map((scenario, index) => {
          const isExpanded = selectedScenario === index;
          const isCompleted = completedScenarios.has(index);

          return (
            <div
              key={index}
              className={`rounded-lg border transition-all ${
                isExpanded
                  ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 shadow-md'
                  : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50'
              }`}
            >
              {/* Accordion Header - Always Visible.
                  Uses a div with role="button" (not a real <button>) so the
                  completion-checkbox <button> below can nest without producing
                  invalid HTML (button-in-button), which broke hydration. */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSelectedScenario(isExpanded ? -1 : index);
                  setHasUserInteracted(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedScenario(isExpanded ? -1 : index);
                    setHasUserInteracted(true);
                  }
                }}
                aria-expanded={isExpanded}
                className="w-full flex items-start gap-3 p-4 text-left cursor-pointer"
              >
                {/* Expand/Collapse Icon */}
                <div className="flex-shrink-0 mt-1">
                  <svg
                    className={`w-5 h-5 text-neutral-600 dark:text-neutral-400 transition-transform ${
                      isExpanded ? 'rotate-90' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>

                {/* Title and Description */}
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold text-sm mb-1 ${isCompleted ? 'line-through text-neutral-500 dark:text-neutral-400' : 'text-neutral-900 dark:text-neutral-100'}`}>
                    {scenario.name}
                  </div>
                  <div className="text-xs text-neutral-600 dark:text-neutral-400">
                    {scenario.description}
                  </div>
                </div>

                {/* Completion Checkbox */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleScenarioCompletion(index, e);
                    setHasUserInteracted(true);
                  }}
                  className="flex-shrink-0 p-1 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                  aria-label={isCompleted ? "Mark as incomplete" : "Mark as complete"}
                >
                  {isCompleted ? (
                    <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <div className="w-6 h-6 border-2 border-neutral-400 dark:border-neutral-500 rounded hover:border-emerald-500 dark:hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all"></div>
                  )}
                </button>
              </div>

              {/* Accordion Content - Expanded Details */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-indigo-200 dark:border-indigo-800 pt-4">
                  {/* Metrics */}
                  <div>
                    <h5 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2 uppercase tracking-wide">
                      Metrics
                    </h5>
                    <div className="grid grid-cols-2 gap-2">
                      {scenario.metrics.map((metric, metricIndex) => (
                        <div key={metricIndex} className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-2">
                          <div className="text-xs text-neutral-600 dark:text-neutral-400">{metric.label}</div>
                          <div className={`text-sm font-semibold ${metric.color || 'text-neutral-900 dark:text-neutral-100'}`}>
                            {metric.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Outcome */}
                  <div>
                    <h5 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2 uppercase tracking-wide">
                      Outcome
                    </h5>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                      {scenario.outcome}
                    </p>
                  </div>

                  {/* Lessons Learned */}
                  <div>
                    <h5 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2 uppercase tracking-wide">
                      Lessons Learned
                    </h5>
                    <ul className="space-y-2">
                      {scenario.lessons.map((lesson, lessonIndex) => (
                        <li key={lessonIndex} className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                          <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span>{lesson}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop: Two-column layout */}
      <div className="hidden md:grid print:hidden md:grid-cols-[1fr,2fr] gap-6">
        <div className="space-y-2">
          <h4 className="font-medium text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            Scenarios
            {/* Desktop hint badge */}
            <span className="text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-2 py-0.5 rounded-full">
              Click to explore
            </span>
          </h4>
          <div className="max-h-[500px] overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-600 scrollbar-track-transparent">
            {scenarios.map((scenario, index) => {
              const isCompleted = completedScenarios.has(index);
              const isSelected = selectedScenario === index;

              return (
                <div
                  key={index}
                  className={`rounded-lg text-sm transition-all relative flex items-start p-3 gap-3 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-100 dark:bg-indigo-900/20 border-2 border-indigo-400 dark:border-indigo-600 shadow-sm'
                      : 'bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600'
                  } ${isCompleted ? 'opacity-75' : ''}`}
                  onClick={() => {
                    setSelectedScenario(index);
                    setHasUserInteracted(true);
                  }}
                >
                  {/* Main content area - fully clickable */}
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium mb-1 ${isCompleted ? 'line-through text-neutral-500 dark:text-neutral-400' : 'text-neutral-900 dark:text-neutral-100'}`}>
                      {scenario.name}
                    </div>
                    <div className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2">
                      {scenario.description}
                    </div>
                  </div>

                  {/* Completion checkbox - separate click area */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleScenarioCompletion(index, e);
                      setHasUserInteracted(true);
                    }}
                    className="flex-shrink-0 p-2 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                    title={isCompleted ? "Mark as incomplete" : "Mark as complete"}
                    aria-label={isCompleted ? "Mark as incomplete" : "Mark as complete"}
                  >
                    {isCompleted ? (
                      <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <div className="w-5 h-5 border-2 border-neutral-400 dark:border-neutral-500 rounded hover:border-emerald-500 dark:hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all"></div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          {scenarios[selectedScenario] && (
            <>
              {/* Context/Description first for better understanding */}
              <div>
                <h4 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">Context</h4>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/40">
                  {scenarios[selectedScenario].description}
                </p>
              </div>

              {/* Metrics section */}
              <div>
                <h4 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">Metrics</h4>
                <div className="grid grid-cols-2 gap-2">
                  {scenarios[selectedScenario].metrics.map((metric, index) => (
                    <div key={index} className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-3">
                      <div className="text-xs text-neutral-600 dark:text-neutral-400">{metric.label}</div>
                      <div className={`font-medium ${metric.color || 'text-neutral-900 dark:text-neutral-100'}`}>
                        {metric.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">Outcome</h4>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-3">
                  {scenarios[selectedScenario].outcome}
                </p>
              </div>

              <div>
                <h4 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">Key Lessons</h4>
                <ul className="text-sm space-y-1">
                  {scenarios[selectedScenario].lessons.map((lesson, index) => (
                    <li key={index} className="flex items-start gap-2 text-neutral-700 dark:text-neutral-300">
                      <span className="text-indigo-500 mt-1 text-xs">•</span>
                      {lesson}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Print version - show all scenarios expanded */}
      <div className="hidden print:block">
        <div className="space-y-6">
          {scenarios.map((scenario, index) => (
            <div key={index} className="border-t border-gray-300 pt-4 first:border-t-0 first:pt-0">
              <h4 className="text-lg font-semibold text-black mb-3">
                {index + 1}. {scenario.name}
              </h4>

              <div className="mb-3">
                <h5 className="font-medium text-black mb-1">Context</h5>
                <p className="text-sm text-gray-700 p-2 bg-gray-50 rounded border">
                  {scenario.description}
                </p>
              </div>

              <div className="mb-3">
                <h5 className="font-medium text-black mb-1">Metrics</h5>
                <div className="grid grid-cols-2 gap-2">
                  {scenario.metrics.map((metric, metricIndex) => (
                    <div key={metricIndex} className="border border-gray-300 bg-gray-50 p-2 rounded">
                      <div className="text-xs text-gray-600">{metric.label}</div>
                      <div className="font-medium text-black">
                        {metric.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <h5 className="font-medium text-black mb-1">Outcome</h5>
                <p className="text-sm text-gray-700">
                  {scenario.outcome}
                </p>
              </div>

              <div className="mb-3">
                <h5 className="font-medium text-black mb-1">Key Lessons</h5>
                <ul className="text-sm space-y-1">
                  {scenario.lessons.map((lesson, lessonIndex) => (
                    <li key={lessonIndex} className="flex items-start gap-2 text-gray-700">
                      <span className="text-black mt-1 text-xs">•</span>
                      {lesson}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface QuizProps {
  title?: string;
  lessonSlug?: string;
  // Support three ways to load quiz content:
  questions?: {
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
  }[];
  questionsFile?: string;  // Path to co-located quiz file
  quizId?: string;         // Quiz bank ID for centralized quizzes
}

export function InteractiveQuiz({ title = "Test Your Understanding", questions, questionsFile, quizId, lessonSlug }: QuizProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [loadedQuestions, setLoadedQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [score, setScore] = useState(0);
  const [completedQuestions, setCompletedQuestions] = useState<boolean[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [saving, setSaving] = useState(false);
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);
  const [hasLoadedPreviousAnswers, setHasLoadedPreviousAnswers] = useState(false);
  const [isActivelyTaking, setIsActivelyTaking] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [perQuestionSeconds, setPerQuestionSeconds] = useState<number[]>([]);
  const [questionStartMs, setQuestionStartMs] = useState<number>(Date.now());

  // Gamification tracking
  const { trackQuizCompletion } = useGamification();

  const formatDuration = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return '0s';
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}h ${remainingMins}m`;
    }
    if (mins > 0) {
      return `${mins}m ${secs.toString().padStart(2, '0')}s`;
    }
    return `${secs}s`;
  };

  type BadgeVariant = 'neutral' | 'brand' | 'success' | 'warning';

  const badgeStyles: Record<BadgeVariant, string> = {
    neutral: 'bg-neutral-100/80 dark:bg-neutral-800/70 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200',
    brand: 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300',
    success: 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300',
    warning: 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300'
  };

  interface ProgressBadge {
    key: string;
    label: string;
    value: string;
    variant: BadgeVariant;
    icon?: JSX.Element;
  }



  interface CompletionStat {
    key: string;
    label: string;
    value: string;
    highlight?: boolean;
  }



  // Load quiz questions from different sources
  useEffect(() => {
    const loadQuestions = async () => {
      if (questions) {
        // Direct questions prop
        setLoadedQuestions(questions);
        setCompletedQuestions(new Array(questions.length).fill(false));
        setAnswers(new Array(questions.length).fill(-1));
        setPerQuestionSeconds(new Array(questions.length).fill(0));
      } else if (questionsFile) {
        // Co-located quiz file
        setLoading(true);
        try {
          const response = await fetch(questionsFile);
          const data = await response.json();
          const questionsList = data.questions || data;
          setLoadedQuestions(questionsList);
          setCompletedQuestions(new Array(questionsList.length).fill(false));
          setAnswers(new Array(questionsList.length).fill(-1));
          setPerQuestionSeconds(new Array(questionsList.length).fill(0));
        } catch (error) {
          console.error('Failed to load quiz from file:', error);
          setLoadedQuestions([]);
        } finally {
          setLoading(false);
        }
      } else if (quizId) {
        // Quiz bank ID
        setLoading(true);
        try {
          const response = await fetch(`/api/quiz-bank/${quizId}`);
          const data = await response.json();
          const questionsList = data.questions || data;
          setLoadedQuestions(questionsList);
          setCompletedQuestions(new Array(questionsList.length).fill(false));
          setAnswers(new Array(questionsList.length).fill(-1));
          setPerQuestionSeconds(new Array(questionsList.length).fill(0));
        } catch (error) {
          console.error('Failed to load quiz from bank:', error);
          setLoadedQuestions([]);
        } finally {
          setLoading(false);
        }
      }
    };

    loadQuestions();
  }, [questions, questionsFile, quizId]);

  // Always call hook to respect hooks rules; if no lessonSlug, use a neutral slug
  const { getBestScore, saveQuizScore, getAttemptCount, quizAttempts, loading: quizLoading } = useQuizProgress(lessonSlug || 'standalone-quiz');

  // Get quiz progress data
  const bestScore = lessonSlug ? getBestScore() : null;
  const attemptCount = lessonSlug ? getAttemptCount() : 0;

  // Calculate metrics
  const totalQuestions = Array.isArray(loadedQuestions) ? loadedQuestions.length : 0;
  const answeredCount = completedQuestions.filter(Boolean).length;
  const answeredAccuracy = answeredCount > 0 ? Math.round((score / Math.max(answeredCount, 1)) * 100) : 0;
  const overallPercentage = totalQuestions > 0 ? Math.round((score / Math.max(totalQuestions, 1)) * 100) : 0;
  const missedCount = Math.max(0, totalQuestions - score);
  const bestPercent = typeof bestScore === 'number' ? Math.round(bestScore) : null;
  const attemptNumber = attemptCount + 1;
  const hasMisses = missedCount > 0;
  const isPerfect = overallPercentage === 100;
  const isNewBest = bestPercent != null ? overallPercentage >= bestPercent : false;
  const showNewBestBadge = attemptCount > 0 && bestPercent != null && isNewBest;

  // Calculate badge variants after metrics are available
  const accuracyVariant: BadgeVariant = answeredAccuracy >= 80
    ? 'success'
    : answeredAccuracy >= 50
      ? 'brand'
      : answeredAccuracy > 0
        ? 'warning'
        : 'neutral';

  const scoreVariant: BadgeVariant = score > 0 ? 'success' : 'neutral';

  // Progress badges array - simplified to show only essential info
  const progressBadges: ProgressBadge[] = [
    { key: 'question', label: 'Question', value: `${currentQuestion + 1}/${totalQuestions || 0}`, variant: 'neutral' },
    { key: 'answered', label: 'Answered', value: `${answeredCount}/${totalQuestions || 0}`, variant: 'neutral' },
    { key: 'score', label: 'Score', value: `${score}`, variant: scoreVariant },
    { key: 'accuracy', label: 'Accuracy', value: answeredCount > 0 ? `${answeredAccuracy}%` : '—', variant: accuracyVariant, icon: <Target className="h-3.5 w-3.5" aria-hidden="true" /> }
  ];

  if (saving) {
    progressBadges.push({ key: 'saving', label: 'Status', value: 'Saving…', variant: 'brand' });
  }

  // Completion stats after all dependencies are calculated
  const completionStats: CompletionStat[] = [
    { key: 'correct', label: 'Correct Answers', value: `${score}/${totalQuestions || 0}`, highlight: true },
    { key: 'accuracy', label: 'Overall Accuracy', value: `${overallPercentage}%`, highlight: true },
    { key: 'time', label: 'Time Spent', value: formatDuration(elapsedSeconds) },
    { key: 'missed', label: 'Questions Missed', value: `${missedCount}`, highlight: hasMisses },
    ...(bestPercent != null ? [{ key: 'best', label: 'Best Score', value: `${bestPercent}%`, highlight: isNewBest }] : []),
    { key: 'attempt', label: 'Attempt Number', value: `#${attemptNumber}` }
  ];

  // Function definitions after all dependencies are calculated
  const handlePracticeMissed = () => {
    if (!hasMisses) {
      return;
    }

    setShowCompletionMessage(false);
    setIsActivelyTaking(false);

    if (!Array.isArray(loadedQuestions) || loadedQuestions.length === 0) {
      return;
    }

    const updatedCompleted = [...completedQuestions];
    const updatedAnswers = [...answers];
    const updatedPerQuestion = [...perQuestionSeconds];

    loadedQuestions.forEach((question, idx) => {
      const answer = updatedAnswers[idx];
      const wasAnswered = answer !== -1;
      const isCorrect = wasAnswered && answer === question?.correctAnswer;

      if (wasAnswered && !isCorrect) {
        updatedCompleted[idx] = false;
        updatedAnswers[idx] = -1;
        updatedPerQuestion[idx] = 0;
      }
    });

    const remainingCorrect = updatedAnswers.reduce((total, answer, idx) => {
      if (answer !== -1 && answer === loadedQuestions[idx]?.correctAnswer) {
        return total + 1;
      }
      return total;
    }, 0);

    setCompletedQuestions(updatedCompleted);
    setAnswers(updatedAnswers);
    setPerQuestionSeconds(updatedPerQuestion);
    setScore(remainingCorrect);

    const nextIndex = updatedCompleted.findIndex(completed => !completed);
    const targetIndex = nextIndex >= 0 ? nextIndex : 0;

    setCurrentQuestion(targetIndex);
    setSelectedAnswer(null);
    setShowAnswer(false);
    setQuestionStartMs(Date.now());
    setStartTime(Date.now());
    setElapsedSeconds(0);
  };

  const completionTone = (() => {
    if (overallPercentage >= 80) {
      return {
        tone: 'success' as const,
        bg: 'bg-emerald-50 dark:bg-emerald-900/10',
        border: 'border-emerald-200 dark:border-emerald-800',
        heading: 'text-emerald-900 dark:text-emerald-100',
        sub: 'text-emerald-700 dark:text-emerald-300',
        iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
        iconColor: 'text-emerald-600 dark:text-emerald-300',
        title: isPerfect ? 'Perfect run!' : isNewBest ? 'New personal best!' : 'Strong finish!',
        description: isPerfect
          ? 'Flawless score—add this to your streak!'
          : isNewBest
            ? 'You beat your previous best score. Keep the streak alive!'
            : 'Nice work! Give the explanations a quick skim to lock things in.',
        icon: <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
      };
    }
    if (overallPercentage >= 60) {
      return {
        tone: 'warning' as const,
        bg: 'bg-amber-50 dark:bg-amber-900/10',
        border: 'border-amber-200 dark:border-amber-800',
        heading: 'text-amber-900 dark:text-amber-100',
        sub: 'text-amber-700 dark:text-amber-300',
        iconBg: 'bg-amber-100 dark:bg-amber-900/40',
        iconColor: 'text-amber-600 dark:text-amber-300',
        title: 'Almost there!',
        description: 'You understand most of it—focus on the tagged concepts you missed and try again.',
        icon: <Lightbulb className="h-6 w-6" aria-hidden="true" />
      };
    }
    return {
      tone: 'danger' as const,
      bg: 'bg-rose-50 dark:bg-rose-900/10',
      border: 'border-rose-200 dark:border-rose-800',
      heading: 'text-rose-900 dark:text-rose-100',
      sub: 'text-rose-700 dark:text-rose-300',
      iconBg: 'bg-rose-100 dark:bg-rose-900/40',
      iconColor: 'text-rose-600 dark:text-rose-300',
      title: 'Keep practicing',
      description: 'Use “Practice Missed Only” to target the tough questions, then take another swing.',
      icon: <AlertCircle className="h-6 w-6" aria-hidden="true" />
    };
  })();

  // Load previous answers on page load
  useEffect(() => {
    if (lessonSlug && quizAttempts.length > 0 && !hasLoadedPreviousAnswers && !quizLoading && !quizCompleted && loadedQuestions.length > 0) {
      const latestAttempt = quizAttempts[0]; // Most recent attempt
      if (latestAttempt.answers && Array.isArray(latestAttempt.answers)) {
        setAnswers(latestAttempt.answers);

        // Calculate which questions were completed and score
        const newCompleted = latestAttempt.answers.map((answer: number) => answer !== -1);
        setCompletedQuestions(newCompleted);

        // Calculate score based on previous answers
        let calculatedScore = 0;
        latestAttempt.answers.forEach((answer: number, index: number) => {
          if (answer === loadedQuestions[index]?.correctAnswer) {
            calculatedScore++;
          }
        });
        setScore(calculatedScore);

        // Track which questions were completed in previous attempt
        const allCompleted = newCompleted.every(completed => completed);
        if (allCompleted) {
          setQuizCompleted(true);
          // Don't automatically show completion message - let user retake the quiz
        }

        // Set the selected answer for current question if it exists
        if (latestAttempt.answers[currentQuestion] !== -1) {
          setSelectedAnswer(latestAttempt.answers[currentQuestion]);
          setShowAnswer(true);
        }
      }
      setHasLoadedPreviousAnswers(true);
    }
  }, [lessonSlug, quizAttempts, hasLoadedPreviousAnswers, quizLoading, loadedQuestions, currentQuestion, quizCompleted]);

  // Elapsed timer
  useEffect(() => {
    // Stop timer on completion screen
    if (showCompletionMessage) return;
    const i = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(i);
  }, [startTime, showCompletionMessage]);

  // Update selected answer when changing questions if answers exist
  useEffect(() => {
    // Force clear selection first to prevent phantom highlights
    setSelectedAnswer(null);
    setShowAnswer(false);

    // Then check if this question was previously answered
    if (Array.isArray(answers) && answers[currentQuestion] !== undefined && answers[currentQuestion] !== -1 && !showCompletionMessage) {
      // This question has been answered before - show the previous answer
      setSelectedAnswer(answers[currentQuestion]);
      setShowAnswer(true);
    }
  }, [currentQuestion, showCompletionMessage, answers]); // Re-added 'answers' dependency

  const handleAnswerSelect = useCallback((answerIndex: number) => {
    // Mark that user is actively taking the quiz
    setIsActivelyTaking(true);

    // accumulate time for current question
    const now = Date.now();
    const spent = Math.max(0, Math.floor((now - questionStartMs) / 1000));
    setPerQuestionSeconds(prev => {
      const copy = [...prev];
      copy[currentQuestion] = (copy[currentQuestion] || 0) + spent;
      return copy;
    });
    setQuestionStartMs(now);

    setSelectedAnswer(answerIndex);
    setShowAnswer(true);

    // Record the answer
    const newAnswers = [...answers];
    const previousAnswer = newAnswers[currentQuestion];
    newAnswers[currentQuestion] = answerIndex;
    setAnswers(newAnswers);

    // Update score: subtract if previous answer was correct, add if new answer is correct
    let newScore = score;
    if (previousAnswer === loadedQuestions[currentQuestion]?.correctAnswer && previousAnswer !== -1) {
      newScore -= 1;
    }
    if (answerIndex === loadedQuestions[currentQuestion]?.correctAnswer) {
      newScore += 1;
    }
    setScore(newScore);

    const newCompleted = [...completedQuestions];
    newCompleted[currentQuestion] = true;
    setCompletedQuestions(newCompleted);
  }, [answers, completedQuestions, currentQuestion, loadedQuestions, questionStartMs, score]);

  const restartQuiz = useCallback(() => {
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setShowAnswer(false);
    setScore(0);
    const questionCount = Array.isArray(loadedQuestions) ? loadedQuestions.length : 0;
    setCompletedQuestions(new Array(questionCount).fill(false));
    setAnswers(new Array(questionCount).fill(-1));
    setPerQuestionSeconds(new Array(questionCount).fill(0));
    setQuizCompleted(false);
    setShowCompletionMessage(false);
    setIsActivelyTaking(false);
    setQuestionStartMs(Date.now());
    setStartTime(Date.now());
    setElapsedSeconds(0);
    // Reset hasLoadedPreviousAnswers to start fresh - no more previous answers should show
    setHasLoadedPreviousAnswers(true); // Keep true to prevent reloading from storage, but answers array is now clean
  }, [loadedQuestions]);

  // Keyboard shortcuts: 1-4 select options, Enter next, Left/Right navigate
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showCompletionMessage) return;
      // 1..4
      if (e.key >= '1' && e.key <= '4') {
        const idx = parseInt(e.key, 10) - 1;
        if (loadedQuestions[currentQuestion]?.options[idx] !== undefined) {
          handleAnswerSelect(idx);
        }
      }
      // Enter advances when an answer is shown
      if (e.key === 'Enter') {
        if (showAnswer) {
          if (currentQuestion === loadedQuestions.length - 1) {
            restartQuiz();
          } else {
            setCurrentQuestion(q => Math.min(q + 1, loadedQuestions.length - 1));
            setSelectedAnswer(null);
            setShowAnswer(false);
          }
        }
      }
      if (e.key === 'ArrowLeft') {
        if (currentQuestion > 0) {
          setCurrentQuestion(q => Math.max(q - 1, 0));
          setSelectedAnswer(null);
          setShowAnswer(false);
        }
      }
      if (e.key === 'ArrowRight') {
        if (currentQuestion < loadedQuestions.length - 1 && showAnswer) {
          setCurrentQuestion(q => Math.min(q + 1, loadedQuestions.length - 1));
          setSelectedAnswer(null);
          setShowAnswer(false);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentQuestion, handleAnswerSelect, loadedQuestions, restartQuiz, showAnswer, showCompletionMessage]);

  const nextQuestion = () => {
    if (currentQuestion === loadedQuestions.length - 1) {
      // On last question, restart quiz instead of going to next
      restartQuiz();
    } else {
      // reset timer for next question
      setQuestionStartMs(Date.now());
      const nextQ = Math.min(currentQuestion + 1, loadedQuestions.length - 1);
      setCurrentQuestion(nextQ);
      // Let useEffect handle setting selectedAnswer and showAnswer based on whether this question was answered
    }
  };

  const prevQuestion = () => {
    const prevQ = Math.max(currentQuestion - 1, 0);
    setCurrentQuestion(prevQ);
    // Let useEffect handle setting selectedAnswer and showAnswer based on whether this question was answered
  };

  // Check if quiz is completed and save score
  useEffect(() => {
    // Don't run if no questions are loaded
    if (loadedQuestions.length === 0) {
      return;
    }

    const allCompleted = completedQuestions.every(completed => completed);
    // Only trigger completion message for fresh completions, not when loading previous data
    if (allCompleted && completedQuestions.length === loadedQuestions.length && !quizCompleted && lessonSlug && !showCompletionMessage) {
      setQuizCompleted(true);
      // Only show completion message if user is actively taking the quiz
      if (isActivelyTaking) {
        setShowCompletionMessage(true);
      }
      
      const handleSaveScore = async () => {
        setSaving(true);
        const timeSpent = Math.floor((Date.now() - startTime) / 1000);
        // include per-question timing in answers payload metadata
        const enrichedAnswers = answers.map((ans, idx) => ({ answer: ans, seconds: perQuestionSeconds[idx] || 0 }));
        await saveQuizScore(score, loadedQuestions.length, enrichedAnswers as any, timeSpent, perQuestionSeconds);
        
        // Track gamification progress
        const finalScore = Math.round((score / loadedQuestions.length) * 100);
        await trackQuizCompletion(lessonSlug || 'unknown-quiz', finalScore);
        
        setSaving(false);
      };
      
      handleSaveScore();
    }
  }, [answers, completedQuestions, isActivelyTaking, loadedQuestions.length, quizCompleted, lessonSlug, perQuestionSeconds, saveQuizScore, score, showCompletionMessage, startTime, trackQuizCompletion]);

  const missedConcepts = () => {
    const items: Array<{ label: string }> = [];
    answers.forEach((ans, i) => {
      if (ans !== -1 && ans !== loadedQuestions[i]?.correctAnswer) {
        const ref = (loadedQuestions as any)[i]?.references?.[0]?.title;
        items.push({ label: ref || `Question ${i + 1}` });
      }
    });
    return items;
  };

  // Show loading state
  if (loading) {
    return (
      <div id="quiz-section" className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-6 mb-6">
        <div className="flex justify-center items-center py-8">
          <div className="text-neutral-600 dark:text-neutral-400">Loading quiz...</div>
        </div>
      </div>
    );
  }

  // Show error state if no questions loaded
  if (!Array.isArray(loadedQuestions) || loadedQuestions.length === 0) {
    return (
      <div id="quiz-section" className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-6 mb-6">
        <div className="text-center py-8">
          <div className="text-neutral-600 dark:text-neutral-400 mb-2">No quiz questions available</div>
          <div className="text-sm text-neutral-500 dark:text-neutral-500">
            {questions ? 'Questions prop is empty' : questionsFile ? 'Could not load questions file' : quizId ? `Quiz ID "${quizId}" not found` : 'No quiz source provided'}
          </div>
        </div>
      </div>
    );
  }

  // Show error state if current question is invalid
  const currentQuestionData = loadedQuestions[currentQuestion];
  if (!currentQuestionData || !currentQuestionData.question || !Array.isArray(currentQuestionData.options)) {
    return (
      <div id="quiz-section" className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-6 mb-6">
        <div className="text-center py-8">
          <div className="text-neutral-600 dark:text-neutral-400 mb-2">Invalid quiz question data</div>
          <div className="text-sm text-neutral-500 dark:text-neutral-500">
            Question {currentQuestion + 1} has invalid format
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="quiz-section" className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          📝 {title}
        </h3>
        <div className="flex flex-wrap justify-end gap-2 text-xs sm:text-sm print:hidden">
          {progressBadges.map(badge => (
            <span
              key={badge.key}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-medium ${badgeStyles[badge.variant]}`}
            >
              {badge.icon && <span aria-hidden="true">{badge.icon}</span>}
              <span className="text-[10px] uppercase tracking-wide opacity-70">
                {badge.label}
              </span>
              <span className="text-xs sm:text-sm font-semibold">
                {badge.value}
              </span>
            </span>
          ))}
        </div>
      </div>


      {/* Interactive version for screen */}
      <div className="print:hidden">

      {/* Question index */}
      {!showCompletionMessage && (
        <div className="flex flex-wrap gap-2 mb-4" aria-label="Question index">
          {Array.isArray(loadedQuestions) && loadedQuestions.map((_, idx) => {
            const isCurrent = idx === currentQuestion;
            const isDone = completedQuestions[idx];
            return (
              <button
                key={idx}
                onClick={() => {
                  setCurrentQuestion(idx);
                  setSelectedAnswer(null);
                  setShowAnswer(answers[idx] !== -1);
                }}
                className={`w-8 h-8 rounded-full text-xs font-medium flex items-center justify-center border transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isCurrent ? 'border-indigo-500 text-indigo-600' : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                } ${isDone ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300' : ''}`}
                aria-current={isCurrent ? 'true' : 'false'}
                aria-label={`Question ${idx + 1}${isDone ? ' completed' : ''}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      )}

      {!showCompletionMessage && (
        <>
          <div className="mb-4">
            <h4 className="text-base font-medium text-neutral-900 dark:text-neutral-100 mb-3">
              {loadedQuestions[currentQuestion]?.question}
            </h4>

            <div className="space-y-2">
              {selectedAnswer === null && !showAnswer && (
                <div className="text-sm text-neutral-500 dark:text-neutral-400 mb-3 p-3 bg-neutral-50 dark:bg-neutral-800/30 rounded border-l-4 border-indigo-300 dark:border-indigo-600">
                  <div className="flex items-center gap-2">
                    <span>💡</span>
                    <span>Select an answer or press <kbd className="px-1.5 py-0.5 text-xs bg-neutral-200 dark:bg-neutral-700 rounded">1-4</kbd> • Enter to continue • <kbd className="px-1.5 py-0.5 text-xs bg-neutral-200 dark:bg-neutral-700 rounded">←/→</kbd> to navigate</span>
                  </div>
                </div>
              )}
              {loadedQuestions[currentQuestion]?.options?.map((option: string, index: number) => (
                <button
                  key={`${currentQuestion}-${index}`}
                  onClick={() => handleAnswerSelect(index)}
                  className={`w-full text-left p-3 rounded-lg text-sm transition-colors ${
                    showAnswer
                      ? index === loadedQuestions[currentQuestion]?.correctAnswer
                        ? 'bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-700 text-green-800 dark:text-green-300'
                        : index === selectedAnswer && index !== loadedQuestions[currentQuestion]?.correctAnswer
                        ? 'bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 text-red-800 dark:text-red-300'
                        : 'bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700'
                      : selectedAnswer === index
                      ? 'bg-blue-100 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300'
                      : 'bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer'
                  }`}
                  aria-pressed={selectedAnswer === index ? "true" : "false"}
                  aria-describedby={selectedAnswer === null ? "question-hint" : undefined}
                >
                  <div className="flex items-center justify-between">
                    <span>{option}</span>
                    {selectedAnswer === index && showAnswer && hasLoadedPreviousAnswers && !isActivelyTaking && (
                      <span className="text-xs px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full">
                        Previous
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {showAnswer && (
            <div className="rounded-lg border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/10 p-4 mb-4">
              <div className="text-sm text-blue-800 dark:text-blue-200" role="status" aria-live="polite">
                <p>
                  <strong>Explanation:</strong> {loadedQuestions[currentQuestion]?.explanation}
                </p>
                {/* Remediation links if provided via question.references */}
                {Array.isArray((loadedQuestions as any)[currentQuestion]?.references) && (loadedQuestions as any)[currentQuestion].references.length > 0 && (
                  <div className="mt-2">
                    <div className="font-medium mb-1">Recommended reading:</div>
                    <ul className="list-disc ml-5 space-y-1">
                      {(loadedQuestions as any)[currentQuestion].references.map((ref: { url: string; title: string }, i: number) => (
                        <li key={i}>
                          <a className="text-indigo-700 dark:text-indigo-300 underline" href={ref.url}>
                            {ref.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {!showCompletionMessage ? (
        <div className="flex justify-between">
          <button
            onClick={prevQuestion}
            disabled={currentQuestion === 0}
            className="px-4 py-2 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          <button
            onClick={nextQuestion}
            disabled={!showAnswer}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {currentQuestion === loadedQuestions.length - 1 ? 'Retake Quiz' : 'Next'}
          </button>
        </div>
      ) : (
        <div className={`rounded-2xl border ${completionTone.border} ${completionTone.bg} p-6`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className={`mt-1 flex h-12 w-12 items-center justify-center rounded-full ${completionTone.iconBg}`}>
                <span className={completionTone.iconColor}>{completionTone.icon}</span>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Quiz saved
                </p>
                <h4 className={`text-xl font-semibold ${completionTone.heading}`}>
                  {completionTone.title}
                </h4>
                <p className={`text-sm ${completionTone.sub}`}>
                  {completionTone.description}
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <div className={`text-4xl font-bold ${completionTone.heading}`}>{overallPercentage}%</div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Overall accuracy</p>
              {showNewBestBadge && (
                <p className="mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                  New personal best!
                </p>
              )}
            </div>
          </div>

          {missedConcepts().length > 0 && (
            <div className="mt-6">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-2">
                Focus next on
              </div>
              <div className="flex flex-wrap gap-2">
                {missedConcepts().map((m, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 text-xs rounded-full border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900/40 text-neutral-700 dark:text-neutral-200"
                  >
                    {m.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {completionStats.map(stat => (
              <div
                key={stat.key}
                className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white/90 dark:bg-neutral-900/60 p-4 text-center"
              >
                <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  {stat.label}
                </div>
                <div className={`mt-2 text-xl font-semibold ${stat.highlight ? completionTone.heading : 'text-neutral-900 dark:text-neutral-100'}`}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={restartQuiz}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Retake Quiz
            </button>
            <button
              onClick={() => setShowCompletionMessage(false)}
              className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Review Questions
            </button>
            <button
              onClick={handlePracticeMissed}
              disabled={!hasMisses}
              className="px-4 py-2 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Practice Missed Only
            </button>
          </div>
        </div>
      )}
      </div>

      {/* Print version - show all questions and answers */}
      <div className="hidden print:block">
        <div className="space-y-6">
          {Array.isArray(loadedQuestions) && loadedQuestions.map((question, index) => (
            <div key={index} className="border-t border-gray-300 pt-4 first:border-t-0 first:pt-0 page-break-inside-avoid">
              <h4 className="text-base font-semibold text-black mb-3">
                Question {index + 1}: {question.question}
              </h4>

              <div className="mb-3">
                <h5 className="font-medium text-black mb-2">Options:</h5>
                <div className="space-y-2">
                  {question.options.map((option: string, optionIndex: number) => (
                    <div
                      key={optionIndex}
                      className={`p-2 rounded border text-sm ${
                        optionIndex === question.correctAnswer
                          ? 'bg-green-50 border-green-300 text-green-800 font-medium'
                          : 'bg-gray-50 border-gray-300 text-gray-700'
                      }`}
                    >
                      <span className="mr-2 font-medium">
                        {String.fromCharCode(65 + optionIndex)}.
                      </span>
                      {option}
                      {optionIndex === question.correctAnswer && (
                        <span className="ml-2 text-green-600 font-bold">✓ Correct Answer</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <h5 className="font-medium text-black mb-1">Explanation:</h5>
                <p className="text-sm text-gray-700 p-2 bg-blue-50 rounded border border-blue-200">
                  {question.explanation}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
