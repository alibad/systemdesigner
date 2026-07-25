/**
 * ADMIN NOTIFICATION SERVICE
 *
 * Flexible notification system that integrates with:
 * - Firestore Email Extension (firebase/firestore-send-email)
 * - In-app notifications for real-time admin updates
 * - Smart batching and deduplication
 *
 * Usage:
 * - Call from anywhere in the codebase: NotificationService.notify()
 * - Firebase functions can also use this service
 * - Supports both immediate and batched notifications
 */

import {
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
  Timestamp,
  runTransaction
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  AdminNotification,
  AdminNotificationsDocument,
  NotificationType,
  NotificationPriority
} from '@/lib/firebase-types';

// =====================================
// NOTIFICATION TRIGGERS CONFIGURATION
// =====================================

export const ADMIN_NOTIFICATION_TRIGGERS = {
  // User Activity Notifications
  USER_ACTIVITY: {
    NEW_USER_REGISTRATION: {
      type: 'user_activity' as NotificationType,
      priority: 'medium' as NotificationPriority,
      emailEnabled: true,
      batchingEnabled: true,
      batchWindow: 60, // minutes
    },
    HIGH_ENGAGEMENT_USER: {
      type: 'user_activity' as NotificationType,
      priority: 'low' as NotificationPriority,
      threshold: 10, // lessons completed in a day
      emailEnabled: false,
      batchingEnabled: true,
    },
    USER_STREAK_MILESTONE: {
      type: 'user_activity' as NotificationType,
      priority: 'low' as NotificationPriority,
      thresholds: [7, 30, 100], // streak days
      emailEnabled: false,
    }
  },

  // Feedback Notifications
  FEEDBACK: {
    NEW_FEEDBACK: {
      type: 'feedback' as NotificationType,
      priority: 'medium' as NotificationPriority,
      emailEnabled: true,
      batchingEnabled: false, // Immediate notification
    },
    URGENT_FEEDBACK: {
      type: 'feedback' as NotificationType,
      priority: 'urgent' as NotificationPriority,
      keywords: ['bug', 'error', 'broken', 'urgent', 'critical'],
      emailEnabled: true,
      batchingEnabled: false,
    },
    FEEDBACK_VOLUME_SPIKE: {
      type: 'feedback' as NotificationType,
      priority: 'high' as NotificationPriority,
      threshold: 5, // feedback items per hour
      emailEnabled: true,
    }
  },

  // Content & Learning Notifications
  CONTENT: {
    LESSON_COMPLETION_MILESTONE: {
      type: 'content_milestone' as NotificationType,
      priority: 'low' as NotificationPriority,
      thresholds: [100, 500, 1000, 5000], // total completions
      emailEnabled: false,
    },
    LOW_QUIZ_SCORES: {
      type: 'learning_activity' as NotificationType,
      priority: 'medium' as NotificationPriority,
      threshold: 60, // average score below 60%
      emailEnabled: true,
      batchingEnabled: true,
    },
    HIGH_DROPOUT_RATE: {
      type: 'learning_activity' as NotificationType,
      priority: 'high' as NotificationPriority,
      threshold: 70, // dropout rate above 70%
      emailEnabled: true,
    }
  },

  // System Health Notifications
  SYSTEM: {
    HIGH_ERROR_RATE: {
      type: 'system_health' as NotificationType,
      priority: 'urgent' as NotificationPriority,
      threshold: 10, // errors per minute
      emailEnabled: true,
      batchingEnabled: false,
    },
    PERFORMANCE_DEGRADATION: {
      type: 'system_health' as NotificationType,
      priority: 'high' as NotificationPriority,
      threshold: 3000, // page load time > 3 seconds
      emailEnabled: true,
    }
  },

  // Engagement Notifications
  ENGAGEMENT: {
    VIRAL_CONTENT: {
      type: 'engagement' as NotificationType,
      priority: 'medium' as NotificationPriority,
      threshold: 50, // shares/highlights per day
      emailEnabled: false,
    },
    FEATURE_ADOPTION: {
      type: 'engagement' as NotificationType,
      priority: 'low' as NotificationPriority,
      threshold: 100, // new feature uses
      emailEnabled: false,
    }
  },

  // Achievement Notifications
  ACHIEVEMENTS: {
    RARE_ACHIEVEMENT_UNLOCKED: {
      type: 'user_activity' as NotificationType,
      priority: 'medium' as NotificationPriority,
      rarities: ['rare', 'epic', 'legendary'], // Only notify for rare+ achievements
      emailEnabled: true,
      batchingEnabled: true,
      batchWindow: 30, // minutes
    },
    LEGENDARY_ACHIEVEMENT: {
      type: 'user_activity' as NotificationType,
      priority: 'high' as NotificationPriority,
      rarities: ['legendary'], // Only legendary achievements
      emailEnabled: true,
      batchingEnabled: false, // Immediate notification for legendary
    },
    ACHIEVEMENT_MILESTONE: {
      type: 'user_activity' as NotificationType,
      priority: 'low' as NotificationPriority,
      thresholds: [5, 10, 25, 50], // Total achievements unlocked milestones
      emailEnabled: true,
      batchingEnabled: true,
    }
  },

  // Learning Plan Notifications
  LEARNING_PLAN: {
    PLAN_CREATED: {
      type: 'engagement' as NotificationType,
      priority: 'medium' as NotificationPriority,
      emailEnabled: true,
      batchingEnabled: true,
      batchWindow: 60, // minutes
    },
    PLAN_COMPLETED: {
      type: 'engagement' as NotificationType,
      priority: 'low' as NotificationPriority,
      emailEnabled: false,
      batchingEnabled: true,
    }
  },

  // AI Interaction Notifications
  AI_INTERACTIONS: {
    AI_EXPLAIN_USED: {
      type: 'engagement' as NotificationType,
      priority: 'low' as NotificationPriority,
      emailEnabled: true, // ✅ ENABLED: Send email for AI Explain usage
      batchingEnabled: true,
      threshold: 10, // Per day
    },
    AI_CHAT_SESSION: {
      type: 'engagement' as NotificationType,
      priority: 'low' as NotificationPriority,
      emailEnabled: true, // ✅ ENABLED: Send email for AI Chat sessions
      batchingEnabled: true,
      threshold: 5, // Per day
    },
    HIGH_AI_USAGE: {
      type: 'engagement' as NotificationType,
      priority: 'medium' as NotificationPriority,
      threshold: 50, // Total interactions per user per week
      emailEnabled: true,
    }
  },

  // Content Engagement Notifications
  CONTENT_ENGAGEMENT: {
    TEXT_HIGHLIGHTED: {
      type: 'engagement' as NotificationType,
      priority: 'low' as NotificationPriority,
      emailEnabled: true, // ✅ ENABLED: Send email for text highlights
      threshold: 5, // Per lesson
    },
    NOTE_CREATED: {
      type: 'engagement' as NotificationType,
      priority: 'low' as NotificationPriority,
      emailEnabled: true, // ✅ ENABLED: Send email for note creation
      threshold: 3, // Per day
    },
    HIGH_ENGAGEMENT_SESSION: {
      type: 'engagement' as NotificationType,
      priority: 'medium' as NotificationPriority,
      threshold: 10, // Highlights + notes in single session
      emailEnabled: true,
    }
  },

  // Whiteboard Notifications
  WHITEBOARD: {
    BOARD_CREATED: {
      type: 'engagement' as NotificationType,
      priority: 'low' as NotificationPriority,
      emailEnabled: true, // ✅ ENABLED: Send email for whiteboard creation
    },
    BOARD_SHARED: {
      type: 'engagement' as NotificationType,
      priority: 'medium' as NotificationPriority,
      emailEnabled: true,
    },
    COLLABORATIVE_SESSION: {
      type: 'engagement' as NotificationType,
      priority: 'medium' as NotificationPriority,
      threshold: 3, // Multiple users on same board
      emailEnabled: true,
    }
  }
} as const;

