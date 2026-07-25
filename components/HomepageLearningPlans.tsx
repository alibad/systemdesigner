"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getUserLearningPlans, FirebaseLearningPlan, calculatePlanProgress, deleteLearningPlan, updateLearningPlanStatus } from '@/lib/firebase-learning-plans';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function HomepageLearningPlans() {
  const { user, loading: authLoading } = useAuth();
  const { addToast } = useToast();
  const [learningPlans, setLearningPlans] = useState<FirebaseLearningPlan[]>([]);
  const [planProgress, setPlanProgress] = useState<Record<string, { totalTopics: number; completedTopics: number; progressPercentage: number }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [deletingPlan, setDeletingPlan] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);

  useEffect(() => {
    const loadLearningPlans = async () => {
      // Only load learning plans for authenticated users (including anonymous)
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
            progressData[plan.id] = await calculatePlanProgress(plan, user.uid);
          }
        }
        setPlanProgress(progressData);
      } catch (error) {
        console.error('Error loading learning plans:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading) {
      loadLearningPlans();
    }
  }, [user, authLoading]);

  const handleDeletePlan = async (planId: string) => {
    if (!user || !planId) return;

    const planToDelete = learningPlans.find(p => p.id === planId);
    const planTitle = planToDelete?.title || 'Learning plan';

    try {
      setDeletingPlan(planId);
      await deleteLearningPlan(planId, user.uid);

      // Refresh the learning plans list
      const updatedPlans = await getUserLearningPlans(user.uid);
      setLearningPlans(updatedPlans);

      // Update progress data
      const progressData: Record<string, any> = {};
      for (const plan of updatedPlans) {
        if (plan.id) {
          progressData[plan.id] = await calculatePlanProgress(plan, user.uid);
        }
      }
      setPlanProgress(progressData);

      setShowDeleteDialog(null);

      // Show success toast
      addToast({
        title: 'Learning plan deleted',
        description: `"${planTitle}" has been permanently removed.`,
        variant: 'success',
        duration: 4000,
      });
    } catch (error) {
      console.error('Error deleting learning plan:', error);

      // Show error toast
      addToast({
        title: 'Failed to delete plan',
        description: 'An error occurred while deleting the learning plan. Please try again.',
        variant: 'destructive',
        duration: 5000,
      });
    } finally {
      setDeletingPlan(null);
    }
  };

  // Don't show the section if no user or still loading auth
  if (!user || authLoading) {
    return null;
  }

  const activePlans = learningPlans.filter(plan => plan.status === 'active');
  const completedPlans = learningPlans.filter(plan => plan.status === 'completed');

  // Show inviting empty state when no plans
  if (!isLoading && learningPlans.length === 0) {
    return (
      <section className="mt-8">
        <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 border border-indigo-200 dark:border-indigo-800 p-8 shadow-card text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-indigo-900 dark:text-indigo-100 mb-2">
              Create Your First AI-Powered Learning Plan
            </h3>
            <p className="text-indigo-700 dark:text-indigo-300 mb-6">
              Get a personalized curriculum tailored to your goals. Our AI analyzes your experience level and creates a structured path with the exact topics you need.
            </p>
            <Link
              href="/learn/custom"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg font-medium shadow-lg hover:shadow-xl hover:scale-105 transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Create Learning Plan
            </Link>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-4">
              ✨ Takes just 30 seconds • Free forever
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Link
              href="/learn/my-plans"
              className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              My Learning Plans
            </Link>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              Personalized learning paths created with AI
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/learn/my-plans"
              className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition"
            >
              Manage All
            </Link>
            <Link
              href="/learn/custom"
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition"
            >
              Create New →
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2 mb-2"></div>
                <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded w-full"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active Plans */}
            {activePlans.length > 0 && (
              <>
                <div className="text-xs font-medium text-neutral-500 dark:text-neutral-500 uppercase tracking-wide">
                  Active Plans ({activePlans.length})
                </div>
                {activePlans.slice(0, 2).map((plan) => {
                  const progress = planProgress[plan.id!] || { totalTopics: plan.topics?.length || 0, completedTopics: 0, progressPercentage: 0 };
                  const progressPercentage = progress.progressPercentage;
                  return (
                    <Link
                      key={plan.id}
                      href={`/learn/plan/${plan.slug}` as any}
                      className="block p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md transition-all group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-medium text-neutral-900 dark:text-neutral-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {plan.title}
                          </h3>
                          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1 line-clamp-2">
                            {plan.description}
                          </p>
                        </div>
                        <div className="ml-4 flex items-start gap-3">
                          <div className="text-right">
                            <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                              {progressPercentage}%
                            </div>
                            <div className="text-xs text-neutral-500 dark:text-neutral-500">
                              {progress.completedTopics}/{progress.totalTopics} topics
                            </div>
                          </div>
                          <DropdownMenu key={`menu-${plan.id}`}>
                            <DropdownMenuTrigger asChild>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                title="Plan options"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                </svg>
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/learn/plan/${plan.slug}` as any}
                                  className="flex items-center cursor-pointer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  View Plan
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={(e) => {
                                  e.preventDefault();
                                  setShowDeleteDialog(plan.id!);
                                }}
                                className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 focus:bg-red-50 dark:focus:bg-red-900/20"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                        <div
                          className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-500">
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            {plan.skillLevel}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                            {progress.totalTopics} topics
                          </span>
                        </div>
                        <svg className="w-4 h-4 text-neutral-400 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </div>
                    </Link>
                  );
                })}
                {activePlans.length > 2 && (
                  <div className="text-center">
                    <Link
                      href={"/learn" as any}
                      className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                    >
                      View all {activePlans.length} active plans →
                    </Link>
                  </div>
                )}
              </>
            )}

            {/* Completed Plans */}
            {completedPlans.length > 0 && (
              <>
                {activePlans.length > 0 && <div className="border-t border-neutral-200 dark:border-neutral-700 my-4"></div>}
                <div className="text-xs font-medium text-neutral-500 dark:text-neutral-500 uppercase tracking-wide">
                  Recently Completed ({completedPlans.length})
                </div>
                {completedPlans.slice(0, 1).map((plan) => (
                  <Link
                    key={plan.id}
                    href={`/learn/plan/${plan.slug}`}
                    className="block p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-green-900 dark:text-green-100">
                          {plan.title}
                        </h3>
                        <div className="flex items-center gap-3 text-xs text-green-700 dark:text-green-300 mt-1">
                          <span>✅ Completed</span>
                          <span>{plan.topics?.length || 0} topics mastered</span>
                        </div>
                      </div>
                      <svg className="w-4 h-4 text-green-600 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </>
            )}

            {/* No plans message */}
            {activePlans.length === 0 && completedPlans.length === 0 && !isLoading && (
              <div className="text-center py-6">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-indigo-100 dark:bg-indigo-900/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                  No learning plans yet
                </p>
                <Link
                  href={"/learn/custom" as any}
                  className="inline-flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition"
                >
                  Create your first learning plan
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog !== null} onOpenChange={(open) => !open && setShowDeleteDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Learning Plan?</DialogTitle>
            <DialogDescription>
              {showDeleteDialog && (
                <>
                  Are you sure you want to delete <strong className="text-neutral-900 dark:text-neutral-100">"{learningPlans.find(p => p.id === showDeleteDialog)?.title}"</strong>?
                  <br />
                  <br />
                  This action cannot be undone. All progress tracking will be permanently lost.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowDeleteDialog(null)}
              disabled={deletingPlan !== null}
              className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => showDeleteDialog && handleDeletePlan(showDeleteDialog)}
              disabled={deletingPlan !== null}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {deletingPlan ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Deleting...
                </>
              ) : (
                'Delete Plan'
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
