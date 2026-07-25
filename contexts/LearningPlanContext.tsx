'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { FirebaseLearningPlan } from '@/lib/firebase-learning-plans';

interface LearningPlanContextType {
  currentPlan: FirebaseLearningPlan | null;
  setCurrentPlan: (plan: FirebaseLearningPlan | null) => void;
}

const LearningPlanContext = createContext<LearningPlanContextType | undefined>(undefined);

export function LearningPlanProvider({ children }: { children: ReactNode }) {
  const [currentPlan, setCurrentPlan] = useState<FirebaseLearningPlan | null>(null);

  return (
    <LearningPlanContext.Provider value={{
      currentPlan,
      setCurrentPlan
    }}>
      {children}
    </LearningPlanContext.Provider>
  );
}

export function useLearningPlan() {
  const context = useContext(LearningPlanContext);
  if (context === undefined) {
    throw new Error('useLearningPlan must be used within a LearningPlanProvider');
  }
  return context;
}