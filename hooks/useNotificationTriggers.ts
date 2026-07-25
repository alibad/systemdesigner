/**
 * NOTIFICATION TRIGGERS HOOK
 *
 * Easy-to-use hooks for triggering admin notifications from anywhere in the app.
 * Integrates with the notification service and provides smart batching.
 */

import { useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { NotificationService } from '@/lib/notification-service';

export function useNotificationTriggers() {
  const { user } = useAuth();

  // User Activity Triggers
  const triggerUserRegistration = useCallback(async (userData: {
    uid: string;
    email?: string;
    displayName?: string;
  }) => {
    try {
      await NotificationService.notifyNewUser(userData);
    } catch (error) {
      console.error('Error triggering user registration notification:', error);
    }
  }, []);

  const triggerLessonCompletion = useCallback(async (data: {
    lessonSlug: string;
    title: string;
    completions: number;
    milestone?: number;
  }) => {
    try {
      // Check for milestone notifications
      const milestones = [100, 500, 1000, 5000];
      const reachedMilestone = milestones.find(m => data.completions === m);

      if (reachedMilestone) {
        await NotificationService.notifyContentMilestone({
          lessonSlug: data.lessonSlug,
          title: data.title,
          completions: data.completions,
          milestone: reachedMilestone,
        });
      }
    } catch (error) {
      console.error('Error triggering lesson completion notification:', error);
    }
  }, []);

  const triggerQuizAlert = useCallback(async (data: {
    topicId: string;
    averageScore: number;
    sampleSize: number;
  }) => {
    try {
      // Only alert if score is below 60% with significant sample size
      if (data.averageScore < 60 && data.sampleSize >= 10) {
        await NotificationService.notify({
          type: 'learning_activity',
          priority: 'medium',
          title: 'Low Quiz Performance Detected',
          message: `Quiz "${data.topicId}" has an average score of ${data.averageScore}% across ${data.sampleSize} attempts`,
          source: 'quiz-analytics',
          tags: ['quiz', 'performance', 'low-score'],
          data: {
            topicId: data.topicId,
            averageScore: data.averageScore,
            sampleSize: data.sampleSize,
          },
          actions: [
            {
              label: 'Review Quiz',
              url: `/admin/content?quiz=${data.topicId}`,
              type: 'view'
            }
          ],
          deliveryMethod: ['in_app', 'email']
        });
      }
    } catch (error) {
      console.error('Error triggering quiz alert:', error);
    }
  }, []);

  // Feedback Triggers
  const triggerFeedback = useCallback(async (feedbackData: {
    id: string;
    feedback: string;
    category: string;
    userEmail?: string;
    urgent?: boolean;
    url?: string;
    pageTitle?: string;
  }) => {
    try {
      await NotificationService.notifyNewFeedback(feedbackData);
    } catch (error) {
      console.error('Error triggering feedback notification:', error);
    }
  }, []);

  // Content Triggers
  const triggerContentMilestone = useCallback(async (data: {
    lessonSlug: string;
    title: string;
    completions: number;
    milestone: number;
  }) => {
    try {
      await NotificationService.notifyContentMilestone(data);
    } catch (error) {
      console.error('Error triggering content milestone notification:', error);
    }
  }, []);

  // System Health Triggers
  const triggerSystemAlert = useCallback(async (data: {
    type: 'error' | 'performance' | 'security';
    title: string;
    message: string;
    errorCode?: string;
    count?: number;
  }) => {
    try {
      await NotificationService.notifySystemAlert(data);
    } catch (error) {
      console.error('Error triggering system alert:', error);
    }
  }, []);

  // Achievement Triggers
  const triggerAchievementUnlocked = useCallback(async (data: {
    achievementId: string;
    achievementTitle: string;
    achievementRarity: 'common' | 'rare' | 'epic' | 'legendary';
    achievementIcon: string;
    achievementDescription: string;
    userEmail?: string;
    userName?: string;
    userId: string;
    xpReward?: number;
    totalAchievements?: number;
  }) => {
    try {
      await NotificationService.notifyAchievementUnlocked(data);
    } catch (error) {
      console.error('Error triggering achievement notification:', error);
    }
  }, []);

  const triggerAchievementMilestone = useCallback(async (data: {
    userId: string;
    userEmail?: string;
    userName?: string;
    totalAchievements: number;
    milestone: number;
    recentAchievements?: Array<{ title: string; rarity: string; icon: string }>;
  }) => {
    try {
      // Check if this total matches a milestone threshold
      const milestones = [5, 10, 25, 50];
      if (milestones.includes(data.totalAchievements)) {
        await NotificationService.notifyAchievementMilestone({
          ...data,
          milestone: data.totalAchievements
        });
      }
    } catch (error) {
      console.error('Error triggering achievement milestone notification:', error);
    }
  }, []);

  // Learning Plan Triggers
  const triggerLearningPlanCreated = useCallback(async (data: {
    userId: string;
    userEmail?: string;
    userName?: string;
    planTitle: string;
    topicCount: number;
    estimatedWeeks: number;
  }) => {
    try {
      await NotificationService.notifyLearningPlanCreated(data);
    } catch (error) {
      console.error('Error triggering learning plan notification:', error);
    }
  }, []);

  // AI Interaction Triggers
  const triggerAIInteraction = useCallback(async (data: {
    userId: string;
    userEmail?: string;
    userName?: string;
    interactionType: 'explain' | 'chat';
    pageUrl: string;
    queryText?: string;
  }) => {
    try {
      await NotificationService.notifyAIInteraction(data);
    } catch (error) {
      console.error('Error triggering AI interaction notification:', error);
    }
  }, []);

  // Content Engagement Triggers
  const triggerContentEngagement = useCallback(async (data: {
    userId: string;
    userEmail?: string;
    userName?: string;
    engagementType: 'highlight' | 'note';
    pageUrl: string;
    textSnippet?: string;
  }) => {
    try {
      await NotificationService.notifyContentEngagement(data);
    } catch (error) {
      console.error('Error triggering content engagement notification:', error);
    }
  }, []);

  // Whiteboard Activity Triggers
  const triggerWhiteboardActivity = useCallback(async (data: {
    userId: string;
    userEmail?: string;
    userName?: string;
    activityType: 'created' | 'shared';
    boardId: string;
    boardTitle?: string;
    sharedWith?: string[];
  }) => {
    try {
      await NotificationService.notifyWhiteboardActivity(data);
    } catch (error) {
      console.error('Error triggering whiteboard activity notification:', error);
    }
  }, []);

  return {
    // User Activity
    triggerUserRegistration,
    triggerLessonCompletion,
    triggerQuizAlert,

    // Feedback
    triggerFeedback,

    // Content
    triggerContentMilestone,

    // System Health
    triggerSystemAlert,

    // Achievements
    triggerAchievementUnlocked,
    triggerAchievementMilestone,

    // Learning Plans
    triggerLearningPlanCreated,

    // AI Interactions
    triggerAIInteraction,

    // Content Engagement
    triggerContentEngagement,

    // Whiteboard
    triggerWhiteboardActivity,
  };
}

// React Error Boundary integration
export function useErrorNotification() {
  const { triggerSystemAlert } = useNotificationTriggers();

  const reportError = useCallback((error: Error, errorInfo?: any) => {
    // For critical errors, trigger an immediate alert
    const isCritical = error.name === 'ChunkLoadError' ||
                      error.message.includes('Loading chunk') ||
                      error.message.includes('Network') ||
                      error.message.includes('Firebase');

    if (isCritical) {
      triggerSystemAlert({
        type: 'error',
        title: 'Critical Application Error',
        message: `${error.name}: ${error.message}`,
        errorCode: error.name,
      });
    }
  }, [triggerSystemAlert]);

  return { reportError };
}