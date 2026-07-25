'use client';

import { useState, useEffect } from 'react';
import { userStorage } from '@/lib/unified-storage';
import {
  FirebaseLearningProgress,
  trackLessonStarted,
  trackLessonCompleted,
} from '@/lib/firebase';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';

export type LearningCategory = 'fundamentals' | 'genai' | 'ml-systems' | 'case-studies' | 'practice' | 'tools' | 'reference' | 'technology';

export function useProgressTracking(category: LearningCategory) {
  const [progress, setProgress] = useState<FirebaseLearningProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const loadProgress = async () => {
    try {
      setLoading(true);

      // Try to get progress from UnifiedStorage first (handles offline/online automatically)
      const categoryProgress = await userStorage.getProgress(category);

      // Convert UnifiedStorage format to FirebaseLearningProgress format
      const progressArray: FirebaseLearningProgress[] = Object.entries(categoryProgress)
        .filter(([_, data]) => data.completed)
        .map(([lessonSlug, data]) => ({
          id: `${category}-${lessonSlug}`,
          userId: user?.uid || 'anonymous',
          lessonSlug,
          category,
          completedAt: data.completedAt ? Timestamp.fromDate(new Date(data.completedAt)) : Timestamp.now(),
          lastAccessed: data.completedAt ? Timestamp.fromDate(new Date(data.completedAt)) : Timestamp.now(),
          timeSpent: data.timeSpent || 0
        } as FirebaseLearningProgress));

      setProgress(progressArray);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load progress');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Set user for UnifiedStorage when it changes
    if (user !== undefined) {
      userStorage.setUser(user);
    }
    loadProgress();
  }, [category, user]);

  const markCompleted = async (lessonSlug: string, timeSpent?: number) => {
    try {
      // Save to UnifiedStorage (handles offline/online automatically)
      await userStorage.setProgress(category, lessonSlug, {
        completed: true,
        completedAt: new Date().toISOString(),
        timeSpent: timeSpent || 0,
        score: 100
      });

      // Note: UnifiedStorage handles Firebase sync automatically

      // Track analytics event
      trackLessonCompleted(lessonSlug, category, timeSpent);

      // Reload progress to get updated data
      await loadProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark lesson complete');
    }
  };

  const isCompleted = (lessonSlug: string): boolean => {
    return progress.some(p => p.lessonSlug === lessonSlug);
  };

  const getCompletionPercentage = (totalLessons: number): number => {
    if (totalLessons === 0) return 0;
    return Math.round((progress.length / totalLessons) * 100);
  };

  const getCompletedCount = (): number => {
    return progress.length;
  };

  const getLastAccessed = (lessonSlug: string): Date | null => {
    const lessonProgress = progress.find(p => p.lessonSlug === lessonSlug);
    return lessonProgress ? lessonProgress.lastAccessed.toDate() : null;
  };

  return {
    progress,
    loading,
    error,
    markCompleted,
    isCompleted,
    getCompletionPercentage,
    getCompletedCount,
    getLastAccessed,
    refetch: loadProgress
  };
}

export function useLessonProgress(lessonSlug: string, category: LearningCategory) {
  const [isCompleted, setIsCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeSpent, setTimeSpent] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    let startTime = Date.now();

    const checkProgress = async () => {
      try {
        // Set user for UnifiedStorage
        if (user !== undefined) {
          await userStorage.setUser(user);
        }

        // Check progress from UnifiedStorage (handles offline/online)
        const categoryProgress = await userStorage.getProgress(category);
        const lessonProgress = categoryProgress[lessonSlug];

        setIsCompleted(lessonProgress?.completed || false);
        setTimeSpent(lessonProgress?.timeSpent || 0);
      } catch (err) {
        setIsCompleted(false);
      } finally {
        setLoading(false);
      }
    };

    checkProgress();

    // Track lesson started for analytics
    trackLessonStarted(lessonSlug, category);

    // Track time spent on page
    const interval = setInterval(() => {
      setTimeSpent(prev => prev + 1);
    }, 1000);

    return () => {
      clearInterval(interval);
      // Calculate total time spent
      const sessionTime = Math.floor((Date.now() - startTime) / 1000);
      setTimeSpent(prev => prev + sessionTime);
    };
  }, [lessonSlug, category, user]);

  const markComplete = async () => {
    try {
      // Save to UnifiedStorage (handles offline/online automatically)
      await userStorage.setProgress(category, lessonSlug, {
        completed: true,
        completedAt: new Date().toISOString(),
        timeSpent,
        score: 100
      });

      // Note: UnifiedStorage handles Firebase sync automatically

      // Track analytics event
      trackLessonCompleted(lessonSlug, category, timeSpent);
      setIsCompleted(true);
    } catch (err) {
      console.error('Failed to mark lesson complete:', err);
    }
  };

  const unmarkComplete = async () => {
    try {
      // Update UnifiedStorage
      await userStorage.setProgress(category, lessonSlug, {
        completed: false,
        timeSpent
      });

      // Note: UnifiedStorage handles Firebase sync automatically

      setIsCompleted(false);
    } catch (err) {
      console.error('Failed to unmark lesson complete:', err);
    }
  };

  return {
    isCompleted,
    loading,
    timeSpent,
    markComplete,
    unmarkComplete
  };
}