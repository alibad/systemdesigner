import { collection, doc, getDoc, setDoc, updateDoc, deleteField, Timestamp, arrayUnion, arrayRemove } from 'firebase/firestore';
import { assertFirebaseConfigured, db, getUserLearningProgress } from './firebase';
import { CONTENT_REGISTRY } from './content-registry';

/**
 * Generate URL-friendly slug from title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim()
    .substring(0, 100); // Increased length limit to accommodate longer titles
}

/**
 * Individual Learning Plan
 */
export interface FirebaseLearningPlan {
  id?: string; // Plan ID (generated)

  // Plan Details
  title: string;
  slug: string; // URL-friendly version of title
  description: string;
  userGoal: string; // Original user input: "I want to learn..."

  // Plan Structure - Just an ordered list of content IDs!
  topics: string[]; // Simple array of content IDs in order

  // Basic Info
  status: 'active' | 'completed' | 'paused' | 'archived';
  skillLevel: 'beginner' | 'intermediate' | 'advanced';

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * User's Learning Plans Document Structure
 * Stored at: learningPlans/{userId}
 */
export interface UserLearningPlansDocument {
  userId: string;
  plans: Record<string, FirebaseLearningPlan>; // Key is plan ID
  activePlanId?: string; // Currently active plan
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Firestore collection reference
export const learningPlansCollection = collection(db, 'learningPlans');

/**
 * Get content details for a learning plan topic
 */
export function getTopicContent(contentId: string) {
  return CONTENT_REGISTRY.find(node => node.id === contentId);
}

/**
 * Calculate learning plan progress dynamically from actual user progress
 */
export async function calculatePlanProgress(plan: FirebaseLearningPlan, userId?: string) {
  assertFirebaseConfigured('Cloud learning plans');
  // Get user progress - pass userId to avoid auth issues
  const completedLessons = await getUserLearningProgress(userId);
    
  const completedTopics = plan.topics.filter(topicId => {
    const content = getTopicContent(topicId);
    if (!content) return false;
    const lessonSlug = content.path.split('/').pop();
    return completedLessons.some((lesson: any) => lesson.lessonSlug === lessonSlug);
  });
  
  return {
    totalTopics: plan.topics.length,
    completedTopics: completedTopics.length,
    progressPercentage: Math.round((completedTopics.length / plan.topics.length) * 100)
  };
}

/**
 * Create a new learning plan
 */
export const createLearningPlan = async (
  planData: Omit<FirebaseLearningPlan, 'id' | 'slug' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<string> => {
  assertFirebaseConfigured('Cloud learning plans');
  if (!userId) {
    throw new Error('userId is required to create a learning plan');
  }

  const now = Timestamp.now();
  const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const newPlan: FirebaseLearningPlan = {
    ...planData,
    id: planId,
    slug: generateSlug(planData.title),
    createdAt: now,
    updatedAt: now,
  };

  // Get user's learning plans document
  const userPlansRef = doc(learningPlansCollection, userId);
  const userPlansDoc = await getDoc(userPlansRef);

  if (userPlansDoc.exists()) {
    // Update existing document
    await updateDoc(userPlansRef, {
      [`plans.${planId}`]: newPlan,
      activePlanId: planId, // Set as active plan
      updatedAt: now
    });
  } else {
    // Create new document
    const newUserPlansDoc: UserLearningPlansDocument = {
      userId,
      plans: {
        [planId]: newPlan
      },
      activePlanId: planId,
      createdAt: now,
      updatedAt: now
    };
    await setDoc(userPlansRef, newUserPlansDoc);
  }

  // Trigger admin notification for new learning plan (async, don't block)
  notifyLearningPlanCreated(userId, newPlan).catch(err =>
    console.error('Error sending learning plan notification:', err)
  );

  return planId;
};

// Helper to notify admins about learning plan creation
async function notifyLearningPlanCreated(userId: string, plan: FirebaseLearningPlan) {
  try {
    const { NotificationService } = await import('./notification-service');
    const { getUserDocument } = await import('./firebase');

    const userDoc = await getUserDocument(userId);
    if (!userDoc) return;

    // Calculate estimated weeks based on topic count (assume 2 topics per week)
    const estimatedWeeks = Math.ceil(plan.topics.length / 2);

    await NotificationService.notifyLearningPlanCreated({
      userId,
      userEmail: userDoc.email,
      userName: userDoc.displayName,
      planTitle: plan.title,
      topicCount: plan.topics.length,
      estimatedWeeks,
    });
  } catch (error) {
    console.error('Error in notifyLearningPlanCreated:', error);
  }
}

/**
 * Get all learning plans for current user
 */
export const getUserLearningPlans = async (userId?: string): Promise<FirebaseLearningPlan[]> => {
  if (!userId) {
    console.log('No userId provided for getUserLearningPlans');
    return [];
  }
  assertFirebaseConfigured('Cloud learning plans');

  try {
    const userPlansRef = doc(learningPlansCollection, userId);
    const userPlansDoc = await getDoc(userPlansRef);

    if (!userPlansDoc.exists()) {
      return [];
    }

    const data = userPlansDoc.data() as UserLearningPlansDocument;
    // Convert plans object to array and sort by creation date
    const plans = Object.values(data.plans || {}).sort((a, b) =>
      b.createdAt.toMillis() - a.createdAt.toMillis()
    );

    return plans;
  } catch (error) {
    console.error('Error getting user learning plans:', error);
    return [];
  }
};

/**
 * Get current active learning plan for user
 */
export const getCurrentLearningPlan = async (userId?: string): Promise<FirebaseLearningPlan | null> => {
  if (!userId) {
    console.log('No userId provided for getCurrentLearningPlan');
    return null;
  }
  assertFirebaseConfigured('Cloud learning plans');

  try {
    const userPlansRef = doc(learningPlansCollection, userId);
    const userPlansDoc = await getDoc(userPlansRef);

    if (!userPlansDoc.exists()) {
      return null;
    }

    const data = userPlansDoc.data() as UserLearningPlansDocument;
    if (!data.activePlanId || !data.plans[data.activePlanId]) {
      // No active plan or active plan doesn't exist
      // Try to find any active plan
      const activePlans = Object.values(data.plans || {}).filter(p => p.status === 'active');
      return activePlans.length > 0 ? activePlans[0] : null;
    }

    return data.plans[data.activePlanId];
  } catch (error) {
    console.error('Error getting current learning plan:', error);
    return null;
  }
};

/**
 * Get a learning plan by ID
 */
export const getLearningPlan = async (planId: string, userId: string): Promise<FirebaseLearningPlan | null> => {
  if (!userId || !planId) {
    return null;
  }
  assertFirebaseConfigured('Cloud learning plans');

  try {
    const userPlansRef = doc(learningPlansCollection, userId);
    const userPlansDoc = await getDoc(userPlansRef);

    if (!userPlansDoc.exists()) {
      return null;
    }

    const data = userPlansDoc.data() as UserLearningPlansDocument;
    return data.plans[planId] || null;
  } catch (error) {
    console.error('Error getting learning plan:', error);
    return null;
  }
};

/**
 * Get a learning plan by slug
 */
export const getLearningPlanBySlug = async (slug: string, userId?: string): Promise<FirebaseLearningPlan | null> => {
  if (!userId) {
    console.log('No userId provided for getLearningPlanBySlug');
    return null;
  }
  assertFirebaseConfigured('Cloud learning plans');

  try {
    const userPlansRef = doc(learningPlansCollection, userId);
    const userPlansDoc = await getDoc(userPlansRef);

    if (!userPlansDoc.exists()) {
      console.log('No learning plans document found for user:', userId);
      return null;
    }

    const data = userPlansDoc.data() as UserLearningPlansDocument;
    console.log('Looking for slug:', slug);
    console.log('Available plans:', Object.keys(data.plans || {}));
    console.log('Available slugs:', Object.values(data.plans || {}).map(p => p.slug));

    // Find plan by slug
    let plan = Object.values(data.plans || {}).find(p => p.slug === slug);

    // Fallback: if no exact match found, try truncated slug (for backward compatibility)
    if (!plan) {
      const truncatedSlug = slug.substring(0, 50);
      plan = Object.values(data.plans || {}).find(p => p.slug === truncatedSlug);
      if (plan) {
        console.log('Found plan using truncated slug fallback:', truncatedSlug);
      }
    }

    if (!plan) {
      console.log('No plan found with slug:', slug);
      console.log('Also tried truncated slug:', slug.substring(0, 50));
    }

    return plan || null;
  } catch (error) {
    console.error('Error getting learning plan by slug:', error);
    return null;
  }
};

/**
 * Delete a learning plan
 */
export const deleteLearningPlan = async (planId: string, userId: string): Promise<void> => {
  assertFirebaseConfigured('Cloud learning plans');
  if (!userId || !planId) {
    throw new Error('userId and planId are required to delete a learning plan');
  }

  try {
    const userPlansRef = doc(learningPlansCollection, userId);
    const userPlansDoc = await getDoc(userPlansRef);

    if (!userPlansDoc.exists()) {
      throw new Error('No learning plans found for user');
    }

    const data = userPlansDoc.data() as UserLearningPlansDocument;

    if (!data.plans[planId]) {
      throw new Error('Learning plan not found');
    }

    // Prepare the update object
    const updateData: any = {
      [`plans.${planId}`]: deleteField(),
      updatedAt: Timestamp.now()
    };

    // If this was the active plan, clear the activePlanId
    if (data.activePlanId === planId) {
      // Find another active plan to set as active
      const remainingPlans = Object.values(data.plans).filter(plan =>
        plan.id !== planId && plan.status === 'active'
      );

      if (remainingPlans.length > 0) {
        updateData.activePlanId = remainingPlans[0].id;
      } else {
        updateData.activePlanId = deleteField();
      }
    }

    await updateDoc(userPlansRef, updateData);
  } catch (error) {
    console.error('Error deleting learning plan:', error);
    throw error;
  }
};

/**
 * Update learning plan status
 */
export const updateLearningPlanStatus = async (
  planId: string,
  userId: string,
  status: FirebaseLearningPlan['status']
): Promise<void> => {
  assertFirebaseConfigured('Cloud learning plans');
  if (!userId || !planId) {
    throw new Error('userId and planId are required');
  }

  try {
    const userPlansRef = doc(learningPlansCollection, userId);
    await updateDoc(userPlansRef, {
      [`plans.${planId}.status`]: status,
      [`plans.${planId}.updatedAt`]: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating learning plan status:', error);
    throw error;
  }
};
