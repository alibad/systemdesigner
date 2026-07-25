'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo, useState, useEffect } from 'react';
import { getCurrentLearningPlan, getTopicContent, type FirebaseLearningPlan } from '@/lib/firebase-learning-plans';
import { getContentById, type ContentNode } from '@/lib/content-registry';
import { useProgressTracking } from '@/hooks/useProgressTracking';
import { useLearningPlan } from '@/contexts/LearningPlanContext';
import { useAuth } from '@/hooks/useAuth';

export interface LearningPlanNavItem {
  contentId: string;
  title: string;
  path: string;
  section: ContentNode['section'];
  isCompleted: boolean;
  isCurrent: boolean;
  index: number; // Sequential position in learning plan
}

export interface LearningPlanNavigation {
  isFromLearningPlan: boolean;
  planTitle?: string;
  planSlug?: string;
  planId?: string;
  items: LearningPlanNavItem[]; // Linear array instead of grouped sections
  currentTopicIndex: number;
  totalTopics: number;
  completedTopics: number;
}

const SECTION_TITLES: Record<ContentNode['section'], string> = {
  'fundamentals': 'Fundamentals',
  'genai': 'GenAI Systems',
  'ml-systems': 'ML Systems',
  'technology': 'Technology',
  'case-studies': 'Case Studies',
  'practice': 'Practice',
  'reference': 'Reference',
  'tools': 'Tools'
};

export function useLearningPlanNavigation(currentPath: string): LearningPlanNavigation {
  const searchParams = useSearchParams();
  const isFromLearningPlan = searchParams?.get('from') === 'learning-plan' || searchParams?.get('fromLearningPlan') === 'true';

  // Also check if we're directly on a learning plan page
  const isOnLearningPlanPage = currentPath.startsWith('/learn/plan/');

  // Check if we have learning plan parameters in URL (even if fromLearningPlan isn't set)
  const hasLearningPlanParams = Boolean(searchParams?.get('planSlug') || searchParams?.get('planId'));

  const shouldShowLearningPlanNav = isFromLearningPlan || isOnLearningPlanPage || hasLearningPlanParams;

  const planTitle = searchParams?.get('planTitle');
  const planSlug = searchParams?.get('planSlug');
  const planId = searchParams?.get('planId');

  // Use global learning plan context when on a learning plan page
  const { currentPlan: globalCurrentPlan } = useLearningPlan();
  const { user } = useAuth();

  const [learningPlan, setLearningPlan] = useState<FirebaseLearningPlan | null>(null);
  const [loading, setLoading] = useState(false);

  // Get progress for all sections that might contain learning plan topics
  const fundamentalsProgress = useProgressTracking('fundamentals');
  const genaiProgress = useProgressTracking('genai');
  const mlSystemsProgress = useProgressTracking('ml-systems');
  const technologyProgress = useProgressTracking('technology');
  const caseStudiesProgress = useProgressTracking('case-studies');
  const practiceProgress = useProgressTracking('practice');
  const toolsProgress = useProgressTracking('tools');
  const referenceProgress = useProgressTracking('reference');

  // Helper function to check if a lesson is completed
  const isLessonCompleted = (contentId: string, section: ContentNode['section']): boolean => {
    const progressMap = {
      'fundamentals': fundamentalsProgress,
      'genai': genaiProgress,
      'ml-systems': mlSystemsProgress,
      'technology': technologyProgress,
      'case-studies': caseStudiesProgress,
      'practice': practiceProgress,
      'tools': toolsProgress,
      'reference': referenceProgress
    };

    const sectionProgress = progressMap[section];
    return sectionProgress ? sectionProgress.isCompleted(contentId) : false;
  };

  // Fetch learning plan data when needed
  useEffect(() => {
    if (!shouldShowLearningPlanNav) return;

    // If no user is authenticated yet, wait for authentication
    if (user === undefined) {
      return;
    }

    // If we're on a learning plan page and have global plan context, use it
    if (isOnLearningPlanPage && globalCurrentPlan) {
      setLearningPlan(globalCurrentPlan);
      setLoading(false);
      return;
    }

    // If we have global plan context from the learning plan context, use it
    if (globalCurrentPlan) {
      setLearningPlan(globalCurrentPlan);
      setLoading(false);
      return;
    }

    // Otherwise fetch the learning plan
    const fetchLearningPlan = async () => {
      setLoading(true);
      try {
        // If we have a specific plan slug from URL, try to fetch that plan
        if (planSlug && user) {
          const { getLearningPlanBySlug } = await import('@/lib/firebase-learning-plans');
          const plan = await getLearningPlanBySlug(planSlug, user.uid);
          setLearningPlan(plan);
        } else if (user) {
          const plan = await getCurrentLearningPlan(user.uid);
          setLearningPlan(plan);
        }
      } catch (error) {
        console.error('Error fetching learning plan:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLearningPlan();
  }, [shouldShowLearningPlanNav, isOnLearningPlanPage, isFromLearningPlan, globalCurrentPlan, planId, planSlug, user]);

  return useMemo(() => {
    if (!shouldShowLearningPlanNav) {
      return {
        isFromLearningPlan: false,
        items: [],
        currentTopicIndex: -1,
        totalTopics: 0,
        completedTopics: 0
      };
    }

    if (loading || !learningPlan) {
      return {
        isFromLearningPlan: true,
        planTitle: planTitle ? decodeURIComponent(planTitle) : 'Loading...',
        planSlug: planSlug || undefined,
        items: [],
        currentTopicIndex: -1,
        totalTopics: 0,
        completedTopics: 0
      };
    }

    // Transform learning plan topics into linear navigation items
    const topicItems: LearningPlanNavItem[] = learningPlan.topics.map((contentId, index) => {
      const content = getTopicContent(contentId);
      if (!content) {
        return {
          contentId,
          title: `Unknown Topic (${contentId})`,
          path: '#',
          section: 'fundamentals' as const,
          isCompleted: false,
          isCurrent: false,
          index: index + 1 // 1-based indexing for display
        };
      }

      const isCurrentPath = currentPath === content.path;
      // Check completion status using progress tracking
      const isCompleted = isLessonCompleted(contentId, content.section);

      return {
        contentId,
        title: content.title,
        path: content.path,
        section: content.section,
        isCompleted,
        isCurrent: isCurrentPath,
        index: index + 1 // 1-based indexing for display
      };
    });

    const currentTopicIndex = topicItems.findIndex(item => item.isCurrent);
    const completedTopics = topicItems.filter(item => item.isCompleted).length;

    return {
      isFromLearningPlan: true,
      planTitle: learningPlan.title,
      planSlug: learningPlan.slug,
      planId: learningPlan.id,
      items: topicItems, // Linear array instead of grouped sections
      currentTopicIndex,
      totalTopics: topicItems.length,
      completedTopics
    };
  }, [
    isFromLearningPlan,
    planTitle,
    planSlug,
    currentPath,
    learningPlan,
    loading,
    fundamentalsProgress,
    genaiProgress,
    mlSystemsProgress,
    technologyProgress,
    caseStudiesProgress,
    practiceProgress,
    toolsProgress,
    referenceProgress
  ]);
}