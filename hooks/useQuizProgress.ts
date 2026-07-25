'use client';

import { useState, useEffect } from 'react';
import { userStorage } from '@/lib/unified-storage';
import { FirebaseQuizAttempt, getUserQuizAttempts } from '@/lib/firebase';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';

export function useQuizProgress(lessonSlug: string) {
  const [quizAttempts, setQuizAttempts] = useState<FirebaseQuizAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const loadQuizProgress = async () => {
    try {
      setLoading(true);

      // Set user for UnifiedStorage
      if (user !== undefined) {
        await userStorage.setUser(user);
      }

      // Try to get quiz attempts from UnifiedStorage first
      const allQuizAttempts = await userStorage.getQuizAttempts();

      const lessonAttempts = Object.values(allQuizAttempts)
        .filter(attempt => attempt.quizId === lessonSlug)
        .map(attempt => ({
          id: `${lessonSlug}-${Date.now()}`,
          userId: user?.uid || 'anonymous',
          topicId: lessonSlug,
          score: attempt.score,
          answers: attempt.answers ? Object.values(attempt.answers) : [],
          timeSpent: attempt.timeSpent || 0,
          completedAt: Timestamp.fromDate(new Date(attempt.lastAttempt)),
          attempts: attempt.attempts
        } as FirebaseQuizAttempt))
        .sort((a, b) => b.completedAt.toMillis() - a.completedAt.toMillis());

      setQuizAttempts(lessonAttempts);
      setError(null);
    } catch (err) {
      // If UnifiedStorage fails and we don't have a user, show error
      if (!user) {
        setError('Please sign in to view quiz progress');
        console.log('Quiz progress loading failed: No user available');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load quiz progress');
        console.log('Quiz progress loading failed:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuizProgress();
  }, [lessonSlug]);

  const saveQuizScore = async (score: number, maxScore: number, answers: any[], timeSpent: number, perQuestionSeconds?: number[]) => {
    // Guard against invalid quiz data
    if (maxScore === 0 || isNaN(score) || score < 0) {
      // This should never happen now with the fix in InteractiveQuiz
      return false;
    }

    try {
      const scorePercentage = Math.round((score / maxScore) * 100);


      // Save to UnifiedStorage (handles offline/online automatically)
      await userStorage.setQuizAttempt(lessonSlug, {
        score: scorePercentage,
        answers,
        attempts: 1,
        lastAttempt: new Date().toISOString(),
        timeSpent
      });


      // Quiz attempt saved via UnifiedStorage (consolidated model)

      // Reload quiz attempts to get updated data
      await loadQuizProgress();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save quiz score');
      console.error('Failed to save quiz score:', err);
      return false;
    }
  };

  const getBestScore = (): number | null => {
    if (quizAttempts.length === 0) return null;
    return Math.max(...quizAttempts.map(attempt => attempt.score));
  };

  const getLatestScore = (): number | null => {
    if (quizAttempts.length === 0) return null;
    return quizAttempts[0].score; // Already sorted by completion date desc
  };

  const getAttemptCount = (): number => {
    return quizAttempts.length;
  };

  return {
    quizAttempts,
    loading,
    error,
    saveQuizScore,
    getBestScore,
    getLatestScore,
    getAttemptCount,
    refetch: loadQuizProgress
  };
}