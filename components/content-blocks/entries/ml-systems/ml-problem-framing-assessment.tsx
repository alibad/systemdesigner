'use client';

import { useState } from 'react';

type ScenarioId = 'fraud-detection' | 'customer-service' | 'inventory';

interface ProblemScenario {
  id: ScenarioId;
  title: string;
  description: string;
  suitability: 'Excellent fit' | 'Good fit' | 'Poor fit';
  reasoning: string;
}

const scenarios: ProblemScenario[] = [
  {
    id: 'fraud-detection',
    title: 'Credit Card Fraud Detection',
    description: 'A bank wants to detect fraudulent transactions in real time.',
    suitability: 'Excellent fit',
    reasoning:
      'Clear patterns, labeled data, high business value, and achievable real-time requirements make this a strong ML problem.',
  },
  {
    id: 'customer-service',
    title: 'Customer Service Automation',
    description: 'A company wants to replace all human customer service with chatbots.',
    suitability: 'Poor fit',
    reasoning:
      'Complex edge cases, emotional intelligence, regulation, and customer-satisfaction risk make full replacement a poor framing.',
  },
  {
    id: 'inventory',
    title: 'Inventory Optimization',
    description: 'A retailer needs inventory targets for 10,000 products across 500 stores.',
    suitability: 'Good fit',
    reasoning:
      'Rich historical data, measurable outcomes, and substantial cost-saving potential support an ML solution.',
  },
];

const resultTone: Record<ProblemScenario['suitability'], string> = {
  'Excellent fit': 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100',
  'Good fit': 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100',
  'Poor fit': 'border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100',
};

export default function MlProblemFramingAssessment() {
  const [selectedId, setSelectedId] = useState<ScenarioId>('fraud-detection');
  const selected = scenarios.find((scenario) => scenario.id === selectedId) ?? scenarios[0];

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-neutral-950 dark:text-neutral-50">Problem Suitability Assessment</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Select a scenario to compare its requirements with the conditions that make ML useful.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3" role="group" aria-label="Problem scenarios">
        {scenarios.map((scenario) => {
          const isSelected = scenario.id === selectedId;
          return (
            <button
              key={scenario.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelectedId(scenario.id)}
              className={`min-h-28 rounded-lg border p-4 text-left transition-colors ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                  : 'border-neutral-200 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-500'
              }`}
            >
              <span className="block font-medium text-neutral-950 dark:text-neutral-50">{scenario.title}</span>
              <span className="mt-2 block text-sm text-neutral-600 dark:text-neutral-400">{scenario.description}</span>
            </button>
          );
        })}
      </div>

      <div className={`mt-4 rounded-lg border p-4 ${resultTone[selected.suitability]}`} aria-live="polite">
        <p className="font-semibold">{selected.suitability}</p>
        <p className="mt-1 text-sm">{selected.reasoning}</p>
      </div>
    </section>
  );
}
