/**
 * FIREBASE DATA MODEL - CLEAN CONSOLIDATED STRUCTURE
 *
 * 6 core collections instead of 14+
 * Everything keyed by userId for clean data ownership
 * No redundancy, single source of truth
 *
 * Collections:
 * 1. users - Profile, stats, preferences
 * 2. progress - Learning activity tracking
 * 3. learningPlans - Custom learning paths with progress
 * 4. annotations - Highlights and notes
 * 5. feedback - User feedback for admin
 * 6. diagrams - User-created diagrams (large data)
 */

import { Timestamp } from 'firebase/firestore';

// =====================================
// USER PROFILE & STATS
// =====================================

export interface UnlockedAchievement {
  achievementId: string;
  unlockedAt: Date;
  isNew: boolean;
}

// Device/Session tracking information
export interface DeviceInfo {
  userAgent: string;
  browser?: string;
  os?: string;
  device?: string;
  isMobile: boolean;
  ipAddress?: string; // Note: IP address capture requires backend/server-side implementation
  location?: {
    city?: string;
    region?: string;
    country?: string;
    timezone?: string;
  };
  firstSeen: Timestamp;
  lastSeen: Timestamp;
  loginCount: number;
}

export interface UserDocument {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  isAdmin: boolean;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;

  // Device and session tracking
  devices?: DeviceInfo[]; // Track multiple devices used by the user
  lastDevice?: {
    userAgent: string;
    browser?: string;
    os?: string;
    device?: string;
    isMobile: boolean;
  };

  // Embedded gamification stats (was gameStats collection)
  stats: {
    // Experience & Level
    totalXP: number;
    level: number;
    xpToNextLevel: number;

    // Streaks
    currentStreak: number;
    longestStreak: number;
    lastActivityDate: Date;
    streakFrozen: boolean;

    // Learning Stats
    totalLessonsCompleted: number;
    totalQuizzesTaken: number;
    averageQuizScore: number;
    totalTimeSpentMinutes: number;

    // Achievements
    unlockedAchievements: UnlockedAchievement[];
    achievementProgress: Record<string, number>;
    milestonesReached: string[];

    // Engagement
    dailyGoalStreak: number;
    weeklyLessonsCompleted: number;
    monthlyLessonsCompleted: number;
  };

  preferences: {
    theme?: 'light' | 'dark' | 'system';
    emailNotifications: boolean;
    language: string;
  };
}

// =====================================
// LEARNING PROGRESS
// =====================================

export type LearningCategory =
  | 'fundamentals'
  | 'genai'
  | 'ml-systems'
  | 'technology'
  | 'case-studies'
  | 'practice'
  | 'reference'
  | 'tools';

export interface UserProgress {
  userId: string;  // Document ID = userId

  // Lesson completions
  lessons: Array<{
    slug: string;
    category: LearningCategory;
    completedAt: Timestamp;
    timeSpent?: number;
  }>;

  // Quiz attempts
  quizzes: Array<{
    topicId: string;
    category: LearningCategory;
    bestScore: number;
    attempts: number;
    lastAttempt: Timestamp;
    timeSpent: number;
  }>;

  // Interactive scenarios
  scenarios?: Array<{
    scenarioId: string;
    completedSteps: number[];
    lastUpdated: Timestamp;
  }>;

  // Reference challenges
  challenges?: Array<{
    challengeId: string;
    completed: boolean;
    attempts: number;
    bestEstimate?: number;
    lastAttempt: Timestamp;
  }>;

  updatedAt: Timestamp;
}

// Individual progress document type (for firebase.ts functions)
export interface FirebaseLearningProgress {
  id: string; // Document ID
  userId: string;
  lessonSlug: string;
  category: LearningCategory;
  type?: 'lesson' | 'quiz'; // Type to distinguish between lesson and quiz progress
  completedAt: Timestamp;
  lastAccessed: Timestamp;
  timeSpent: number;

  // Quiz-specific fields (only present when type === 'quiz')
  score?: number;
  totalQuestions?: number;
  percentage?: number;
  answers?: any[];
  attempt?: number;
}

// =====================================
// LEARNING PLANS
// =====================================

export interface LearningPlan {
  id?: string;
  userId: string;

  // Plan details
  title: string;
  slug: string;
  description: string;
  userGoal: string;
  skillLevel: 'beginner' | 'intermediate' | 'advanced';

  // Topics with embedded progress
  topics: Array<{
    contentId: string;
    title: string;
    category: LearningCategory;
    completed: boolean;
    completedAt?: Timestamp;
    order: number;
  }>;

  // Cached aggregate progress
  progress: {
    completedCount: number;
    totalCount: number;
    percentage: number;
    lastCompletedAt?: Timestamp;
    estimatedTimeRemaining?: number; // in minutes
  };

  status: 'active' | 'completed' | 'paused' | 'archived';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// =====================================
// USER ANNOTATIONS
// =====================================

export interface UserAnnotations {
  userId: string;  // Document ID = userId

  // Text highlights
  highlights: Array<{
    id: string;
    text: string;
    context: string;
    pageUrl: string;
    pageTitle: string;
    category?: LearningCategory;
    color?: string; // highlight color
    timestamp: Timestamp;
  }>;

  // Personal notes
  notes: Array<{
    id: string;
    text: string;
    note: string;
    pageUrl: string;
    pageTitle: string;
    category?: LearningCategory;
    tags?: string[];
    timestamp: Timestamp;
  }>;

  // Summary stats
  stats: {
    totalHighlights: number;
    totalNotes: number;
    lastActivityAt: Timestamp;
  };

  updatedAt: Timestamp;
}

// =====================================
// FEEDBACK
// =====================================

export interface Feedback {
  id?: string;
  userId: string | null;  // null for anonymous

