"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SimpleLearningPlanInput from '@/components/SimpleLearningPlanInput';
import SimpleLearningPlanDashboard from '@/components/SimpleLearningPlanDashboard';
import LearningPlanEditor from '@/components/LearningPlanEditor';
import { FirebaseLearningPlan, createLearningPlan, getLearningPlan } from '@/lib/firebase-learning-plans';
import { useAuth } from '@/hooks/useAuth';
import { Timestamp } from 'firebase/firestore';

type CreationMode = 'choose' | 'ai' | 'manual';

export default function CustomLearningPlanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [currentPlan, setCurrentPlan] = useState<FirebaseLearningPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [creationMode, setCreationMode] = useState<CreationMode>('choose');

  const handlePlanGenerated = async (plan: Omit<FirebaseLearningPlan, 'id' | 'slug' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (!user?.uid) {
        throw new Error('User must be authenticated to create learning plan');
      }

      // Save the plan to Firebase
      const planId = await createLearningPlan(plan, user.uid);

      // Load the saved plan to get the full data with ID
      const savedPlan = await getLearningPlan(planId, user.uid);

      if (savedPlan) {
        // Redirect to the specific learning plan page
        router.push(`/learn/plan/${savedPlan.slug}` as any);
      }
    } catch (error) {
      console.error('Error saving learning plan:', error);
      // Still show the plan even if save fails
      setCurrentPlan(plan as FirebaseLearningPlan);
    }
  };

  const handleManualPlanSave = async (plan: FirebaseLearningPlan) => {
    try {
      if (!user?.uid) {
        throw new Error('User must be authenticated to create learning plan');
      }

      // Save the manually created plan to Firebase
      const planId = await createLearningPlan(plan, user.uid);

      // Load the saved plan to get the full data with ID
      const savedPlan = await getLearningPlan(planId, user.uid);

      if (savedPlan) {
        // Redirect to the specific learning plan page
        router.push(`/learn/plan/${savedPlan.slug}` as any);
      }
    } catch (error) {
      console.error('Error saving manual learning plan:', error);
    }
  };

  const handleCreateNewPlan = () => {
    setCurrentPlan(null);
    setCreationMode('choose');
    // Clear the planId from URL
    router.push('/learn/custom' as any);
  };

  const handleBackNavigation = () => {
    if (creationMode !== 'choose') {
      // If we're in AI or manual mode, go back to choice screen
      setCreationMode('choose');
    } else {
      // If we're on choice screen, go back to previous page
      router.back();
    }
  };

  useEffect(() => {
    const loadPlan = async () => {
      const planId = searchParams.get('planId');

      if (planId && user?.uid) {
        // Load specific plan (only if explicitly requested via URL)
        const plan = await getLearningPlan(planId, user.uid);
        setCurrentPlan(plan);
      } else {
        // Always show input form for new plan creation
        setCurrentPlan(null);
      }

      setIsLoading(false);
    };

    // Only load if user is defined (either authenticated or null)
    if (user !== undefined) {
      loadPlan();
    }
  }, [searchParams, user]);

  return (
    <main className="min-h-screen py-8">
      <div className={creationMode === 'manual' ? 'px-4' : 'max-w-4xl mx-auto px-4'}>
        <div className="mb-8">
          <button
            onClick={handleBackNavigation}
            className="inline-flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-neutral-600 dark:text-neutral-300">Loading your learning plan...</p>
          </div>
        ) : currentPlan ? (
          <SimpleLearningPlanDashboard 
            plan={currentPlan} 
            onCreateNew={handleCreateNewPlan}
          />
        ) : creationMode === 'choose' ? (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
                Create Learning Plan
              </h1>
              <p className="text-neutral-600 dark:text-neutral-400">
                Choose how you'd like to create your personalized learning plan
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* AI Generation Option */}
              <div 
                onClick={() => setCreationMode('ai')}
                className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-700 hover:border-indigo-300 dark:hover:border-indigo-600 cursor-pointer transition-all hover:shadow-lg group"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                  AI-Powered Generation
                </h3>
                <p className="text-neutral-600 dark:text-neutral-400 mb-4">
                  Describe your learning goals and let AI create a personalized curriculum from our content library.
                </p>
                <div className="flex items-center text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform">
                  <span className="text-sm font-medium">Generate with AI</span>
                  <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              </div>

              {/* Manual Creation Option */}
              <div 
                onClick={() => setCreationMode('manual')}
                className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-700 hover:border-indigo-300 dark:hover:border-indigo-600 cursor-pointer transition-all hover:shadow-lg group"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                  Manual Creation
                </h3>
                <p className="text-neutral-600 dark:text-neutral-400 mb-4">
                  Browse and select specific topics to create your own custom learning path with full control.
                </p>
                <div className="flex items-center text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform">
                  <span className="text-sm font-medium">Create manually</span>
                  <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        ) : creationMode === 'ai' ? (
          <SimpleLearningPlanInput onPlanGenerated={handlePlanGenerated} />
        ) : (
          <LearningPlanEditor
            plan={{
              id: '',
              userId: '',
              title: '',
              slug: '',
              description: '',
              userGoal: '',
              topics: [],
              status: 'active',
              skillLevel: 'beginner',
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now()
            } as FirebaseLearningPlan}
            onSave={handleManualPlanSave}
            onCancel={() => setCreationMode('choose')}
          />
        )}
      </div>
    </main>
  );
}
