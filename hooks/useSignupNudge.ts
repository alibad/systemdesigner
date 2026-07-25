'use client';

import { useState, useEffect } from 'react';
import { userStorage } from '@/lib/unified-storage';
import { useAuth } from '@/hooks/useAuth';

export function useSignupNudge() {
  const { user } = useAuth();
  const [shouldShowNudge, setShouldShowNudge] = useState(false);
  const [hasCompletedFirstQuiz, setHasCompletedFirstQuiz] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [currentMilestone, setCurrentMilestone] = useState(0);

  useEffect(() => {
    checkSignupNudgeEligibility();
  }, [user]);

  const checkSignupNudgeEligibility = async () => {
    try {
      // Use the current user from useAuth instead of creating anonymous users
      if (!user) {
        setShouldShowNudge(false);
        return;
      }

      const isUserAnonymous = user.isAnonymous;
      setIsAnonymous(isUserAnonymous);

      // Only show nudge for anonymous users
      if (!isUserAnonymous) {
        setShouldShowNudge(false); // Hide nudge if user becomes authenticated
        return;
      }

      // Check dismissal status
      const permanentDismissalKey = `signup-nudge-permanent-${user.uid}`;
      const milestonesDismissalKey = `signup-nudge-dismissed-${user.uid}`;
      const wasAuthenticatedKey = 'was-previously-authenticated';
      
      const isPermanentlyDismissed = localStorage.getItem(permanentDismissalKey) === 'true';
      const lastDismissedMilestone = parseInt(localStorage.getItem(milestonesDismissalKey) || '0');
      const wasPreviouslyAuthenticated = localStorage.getItem(wasAuthenticatedKey) === 'true';

      if (isPermanentlyDismissed || wasPreviouslyAuthenticated) {
        return;
      }

      // Set user for UnifiedStorage and check activity
      if (user !== undefined) {
        await userStorage.setUser(user);
      }

      // Check if user has completed any quizzes
      const allQuizAttempts = await userStorage.getQuizAttempts();
      const quizCount = Object.keys(allQuizAttempts).length;
      const hasQuizzes = quizCount > 0;

      // Check if user has completed any lessons
      const allProgress = await userStorage.getProgress();
      const progressEntries = Object.values(allProgress).filter(p => p.completed);
      const progressCount = progressEntries.length;
      const hasProgress = progressCount > 0;

      const totalActivity = quizCount + progressCount;
      setHasCompletedFirstQuiz(hasQuizzes || hasProgress);
      setCurrentMilestone(totalActivity);


      // Progressive nudging at key milestones: 1st, 3rd, 5th, 10th, 20th activity
      const nudgeMilestones = [1, 3, 5, 10, 20];
      
      // Find the highest milestone reached that hasn't been dismissed
      let eligibleMilestone = null;
      for (const milestone of nudgeMilestones) {
        if (totalActivity >= milestone && milestone > lastDismissedMilestone) {
          eligibleMilestone = milestone;
        }
      }
      
      if (eligibleMilestone) {
        setShouldShowNudge(true);
        return;
      }
    } catch (error) {
      console.error('Error checking signup nudge eligibility:', error);
      setShouldShowNudge(false);
    }
  };

  const dismissNudge = async () => {
    try {
      if (!user) {
        return;
      }
      const permanentDismissalKey = `signup-nudge-permanent-${user.uid}`;
      localStorage.setItem(permanentDismissalKey, 'true');
      setNudgeDismissed(true);
      setShouldShowNudge(false);
    } catch (error) {
      console.error('Error dismissing nudge:', error);
    }
  };

  const dismissCurrentMilestone = async () => {
    try {
      if (!user) {
        return;
      }
      const nudgeDismissedKey = `signup-nudge-dismissed-${user.uid}`;
      localStorage.setItem(nudgeDismissedKey, currentMilestone.toString());
      setShouldShowNudge(false);
    } catch (error) {
      console.error('Error dismissing current milestone:', error);
    }
  };

  const hideNudge = () => {
    setShouldShowNudge(false);
  };

  return {
    shouldShowNudge,
    hasCompletedFirstQuiz,
    isAnonymous,
    nudgeDismissed,
    currentMilestone,
    dismissNudge, // Permanent dismissal
    dismissCurrentMilestone, // Just this milestone
    hideNudge, // Just hide for this session
    checkSignupNudgeEligibility
  };
}