// =====================================
// NOTIFICATION SERVICE CLASS
// =====================================

export class NotificationService {

  private static readonly MAX_NOTIFICATIONS = 500; // Keep last 500 notifications

  // CRITICAL: Deduplication tracking to prevent notification spam
  // Maps notification key -> timestamp of last notification
  private static notificationCache = new Map<string, number>();
  private static readonly DEDUP_WINDOW_MS = 60000; // 1 minute window for deduplication

  /**
   * Generate a unique key for deduplication based on notification content
   */
  private static generateNotificationKey(notification: Omit<AdminNotification, 'id' | 'createdAt' | 'read'>): string {
    // Create a key that uniquely identifies this notification type + user + context
    const parts: string[] = [
      notification.type,
      notification.source,
    ];

    // Add user-specific data if available
    if (notification.data?.userId) {
      parts.push(notification.data.userId);
    }
    if (notification.data?.userEmail) {
      parts.push(notification.data.userEmail);
    }

    // Add context-specific data based on notification type
    if (notification.type === 'user_activity' && notification.source === 'user-registration') {
      // For user registration, use userId as the key (should only notify once per user)
      return `user_registration_${notification.data?.userId || 'unknown'}`;
    }
    if (notification.type === 'engagement' && notification.source === 'ai-interaction-system') {
      // For AI interactions, use userId + pageUrl + interactionType as the key
      return `ai_interaction_${notification.data?.userId}_${notification.data?.pageUrl}_${notification.data?.interactionType}`;
    }
    if (notification.type === 'engagement' && notification.source === 'whiteboard-system') {
      // For whiteboard activity, use userId + boardId + activityType
      return `whiteboard_${notification.data?.userId}_${notification.data?.boardId}_${notification.data?.activityType}`;
    }

    // Default: combine all parts
    return parts.join('_');
  }

  /**
   * Check if this notification was recently sent (within dedup window)
   */
  private static isDuplicate(notification: Omit<AdminNotification, 'id' | 'createdAt' | 'read'>): boolean {
    const key = this.generateNotificationKey(notification);
    const now = Date.now();
    const lastSent = this.notificationCache.get(key);

    if (lastSent && (now - lastSent) < this.DEDUP_WINDOW_MS) {
      console.log('🚫 [DEDUP] Blocking duplicate notification:', {
        key,
        lastSent: new Date(lastSent).toISOString(),
        timeSinceLastMs: now - lastSent,
      });
      return true;
    }

    // Not a duplicate - mark as sent
    this.notificationCache.set(key, now);

    // Cleanup old entries to prevent memory leaks
    if (this.notificationCache.size > 1000) {
      const oldestAllowed = now - this.DEDUP_WINDOW_MS;
      for (const [k, timestamp] of this.notificationCache.entries()) {
        if (timestamp < oldestAllowed) {
          this.notificationCache.delete(k);
        }
      }
    }

    return false;
  }

  /**
   * Main notification method - call from anywhere in the codebase
   */
  static async notify(notification: Omit<AdminNotification, 'id' | 'createdAt' | 'read'>) {
    // CRITICAL: Check for duplicates before creating notification
    if (this.isDuplicate(notification)) {
      return null; // Silently skip duplicate
    }
    try {
      const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Create notification object and remove undefined fields for Firestore
      const notificationData: AdminNotification = {
        ...notification,
        id: notificationId,
        read: false,
        createdAt: Timestamp.now(),
      };

      // Remove undefined fields recursively to prevent Firestore errors
      const removeUndefined = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map(item => removeUndefined(item));
        }
        if (obj !== null && typeof obj === 'object') {
          return Object.keys(obj).reduce((acc, key) => {
            const value = obj[key];
            if (value !== undefined) {
              acc[key] = removeUndefined(value);
            }
            return acc;
          }, {} as any);
        }
        return obj;
      };

      const cleanedNotificationData = removeUndefined(notificationData) as AdminNotification;

      // Send email immediately (non-blocking) if enabled
      if (notification.deliveryMethod.includes('email')) {
        // Fire and forget - don't wait for email
        this.sendEmailNotification(notificationId, cleanedNotificationData).catch(err =>
          console.error('Error sending email notification:', err)
        );
      }

      // Save to admin notifications (non-blocking, async)
      // Use simple update with arrayUnion instead of transaction
      const adminNotificationsRef = doc(db, 'admin', 'notifications');

      // Fire and forget - don't block on Firestore write
      runTransaction(db, async (transaction) => {
        const adminNotificationsSnap = await transaction.get(adminNotificationsRef);

        let adminNotificationsDoc: AdminNotificationsDocument;

        if (adminNotificationsSnap.exists()) {
          adminNotificationsDoc = adminNotificationsSnap.data() as AdminNotificationsDocument;
        } else {
          // Initialize document if it doesn't exist
          adminNotificationsDoc = {
            lastUpdated: Timestamp.now(),
            totalNotifications: 0,
            notifications: [],
            summary: {
              unreadCount: 0,
              priorityCounts: { low: 0, medium: 0, high: 0, urgent: 0 },
              typeCounts: {
                user_activity: 0,
                feedback: 0,
                system_health: 0,
                content_milestone: 0,
                learning_activity: 0,
                engagement: 0,
                security: 0,
                error: 0
              },
              lastNotificationAt: Timestamp.now()
            }
          };
        }

        // Add new notification to the beginning of array
        adminNotificationsDoc.notifications.unshift(cleanedNotificationData);

        // Update summary stats
        adminNotificationsDoc.summary.unreadCount += 1;
        adminNotificationsDoc.summary.priorityCounts[cleanedNotificationData.priority] += 1;
        adminNotificationsDoc.summary.typeCounts[cleanedNotificationData.type] += 1;
        adminNotificationsDoc.summary.lastNotificationAt = cleanedNotificationData.createdAt;
        adminNotificationsDoc.totalNotifications += 1;
        adminNotificationsDoc.lastUpdated = Timestamp.now();

        // Cleanup old notifications if we exceed the limit
        if (adminNotificationsDoc.notifications.length > this.MAX_NOTIFICATIONS) {
          const removedNotifications = adminNotificationsDoc.notifications.splice(this.MAX_NOTIFICATIONS);

          // Update summary counts for removed notifications
          removedNotifications.forEach(removedNotif => {
            if (!removedNotif.read) {
              adminNotificationsDoc.summary.unreadCount -= 1;
            }
            adminNotificationsDoc.summary.priorityCounts[removedNotif.priority] -= 1;
            adminNotificationsDoc.summary.typeCounts[removedNotif.type] -= 1;
          });
        }

        // Ensure summary counts don't go negative
        adminNotificationsDoc.summary.unreadCount = Math.max(0, adminNotificationsDoc.summary.unreadCount);

        transaction.set(adminNotificationsRef, adminNotificationsDoc);
      }).catch(err => {
        console.error('Error saving admin notification to Firestore:', err);
      });