  // User info snapshot
  userEmail?: string | null;
  userName?: string | null;
  userPhotoURL?: string | null;
  isAnonymous: boolean;

  // Feedback content
  feedback: string;
  category: 'general' | 'bug' | 'feature' | 'content' | 'ui';

  // Context
  url: string;
  userAgent: string;

  // Admin fields
  resolved: boolean;
  adminNotes?: string;
  priority?: 'low' | 'medium' | 'high';
  assignedTo?: string;

  // Rich context
  metadata?: {
    selectionType?: 'feedback' | 'highlight' | 'note';
    selectedText?: string;
    textContext?: string;
    pageTitle?: string;
  };

  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// =====================================
// DIAGRAMS (Keep separate - large data)
// =====================================

export interface Diagram {
  id?: string;
  userId: string;

  title: string;
  description?: string;
  canvas: any; // tldraw document state - can be large

  visibility: 'private' | 'public';
  tags?: string[];

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// =====================================
// ADMIN VIEW TYPES
// =====================================

export interface UserDetailView {
  profile: UserDocument;
  progress: UserProgress | null;
  learningPlans: LearningPlan[];
  annotations: UserAnnotations | null;
  feedbackHistory: Feedback[];
  diagrams?: Diagram[];
}

export interface AdminDashboardStats {
  users: {
    total: number;
    active: number;
    new: number;
    authenticated: number;
    anonymous: number;
  };

  devices: {
    totalDevices: number;
    uniqueDevices: number;
    avgDevicesPerUser: number;
    mobileUsers: number;
    desktopUsers: number;
  };

  learning: {
    totalLessonsCompleted: number;
    avgCompletionRate: number;
    totalQuizAttempts: number;
    avgQuizScore: number;
  };

  engagement: {
    totalHighlights: number;
    totalNotes: number;
    activeLearningPlans: number;
    totalFeedback: number;
    unresolvedFeedback: number;
  };

  content: {
    popularLessons: Array<{ slug: string; completions: number }>;
    difficultQuizzes: Array<{ topicId: string; avgScore: number }>;
    completionByCategory: Record<LearningCategory, number>;
  };
}

// =====================================
// ADMIN NOTIFICATIONS
// =====================================

export type NotificationType =
  | 'user_activity'     // New user registration, high activity
  | 'feedback'          // New feedback, urgent feedback
  | 'system_health'     // System errors, performance issues
  | 'content_milestone' // Content milestones reached
  | 'learning_activity' // Learning patterns, achievements
  | 'engagement'        // High engagement events
  | 'security'          // Security-related events
  | 'error'             // System errors requiring attention

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface AdminNotification {
  id: string; // Unique notification ID

  // Core notification details
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;

  // Data and context
  data?: {
    userId?: string;
    feedbackId?: string;
    lessonSlug?: string;
    category?: LearningCategory;
    count?: number;
    percentage?: number;
    [key: string]: any;
  };

  // Metadata
  source: string; // Source component/function that generated notification
  tags?: string[]; // For filtering and categorization
  actionRequired?: boolean; // Indicates if admin action is needed

  // Action links
  actions?: Array<{
    label: string;
    url: string;
    type: 'view' | 'edit' | 'resolve' | 'external';
  }>;

  // Status tracking
  read: boolean;
  readAt?: Timestamp;
  readBy?: string; // Admin user ID who read it

  // Delivery tracking
  deliveryMethod: Array<'in_app' | 'email' | 'push'>; // How it was/should be delivered
  emailSent?: boolean;
  emailSentAt?: Timestamp;

  // Timing
  createdAt: Timestamp;
  expiresAt?: Timestamp; // For time-sensitive notifications

  // Grouping (for digest/batching)
  groupKey?: string; // For grouping similar notifications
  batchId?: string; // For batch processing
}

// Single document structure for all admin notifications
export interface AdminNotificationsDocument {
  // Document metadata
  lastUpdated: Timestamp;
  totalNotifications: number;

  // All notifications stored in a single array (max 500)
  notifications: AdminNotification[];

  // Summary stats for quick access
  summary: {
    unreadCount: number;
    priorityCounts: Record<NotificationPriority, number>;
    typeCounts: Record<NotificationType, number>;
    lastNotificationAt: Timestamp;
  };
}

export interface AdminNotificationPreferences {
  adminUserId: string; // Document ID = admin user ID

  // Global settings
  enabled: boolean;
  emailDigest: {
    enabled: boolean;
    frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
    time?: string; // For daily/weekly digests (HH:MM format)
    lastSent?: Timestamp;
  };

  // Notification type preferences
  preferences: Record<NotificationType, {
    enabled: boolean;
    inApp: boolean;
    email: boolean;
    priority: NotificationPriority; // Minimum priority to receive
    quietHours?: {
      enabled: boolean;
      start: string; // HH:MM format
      end: string;   // HH:MM format
      timezone: string;
    };
  }>;

  // Filtering
  filters: {
    keywords?: string[]; // Keyword filters
    excludeUsers?: string[]; // Exclude notifications from specific users
    minimumImpact?: number; // Minimum impact threshold (for metrics-based notifications)
  };

  updatedAt: Timestamp;
}

export interface NotificationTemplate {
  id: string;
  type: NotificationType;
  title: string; // Template with placeholders: "New user {{userName}} registered"
  message: string; // Template with placeholders
  priority: NotificationPriority;
  actionRequired: boolean;

  // Template variables expected
  variables: string[]; // ['userName', 'userEmail', 'registrationTime']

  // Conditions for triggering
  conditions?: {
    threshold?: number; // Numeric threshold
    comparison?: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
    timeWindow?: number; // Time window in minutes
    frequency?: 'once' | 'daily' | 'weekly'; // How often to trigger
  };

  enabled: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

