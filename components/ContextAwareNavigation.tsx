"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getCurrentLearningPlan, getTopicContent } from '@/lib/firebase-learning-plans';
import { getContentById } from '@/lib/content-registry';
import { userStorage } from '@/lib/unified-storage';

interface NavigationItem {
  title: string;
  path: string;
  type: 'current' | 'next' | 'related' | 'prerequisite';
  description?: string;
  completed?: boolean;
}

export default function ContextAwareNavigation() {
  const pathname = usePathname();
  const [navigationItems, setNavigationItems] = useState<NavigationItem[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const generateContextualNavigation = async () => {
      const items: NavigationItem[] = [];
      
      try {
        // Get current learning plan
        const currentPlan = await getCurrentLearningPlan();
        if (!currentPlan) return items;

        // Enrich topics with content registry data
        const enrichedTopics = currentPlan.topics.map(contentId => {
          const contentNode = getContentById(contentId);
          return {
            contentId,
            title: contentNode?.title || contentId,
            path: contentNode?.path || `/${contentId}`,
          };
        });

        // Find current topic based on actual progress
        // Check which topics have been completed
        const progressMap = new Map<string, boolean>();
        for (const topic of enrichedTopics) {
          const contentNode = getContentById(topic.contentId);
          if (contentNode?.section) {
            const categoryProgress = await userStorage.getProgress(contentNode.section as any);
            const lessonSlug = topic.contentId;
            progressMap.set(topic.contentId, categoryProgress[lessonSlug]?.completed || false);
          }
        }

        // Find first incomplete topic or last topic if all complete
        let currentTopicIndex = enrichedTopics.findIndex(topic => !progressMap.get(topic.contentId));
        if (currentTopicIndex === -1) {
          currentTopicIndex = enrichedTopics.length - 1; // All complete, point to last topic
        }

        const currentTopic = enrichedTopics[currentTopicIndex];
        const nextTopic = enrichedTopics[currentTopicIndex + 1];

        // If we're on a content page that's part of their learning plan
        const currentPageTopic = enrichedTopics.find(topic => topic.path === pathname);
        
        if (currentPageTopic) {
          // Add next topic in their learning plan
          if (nextTopic) {
            items.push({
              title: nextTopic.title,
              path: nextTopic.path,
              type: 'next',
              description: 'Next in your learning plan',
            });
          }

          // Add related content from the content registry
          const contentNode = getContentById(currentPageTopic.contentId);
          if (contentNode) {
            contentNode.related.slice(0, 2).forEach(relatedId => {
              const relatedContent = getContentById(relatedId);
              if (relatedContent) {
                items.push({
                  title: relatedContent.title,
                  path: relatedContent.path,
                  type: 'related',
                  description: 'Related topic',
                });
              }
            });
          }
        } else {
          // If not on a learning plan page, show current topic
          if (currentTopic) {
            items.push({
              title: currentTopic.title,
              path: currentTopic.path,
              type: 'current',
              description: 'Continue your learning plan',
            });
          }
        }

        return items;
      } catch (error) {
        console.error('Error generating contextual navigation:', error);
        return items;
      }
    };

    generateContextualNavigation().then(items => {
      setNavigationItems(items);
      setIsVisible(items.length > 0);
    });
  }, [pathname]);

  if (!isVisible || navigationItems.length === 0) {
    return null;
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'current':
        return (
          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
        );
      case 'next':
        return (
          <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
          </svg>
        );
      case 'related':
        return (
          <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
          </svg>
        );
      default:
        return null;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'current':
        return 'Continue';
      case 'next':
        return 'Next';
      case 'related':
        return 'Related';
      case 'prerequisite':
        return 'Review';
      default:
        return '';
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-30">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-lg p-4 max-w-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7"/>
            </svg>
          </div>
          <h3 className="text-sm font-medium">Learning Path</h3>
        </div>
        
        <div className="space-y-2">
          {navigationItems.map((item, index) => (
            <Link
              key={index}
              href={item.path as any}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition group"
            >
              <div className="flex items-center justify-center w-5 h-5 mt-0.5">
                {getTypeIcon(item.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                    {getTypeLabel(item.type)}
                  </span>
                </div>
                <p className="text-sm font-medium group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition truncate">
                  {item.title}
                </p>
                {item.description && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                    {item.description}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
        
        <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
          <Link
            href="/"
            className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
          >
            ← Back to learning plan
          </Link>
        </div>
      </div>
    </div>
  );
}
