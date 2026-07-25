"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import SimpleLearningPlanDashboard from '@/components/SimpleLearningPlanDashboard';
import { FirebaseLearningPlan, getLearningPlanBySlug } from '@/lib/firebase-learning-plans';
import { useAuth } from '@/hooks/useAuth';
import { useNavigationContext } from '@/contexts/NavigationContext';
import { useLearningPlan } from '@/contexts/LearningPlanContext';

export default function LearningPlanPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const { setLearningPlanContext } = useNavigationContext();
  const { setCurrentPlan: setGlobalCurrentPlan } = useLearningPlan();
  const [currentPlan, setCurrentPlan] = useState<FirebaseLearningPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const handleCreateNewPlan = () => {
    router.push('/learn/custom');
  };

  useEffect(() => {
    const loadPlan = async () => {
      if (!params.slug || typeof params.slug !== 'string') {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      // Wait for user to be loaded
      if (user === undefined) {
        // Still loading auth
        return;
      }

      if (!user) {
        // Not authenticated
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      // Ensure we're in loading state and reset notFound
      setIsLoading(true);
      setNotFound(false);

      try {
        console.log('🔍 Page: Loading plan with slug:', params.slug, 'and userId:', user.uid);
        const plan = await getLearningPlanBySlug(params.slug, user.uid);
        console.log('🔍 Page: Plan result:', plan);
        if (plan) {
          console.log('✅ Page: Plan found, setting currentPlan');
          setCurrentPlan(plan);
          setNotFound(false); // Reset notFound state when plan is found

          // Set navigation context for sidebar
          if (plan.id && plan.slug && plan.title) {
            setLearningPlanContext(plan.id, plan.slug, plan.title);
            setGlobalCurrentPlan(plan);
          }
        } else {
          console.log('❌ Page: No plan returned, setting notFound=true');
          setNotFound(true);
        }
      } catch (error) {
        console.error('❌ Page: Error loading learning plan:', error);
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadPlan();
  }, [params.slug, setGlobalCurrentPlan, setLearningPlanContext, user]);

  // Debug: Log render state
  console.log('🎨 Render state:', { isLoading, notFound, hasPlan: !!currentPlan });

  // Show loading only if explicitly loading and not in error state
  if (isLoading && !notFound) {
    console.log('🔄 Showing loading state');
    return (
      <main className="min-h-screen py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-neutral-600 dark:text-neutral-300">Loading your learning plan...</p>
          </div>
        </div>
      </main>
    );
  }

  // Show "not found" if marked as not found OR if finished loading with no plan
  if (notFound || (!isLoading && !currentPlan)) {
    console.log('❌ Showing not found state');
    return (
      <main className="min-h-screen py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.47-.881-6.08-2.33" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
              Learning Plan Not Found
            </h1>
            <p className="text-neutral-600 dark:text-neutral-300 mb-6">
              The learning plan you're looking for doesn't exist or you don't have access to it.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => router.back()}
                className="px-4 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
              >
                Go Back
              </button>
              <button
                onClick={handleCreateNewPlan}
                className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white font-medium shadow hover:shadow-lg transition"
              >
                Create New Plan
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  console.log('✅ Showing plan dashboard');

  return (
    <>
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-8">
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
      </div>

      {currentPlan && (
        <SimpleLearningPlanDashboard
          plan={currentPlan}
          onCreateNew={handleCreateNewPlan}
        />
      )}
    </>
  );
}
