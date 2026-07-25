'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

interface NavigationContextType {
  // Where the user came from
  referrerContext: 'content-structure' | 'learning-plan' | 'search' | 'direct';
  
  // Learning plan context (if applicable)
  learningPlanId?: string;
  learningPlanSlug?: string;
  learningPlanTitle?: string;
  
  // Navigation overrides
  backUrl?: string;
  backLabel?: string;
  nextUrl?: string;
  nextLabel?: string;
  
  // Methods to set context
  setLearningPlanContext: (planId: string, planSlug: string, planTitle: string) => void;
  setContentStructureContext: () => void;
  clearContext: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [referrerContext, setReferrerContext] = useState<NavigationContextType['referrerContext']>('direct');
  const [learningPlanId, setLearningPlanId] = useState<string>();
  const [learningPlanSlug, setLearningPlanSlug] = useState<string>();
  const [learningPlanTitle, setLearningPlanTitle] = useState<string>();
  const [backUrl, setBackUrl] = useState<string>();
  const [backLabel, setBackLabel] = useState<string>();
  const [nextUrl, setNextUrl] = useState<string>();
  const [nextLabel, setNextLabel] = useState<string>();

  // Check URL parameters for learning plan context
  useEffect(() => {
    const planId = searchParams.get('planId');
    const planSlug = searchParams.get('planSlug');
    const planTitle = searchParams.get('planTitle');
    const from = searchParams.get('from');

    if (planId && planSlug && planTitle) {
      setLearningPlanContext(planId, planSlug, planTitle);
    } else if (from === 'learning-plan') {
      setReferrerContext('learning-plan');
    } else {
      // Check if we're coming from a learning plan URL pattern
      const referrer = document.referrer;
      if (referrer.includes('/learn/plan/')) {
        setReferrerContext('learning-plan');
      } else if (referrer.includes('/learn/')) {
        setReferrerContext('learning-plan');
      } else {
        setReferrerContext('content-structure');
      }
    }
  }, [searchParams, pathname]);

  const setLearningPlanContext = (planId: string, planSlug: string, planTitle: string) => {
    setReferrerContext('learning-plan');
    setLearningPlanId(planId);
    setLearningPlanSlug(planSlug);
    setLearningPlanTitle(planTitle);
    setBackUrl(`/learn/plan/${planSlug}`);
    setBackLabel(`Back to ${planTitle}`);
  };

  const setContentStructureContext = () => {
    setReferrerContext('content-structure');
    setLearningPlanId(undefined);
    setLearningPlanSlug(undefined);
    setLearningPlanTitle(undefined);
    setBackUrl(undefined);
    setBackLabel(undefined);
    setNextUrl(undefined);
    setNextLabel(undefined);
  };

  const clearContext = () => {
    setReferrerContext('direct');
    setLearningPlanId(undefined);
    setLearningPlanSlug(undefined);
    setLearningPlanTitle(undefined);
    setBackUrl(undefined);
    setBackLabel(undefined);
    setNextUrl(undefined);
    setNextLabel(undefined);
  };

  return (
    <NavigationContext.Provider value={{
      referrerContext,
      learningPlanId,
      learningPlanSlug,
      learningPlanTitle,
      backUrl,
      backLabel,
      nextUrl,
      nextLabel,
      setLearningPlanContext,
      setContentStructureContext,
      clearContext
    }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigationContext() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigationContext must be used within a NavigationProvider');
  }
  return context;
}
