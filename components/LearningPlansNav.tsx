"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getUserLearningPlans, FirebaseLearningPlan, calculatePlanProgress } from '@/lib/firebase-learning-plans';
import { useAuth } from '@/hooks/useAuth';
import { BookOpen, Plus, Target } from 'lucide-react';

export default function LearningPlansNav() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [learningPlans, setLearningPlans] = useState<FirebaseLearningPlan[]>([]);
  const [planProgress, setPlanProgress] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const loadLearningPlans = async () => {
      if (authLoading) {
        return;
      }
      
      if (!user) {
        setIsLoading(false);
        return;
      }
      
      try {
        const plans = await getUserLearningPlans(user.uid);
        setLearningPlans(plans);
        
        // Calculate progress for each plan
        const progressData: Record<string, any> = {};
        for (const plan of plans) {
          if (plan.id) {
            const progress = await calculatePlanProgress(plan, user.uid);
            progressData[plan.id] = progress;
          }
        }
        setPlanProgress(progressData);
        
        // Auto-expand if user is on a learning plan page
        if (pathname?.includes('/learn/custom') || pathname?.includes('/learn/plan/')) {
          setIsExpanded(true);
        }
      } catch (error) {
        console.error('Error loading learning plans:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLearningPlans();
  }, [user, authLoading, pathname]);

  // Don't show if no user, still loading, or no learning plans
  if (!user || isLoading || learningPlans.length === 0) {
    return null;
  }

  const activePlans = learningPlans.filter(plan => plan.status === 'active');
  const completedPlans = learningPlans.filter(plan => plan.status === 'completed');

  return (
    <div className="mb-4">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition"
      >
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4" />
          <span>My Learning Plans</span>
          {learningPlans.length > 0 && (
            <span className="text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 px-2 py-0.5 rounded-full">
              {learningPlans.length}
            </span>
          )}
        </div>
        <svg
          className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-2 ml-4 space-y-1">
          {/* Create New Plan */}
          <Link
            href={"/learn/custom" as any}
            className={`flex items-center gap-2 p-2 text-sm rounded-lg transition ${
              pathname === '/learn/custom'
                ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <Plus className="h-3 w-3" />
            <span>Create New Plan</span>
          </Link>

          {/* Active Plans */}
          {(isLoading || activePlans.length > 0 || (!isLoading && learningPlans.length > 0)) && (
            <>
              <div className="text-xs font-medium text-neutral-500 dark:text-neutral-500 px-2 py-1">
                Active Plans
              </div>
              {isLoading ? (
                // Loading skeleton for active plans
                <div className="space-y-2">
                  <div className="p-2 rounded-lg animate-pulse">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4 mb-1"></div>
                        <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2"></div>
                      </div>
                      <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-12 ml-2"></div>
                    </div>
                    <div className="mt-1.5 w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1"></div>
                  </div>
                </div>
              ) : activePlans.length === 0 ? (
                <div className="p-2 text-xs text-neutral-500 dark:text-neutral-500 italic">
                  No active plans yet
                </div>
              ) : (
                activePlans.map((plan) => {
                const progress = planProgress[plan.id!] || { totalTopics: plan.topics?.length || 0, completedTopics: 0, progressPercentage: 0 };
                const progressPercentage = progress.progressPercentage;
                const isActivePlan = pathname === `/learn/plan/${plan.slug}`;
                return (
                  <Link
                    key={plan.id}
                    href={`/learn/plan/${plan.slug}` as any}
                    className={`block p-2 text-sm rounded-lg transition ${
                      isActivePlan
                        ? 'bg-indigo-100 dark:bg-indigo-900 border border-indigo-200 dark:border-indigo-800'
                        : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium truncate ${
                          isActivePlan
                            ? 'text-indigo-900 dark:text-indigo-100'
                            : 'text-neutral-900 dark:text-neutral-100'
                        }`}>
                          {plan.title}
                        </div>
                        <div className={`text-xs mt-0.5 ${
                          isActivePlan
                            ? 'text-indigo-700 dark:text-indigo-300'
                            : 'text-neutral-500 dark:text-neutral-500'
                        }`}>
                          {plan.topics.length} topics • {plan.skillLevel}
                        </div>
                      </div>
                      <div className={`ml-2 text-xs font-medium ${
                        isActivePlan
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-indigo-600 dark:text-indigo-400'
                      }`}>
                        Active
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-1.5 w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1">
                      <div
                        className="bg-indigo-500 h-1 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                  </Link>
                );
              })
              )}
            </>
          )}

          {/* Completed Plans */}
          {completedPlans.length > 0 && (
            <>
              <div className="text-xs font-medium text-neutral-500 dark:text-neutral-500 px-2 py-1 mt-3">
                Completed Plans
              </div>
              {completedPlans.slice(0, 3).map((plan) => {
                const isActivePlan = pathname === `/learn/plan/${plan.slug}`;
                return (
                <Link
                  key={plan.id}
                  href={`/learn/plan/${plan.slug}`}
                  className={`block p-2 text-sm rounded-lg transition ${
                    isActivePlan
                      ? 'bg-emerald-100 dark:bg-emerald-900 border border-emerald-200 dark:border-emerald-800'
                      : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500 flex items-center justify-center">
                      <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-neutral-700 dark:text-neutral-300 truncate">
                        {plan.title}
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-400">
                        Completed • {plan.topics.length} topics
                      </div>
                    </div>
                  </div>
                </Link>
                );
              })}
              {completedPlans.length > 3 && (
                <div className="text-xs text-neutral-500 dark:text-neutral-500 px-2 py-1">
                  +{completedPlans.length - 3} more completed
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
