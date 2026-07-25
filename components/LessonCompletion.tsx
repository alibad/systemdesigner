'use client';

import { useState, useEffect, useRef } from 'react';
import { useLessonProgress, LearningCategory } from '@/hooks/useProgressTracking';
import { useSignupNudge } from '@/hooks/useSignupNudge';
import { useGamification } from '@/contexts/GamificationContext';

interface LessonCompletionProps {
  lessonSlug: string;
  category: LearningCategory;
  nextLessonUrl?: string;
  nextLessonTitle?: string;
  isFromLearningPlan?: boolean;
  /**
   * When true, this lesson's progress is gated by a graded challenge, so marking it
   * complete tracks PROGRESS only and grants NO flat XP — the challenge awards XP based
   * on the rubric score (see lib/gamification.ts trackChallengeCompletion). Defaults to
   * false to preserve the legacy behavior for the ~200 lessons without a challenge yet.
   */
  masteryGated?: boolean;
}

export default function LessonCompletion({
  lessonSlug,
  category,
  nextLessonUrl,
  nextLessonTitle,
  isFromLearningPlan = false,
  masteryGated = false
}: LessonCompletionProps) {
  const { isCompleted, loading, markComplete, unmarkComplete } = useLessonProgress(lessonSlug, category);
  const { checkSignupNudgeEligibility } = useSignupNudge();
  const { trackLessonCompletion } = useGamification();
  const [isMarking, setIsMarking] = useState(false);
  const [showUnmarkOption, setShowUnmarkOption] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUnmarkOption(false);
      }
    };

    if (showUnmarkOption) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUnmarkOption]);

  const handleMarkComplete = async () => {
    setIsMarking(true);
    try {
      await markComplete();

      // Evidence-based XP: only award the flat completion XP for lessons NOT gated by a
      // graded challenge. Gated lessons earn XP from the challenge rubric instead, so a
      // button click can no longer inflate XP/streaks.
      if (!masteryGated) {
        await trackLessonCompletion(`${category}-${lessonSlug}`, 15, category);
      }

      // Trigger signup nudge check after completing lesson
      setTimeout(() => {
        checkSignupNudgeEligibility();
      }, 1000); // Small delay to ensure progress is saved
    } catch (error) {
      console.error('Failed to mark lesson complete:', error);
    } finally {
      setIsMarking(false);
    }
  };

  const handleUnmarkComplete = async () => {
    setIsMarking(true);
    try {
      await unmarkComplete();
      setShowUnmarkOption(false);
    } catch (error) {
      console.error('Failed to unmark lesson complete:', error);
    } finally {
      setIsMarking(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 animate-pulse">
        <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded mb-2"></div>
        <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4"></div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border p-6 ${
      isCompleted 
        ? 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/10' 
        : 'border-indigo-200 dark:border-indigo-900/40 bg-indigo-50 dark:bg-indigo-900/10'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {isCompleted ? (
              <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            
            <h3 className={`text-lg font-semibold flex-1 ${
              isCompleted 
                ? 'text-emerald-900 dark:text-emerald-100' 
                : 'text-indigo-900 dark:text-indigo-100'
            }`}>
              {isCompleted ? 'Lesson Completed!' : 'Mark Lesson Complete'}
            </h3>
            
            {/* Hidden unmark option - only shows when completed */}
            {isCompleted && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowUnmarkOption(!showUnmarkOption)}
                  className="p-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 opacity-30 hover:opacity-100 transition-all duration-200"
                  title="Mark as incomplete"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                
                {/* Confirmation dropdown */}
                {showUnmarkOption && (
                  <div className="absolute top-6 right-0 z-10 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg p-3 min-w-48">
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                      Mark this lesson as incomplete?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleUnmarkComplete}
                        disabled={isMarking}
                        className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isMarking ? 'Unmarking...' : 'Yes, unmark'}
                      </button>
                      <button
                        onClick={() => setShowUnmarkOption(false)}
                        className="px-2 py-1 bg-neutral-500 text-white rounded text-xs hover:bg-neutral-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <p className={`${
            isCompleted 
              ? 'text-emerald-700 dark:text-emerald-300' 
              : 'text-indigo-700 dark:text-indigo-300'
          } mb-4`}>
            {isCompleted 
              ? 'Great job! You\'ve completed this lesson. Your progress has been saved.'
              : 'Mark this lesson as complete to track your learning progress.'
            }
          </p>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-3">
        {!isCompleted && (
          <button
            onClick={handleMarkComplete}
            disabled={isMarking}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm sm:text-base"
          >
            {isMarking ? 'Marking Complete...' : 'Mark Complete'}
          </button>
        )}
        
        {nextLessonUrl && nextLessonTitle && (
          <a
            href={isFromLearningPlan ? `${nextLessonUrl}?fromLearningPlan=true` : nextLessonUrl}
            className={`px-4 py-2 rounded-lg transition-colors font-medium text-sm sm:text-base text-center ${
              isCompleted
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'border border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/20'
            }`}
          >
            <span className="block sm:inline">Next:</span> <span className="block sm:inline font-normal sm:font-medium">{nextLessonTitle}</span>
          </a>
        )}
        
        <a
          href={`/${category}`}
          className={`px-4 py-2 border rounded-lg transition-colors font-medium text-sm sm:text-base text-center ${
            isCompleted
              ? 'border-emerald-300 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/20'
              : 'border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/20'
          }`}
        >
          All {category === 'reference' ? 'Reference' :
               category === 'technology' ? 'Technology' :
               category === 'fundamentals' ? 'Fundamentals' : 'Lessons'}
        </a>
      </div>

    </div>
  );
}
