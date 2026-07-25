'use client';

import React, { useState, useEffect } from 'react';
import { saveEnvelopeChallenge, getEnvelopeChallenges } from '@/lib/firebase';

interface CalculationStep {
  description: string;
  formula: string;
  value: number | string;
  unit: string;
  explanation?: string;
}

interface EstimationChallenge {
  id: string;
  title: string;
  scenario: string;
  hints: string[];
  targetRange: { min: number; max: number };
  unit: string;
  solution: {
    steps: CalculationStep[];
    finalAnswer: number;
    reasoning: string;
  };
}

export function EnvelopeCalculator() {
  const [selectedChallenge, setSelectedChallenge] = useState(0);
  const [userEstimate, setUserEstimate] = useState('');
  const [showSolution, setShowSolution] = useState(false);
  const [userSteps, setUserSteps] = useState<CalculationStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedChallenges, setCompletedChallenges] = useState<Set<string>>(new Set());
  const [isClient, setIsClient] = useState(false);

  // Load saved progress from Firebase
  useEffect(() => {
    setIsClient(true);
    
    const loadProgress = async () => {
      try {
        const challenges = await getEnvelopeChallenges();
        const completed = new Set(
          challenges
            .filter(c => c.completed)
            .map(c => c.challengeId)
        );
        setCompletedChallenges(completed);
      } catch (error) {
        console.log('Failed to load challenge progress:', error);
      }
    };
    
    loadProgress();
  }, []);

  const challenges: EstimationChallenge[] = [
    {
      id: 'twitter-storage',
      title: 'Twitter Storage Requirements',
      scenario: 'Twitter has 500M daily active users. Each user posts 2 tweets per day on average. Calculate the storage needed for 1 year of tweets.',
      hints: [
        'Consider the size of a tweet (280 chars max)',
        'Add metadata (user ID, timestamp, etc.)',
        'Think about media attachments',
        'Consider replication factor'
      ],
      targetRange: { min: 200, max: 400 },
      unit: 'PB',
      solution: {
        steps: [
          { description: 'Daily tweets', formula: '500M users × 2 tweets/day', value: '1B', unit: 'tweets/day' },
          { description: 'Yearly tweets', formula: '1B × 365 days', value: '365B', unit: 'tweets/year' },
          { description: 'Avg tweet size', formula: '140 chars + 60B metadata', value: '200', unit: 'bytes', explanation: 'Most tweets are shorter than max' },
          { description: 'Text storage', formula: '365B × 200 bytes', value: '73', unit: 'TB' },
          { description: 'Media (30% have images)', formula: '365B × 0.3 × 200KB', value: '21.9', unit: 'PB' },
          { description: 'With 3x replication', formula: '(73TB + 21.9PB) × 3', value: '66', unit: 'PB' },
          { description: 'Add 20% overhead', formula: '66PB × 1.2', value: '79.2', unit: 'PB' }
        ],
        finalAnswer: 80,
        reasoning: 'Main storage comes from media attachments, not text. Replication and overhead significantly increase requirements.'
      }
    },
    {
      id: 'youtube-bandwidth',
      title: 'YouTube Peak Bandwidth',
      scenario: 'YouTube has 2 billion users. During peak hours, 10% are watching videos. Calculate the total bandwidth required.',
      hints: [
        'Consider different video qualities (SD, HD, 4K)',
        'Think about regional distribution',
        'Account for CDN efficiency',
        'Consider mobile vs desktop usage'
      ],
      targetRange: { min: 500, max: 2000 },
      unit: 'Tbps',
      solution: {
        steps: [
          { description: 'Peak concurrent viewers', formula: '2B × 10%', value: '200M', unit: 'users' },
          { description: 'Quality distribution', formula: '30% SD + 60% HD + 10% 4K', value: 'mixed', unit: '' },
          { description: 'SD bandwidth', formula: '200M × 0.3 × 1 Mbps', value: '60', unit: 'Tbps' },
          { description: 'HD bandwidth', formula: '200M × 0.6 × 5 Mbps', value: '600', unit: 'Tbps' },
          { description: '4K bandwidth', formula: '200M × 0.1 × 25 Mbps', value: '500', unit: 'Tbps' },
          { description: 'Total before optimization', formula: '60 + 600 + 500', value: '1160', unit: 'Tbps' },
          { description: 'With CDN (70% cache hit)', formula: '1160 × 0.3', value: '348', unit: 'Tbps origin' }
        ],
        finalAnswer: 1160,
        reasoning: 'HD streaming dominates bandwidth. CDN significantly reduces origin server load but total edge bandwidth is still massive.'
      }
    },
    {
      id: 'uber-requests',
      title: 'Uber Ride Matching QPS',
      scenario: 'Uber operates in 10,000 cities worldwide. Calculate the peak queries per second for ride matching during rush hour.',
      hints: [
        'Consider time zones and peak hours',
        'Think about driver location updates',
        'Account for passenger requests',
        'Include pricing calculations'
      ],
      targetRange: { min: 100000, max: 500000 },
      unit: 'QPS',
      solution: {
        steps: [
          { description: 'Cities in peak hour', formula: '10,000 × 30% (timezone)', value: '3,000', unit: 'cities' },
          { description: 'Active drivers per city', formula: '1,000 avg', value: '3M', unit: 'drivers' },
          { description: 'Driver location updates', formula: '3M × 1 update/5sec', value: '600K', unit: 'QPS' },
          { description: 'Active passengers', formula: '3,000 cities × 500', value: '1.5M', unit: 'users' },
          { description: 'Search requests', formula: '1.5M × 1 req/30sec', value: '50K', unit: 'QPS' },
          { description: 'Price calculations', formula: '50K × 3 options', value: '150K', unit: 'QPS' },
          { description: 'Total QPS', formula: '600K + 50K + 150K', value: '800K', unit: 'QPS' }
        ],
        finalAnswer: 800000,
        reasoning: 'Driver location updates dominate QPS. Real-time tracking requires frequent updates for accurate positioning.'
      }
    }
  ];

  const currentChallenge = challenges[selectedChallenge];

  const checkAnswer = () => {
    const estimate = parseFloat(userEstimate);
    if (isNaN(estimate)) return false;
    
    return estimate >= currentChallenge.targetRange.min && 
           estimate <= currentChallenge.targetRange.max;
  };

  const submitAnswer = async () => {
    setShowSolution(true);
    const isCorrect = checkAnswer();
    
    if (isCorrect) {
      setCompletedChallenges(prev => new Set([...prev, currentChallenge.id]));
    }
    
    // Save to Firebase
    try {
      const estimate = parseFloat(userEstimate);
      await saveEnvelopeChallenge(
        currentChallenge.id,
        isCorrect,
        isNaN(estimate) ? undefined : estimate
      );
    } catch (error) {
      console.log('Failed to save challenge progress:', error);
    }
  };

  const addStep = () => {
    setUserSteps([...userSteps, {
      description: '',
      formula: '',
      value: '',
      unit: ''
    }]);
  };

  const updateStep = (index: number, field: keyof CalculationStep, value: string | number) => {
    const newSteps = [...userSteps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setUserSteps(newSteps);
  };

  const resetChallenge = () => {
    setUserEstimate('');
    setShowSolution(false);
    setUserSteps([]);
    setCurrentStep(0);
  };

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          🧮 Back-of-the-Envelope Calculator
        </h3>
        <div className="text-sm text-neutral-600 dark:text-neutral-400">
          {completedChallenges.size} / {challenges.length} completed
        </div>
      </div>

      {/* Challenge Selection */}
      <div className="grid md:grid-cols-[1fr,2fr] gap-6">
        <div className="space-y-2">
          <h4 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">Challenges</h4>
          <div className="space-y-2">
            {challenges.map((challenge, index) => {
              const isCompleted = completedChallenges.has(challenge.id);
              return (
                <button
                  key={challenge.id}
                  onClick={() => {
                    setSelectedChallenge(index);
                    resetChallenge();
                  }}
                  className={`w-full text-left p-3 rounded-lg text-sm transition-colors flex items-start gap-3 ${
                    selectedChallenge === index
                      ? 'bg-indigo-100 dark:bg-indigo-900/20 border border-indigo-300 dark:border-indigo-700'
                      : 'bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <div className="flex-1">
                    <div className={`font-medium mb-1 ${isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-900 dark:text-neutral-100'}`}>
                      {challenge.title}
                    </div>
                    <div className="text-xs text-neutral-600 dark:text-neutral-400">
                      Target: {challenge.targetRange.min}-{challenge.targetRange.max} {challenge.unit}
                    </div>
                  </div>
                  {isCompleted && (
                    <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Challenge Workspace */}
        <div className="space-y-4">
          <div className="rounded-lg border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/10 p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Scenario</h4>
            <p className="text-sm text-blue-700 dark:text-blue-300">{currentChallenge.scenario}</p>
          </div>

          {/* Hints */}
          <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 p-4">
            <h4 className="font-medium text-amber-900 dark:text-amber-100 mb-2">💡 Hints</h4>
            <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
              {currentChallenge.hints.map((hint, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  {hint}
                </li>
              ))}
            </ul>
          </div>

          {/* User Workspace */}
          {!showSolution && (
            <div className="space-y-4">
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-4">
                <h4 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">Your Calculation</h4>
                
                {/* Quick Estimate */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Quick Estimate
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={userEstimate}
                      onChange={(e) => setUserEstimate(e.target.value)}
                      placeholder="Enter your estimate"
                      className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {currentChallenge.unit}
                    </span>
                  </div>
                </div>

                {/* Step-by-step calculation */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      Show Your Work (Optional)
                    </label>
                    <button
                      onClick={addStep}
                      className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                    >
                      + Add Step
                    </button>
                  </div>
                  
                  {userSteps.map((step, index) => (
                    <div key={index} className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={step.description}
                        onChange={(e) => updateStep(index, 'description', e.target.value)}
                        placeholder="Description"
                        className="rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1 text-xs"
                      />
                      <input
                        type="text"
                        value={step.formula}
                        onChange={(e) => updateStep(index, 'formula', e.target.value)}
                        placeholder="Formula"
                        className="rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1 text-xs"
                      />
                      <input
                        type="text"
                        value={step.value}
                        onChange={(e) => updateStep(index, 'value', e.target.value)}
                        placeholder="Result"
                        className="rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1 text-xs"
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={submitAnswer}
                  disabled={!userEstimate}
                  className="mt-4 w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Check Answer
                </button>
              </div>
            </div>
          )}

          {/* Solution */}
          {showSolution && (
            <div className="space-y-4">
              {/* Result */}
              <div className={`rounded-lg border p-4 ${
                checkAnswer()
                  ? 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/10'
                  : 'border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className={`font-medium ${
                    checkAnswer()
                      ? 'text-emerald-900 dark:text-emerald-100'
                      : 'text-red-900 dark:text-red-100'
                  }`}>
                    {checkAnswer() ? '✅ Correct!' : '❌ Not Quite'}
                  </h4>
                  <div className="text-sm">
                    Your answer: <strong>{userEstimate || '—'} {currentChallenge.unit}</strong>
                  </div>
                </div>
                <p className={`text-sm ${
                  checkAnswer()
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-red-700 dark:text-red-300'
                }`}>
                  Target range: {currentChallenge.targetRange.min}-{currentChallenge.targetRange.max} {currentChallenge.unit}
                </p>
              </div>

              {/* Solution Steps */}
              <div className="rounded-lg border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50 dark:bg-indigo-900/10 p-4">
                <h4 className="font-medium text-indigo-900 dark:text-indigo-100 mb-3">Solution Walkthrough</h4>
                
                <div className="space-y-3">
                  {currentChallenge.solution.steps.map((step, index) => (
                    <div
                      key={index}
                      className={`rounded border p-3 transition-all ${
                        index === currentStep
                          ? 'border-indigo-300 dark:border-indigo-700 bg-white dark:bg-indigo-900/20'
                          : 'border-neutral-200 dark:border-neutral-700 bg-white/50 dark:bg-neutral-800/20'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-sm text-neutral-900 dark:text-neutral-100">
                            Step {index + 1}: {step.description}
                          </div>
                          <div className="font-mono text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                            {step.formula}
                          </div>
                          {step.explanation && (
                            <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                              {step.explanation}
                            </div>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <div className="font-bold text-lg text-indigo-600 dark:text-indigo-400">
                            {step.value}
                          </div>
                          <div className="text-xs text-neutral-600 dark:text-neutral-400">
                            {step.unit}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-3 rounded bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-indigo-900 dark:text-indigo-100">
                      Final Answer
                    </div>
                    <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                      {currentChallenge.solution.finalAnswer} {currentChallenge.unit}
                    </div>
                  </div>
                  <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-2">
                    {currentChallenge.solution.reasoning}
                  </p>
                </div>

                {/* Navigation */}
                <div className="flex justify-between mt-4">
                  <button
                    onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                    disabled={currentStep === 0}
                    className="px-3 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
                  >
                    ← Previous Step
                  </button>
                  <button
                    onClick={resetChallenge}
                    className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={() => setCurrentStep(Math.min(currentChallenge.solution.steps.length - 1, currentStep + 1))}
                    disabled={currentStep === currentChallenge.solution.steps.length - 1}
                    className="px-3 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
                  >
                    Next Step →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}