/**
 * FIRESTORE MIDDLEWARE LAYER
 *
 * Centralized interface for all Firestore operations with:
 * - Type safety validation
 * - Operation logging
 * - Data transformation
 * - Error handling
 * - Performance monitoring
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  DocumentReference
} from 'firebase/firestore';
import { db } from './firebase';

// Import clean consolidated types
import type {
  UserDocument,
  UserProgress,
  LearningPlan,
  UserAnnotations,
  Feedback,
  Diagram,
  UserDetailView,
  AdminDashboardStats
} from './firebase-types';

// =====================================
// COLLECTION REGISTRY
// =====================================

export const COLLECTION_REGISTRY = {
  // Clean consolidated collections (6 total)
  users: 'users',              // Profile + stats + preferences
  progress: 'progress',        // Learning activity tracking
  learningPlans: 'learningPlans', // Custom learning paths
  annotations: 'annotations',  // Highlights + notes
  feedback: 'feedback',        // User feedback
  diagrams: 'diagrams',       // User-created diagrams
} as const;

export type CollectionName = keyof typeof COLLECTION_REGISTRY;

// =====================================
// TYPE MAPPING
// =====================================

type CollectionTypeMap = {
  users: UserDocument;
  progress: UserProgress;
  learningPlans: LearningPlan;
  annotations: UserAnnotations;
  feedback: Feedback;
  diagrams: Diagram;
};

// =====================================
// MIDDLEWARE OPERATIONS
// =====================================

interface OperationContext {
  operation: string;
  collection: string;
  documentId?: string;
  timestamp: Date;
  userId?: string;
}

class FirestoreMiddleware {
  private static logOperation(context: OperationContext, data?: any) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔥 Firestore ${context.operation}:`, {
        collection: context.collection,
        documentId: context.documentId,
        timestamp: context.timestamp,
        userId: context.userId,
        dataKeys: data ? Object.keys(data) : undefined
      });
    }
  }

  private static validateCollection(collectionName: string): void {
    if (!Object.values(COLLECTION_REGISTRY).includes(collectionName as any)) {
      throw new Error(`Invalid collection: ${collectionName}. Use COLLECTION_REGISTRY.`);
    }
  }

  private static addTimestamps<T extends Record<string, any>>(data: T): T & { updatedAt: Timestamp } {
    return {
      ...data,
      updatedAt: Timestamp.now()
    };
  }

  // =====================================
  // READ OPERATIONS
  // =====================================

  static async getDocument<T extends CollectionName>(
    collectionName: T,
    documentId: string
  ): Promise<CollectionTypeMap[T] | null> {
    this.validateCollection(COLLECTION_REGISTRY[collectionName]);

    const context: OperationContext = {
      operation: 'GET_DOCUMENT',
      collection: COLLECTION_REGISTRY[collectionName],
      documentId,
      timestamp: new Date()
    };

    try {
      const docRef = doc(db, COLLECTION_REGISTRY[collectionName], documentId);
      const docSnap = await getDoc(docRef);

      this.logOperation(context);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as CollectionTypeMap[T];
      }
      return null;
    } catch (error) {
      console.error(`Failed to get document from ${COLLECTION_REGISTRY[collectionName]}:`, error);
      throw error;
    }
  }

  static async getCollection<T extends CollectionName>(
    collectionName: T,
    queryOptions?: {
      where?: { field: string; operator: any; value: any }[];
      orderBy?: { field: string; direction: 'asc' | 'desc' }[];
      limit?: number;
    }
  ): Promise<CollectionTypeMap[T][]> {
    this.validateCollection(COLLECTION_REGISTRY[collectionName]);

    const context: OperationContext = {
      operation: 'GET_COLLECTION',
      collection: COLLECTION_REGISTRY[collectionName],
      timestamp: new Date()
    };

    try {
      let q = query(collection(db, COLLECTION_REGISTRY[collectionName]));

      if (queryOptions?.where) {
        for (const condition of queryOptions.where) {
          q = query(q, where(condition.field, condition.operator, condition.value));
        }
      }

      if (queryOptions?.orderBy) {
        for (const order of queryOptions.orderBy) {
          q = query(q, orderBy(order.field, order.direction));
        }
      }

      if (queryOptions?.limit) {
        q = query(q, limit(queryOptions.limit));
      }

      const querySnapshot = await getDocs(q);

      this.logOperation(context, { queryOptions });

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CollectionTypeMap[T][];
    } catch (error) {
      console.error(`Failed to get collection ${COLLECTION_REGISTRY[collectionName]}:`, error);
      throw error;
    }
  }

  // =====================================
  // WRITE OPERATIONS
  // =====================================

  static async createDocument<T extends CollectionName>(
    collectionName: T,
    data: Omit<CollectionTypeMap[T], 'id'>,
    documentId?: string
  ): Promise<string> {
    this.validateCollection(COLLECTION_REGISTRY[collectionName]);

    const context: OperationContext = {
      operation: 'CREATE_DOCUMENT',
      collection: COLLECTION_REGISTRY[collectionName],
      documentId,
      timestamp: new Date()
    };

    try {
      const dataWithTimestamps = {
        ...data,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      let docRef: DocumentReference;

      if (documentId) {
        docRef = doc(db, COLLECTION_REGISTRY[collectionName], documentId);
        await setDoc(docRef, dataWithTimestamps);
      } else {
        docRef = await addDoc(collection(db, COLLECTION_REGISTRY[collectionName]), dataWithTimestamps);
      }

      this.logOperation(context, dataWithTimestamps);
      return docRef.id;
    } catch (error) {
      console.error(`Failed to create document in ${COLLECTION_REGISTRY[collectionName]}:`, error);
      throw error;
    }
  }

  static async updateDocument<T extends CollectionName>(
    collectionName: T,
    documentId: string,
    updates: Partial<CollectionTypeMap[T]>
  ): Promise<void> {
    this.validateCollection(COLLECTION_REGISTRY[collectionName]);

    const context: OperationContext = {
      operation: 'UPDATE_DOCUMENT',
      collection: COLLECTION_REGISTRY[collectionName],
      documentId,
      timestamp: new Date()
    };

    try {
      const docRef = doc(db, COLLECTION_REGISTRY[collectionName], documentId);
      const updatesWithTimestamp = this.addTimestamps(updates);

      await updateDoc(docRef, updatesWithTimestamp);
      this.logOperation(context, updatesWithTimestamp);
    } catch (error) {
      console.error(`Failed to update document in ${COLLECTION_REGISTRY[collectionName]}:`, error);
      throw error;
    }
  }

  static async deleteDocument<T extends CollectionName>(
    collectionName: T,
    documentId: string
  ): Promise<void> {
    this.validateCollection(COLLECTION_REGISTRY[collectionName]);

    const context: OperationContext = {
      operation: 'DELETE_DOCUMENT',
      collection: COLLECTION_REGISTRY[collectionName],
      documentId,
      timestamp: new Date()
    };

    try {
      const docRef = doc(db, COLLECTION_REGISTRY[collectionName], documentId);
      await deleteDoc(docRef);
      this.logOperation(context);
    } catch (error) {
      console.error(`Failed to delete document from ${COLLECTION_REGISTRY[collectionName]}:`, error);
      throw error;
    }
  }

  // =====================================
  // SPECIALIZED OPERATIONS
  // =====================================

  static async getUserDetailView(userId: string): Promise<UserDetailView> {
    try {
      const [user, progress, learningPlans, feedback] = await Promise.all([
        FirestoreMiddleware.getDocument('users', userId).catch(() => null),
        FirestoreMiddleware.getDocument('progress', userId).catch(() => null),
        FirestoreMiddleware.getCollection('learningPlans', {
          where: [{ field: 'userId', operator: '==', value: userId }]
        }).catch(() => []),
        FirestoreMiddleware.getCollection('feedback', {
          where: [{ field: 'userId', operator: '==', value: userId }],
          orderBy: [{ field: 'createdAt', direction: 'desc' }]
        }).catch(() => [])
      ]);

      // If user doesn't exist, create a minimal profile
      const profile = user || {
        uid: userId,
        email: 'Unknown user',
        displayName: 'Unknown user',
        isAdmin: false,
        createdAt: Timestamp.now(),
        lastLoginAt: Timestamp.now(),
        stats: {
          totalXP: 0,
          level: 1,
          xpToNextLevel: 100,
          currentStreak: 0,
          longestStreak: 0,
          lastActivityDate: new Date(),
          streakFrozen: false,
          totalLessonsCompleted: 0,
          totalQuizzesTaken: 0,
          averageQuizScore: 0,
          totalTimeSpentMinutes: 0,
          unlockedAchievements: [],
          achievementProgress: {},
          milestonesReached: [],
          dailyGoalStreak: 0,
          weeklyLessonsCompleted: 0,
          monthlyLessonsCompleted: 0
        },
        preferences: {
          theme: 'system' as const,
          emailNotifications: false,
          language: 'en'
        }
      };

      // Load annotations from dedicated collection per data model
      const annotationsDoc = await FirestoreMiddleware.getDocument('annotations', userId).catch(() => null);

      // Transform progress data for admin view - organize by section and flat array
      let transformedProgress = null;
      if (progress) {
        const lessons: any[] = [];
        const progressBySection: Record<string, any> = {};
        const sections = ['fundamentals', 'genai', 'ml-systems', 'technology', 'case-studies', 'practice', 'reference', 'tools'];

        // Get total lesson counts from content registry
        const { CONTENT_REGISTRY } = await import('./content-registry');
        const totalCountsBySection: Record<string, number> = {};
        sections.forEach(section => {
          totalCountsBySection[section] = CONTENT_REGISTRY.filter(item =>
            item.section === section && item.status === 'active'
          ).length;
        });

        sections.forEach(section => {
          const progressData = (progress as any)[section];
          const sectionLessons: any[] = [];
          let completedCount = 0;
          let totalTimeSpent = 0;

          if (progressData) {
            Object.values(progressData).forEach((lesson: any) => {
              if (lesson) {
                const lessonData = {
                  slug: lesson.item,
                  category: lesson.section,
                  completed: lesson.completed,
                  completedAt: lesson.completedAt ? new Date(lesson.completedAt) : lesson.completedAt,
                  lessonScore: lesson.score, // Lesson completion score
                  timeSpent: lesson.timeSpent || 0
                };

                sectionLessons.push(lessonData);

                if (lesson.completed) {
                  lessons.push(lessonData); // Add to flat array for backward compatibility
                  completedCount++;
                }

                totalTimeSpent += lesson.timeSpent || 0;
              }
            });

            // Sort section lessons by completion date (most recent first)
            sectionLessons.sort((a, b) => {
              if (!a.completedAt && !b.completedAt) return 0;
              if (!a.completedAt) return 1;
              if (!b.completedAt) return -1;
              return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
            });
          }

          // Always include section if it has content in registry, even if no user progress
          const totalCount = totalCountsBySection[section] || 0;
          if (totalCount > 0) {
            progressBySection[section] = {
              lessons: sectionLessons,
              completedCount,
              totalCount,
              totalTimeSpent,
              completionRate: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
            };
          }
        });

        // Sort flat lessons array by completion date (most recent first)
        lessons.sort((a, b) => {
          if (!a.completedAt) return 1;
          if (!b.completedAt) return -1;
          return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
        });

        // Add quiz scores to lesson data where available
        if (progress.quizzes && Array.isArray(progress.quizzes)) {
          const quizMap = new Map();
          progress.quizzes.forEach((quiz: any) => {
            if (quiz.topicId) {
              quizMap.set(quiz.topicId, {
                bestQuizScore: quiz.bestScore,
                quizAttempts: quiz.attempts,
                lastQuizAttempt: quiz.lastAttempt
              });
            }
          });

          // Enhance lessons with quiz data
          lessons.forEach(lesson => {
            const quizData = quizMap.get(lesson.slug);
            if (quizData) {
              lesson.bestQuizScore = quizData.bestQuizScore;
              lesson.quizAttempts = quizData.quizAttempts;
              lesson.lastQuizAttempt = quizData.lastQuizAttempt;
            }
          });

          // Enhance section progress with quiz data
          Object.keys(progressBySection).forEach(section => {
            progressBySection[section].lessons.forEach((lesson: any) => {
              const quizData = quizMap.get(lesson.slug);
              if (quizData) {
                lesson.bestQuizScore = quizData.bestQuizScore;
                lesson.quizAttempts = quizData.quizAttempts;
                lesson.lastQuizAttempt = quizData.lastQuizAttempt;
              }
            });
          });
        }

        transformedProgress = {
          ...progress,
          lessons, // Flat array for backward compatibility
          progressBySection // Organized by section for better admin view
        } as any;
      }

      return {
        profile,
        progress: transformedProgress,
        learningPlans: learningPlans || [],
        annotations: annotationsDoc,
        feedbackHistory: feedback || []
      };
    } catch (error) {
      console.error('Error in getUserDetailView:', error);
      throw error;
    }
  }

  static async getAdminDashboardStats(): Promise<AdminDashboardStats> {
    // Get all users for stats
    const users = await FirestoreMiddleware.getCollection('users');

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // User stats
    const userStats = {
      total: users.length,
      active: users.filter(u => u.lastLoginAt?.toDate() > weekAgo).length,
      new: users.filter(u => u.createdAt?.toDate() > dayAgo).length,
      authenticated: users.filter(u => u.email && !u.email.includes('anonymous')).length,
      anonymous: users.filter(u => !u.email || u.email.includes('anonymous')).length
    };

    // Learning stats from user stats
    const learningStats = users.reduce((acc, user) => {
      if (user.stats) {
        acc.totalLessonsCompleted += user.stats.totalLessonsCompleted || 0;
        acc.totalQuizAttempts += user.stats.totalQuizzesTaken || 0;
        acc.totalQuizScores += (user.stats.averageQuizScore || 0) * (user.stats.totalQuizzesTaken || 0);
        acc.usersWithProgress++;
      }
      return acc;
    }, {
      totalLessonsCompleted: 0,
      totalQuizAttempts: 0,
      totalQuizScores: 0,
      usersWithProgress: 0
    });

    // Get feedback stats
    const feedback = await FirestoreMiddleware.getCollection('feedback');
    const unresolvedFeedback = feedback.filter(f => !f.resolved).length;

    // Device stats
    const deviceStats = users.reduce((acc, user: any) => {
      const devices = user.devices || [];
      acc.totalDevices += devices.length;

      // Count unique devices using Set
      const deviceFingerprints = new Set(devices.map((d: any) => d.fingerprint));
      acc.uniqueDevices += deviceFingerprints.size;

      // Count mobile vs desktop users (based on last device)
      if (user.lastDevice) {
        if (user.lastDevice.isMobile) {
          acc.mobileUsers++;
        } else {
          acc.desktopUsers++;
        }
      }

      return acc;
    }, {
      totalDevices: 0,
      uniqueDevices: 0,
      mobileUsers: 0,
      desktopUsers: 0
    });

    return {
      users: userStats,
      devices: {
        totalDevices: deviceStats.totalDevices,
        uniqueDevices: deviceStats.uniqueDevices,
        avgDevicesPerUser: users.length > 0
          ? parseFloat((deviceStats.totalDevices / users.length).toFixed(2))
          : 0,
        mobileUsers: deviceStats.mobileUsers,
        desktopUsers: deviceStats.desktopUsers
      },
      learning: {
        totalLessonsCompleted: learningStats.totalLessonsCompleted,
        avgCompletionRate: learningStats.usersWithProgress > 0
          ? Math.round(learningStats.totalLessonsCompleted / learningStats.usersWithProgress)
          : 0,
        totalQuizAttempts: learningStats.totalQuizAttempts,
        avgQuizScore: learningStats.totalQuizAttempts > 0
          ? Math.round(learningStats.totalQuizScores / learningStats.totalQuizAttempts)
          : 0
      },
      engagement: {
        totalHighlights: 0, // Would need to aggregate from annotations
        totalNotes: 0, // Would need to aggregate from annotations
        activeLearningPlans: 0, // Would need to count from learningPlans
        totalFeedback: feedback.length,
        unresolvedFeedback
      },
      content: {
        popularLessons: [],
        difficultQuizzes: [],
        completionByCategory: {} as any
      }
    };
  }


  // =====================================
  // QUIZ PROGRESS ANALYTICS
  // =====================================

  static async getQuizProgressStats(): Promise<{
    totalQuizAttempts: number;
    quizzesByCategory: Record<string, number>;
    averageScores: Record<string, number>;
    recentQuizzes: Array<{
      lessonSlug: string;
      category: string;
      score: number;
      percentage: number;
      completedAt: Date;
      userEmail?: string;
    }>;
    topPerformingQuizzes: Array<{
      lessonSlug: string;
      category: string;
      averageScore: number;
      attemptCount: number;
    }>;
  }> {
    try {
      // Get all user progress documents (they contain quizzes array)
      const allUserProgress = await FirestoreMiddleware.getCollection('progress');

      let totalQuizAttempts = 0;
      const quizzesByCategory: Record<string, number> = {};
      const scoresByCategory: Record<string, number[]> = {};
      const quizStats: Record<string, { totalScore: number; count: number; category?: string }> = {};
      const allQuizAttempts: Array<{
        lessonSlug: string;
        category: string;
        score: number;
        percentage: number;
        completedAt: Date;
        userEmail?: string;
      }> = [];

      // Import content registry to get categories
      const { getContentById } = await import('./content-registry');

      // Process each user's progress document
      for (const userProgress of allUserProgress) {
        const quizzes = userProgress.quizzes || [];

        for (const quiz of quizzes) {
          const quizId = quiz.topicId;

          // Sum total attempts across all quizzes
          totalQuizAttempts += Math.max(quiz.attempts || 0, 0);

          // Prefer category from quiz record; fallback to content registry
          const contentNode = getContentById(quizId);
          const category = quiz.category || (contentNode?.section as any) || 'unknown';

          // Track by category (count of unique quizzes encountered)
          quizzesByCategory[category] = (quizzesByCategory[category] || 0) + 1;

          if (!scoresByCategory[category]) {
            scoresByCategory[category] = [];
          }
          scoresByCategory[category].push(quiz.bestScore || 0);

          // Track per-quiz stats
          if (!quizStats[quizId]) {
            quizStats[quizId] = { totalScore: 0, count: 0, category };
          }
          quizStats[quizId].totalScore += quiz.bestScore || 0;
          quizStats[quizId].count += 1;

          // Add to all attempts for recent list (aggregated per quiz record)
          allQuizAttempts.push({
            lessonSlug: quizId,
            category,
            score: quiz.bestScore || 0,
            percentage: quiz.bestScore || 0,
            completedAt: quiz.lastAttempt && typeof (quiz.lastAttempt as any).toDate === 'function'
              ? (quiz.lastAttempt as any).toDate()
              : new Date(),
            userEmail: 'User ID: ' + userProgress.userId // For privacy
          });
        }
      }

      // Calculate average scores by category
      const averageScores: Record<string, number> = {};
      for (const [category, scores] of Object.entries(scoresByCategory)) {
        averageScores[category] = scores.length > 0
          ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
          : 0;
      }

      // Get recent quizzes (last 20)
      const recentQuizzes = allQuizAttempts
        .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
        .slice(0, 20);

      // Get top performing quizzes
      const topPerformingQuizzes = Object.entries(quizStats)
        .map(([lessonSlug, stats]) => ({
          lessonSlug,
          category: stats.category || 'unknown',
          averageScore: Math.round(stats.totalScore / stats.count),
          attemptCount: stats.count
        }))
        .filter(quiz => quiz.attemptCount >= 1) // Include all quizzes
        .sort((a, b) => b.averageScore - a.averageScore)
        .slice(0, 10);

      return {
        totalQuizAttempts,
        quizzesByCategory,
        averageScores,
        recentQuizzes,
        topPerformingQuizzes
      };
    } catch (error) {
      console.error('Failed to get quiz progress stats:', error);
      return {
        totalQuizAttempts: 0,
        quizzesByCategory: {},
        averageScores: {},
        recentQuizzes: [],
        topPerformingQuizzes: []
      };
    }
  }

  // =====================================
  // COLLECTION HEALTH CHECK
  // =====================================

  static async healthCheck(): Promise<{
    collections: Record<string, { exists: boolean; documentCount: number; sampleDoc?: any }>;
    legacyCollections: string[];
    recommendations: string[];
  }> {
    const results: any = {
      collections: {},
      legacyCollections: [],
      recommendations: []
    };

    for (const [key, collectionName] of Object.entries(COLLECTION_REGISTRY)) {
      try {
        const docs = await FirestoreMiddleware.getCollection(key as CollectionName, { limit: 1 });
        const allDocs = await FirestoreMiddleware.getCollection(key as CollectionName);

        results.collections[collectionName] = {
          exists: true,
          documentCount: allDocs.length,
          sampleDoc: docs[0] || null
        };

        // Flag legacy collections
        if (key === 'unlockedAchievements') {
          results.legacyCollections.push(collectionName);
          results.recommendations.push(`Migrate ${collectionName} data to gameStats.unlockedAchievements`);
        }
      } catch (error) {
        results.collections[collectionName] = {
          exists: false,
          documentCount: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return results;
  }
}

export default FirestoreMiddleware;

// =====================================
// CONVENIENCE EXPORTS
// =====================================

export const {
  getDocument,
  getCollection,
  createDocument,
  updateDocument,
  deleteDocument,
  getUserDetailView,
  getAdminDashboardStats,
  getQuizProgressStats,
  healthCheck
} = FirestoreMiddleware;