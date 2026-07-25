'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { 
  trackPageView,
  trackLessonStarted,
  trackLessonCompleted,
  trackQuizAttempt,
  trackSearchUsage,
  trackToolUsage,
  trackDiagramAction,
  trackUserEngagement,
  trackNavigationPath,
  trackLoadTime,
  trackAuthAction,
  trackContentInteraction,
  trackError,
  trackFeatureUsage
} from '@/lib/firebase';

/**
 * Analytics hook for tracking page views and user interactions
 */
export function useAnalytics() {
  const pathname = usePathname();

  // Track page view on pathname change
  useEffect(() => {
    const startTime = performance.now();
    
    // Get page title from document or pathname
    const pageTitle = document.title || pathname;
    
    // Track page view
    trackPageView(pageTitle);
    
    // Track load time when component mounts
    const loadTime = performance.now() - startTime;
    if (loadTime > 0) {
      trackLoadTime(getPageType(pathname), loadTime);
    }
  }, [pathname]);

  return {
    // Learning analytics
    trackLessonStarted: (lesson_slug: string, category: string) => 
      trackLessonStarted(lesson_slug, category),
    
    trackLessonCompleted: (lesson_slug: string, category: string, time_spent?: number) => 
      trackLessonCompleted(lesson_slug, category, time_spent),
    
    trackQuizAttempt: (quiz_id: string, score: number, total_questions: number, time_spent?: number) => 
      trackQuizAttempt(quiz_id, score, total_questions, time_spent),
    
    // User interaction analytics
    trackSearchUsage: (search_query: string, results_count: number) => 
      trackSearchUsage(search_query, results_count),
    
    trackToolUsage: (tool_name: string, action: string) => 
      trackToolUsage(tool_name, action),
    
    trackDiagramAction: (action: string, diagram_type?: string) => 
      trackDiagramAction(action, diagram_type),
    
    trackUserEngagement: (engagement_type: 'feedback' | 'highlight' | 'note', content_type?: string) => 
      trackUserEngagement(engagement_type, content_type),
    
    // Navigation analytics
    trackNavigationPath: (from_page: string, to_page: string, navigation_type: 'click' | 'breadcrumb' | 'menu' | 'search') => 
      trackNavigationPath(from_page, to_page, navigation_type),
    
    // Auth analytics
    trackAuthAction: (action: 'login' | 'logout' | 'signup', method?: string) => 
      trackAuthAction(action, method),
    
    // Content interaction analytics
    trackContentInteraction: (content_id: string, interaction_type: string, content_category?: string) => 
      trackContentInteraction(content_id, interaction_type, content_category),
    
    // Error tracking
    trackError: (error_type: string, error_message: string, page_location?: string) => 
      trackError(error_type, error_message, page_location),
    
    // Feature usage analytics
    trackFeatureUsage: (feature_name: string, feature_category: string, usage_details?: Record<string, any>) => 
      trackFeatureUsage(feature_name, feature_category, usage_details),
  };
}

/**
 * Determine page type from pathname for analytics categorization
 */
function getPageType(pathname: string): string {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/fundamentals')) return 'fundamentals';
  if (pathname.startsWith('/genai')) return 'genai';
  if (pathname.startsWith('/ml-systems')) return 'ml-systems';
  if (pathname.startsWith('/technology')) return 'technology';
  if (pathname.startsWith('/case-studies')) return 'case-studies';
  if (pathname.startsWith('/practice')) return 'practice';
  if (pathname.startsWith('/reference')) return 'reference';
  if (pathname.startsWith('/tools')) return 'tools';
  if (pathname.startsWith('/whiteboard')) return 'whiteboard';
  if (pathname.startsWith('/projects')) return 'projects';
  if (pathname.startsWith('/admin')) return 'admin';
  return 'other';
}

/**
 * Hook for tracking lesson completion with time tracking
 */
export function useLessonTracking(lessonSlug: string, category: string) {
  const startTime = Date.now();

  useEffect(() => {
    // Track lesson started when component mounts
    trackLessonStarted(lessonSlug, category);

    // Track lesson completed when component unmounts or user leaves
    return () => {
      const timeSpent = Date.now() - startTime;
      trackLessonCompleted(lessonSlug, category, timeSpent);
    };
  }, [lessonSlug, category]);

  const markCompleted = () => {
    const timeSpent = Date.now() - startTime;
    trackLessonCompleted(lessonSlug, category, timeSpent);
  };

  return { markCompleted };
}

/**
 * Hook for tracking quiz performance
 */
export function useQuizTracking(quizId: string) {
  const startTime = Date.now();

  const trackQuizCompletion = (score: number, totalQuestions: number) => {
    const timeSpent = Date.now() - startTime;
    trackQuizAttempt(quizId, score, totalQuestions, timeSpent);
  };

  return { trackQuizCompletion };
}

/**
 * Hook for tracking user engagement with content
 */
export function useEngagementTracking() {
  const trackHighlight = (contentType?: string) => {
    trackUserEngagement('highlight', contentType);
  };

  const trackNote = (contentType?: string) => {
    trackUserEngagement('note', contentType);
  };

  const trackFeedback = (contentType?: string) => {
    trackUserEngagement('feedback', contentType);
  };

  return {
    trackHighlight,
    trackNote, 
    trackFeedback
  };
}