      console.log('✅ [NOTIFY] Notification created:', notificationId);
      return notificationId;

    } catch (error) {
      console.error('Error creating admin notification:', error);
      throw error;
    }
  }

  /**
   * Quick notification helpers for common scenarios
   */
  static async notifyNewUser(userData: {
    email?: string;
    displayName?: string;
    uid: string;
    deviceInfo?: {
      browser?: string;
      os?: string;
      device?: string;
      isMobile?: boolean;
      location?: any;
      ip?: string;
    };
  }) {
    const trigger = ADMIN_NOTIFICATION_TRIGGERS.USER_ACTIVITY.NEW_USER_REGISTRATION;

    return this.notify({
      type: trigger.type,
      priority: trigger.priority,
      title: 'New User Registration',
      message: `New user ${userData.displayName || userData.email || 'Anonymous'} has registered`,
      source: 'user-registration',
      tags: ['user', 'registration'],
      data: {
        userId: userData.uid,
        userEmail: userData.email,
        userName: userData.displayName,
        deviceInfo: userData.deviceInfo,
        ipAddress: userData.deviceInfo?.ip,
        location: userData.deviceInfo?.location,
      },
      actions: [
        {
          label: 'View User',
          url: `/admin/users/${userData.uid}`,
          type: 'view'
        }
      ],
      deliveryMethod: trigger.emailEnabled ? ['in_app', 'email'] : ['in_app']
    });
  }

  static async notifyNewFeedback(feedbackData: {
    id: string;
    feedback: string;
    category: string;
    userEmail?: string;
    urgent?: boolean;
    url?: string;
    pageTitle?: string;
  }) {
    const isUrgent = feedbackData.urgent ||
      ADMIN_NOTIFICATION_TRIGGERS.FEEDBACK.URGENT_FEEDBACK.keywords.some(keyword =>
        feedbackData.feedback.toLowerCase().includes(keyword)
      );

    const trigger = isUrgent
      ? ADMIN_NOTIFICATION_TRIGGERS.FEEDBACK.URGENT_FEEDBACK
      : ADMIN_NOTIFICATION_TRIGGERS.FEEDBACK.NEW_FEEDBACK;

    // Extract page info from URL if available
    const pageInfo = feedbackData.url ? this.extractPageInfo(feedbackData.url, feedbackData.pageTitle) : null;

    return this.notify({
      type: trigger.type,
      priority: trigger.priority,
      title: isUrgent ? 'Urgent Feedback Received' : 'New Feedback',
      message: pageInfo
        ? `${feedbackData.category} feedback on "${pageInfo.pageTitle}": ${feedbackData.feedback.substring(0, 100)}${feedbackData.feedback.length > 100 ? '...' : ''}`
        : `${feedbackData.category} feedback: ${feedbackData.feedback.substring(0, 100)}${feedbackData.feedback.length > 100 ? '...' : ''}`,
      source: 'feedback-system',
      tags: ['feedback', feedbackData.category.toLowerCase(), ...(isUrgent ? ['urgent'] : [])],
      actionRequired: isUrgent,
      data: {
        feedbackId: feedbackData.id,
        feedbackCategory: feedbackData.category,
        feedbackText: feedbackData.feedback, // Store full feedback text
        userEmail: feedbackData.userEmail,
        pageUrl: feedbackData.url,
        pageTitle: pageInfo?.pageTitle,
        pagePath: pageInfo?.pagePath,
      },
      actions: [
        {
          label: 'View Feedback',
          url: `/admin/feedback?id=${feedbackData.id}`,
          type: 'view'
        },
        {
          label: 'Resolve',
          url: `/admin/feedback?id=${feedbackData.id}&action=resolve`,
          type: 'resolve'
        }
      ],
      deliveryMethod: trigger.emailEnabled ? ['in_app', 'email'] : ['in_app']
    });
  }

  /**
   * Extract clean page information from URL
   */
  private static extractPageInfo(url: string, pageTitle?: string): { pageTitle: string; pagePath: string } {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;

      // Clean up the page title or generate from path
      let cleanTitle = pageTitle || 'Unknown Page';

      // Remove " - System Designer" suffix if present
      cleanTitle = cleanTitle.replace(/ - System Designer$/i, '').trim();

      return {
        pageTitle: cleanTitle,
        pagePath: path
      };
    } catch (error) {
      return {
        pageTitle: pageTitle || 'Unknown Page',
        pagePath: url
      };
    }
  }

  static async notifyContentMilestone(data: {
    lessonSlug: string;
    title: string;
    completions: number;
    milestone: number;
  }) {
    const trigger = ADMIN_NOTIFICATION_TRIGGERS.CONTENT.LESSON_COMPLETION_MILESTONE;

    return this.notify({
      type: trigger.type,
      priority: trigger.priority,
      title: 'Content Milestone Reached',
      message: `"${data.title}" has reached ${data.milestone} completions!`,
      source: 'content-analytics',
      tags: ['content', 'milestone', 'achievement'],
      data: {
        lessonSlug: data.lessonSlug,
        count: data.completions,
        milestone: data.milestone,
      },
      actions: [
        {
          label: 'View Analytics',
          url: `/admin/content?lesson=${data.lessonSlug}`,
          type: 'view'
        }
      ],
      deliveryMethod: trigger.emailEnabled ? ['in_app', 'email'] : ['in_app']
    });
  }

  static async notifySystemAlert(data: {
    type: 'error' | 'performance' | 'security';
    title: string;
    message: string;
    errorCode?: string;
    count?: number;
  }) {
    const isUrgent = data.type === 'error' || data.type === 'security';

    return this.notify({
      type: 'system_health',
      priority: isUrgent ? 'urgent' : 'high',
      title: data.title,
      message: data.message,
      source: 'system-monitoring',
      tags: ['system', data.type, 'alert'],
      actionRequired: isUrgent,
      data: {
        errorCode: data.errorCode,
        count: data.count,
        alertType: data.type,
      },
      deliveryMethod: ['in_app', 'email'] // Always send email for system alerts
    });
  }

  static async notifyAchievementUnlocked(data: {
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
    deviceInfo?: {
      browser?: string;
      os?: string;
      device?: string;
      isMobile?: boolean;
    };
  }) {
    const isLegendary = data.achievementRarity === 'legendary';
    const isRareOrAbove = ['rare', 'epic', 'legendary'].includes(data.achievementRarity);

    // Only send notifications for rare+ achievements
    if (!isRareOrAbove) {
      return;
    }

    const trigger = isLegendary
      ? ADMIN_NOTIFICATION_TRIGGERS.ACHIEVEMENTS.LEGENDARY_ACHIEVEMENT
      : ADMIN_NOTIFICATION_TRIGGERS.ACHIEVEMENTS.RARE_ACHIEVEMENT_UNLOCKED;

    const rarityEmojiMap = {
      rare: '🔷',
      epic: '💜',
      legendary: '👑',
      common: '🏆'
    } as const;

    const rarityEmoji = rarityEmojiMap[data.achievementRarity as keyof typeof rarityEmojiMap] || '🏆';

    return this.notify({
      type: trigger.type,
      priority: trigger.priority,
      title: isLegendary ? 'Legendary Achievement Unlocked!' : `${data.achievementRarity.charAt(0).toUpperCase() + data.achievementRarity.slice(1)} Achievement Unlocked`,
      message: `${data.userName || data.userEmail || 'User'} just unlocked ${rarityEmoji} "${data.achievementTitle}"${data.xpReward ? ` (+${data.xpReward} XP)` : ''}`,
      source: 'gamification-system',
      tags: ['achievement', data.achievementRarity, 'user-milestone'],
      actionRequired: isLegendary, // Flag legendary achievements for attention
      data: {
        userId: data.userId,
        userEmail: data.userEmail,
        userName: data.userName,
        achievementId: data.achievementId,
        achievementTitle: data.achievementTitle,
        achievementRarity: data.achievementRarity,
        achievementIcon: data.achievementIcon,
        achievementDescription: data.achievementDescription,
        xpReward: data.xpReward,
        totalUserAchievements: data.totalAchievements,
        deviceInfo: data.deviceInfo,
      },
      actions: [
        {
          label: 'View User Profile',
          url: `/admin/users/${data.userId}`,
          type: 'view'
        },
        {
          label: 'View All Achievements',
          url: `/admin/users/${data.userId}#achievements`,
          type: 'view'
        }
      ],
      deliveryMethod: trigger.emailEnabled ? ['in_app', 'email'] : ['in_app']
    });
  }

  static async notifyAchievementMilestone(data: {
    userId: string;
    userEmail?: string;
    userName?: string;
    totalAchievements: number;
    milestone: number;
    recentAchievements?: Array<{ title: string; rarity: string; icon: string }>;
  }) {
    const trigger = ADMIN_NOTIFICATION_TRIGGERS.ACHIEVEMENTS.ACHIEVEMENT_MILESTONE;

    return this.notify({
      type: trigger.type,
      priority: trigger.priority,
      title: 'Achievement Milestone Reached',
      message: `${data.userName || data.userEmail || 'User'} has unlocked ${data.totalAchievements} achievements! 🎯`,
      source: 'gamification-system',
      tags: ['achievement', 'milestone', 'user-engagement'],
      data: {
        userId: data.userId,
        userEmail: data.userEmail,
        userName: data.userName,
        totalAchievements: data.totalAchievements,
        milestone: data.milestone,
        recentAchievements: data.recentAchievements,
      },
      actions: [
        {
          label: 'View User Progress',
          url: `/admin/users/${data.userId}`,
          type: 'view'
        },
        {
          label: 'User Achievements',
          url: `/admin/users/${data.userId}#achievements`,
          type: 'view'
        }
      ],
      deliveryMethod: trigger.emailEnabled ? ['in_app', 'email'] : ['in_app']
    });
  }

  static async notifyLearningPlanCreated(data: {
    userId: string;
    userEmail?: string;
    userName?: string;
    planTitle: string;
    topicCount: number;
    estimatedWeeks: number;
  }) {
    const trigger = ADMIN_NOTIFICATION_TRIGGERS.LEARNING_PLAN.PLAN_CREATED;

    return this.notify({
      type: trigger.type,
      priority: trigger.priority,
      title: 'New Learning Plan Created',
      message: `${data.userName || data.userEmail || 'User'} created "${data.planTitle}" (${data.topicCount} topics, ~${data.estimatedWeeks} weeks)`,
      source: 'learning-plan-system',
      tags: ['learning-plan', 'user-engagement', 'commitment'],
      data: {
        userId: data.userId,
        userEmail: data.userEmail,
        userName: data.userName,
        planTitle: data.planTitle,
        topicCount: data.topicCount,
        estimatedWeeks: data.estimatedWeeks,
      },
      actions: [
        {
          label: 'View User',
          url: `/admin/users/${data.userId}`,
          type: 'view'
        }
      ],
      deliveryMethod: trigger.emailEnabled ? ['in_app', 'email'] : ['in_app']
    });
  }

  static async notifyAIInteraction(data: {
    userId: string;
    userEmail?: string;
    userName?: string;
    interactionType: 'explain' | 'chat';
    pageUrl: string;
    queryText?: string;
  }) {
    const trigger = data.interactionType === 'explain'
      ? ADMIN_NOTIFICATION_TRIGGERS.AI_INTERACTIONS.AI_EXPLAIN_USED
      : ADMIN_NOTIFICATION_TRIGGERS.AI_INTERACTIONS.AI_CHAT_SESSION;

    return this.notify({
      type: trigger.type,
      priority: trigger.priority,
      title: `AI ${data.interactionType === 'explain' ? 'Explain' : 'Chat'} Used`,
      message: `${data.userName || data.userEmail || 'User'} used AI ${data.interactionType} on ${data.pageUrl}`,
      source: 'ai-interaction-system',
      tags: ['ai', data.interactionType, 'feature-usage'],
      data: {
        userId: data.userId,
        userEmail: data.userEmail,
        userName: data.userName,
        interactionType: data.interactionType,
        pageUrl: data.pageUrl,
        queryText: data.queryText,
      },
      deliveryMethod: trigger.emailEnabled ? ['in_app', 'email'] : ['in_app']
    });
  }

  static async notifyContentEngagement(data: {
    userId: string;
    userEmail?: string;
    userName?: string;
    engagementType: 'highlight' | 'note';
    pageUrl: string;
    textSnippet?: string;
  }) {
    const trigger = data.engagementType === 'highlight'
      ? ADMIN_NOTIFICATION_TRIGGERS.CONTENT_ENGAGEMENT.TEXT_HIGHLIGHTED
      : ADMIN_NOTIFICATION_TRIGGERS.CONTENT_ENGAGEMENT.NOTE_CREATED;

    return this.notify({
      type: trigger.type,
      priority: trigger.priority,
      title: `User ${data.engagementType === 'highlight' ? 'Highlighted' : 'Created Note'}`,
      message: `${data.userName || data.userEmail || 'User'} ${data.engagementType === 'highlight' ? 'highlighted text' : 'created a note'} on ${data.pageUrl}`,
      source: 'content-engagement-system',
      tags: ['engagement', data.engagementType, 'content-interaction'],
      data: {
        userId: data.userId,
        userEmail: data.userEmail,
        userName: data.userName,
        engagementType: data.engagementType,
        pageUrl: data.pageUrl,
        textSnippet: data.textSnippet,
      },
      deliveryMethod: trigger.emailEnabled ? ['in_app', 'email'] : ['in_app']
    });
  }

  static async notifyWhiteboardActivity(data: {
    userId: string;
    userEmail?: string;
    userName?: string;
    activityType: 'created' | 'shared';
    boardId: string;
    boardTitle?: string;
    sharedWith?: string[];
  }) {
    const trigger = data.activityType === 'created'
      ? ADMIN_NOTIFICATION_TRIGGERS.WHITEBOARD.BOARD_CREATED
      : ADMIN_NOTIFICATION_TRIGGERS.WHITEBOARD.BOARD_SHARED;

    return this.notify({
      type: trigger.type,
      priority: trigger.priority,
      title: `Whiteboard ${data.activityType === 'created' ? 'Created' : 'Shared'}`,
      message: `${data.userName || data.userEmail || 'User'} ${data.activityType} whiteboard "${data.boardTitle || data.boardId}"${data.sharedWith ? ` with ${data.sharedWith.length} users` : ''}`,
      source: 'whiteboard-system',
      tags: ['whiteboard', data.activityType, 'collaboration'],
      data: {
        userId: data.userId,
        userEmail: data.userEmail,
        userName: data.userName,
        activityType: data.activityType,
        boardId: data.boardId,
        boardTitle: data.boardTitle,
        sharedWith: data.sharedWith,
      },
      actions: [
        {
          label: 'View Whiteboard',
          url: `/whiteboard/${data.boardId}`,
          type: 'view'
        }
      ],
      deliveryMethod: trigger.emailEnabled ? ['in_app', 'email'] : ['in_app']
    });
  }

  /**
   * Send email via Firestore Email Extension
   */
  private static async sendEmailNotification(notificationId: string, notification: AdminNotification) {
    try {
      // Get admin email preferences
      const adminEmails = await this.getAdminEmailAddresses();

      if (adminEmails.length === 0) {
        console.log('No admin emails configured for notifications');
        return;
      }

      // Create smart subject line based on notification type
      const subject = this.generateEmailSubject(notification);

      // Create email document for the extension
      const emailData = {
        to: adminEmails,
        message: {
          subject,
          html: this.generateEmailHTML(notification),
          text: this.generateEmailText(notification),
        },
        // Extension-specific fields
        template: {
          name: 'admin-notification',
          data: {
            title: notification.title,
            message: notification.message,
            priority: notification.priority,
            type: notification.type,
            timestamp: new Date().toLocaleString(),
            actions: notification.actions || [],
            data: notification.data || {},
            notificationId: notificationId,
          }
        }
      };

      // Add to the email collection (extension will process it)
      await addDoc(collection(db, 'mail'), emailData);

      console.log('Email notification queued via Firestore extension');

    } catch (error) {
      console.error('Error sending email notification:', error);
      // Don't throw - notification should still be created even if email fails
    }
  }

  /**
   * Get admin email addresses that receive activity notifications.
   * Configurable so a fork notifies ITS OWN admins instead of the maintainer's
   * Google Group: set ADMIN_NOTIFICATION_EMAILS (or reuse NEXT_PUBLIC_ADMIN_EMAILS),
   * comma-separated. If unset, no admin email notifications are sent.
   */
  private static async getAdminEmailAddresses(): Promise<string[]> {
    const configured =
      process.env.ADMIN_NOTIFICATION_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS;
    if (configured) {
      return configured.split(',').map((e) => e.trim()).filter(Boolean);
    }
    return [];
  }

  /**
   * Generate smart email subject line
   */
  private static generateEmailSubject(notification: AdminNotification): string {
    const urgencyPrefix = notification.priority === 'urgent' ? '🚨 URGENT: ' :
                         notification.priority === 'high' ? '⚠️ ' : '';

    switch (notification.type) {
      case 'user_activity':
        // Achievement notifications
        if (notification.data?.achievementId && notification.data?.achievementRarity) {
          const user = notification.data.userName || notification.data.userEmail || 'User';
          const rarityEmojiMap = {
            rare: '🔷',
            epic: '💜',
            legendary: '👑',
            common: '🏆'
          } as const;

          const rarityEmoji = rarityEmojiMap[notification.data.achievementRarity as keyof typeof rarityEmojiMap] || '🏆';

          if (notification.data.achievementRarity === 'legendary') {
            return `👑 LEGENDARY: ${user} unlocked "${notification.data.achievementTitle}"`;
          }
          return `${rarityEmoji} ${notification.data.achievementRarity} achievement: ${notification.data.achievementTitle}`;
        }

        // Achievement milestone notifications
        if (notification.data?.totalAchievements && notification.data?.milestone) {
          const user = notification.data.userName || notification.data.userEmail || 'User';
          return `🎯 Milestone: ${user} reached ${notification.data.totalAchievements} achievements`;
        }

        // User registration
        if (notification.data?.userEmail) {
          return `${urgencyPrefix}New user: ${notification.data.userEmail}`;
        }
        return `${urgencyPrefix}User activity: ${notification.title}`;

      case 'feedback':
        const category = notification.data?.category || 'General';
        const urgent = notification.data?.urgent || notification.priority === 'urgent';
        if (urgent) {
          return `${urgencyPrefix}URGENT ${category} feedback needs attention`;
        }
        return `📝 New ${category} feedback from user`;

      case 'system_health':
      case 'error':
        return `${urgencyPrefix}System alert: ${notification.data?.errorCode || 'Error detected'}`;

      case 'content_milestone':
        return `🎉 Milestone: ${notification.data?.count} users completed "${notification.data?.lessonSlug}"`;

      case 'learning_activity':
        return `📊 Learning alert: ${notification.title}`;

      case 'engagement':
        return `🔥 High engagement: ${notification.title}`;

      case 'security':
        return `🔒 Security alert: ${notification.title}`;

      default:
        return `[System Designer] ${notification.title}`;
    }
  }

  /**
   * Generate HTML email content with rich context
   */
  private static generateEmailHTML(notification: AdminNotification): string {
    const priorityColors = {
      low: '#10B981',      // green
      medium: '#F59E0B',   // amber
      high: '#EF4444',     // red
      urgent: '#DC2626'    // dark red
    };

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://systemdesigner.net';

    // Generate rich user context section
    const userContextHTML = this.generateUserContextHTML(notification);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>System Designer Admin Notification</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f9fafb; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
          .header { background: ${priorityColors[notification.priority]}; color: white; padding: 20px; }
          .content { padding: 20px; }
          .priority-badge { display: inline-block; background: ${priorityColors[notification.priority]}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
          .actions { margin-top: 20px; }
          .button { display: inline-block; background: #6366f1; color: white; padding: 10px 16px; text-decoration: none; border-radius: 6px; margin-right: 10px; margin-bottom: 10px; }
          .context-section { background: #f8fafc; border-radius: 6px; padding: 16px; margin: 16px 0; border-left: 4px solid #6366f1; }
          .user-info { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
          .user-avatar { width: 40px; height: 40px; border-radius: 50%; background: #e5e7eb; display: flex; align-items: center; justify-content: center; font-weight: bold; }
          .data-table { background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0; }
          .footer { padding: 20px; background: #f9fafb; text-align: center; font-size: 14px; color: #6b7280; }
          .urgency-banner { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 12px; margin: 16px 0; border-radius: 6px; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 20px;">${notification.title}</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9;">System Designer Admin Alert</p>
          </div>

          <div class="content">
            <div style="margin-bottom: 16px;">
              <span class="priority-badge">${notification.priority} priority</span>
              <span style="color: #6b7280; font-size: 14px; margin-left: 10px;">${notification.type.replace('_', ' ')}</span>
              <span style="color: #6b7280; font-size: 12px; margin-left: 10px;">${new Date().toLocaleString()}</span>
            </div>

            ${notification.priority === 'urgent' ? `
              <div class="urgency-banner">
                🚨 This is an urgent notification requiring immediate attention!
              </div>
            ` : ''}

            ${notification.type === 'feedback' && notification.data?.feedbackText ? `
              ${notification.data.pageTitle ? `
                <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin-bottom: 16px; border-radius: 4px;">
                  <div style="color: #1e40af; font-size: 11px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 4px;">📄 Page Context</div>
                  <div style="font-size: 15px; font-weight: 600; color: #1e3a8a; margin-bottom: 4px;">${notification.data.pageTitle}</div>
                  ${notification.data.pageUrl ? `
                    <a href="${notification.data.pageUrl}" style="color: #3b82f6; font-size: 13px; text-decoration: none;">
                      ${notification.data.pagePath || notification.data.pageUrl} →
                    </a>
                  ` : ''}
                </div>
              ` : ''}
              <div style="background: #f9fafb; border-left: 4px solid #6366f1; padding: 16px; margin-bottom: 20px; border-radius: 4px;">
                <div style="color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: 600; margin-bottom: 8px;">${notification.data.feedbackCategory || 'General'} Feedback</div>
                <p style="font-size: 16px; line-height: 1.6; color: #374151; margin: 0; white-space: pre-wrap;">${notification.data.feedbackText}</p>
              </div>
            ` : `
              <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 20px;">${notification.message}</p>
            `}

            ${userContextHTML}

            ${notification.data && Object.keys(notification.data).length > 0 ? `
              <div class="data-table">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #374151;">📊 Event Details:</h3>
                ${Object.entries(notification.data)
                  .filter(([key]) => !['feedbackText', 'pageTitle', 'pageUrl', 'pagePath'].includes(key)) // Don't show feedbackText or page info twice
                  .map(([key, value]) => `
                  <div style="margin: 8px 0; font-size: 14px; display: flex; justify-content: space-between;">
                    <span style="color: #6b7280; text-transform: capitalize;">${key.replace(/([A-Z])/g, ' $1').toLowerCase()}:</span>
                    <span style="color: #374151; font-weight: 500;">${value}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            ${notification.actions && notification.actions.length > 0 ? `
              <div class="actions">
                <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #374151;">🎯 Quick Actions:</h3>
                ${notification.actions.map(action => `
                  <a href="${baseUrl}${action.url}" class="button">${action.label}</a>
                `).join('')}
              </div>
            ` : ''}

            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
              <strong>Source:</strong> ${notification.source} •
              <strong>ID:</strong> ${notification.id} •
              <strong>Time:</strong> ${new Date().toLocaleString()}
            </div>
          </div>

          <div class="footer">
            <p>🤖 Automated System Designer monitoring alert</p>
            <p><a href="${baseUrl}/admin">Admin Dashboard</a> | <a href="${baseUrl}/adminNotifications">All Notifications</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate user context HTML section with device and location info
   */
  private static generateUserContextHTML(notification: AdminNotification): string {
    const data = notification.data;
    if (!data) return '';

    // Achievement notifications
    if (notification.type === 'user_activity' && data.achievementId) {
      const userEmail = data.userEmail || data.email;
      const userName = data.userName || data.displayName;
      const userId = data.userId;
      const initials = userName ? userName.split(' ').map((n: string) => n[0]).join('').toUpperCase() :
                      userEmail ? userEmail.substring(0, 2).toUpperCase() : '?';

      const rarityColors = {
        common: '#10B981',
        rare: '#3B82F6',
        epic: '#8B5CF6',
        legendary: '#F59E0B'
      };

      const rarityColor = rarityColors[data.achievementRarity as keyof typeof rarityColors] || '#6B7280';

      return `
        <div class="context-section">
          <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #374151;">🏆 Achievement Context:</h3>
          <div class="user-info" style="margin-bottom: 16px;">
            <div class="user-avatar">${initials}</div>
            <div>
              ${userName ? `<div style="font-weight: 600; color: #374151;">${userName}</div>` : ''}
              ${userEmail ? `<div style="color: #6b7280; font-size: 14px;">${userEmail}</div>` : ''}
              ${userId ? `<div style="color: #9ca3af; font-size: 12px;">ID: ${userId}</div>` : ''}
            </div>
          </div>
          <div style="background: ${rarityColor}15; border-left: 4px solid ${rarityColor}; padding: 12px; border-radius: 6px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <span style="font-size: 24px;">${data.achievementIcon}</span>
              <div>
                <div style="font-weight: 600; color: #374151;">${data.achievementTitle}</div>
                <div style="font-size: 12px; color: ${rarityColor}; font-weight: 600; text-transform: uppercase;">${data.achievementRarity}</div>
              </div>
            </div>
            <div style="color: #6b7280; font-size: 14px; margin-bottom: 8px;">${data.achievementDescription || 'Achievement unlocked!'}</div>
            ${data.xpReward ? `<div style="color: #059669; font-size: 12px; font-weight: 600;">+${data.xpReward} XP Reward</div>` : ''}
            ${data.totalUserAchievements ? `<div style="color: #6b7280; font-size: 12px;">Total achievements: ${data.totalUserAchievements}</div>` : ''}
          </div>
          ${this.generateDeviceLocationHTML(data)}
        </div>
      `;
    }

    // User-related notifications (non-achievement)
    if (notification.type === 'user_activity' || notification.type === 'feedback') {
      const userEmail = data.userEmail || data.email;
      const userName = data.userName || data.displayName;
      const userId = data.userId;

      // Skip if this is an achievement notification (already handled above)
      if (data.achievementId) {
        return '';
      }

      if (userEmail || userName || userId) {
        const initials = userName ? userName.split(' ').map((n: string) => n[0]).join('').toUpperCase() :
                        userEmail ? userEmail.substring(0, 2).toUpperCase() : '?';

        return `
          <div class="context-section">
            <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #374151;">👤 User Context:</h3>
            <div class="user-info">
              <div class="user-avatar">${initials}</div>
              <div>
                ${userName ? `<div style="font-weight: 600; color: #374151;">${userName}</div>` : ''}
                ${userEmail ? `<div style="color: #6b7280; font-size: 14px;">${userEmail}</div>` : ''}
                ${userId ? `<div style="color: #9ca3af; font-size: 12px;">ID: ${userId}</div>` : ''}
              </div>
            </div>
            ${this.generateDeviceLocationHTML(data)}
          </div>
        `;
      }
    }

    // Content-related notifications
    if (notification.type === 'content_milestone' || notification.type === 'learning_activity') {
      const lessonSlug = data.lessonSlug || data.topicId;
      const count = data.count || data.completions;

      if (lessonSlug) {
        return `
          <div class="context-section">
            <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #374151;">📚 Content Context:</h3>
            <div style="color: #374151; font-weight: 500;">Lesson: ${lessonSlug}</div>
            ${count ? `<div style="color: #6b7280; font-size: 14px;">Total completions: ${count}</div>` : ''}
            <div style="margin-top: 8px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://systemdesigner.net'}/${lessonSlug}" style="color: #6366f1; font-size: 14px;">View lesson →</a>
            </div>
          </div>
        `;
      }
    }

    // System error context
    if (notification.type === 'system_health' || notification.type === 'error') {
      return `
        <div class="context-section">
          <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #374151;">⚙️ System Context:</h3>
          ${data.errorCode ? `<div style="color: #ef4444; font-weight: 600;">Error Code: ${data.errorCode}</div>` : ''}
          ${data.count ? `<div style="color: #6b7280;">Occurrence count: ${data.count}</div>` : ''}
          <div style="color: #6b7280; font-size: 12px; margin-top: 4px;">Check Firebase Console for detailed logs</div>
        </div>
      `;
    }

    return '';
  }

  /**
   * Generate device and location HTML section
   */
  private static generateDeviceLocationHTML(data: any): string {
    if (!data.deviceInfo && !data.ipAddress && !data.location) {
      return '';
    }

    const deviceInfo = data.deviceInfo || {};
    const location = data.location || deviceInfo.location || {};
    const ipAddress = data.ipAddress || deviceInfo.ip;

    let html = `
      <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Device & Location</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px;">
    `;

    // Location info
    if (location.city || location.country || location.timezone) {
      html += `
        <div>
          <div style="color: #9ca3af; font-size: 11px;">📍 Location</div>
          ${location.city && location.country ? `<div style="color: #374151;">${location.city}, ${location.country}</div>` : ''}
          ${!location.city && location.country ? `<div style="color: #374151;">${location.country}</div>` : ''}
          ${location.timezone ? `<div style="color: #6b7280; font-size: 11px;">${location.timezone}</div>` : ''}
        </div>
      `;
    }

    // IP Address
    if (ipAddress) {
      html += `
        <div>
          <div style="color: #9ca3af; font-size: 11px;">🌐 IP Address</div>
          <div style="color: #374151; font-family: monospace; font-size: 12px;">${ipAddress}</div>
        </div>
      `;
    }

    // Device info
    if (deviceInfo.browser || deviceInfo.os) {
      html += `
        <div>
          <div style="color: #9ca3af; font-size: 11px;">💻 Device</div>
          ${deviceInfo.browser ? `<div style="color: #374151;">${deviceInfo.browser}</div>` : ''}
          ${deviceInfo.os ? `<div style="color: #6b7280; font-size: 11px;">${deviceInfo.os}</div>` : ''}
        </div>
      `;
    }

    // Device type
    if (deviceInfo.isMobile !== undefined || deviceInfo.device) {
      const deviceType = deviceInfo.isMobile ? '📱 Mobile' : '🖥️ Desktop';
      const deviceName = deviceInfo.device || deviceType;
      html += `
        <div>
          <div style="color: #9ca3af; font-size: 11px;">📱 Type</div>
          <div style="color: #374151;">${deviceName}</div>
        </div>
      `;
    }

    html += `
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Generate plain text email content
   */
  private static generateEmailText(notification: AdminNotification): string {
    let text = `SYSTEM DESIGNER ADMIN NOTIFICATION\n\n`;
    text += `${notification.title}\n`;
    text += `Priority: ${notification.priority.toUpperCase()}\n`;
    text += `Type: ${notification.type.replace('_', ' ')}\n\n`;
    text += `${notification.message}\n\n`;

    if (notification.data && Object.keys(notification.data).length > 0) {
      text += `Additional Information:\n`;
      Object.entries(notification.data).forEach(([key, value]) => {
        text += `- ${key}: ${value}\n`;
      });
      text += `\n`;
    }

    if (notification.actions && notification.actions.length > 0) {
      text += `Quick Actions:\n`;
      notification.actions.forEach(action => {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://systemdesigner.net';
        text += `- ${action.label}: ${baseUrl}${action.url}\n`;
      });
      text += `\n`;
    }

    text += `--\n`;
    text += `This notification was generated by System Designer admin monitoring.\n`;
    text += `Visit the admin dashboard: ${process.env.NEXT_PUBLIC_APP_URL || 'https://systemdesigner.net'}/admin\n`;

    return text;
  }

  /**
   * Get recent notifications for admin dashboard
   */
  static async getRecentNotifications(limit_count = 100): Promise<AdminNotification[]> {
    try {
      const adminNotificationsRef = doc(db, 'admin', 'notifications');
      const adminNotificationsSnap = await getDoc(adminNotificationsRef);

      if (!adminNotificationsSnap.exists()) {
        return [];
      }

      const adminNotificationsDoc = adminNotificationsSnap.data() as AdminNotificationsDocument;

      // Return the most recent notifications up to the limit
      return adminNotificationsDoc.notifications
        .slice(0, limit_count)
        .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());

    } catch (error) {
      console.error('Error getting recent notifications:', error);
      return [];
    }
  }

  /**
   * Get notification summary stats
   */
  static async getNotificationSummary(): Promise<{
    unreadCount: number;
    priorityCounts: Record<NotificationPriority, number>;
    typeCounts: Record<NotificationType, number>;
    lastNotificationAt: Timestamp | null;
  }> {
    try {
      const adminNotificationsRef = doc(db, 'admin', 'notifications');
      const adminNotificationsSnap = await getDoc(adminNotificationsRef);

      if (!adminNotificationsSnap.exists()) {
        return {
          unreadCount: 0,
          priorityCounts: { low: 0, medium: 0, high: 0, urgent: 0 },
          typeCounts: {
            user_activity: 0,
            feedback: 0,
            system_health: 0,
            content_milestone: 0,
            learning_activity: 0,
            engagement: 0,
            security: 0,
            error: 0
          },
          lastNotificationAt: null
        };
      }

      const adminNotificationsDoc = adminNotificationsSnap.data() as AdminNotificationsDocument;
      return {
        unreadCount: adminNotificationsDoc.summary.unreadCount,
        priorityCounts: adminNotificationsDoc.summary.priorityCounts,
        typeCounts: adminNotificationsDoc.summary.typeCounts,
        lastNotificationAt: adminNotificationsDoc.summary.lastNotificationAt
      };

    } catch (error) {
      console.error('Error getting notification summary:', error);
      return {
        unreadCount: 0,
        priorityCounts: { low: 0, medium: 0, high: 0, urgent: 0 },
        typeCounts: {
          user_activity: 0,
          feedback: 0,
          system_health: 0,
          content_milestone: 0,
          learning_activity: 0,
          engagement: 0,
          security: 0,
          error: 0
        },
        lastNotificationAt: null
      };
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string, adminUserId: string): Promise<void> {
    try {
      const notificationRef = doc(db, 'admin', 'notifications');
      const notificationSnap = await getDoc(notificationRef);

      if (!notificationSnap.exists()) {
        throw new Error(`Notification with ID ${notificationId} not found`);
      }

      const notification = notificationSnap.data() as AdminNotification;

      // Only update if it's currently unread
      if (!notification.read) {
        await setDoc(notificationRef, {
          ...notification,
          read: true,
          readAt: Timestamp.now(),
          readBy: adminUserId
        });
      }

    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark multiple notifications as read
   */
  static async markMultipleAsRead(notificationIds: string[], adminUserId: string): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        const adminNotificationsRef = doc(db, 'admin', 'notifications');
        const adminNotificationsSnap = await transaction.get(adminNotificationsRef);

        if (!adminNotificationsSnap.exists()) {
          throw new Error('Admin notifications document not found');
        }

        const adminNotificationsDoc = adminNotificationsSnap.data() as AdminNotificationsDocument;
        let updatedCount = 0;

        // Update all matching notifications
        notificationIds.forEach(notificationId => {
          const notificationIndex = adminNotificationsDoc.notifications.findIndex(n => n.id === notificationId);

          if (notificationIndex !== -1) {
            const notification = adminNotificationsDoc.notifications[notificationIndex];

            if (!notification.read) {
              notification.read = true;
              notification.readAt = Timestamp.now();
              notification.readBy = adminUserId;
              updatedCount++;
            }
          }
        });

        if (updatedCount > 0) {
          // Update summary counts
          adminNotificationsDoc.summary.unreadCount = Math.max(0, adminNotificationsDoc.summary.unreadCount - updatedCount);
          adminNotificationsDoc.lastUpdated = Timestamp.now();

          transaction.set(adminNotificationsRef, adminNotificationsDoc);
        }
      });

    } catch (error) {
      console.error('Error marking multiple notifications as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(adminUserId: string): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        const adminNotificationsRef = doc(db, 'admin', 'notifications');
        const adminNotificationsSnap = await transaction.get(adminNotificationsRef);

        if (!adminNotificationsSnap.exists()) {
          return;
        }

        const adminNotificationsDoc = adminNotificationsSnap.data() as AdminNotificationsDocument;
        let updatedCount = 0;

        // Mark all unread notifications as read
        adminNotificationsDoc.notifications.forEach(notification => {
          if (!notification.read) {
            notification.read = true;
            notification.readAt = Timestamp.now();
            notification.readBy = adminUserId;
            updatedCount++;
          }
        });

        if (updatedCount > 0) {
          // Reset unread count
          adminNotificationsDoc.summary.unreadCount = 0;
          adminNotificationsDoc.lastUpdated = Timestamp.now();

          transaction.set(adminNotificationsRef, adminNotificationsDoc);
        }
      });

    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Delete a single notification
   */
  static async deleteNotification(notificationId: string): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        const adminNotificationsRef = doc(db, 'admin', 'notifications');
        const adminNotificationsSnap = await transaction.get(adminNotificationsRef);

        if (!adminNotificationsSnap.exists()) {
          throw new Error('Admin notifications document not found');
        }

        const adminNotificationsDoc = adminNotificationsSnap.data() as AdminNotificationsDocument;

        // Find and remove the notification
        const notificationIndex = adminNotificationsDoc.notifications.findIndex(n => n.id === notificationId);

        if (notificationIndex === -1) {
          throw new Error(`Notification with ID ${notificationId} not found`);
        }

        const notification = adminNotificationsDoc.notifications[notificationIndex];

        // Remove from array
        adminNotificationsDoc.notifications.splice(notificationIndex, 1);

        // Update summary counts
        if (!notification.read) {
          adminNotificationsDoc.summary.unreadCount = Math.max(0, adminNotificationsDoc.summary.unreadCount - 1);
        }
        adminNotificationsDoc.summary.priorityCounts[notification.priority] = Math.max(0, adminNotificationsDoc.summary.priorityCounts[notification.priority] - 1);
        adminNotificationsDoc.summary.typeCounts[notification.type] = Math.max(0, adminNotificationsDoc.summary.typeCounts[notification.type] - 1);
        adminNotificationsDoc.totalNotifications = Math.max(0, adminNotificationsDoc.totalNotifications - 1);
        adminNotificationsDoc.lastUpdated = Timestamp.now();

        transaction.set(adminNotificationsRef, adminNotificationsDoc);
      });

      console.log('Notification deleted:', notificationId);
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  /**
   * Delete all notifications
   */
  static async deleteAllNotifications(): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        const adminNotificationsRef = doc(db, 'admin', 'notifications');
        const adminNotificationsSnap = await transaction.get(adminNotificationsRef);

        if (!adminNotificationsSnap.exists()) {
          return;
        }

        const adminNotificationsDoc = adminNotificationsSnap.data() as AdminNotificationsDocument;
        const deletedCount = adminNotificationsDoc.notifications.length;

        // Clear all notifications and reset summary
        adminNotificationsDoc.notifications = [];
        adminNotificationsDoc.summary = {
          unreadCount: 0,
          priorityCounts: { low: 0, medium: 0, high: 0, urgent: 0 },
          typeCounts: {
            user_activity: 0,
            feedback: 0,
            system_health: 0,
            content_milestone: 0,
            learning_activity: 0,
            engagement: 0,
            security: 0,
            error: 0
          },
          lastNotificationAt: adminNotificationsDoc.summary.lastNotificationAt
        };
        adminNotificationsDoc.totalNotifications = 0;
        adminNotificationsDoc.lastUpdated = Timestamp.now();

        transaction.set(adminNotificationsRef, adminNotificationsDoc);

        console.log(`Deleted ${deletedCount} notifications`);
      });

    } catch (error) {
      console.error('Error deleting all notifications:', error);
      throw error;
    }
  }

  /**
   * Delete notifications older than specified days
   */
  static async deleteOldNotifications(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      let deletedCount = 0;

      await runTransaction(db, async (transaction) => {
        const adminNotificationsRef = doc(db, 'admin', 'notifications');
        const adminNotificationsSnap = await transaction.get(adminNotificationsRef);

        if (!adminNotificationsSnap.exists()) {
          return;
        }

        const adminNotificationsDoc = adminNotificationsSnap.data() as AdminNotificationsDocument;

        // Filter out old notifications
        const cutoffTimestamp = Timestamp.fromDate(cutoffDate);
        const originalCount = adminNotificationsDoc.notifications.length;


        adminNotificationsDoc.notifications = adminNotificationsDoc.notifications.filter(n =>
          n.createdAt.toMillis() >= cutoffTimestamp.toMillis()
        );

        deletedCount = originalCount - adminNotificationsDoc.notifications.length;

        if (deletedCount > 0) {
          // Recalculate summary counts
          adminNotificationsDoc.summary = {
            unreadCount: adminNotificationsDoc.notifications.filter(n => !n.read).length,
            priorityCounts: { low: 0, medium: 0, high: 0, urgent: 0 },
            typeCounts: {
              user_activity: 0,
              feedback: 0,
              system_health: 0,
              content_milestone: 0,
              learning_activity: 0,
              engagement: 0,
              security: 0,
              error: 0
            },
            lastNotificationAt: adminNotificationsDoc.summary.lastNotificationAt
          };

          // Recalculate counts
          adminNotificationsDoc.notifications.forEach(notification => {
            adminNotificationsDoc.summary.priorityCounts[notification.priority]++;
            adminNotificationsDoc.summary.typeCounts[notification.type]++;
          });

          adminNotificationsDoc.totalNotifications = adminNotificationsDoc.notifications.length;
          adminNotificationsDoc.lastUpdated = Timestamp.now();

          transaction.set(adminNotificationsRef, adminNotificationsDoc);
        }
      });

      if (deletedCount > 0) {
        console.log(`Deleted ${deletedCount} notifications older than ${olderThanDays} days`);
      }
      return deletedCount;

    } catch (error) {
      console.error('Error deleting old notifications:', error);
      throw error;
    }
  }
}
