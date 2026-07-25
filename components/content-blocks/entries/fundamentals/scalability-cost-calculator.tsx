'use client';

import { InteractiveCalculator } from '@/components/fundamentals/InteractiveLearning';

export default function ScalabilityCostCalculator() {
  return (
    <InteractiveCalculator
      title="Scaling Cost Calculator"
      description="Compare the costs of vertical vs horizontal scaling strategies"
      type="scaling"
      fields={[
        {
          label: 'Current Users',
          key: 'currentUsers',
          type: 'number',
          unit: 'users',
          defaultValue: 10000,
        },
        {
          label: 'Target Users',
          key: 'targetUsers',
          type: 'number',
          unit: 'users',
          defaultValue: 100000,
        },
        {
          label: 'Current Server Cost',
          key: 'currentCost',
          type: 'number',
          unit: '$/month',
          defaultValue: 100,
        },
      ]}
    />
  );
}
