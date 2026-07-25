'use client';

import { useEffect, useState } from 'react';
import { useNavigationContext } from '@/contexts/NavigationContext';
import { getCurrentLearningPlan, getLearningPlan, getTopicContent } from '@/lib/firebase-learning-plans';
import { getContentById } from '@/lib/content-registry';
import { useAuth } from '@/hooks/useAuth';

interface ContextAwareNavigation {
  backUrl: string;
  backLabel: string;
  nextUrl?: string;
  nextLabel?: string;
  isFromLearningPlan: boolean;
}

export function useContextAwareNavigation(
  currentContentId: string,
  defaultBackUrl: string,
  defaultBackLabel: string,
  defaultNextUrl?: string,
  defaultNextLabel?: string
): ContextAwareNavigation {
  const { 
    referrerContext, 
    learningPlanId, 
    learningPlanSlug, 
    learningPlanTitle,
    backUrl: contextBackUrl,
    backLabel: contextBackLabel 
  } = useNavigationContext();
  const { user } = useAuth();

  const [navigation, setNavigation] = useState<ContextAwareNavigation>({
    backUrl: defaultBackUrl,
    backLabel: defaultBackLabel,
    nextUrl: defaultNextUrl,
    nextLabel: defaultNextLabel,
    isFromLearningPlan: false
  });

  useEffect(() => {
    const loadLearningPlanNavigation = async () => {
      if (referrerContext === 'learning-plan') {
        try {
          // If we have explicit learning plan context, use it
          if (contextBackUrl && contextBackLabel) {
            // Get the current learning plan to find next lesson
            if (learningPlanId && user?.uid) {
              const currentPlan = await getLearningPlan(learningPlanId, user.uid);

              if (currentPlan) {
                const currentTopicIndex = currentPlan.topics.findIndex(topicId => {
                  const content = getTopicContent(topicId);
                  const currentPath = window.location.pathname;
                  return content?.path === currentPath || topicId === currentContentId;
                });

                if (currentTopicIndex !== -1) {
                  const nextTopicId = currentPlan.topics[currentTopicIndex + 1];
                  let nextUrl: string | undefined;
                  let nextLabel: string | undefined;

                  if (nextTopicId) {
                    const nextContent = getTopicContent(nextTopicId);
                    if (nextContent) {
                      nextUrl = `${nextContent.path}?from=learning-plan&planId=${currentPlan.id}&planSlug=${currentPlan.slug}&planTitle=${encodeURIComponent(currentPlan.title)}`;
                      nextLabel = nextContent.title;
                    }
                  }

                  setNavigation({
                    backUrl: contextBackUrl,
                    backLabel: contextBackLabel,
                    nextUrl,
                    nextLabel,
                    isFromLearningPlan: true
                  });
                  return;
                }
              }
            }

            // Fallback: set navigation without next lesson
            setNavigation(prev => ({
              ...prev,
              backUrl: contextBackUrl,
              backLabel: contextBackLabel,
              isFromLearningPlan: true
            }));
            return;
          }

          // Otherwise, try to get the current learning plan
          const currentPlan = await getCurrentLearningPlan();
          if (currentPlan) {
            const currentTopicIndex = currentPlan.topics.findIndex(topicId => {
              const content = getTopicContent(topicId);
              // Compare pathname without query parameters
              const currentPath = window.location.pathname;
              return content?.path === currentPath || topicId === currentContentId;
            });

            if (currentTopicIndex !== -1) {
              // User is following their learning plan
              const nextTopicId = currentPlan.topics[currentTopicIndex + 1];
              let nextUrl: string | undefined;
              let nextLabel: string | undefined;

              if (nextTopicId) {
                const nextContent = getTopicContent(nextTopicId);
                if (nextContent) {
                  nextUrl = `${nextContent.path}?from=learning-plan&planId=${currentPlan.id}&planSlug=${currentPlan.slug}&planTitle=${encodeURIComponent(currentPlan.title)}`;
                  nextLabel = nextContent.title;
                }
              }

              setNavigation({
                backUrl: `/learn/plan/${currentPlan.slug}`,
                backLabel: `Back to ${currentPlan.title}`,
                nextUrl,
                nextLabel,
                isFromLearningPlan: true
              });
              return;
            }
          }
        } catch (error) {
          console.error('Error loading learning plan navigation:', error);
        }
      }

      // Fallback to default content structure navigation
      setNavigation({
        backUrl: defaultBackUrl,
        backLabel: defaultBackLabel,
        nextUrl: defaultNextUrl,
        nextLabel: defaultNextLabel,
        isFromLearningPlan: false
      });
    };

    loadLearningPlanNavigation();
  }, [
    referrerContext,
    learningPlanId,
    learningPlanSlug,
    learningPlanTitle,
    contextBackUrl,
    contextBackLabel,
    currentContentId,
    defaultBackUrl,
    defaultBackLabel,
    defaultNextUrl,
    defaultNextLabel
  ]);

  return navigation;
}
