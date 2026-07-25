"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/toast';
import {
  getUserLearningPlans,
  FirebaseLearningPlan,
  calculatePlanProgress,
  deleteLearningPlan,
  updateLearningPlanStatus
} from '@/lib/firebase-learning-plans';

export default function MyLearningPlansPage() {
  const { user, loading: authLoading } = useAuth();
  const { addToast } = useToast();
  const [learningPlans, setLearningPlans] = useState<FirebaseLearningPlan[]>([]);
  const [planProgress, setPlanProgress] = useState<Record<string, { totalTopics: number; completedTopics: number; progressPercentage: number }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    const loadLearningPlans = async () => {
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
      setProcessingPlan(planId);
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

      setShowDeleteConfirm(null);

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
      setProcessingPlan(null);
    }
  };

  const handleStatusChange = async (planId: string, newStatus: FirebaseLearningPlan['status']) => {
    if (!user || !planId) return;

    const plan = learningPlans.find(p => p.id === planId);
    const planTitle = plan?.title || 'Learning plan';

    try {
      setProcessingPlan(planId);
      await updateLearningPlanStatus(planId, user.uid, newStatus);

      // Refresh the learning plans list
      const updatedPlans = await getUserLearningPlans(user.uid);
      setLearningPlans(updatedPlans);

      // Show success toast
      const statusMessages = {
        active: 'activated',
        paused: 'paused',
        completed: 'marked as complete',
        archived: 'archived',
      };

      addToast({
        title: 'Plan status updated',
        description: `"${planTitle}" has been ${statusMessages[newStatus]}.`,
        variant: 'success',
        duration: 3000,
      });
    } catch (error) {
      console.error('Error updating plan status:', error);

      addToast({
        title: 'Failed to update status',
        description: 'An error occurred while updating the plan status. Please try again.',
        variant: 'destructive',
        duration: 4000,
      });
    } finally {
      setProcessingPlan(null);
    }
  };

  if (!user && !authLoading) {
    return (
      <main className="min-h-screen py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center py-12">
            <h1 className="text-2xl font-semibold mb-4">Sign in to view your learning plans</h1>
            <p className="text-neutral-600 dark:text-neutral-300 mb-6">
              Create personalized learning paths and track your progress.
            </p>
            <Link
              href="/learn"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Browse Learning Paths
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const activePlans = learningPlans.filter(plan => plan.status === 'active');
  const pausedPlans = learningPlans.filter(plan => plan.status === 'paused');
  const completedPlans = learningPlans.filter(plan => plan.status === 'completed');
  const archivedPlans = learningPlans.filter(plan => plan.status === 'archived');

  return (
    <main className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">My Learning Plans</h1>
              <p className="text-neutral-600 dark:text-neutral-300 mt-2">
                Manage your personalized learning paths created with AI
              </p>
            </div>
            <Link
              href="/learn/custom"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Create New Plan
            </Link>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{activePlans.length}</div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">Active</div>
            </div>
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{pausedPlans.length}</div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">Paused</div>
            </div>
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{completedPlans.length}</div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">Completed</div>
            </div>
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-neutral-600 dark:text-neutral-400">{learningPlans.length}</div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">Total</div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-6">
                <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-full mb-2"></div>
                <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : learningPlans.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-100 dark:bg-indigo-900/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">No learning plans yet</h2>
            <p className="text-neutral-600 dark:text-neutral-300 mb-6">
              Create your first AI-powered learning plan to get started.
            </p>
            <Link
              href="/learn/custom"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Create Learning Plan
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Active Plans */}
            {activePlans.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                  Active Plans ({activePlans.length})
                </h2>
                <div className="grid gap-4">
                  {activePlans.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      progress={planProgress[plan.id!] || { totalTopics: 0, completedTopics: 0, progressPercentage: 0 }}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDeletePlan}
                      processingPlan={processingPlan}
                      showDeleteConfirm={showDeleteConfirm}
                      setShowDeleteConfirm={setShowDeleteConfirm}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Paused Plans */}
            {pausedPlans.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  Paused Plans ({pausedPlans.length})
                </h2>
                <div className="grid gap-4">
                  {pausedPlans.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      progress={planProgress[plan.id!] || { totalTopics: 0, completedTopics: 0, progressPercentage: 0 }}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDeletePlan}
                      processingPlan={processingPlan}
                      showDeleteConfirm={showDeleteConfirm}
                      setShowDeleteConfirm={setShowDeleteConfirm}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Completed Plans */}
            {completedPlans.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  Completed Plans ({completedPlans.length})
                </h2>
                <div className="grid gap-4">
                  {completedPlans.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      progress={planProgress[plan.id!] || { totalTopics: 0, completedTopics: 0, progressPercentage: 0 }}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDeletePlan}
                      processingPlan={processingPlan}
                      showDeleteConfirm={showDeleteConfirm}
                      setShowDeleteConfirm={setShowDeleteConfirm}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Archived Plans */}
            {archivedPlans.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-neutral-500"></div>
                  Archived Plans ({archivedPlans.length})
                </h2>
                <div className="grid gap-4">
                  {archivedPlans.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      progress={planProgress[plan.id!] || { totalTopics: 0, completedTopics: 0, progressPercentage: 0 }}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDeletePlan}
                      processingPlan={processingPlan}
                      showDeleteConfirm={showDeleteConfirm}
                      setShowDeleteConfirm={setShowDeleteConfirm}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

interface PlanCardProps {
  plan: FirebaseLearningPlan;
  progress: { totalTopics: number; completedTopics: number; progressPercentage: number };
  onStatusChange: (planId: string, status: FirebaseLearningPlan['status']) => void;
  onDelete: (planId: string) => void;
  processingPlan: string | null;
  showDeleteConfirm: string | null;
  setShowDeleteConfirm: (planId: string | null) => void;
}

function PlanCard({
  plan,
  progress,
  onStatusChange,
  onDelete,
  processingPlan,
  showDeleteConfirm,
  setShowDeleteConfirm
}: PlanCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200';
      case 'paused': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200';
      case 'archived': return 'bg-neutral-100 text-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-200';
      default: return 'bg-neutral-100 text-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-200';
    }
  };

  // Track when plan is being deleted for fade-out animation
  useEffect(() => {
    if (processingPlan === plan.id) {
      setIsDeleting(true);
    }
  }, [processingPlan, plan.id]);

  return (
    <div className={`bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-6 hover:shadow-lg transition-all ${isDeleting ? 'opacity-50 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Link
              href={`/learn/plan/${plan.slug}`}
              className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              {plan.title}
            </Link>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(plan.status)}`}>
              {plan.status}
            </span>
          </div>
          <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-3 line-clamp-2">
            {plan.description}
          </p>
          <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-500">
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
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Created {new Date(plan.createdAt.toDate()).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right min-w-[60px]">
            <div className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">
              {progress.progressPercentage}%
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-500">
              {progress.completedTopics}/{progress.totalTopics}
            </div>
          </div>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
              disabled={processingPlan === plan.id}
              aria-label="Plan options"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>

            {showMenu && (
              <div className="absolute top-10 right-0 z-20 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg py-2 min-w-40 animate-in fade-in slide-in-from-top-2 duration-200">
                {plan.status !== 'active' && (
                  <button
                    onClick={() => {
                      onStatusChange(plan.id!, 'active');
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Activate
                  </button>
                )}
                {plan.status !== 'paused' && (
                  <button
                    onClick={() => {
                      onStatusChange(plan.id!, 'paused');
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Pause
                  </button>
                )}
                {plan.status !== 'completed' && (
                  <button
                    onClick={() => {
                      onStatusChange(plan.id!, 'completed');
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Mark Complete
                  </button>
                )}
                {plan.status !== 'archived' && (
                  <button
                    onClick={() => {
                      onStatusChange(plan.id!, 'archived');
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                    Archive
                  </button>
                )}
                <div className="border-t border-neutral-200 dark:border-neutral-700 my-1"></div>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(plan.id!);
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 mb-4">
        <div
          className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress.progressPercentage}%` }}
        />
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm === plan.id && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDeleteConfirm(null);
            }
          }}
        >
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2 text-neutral-900 dark:text-neutral-100">
                  Delete Learning Plan?
                </h3>
                <p className="text-neutral-600 dark:text-neutral-400 mb-2">
                  Are you sure you want to delete <strong className="text-neutral-900 dark:text-neutral-100">"{plan.title}"</strong>?
                </p>
                <p className="text-sm text-neutral-500 dark:text-neutral-500">
                  This action cannot be undone. All progress tracking will be permanently lost.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                disabled={processingPlan === plan.id}
                className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={() => onDelete(plan.id!)}
                disabled={processingPlan === plan.id}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
              >
                {processingPlan === plan.id ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Plan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}