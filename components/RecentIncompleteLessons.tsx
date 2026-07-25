"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { userStorage } from '@/lib/unified-storage';
import { CONTENT_REGISTRY } from '@/lib/content-registry';

interface RecentLesson {
  id: string;
  title: string;
  section: string;
  sectionTitle: string;
  path: string;
  lastVisited: Date;
  color: string;
}

export default function RecentIncompleteLessons() {
  const { user, loading: authLoading } = useAuth();
  const [recentLessons, setRecentLessons] = useState<RecentLesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadRecentLessons = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        // Set user for unified storage
        await userStorage.setUser(user);

        // Get progress for all sections
        const allProgress = await userStorage.getProgress();

        // Define section colors and titles
        const sectionInfo: Record<string, { title: string; color: string }> = {
          'fundamentals': { title: 'Fundamentals', color: 'blue' },
          'genai': { title: 'GenAI Systems', color: 'purple' },
          'ml-systems': { title: 'ML Systems', color: 'green' },
          'technology': { title: 'Technologies', color: 'orange' },
          'case-studies': { title: 'Case Studies', color: 'indigo' },
          'practice': { title: 'Practice', color: 'pink' }
        };

        // Collect all incomplete lessons with timestamps
        const incompleteLessons: RecentLesson[] = [];

        Object.entries(allProgress).forEach(([section, sectionProgress]) => {
          Object.entries(sectionProgress as Record<string, any>).forEach(([lessonSlug, progress]) => {
            // Only include lessons that are NOT completed
            if (!progress.completed && progress.lastUpdated) {
              // Find the content in the registry
              const content = CONTENT_REGISTRY.find(item =>
                item.section === section && item.path.endsWith(lessonSlug)
              );

              if (content) {
                incompleteLessons.push({
                  id: content.id,
                  title: content.title,
                  section,
                  sectionTitle: sectionInfo[section]?.title || section,
                  path: content.path,
                  lastVisited: new Date(progress.lastUpdated),
                  color: sectionInfo[section]?.color || 'neutral'
                });
              }
            }
          });
        });

        // Sort by most recent and take top 5
        const sortedRecent = incompleteLessons
          .sort((a, b) => b.lastVisited.getTime() - a.lastVisited.getTime())
          .slice(0, 5);

        setRecentLessons(sortedRecent);
      } catch (error) {
        console.error('Error loading recent lessons:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading) {
      loadRecentLessons();
    }
  }, [user, authLoading]);

  // Don't show if no user, loading, or no recent lessons
  if (!user || isLoading || recentLessons.length === 0) {
    return null;
  }

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      blue: { bg: 'bg-blue-50 dark:bg-blue-900/10', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
      purple: { bg: 'bg-purple-50 dark:bg-purple-900/10', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
      green: { bg: 'bg-green-50 dark:bg-green-900/10', text: 'text-green-700 dark:text-green-300', border: 'border-green-200 dark:border-green-800' },
      orange: { bg: 'bg-orange-50 dark:bg-orange-900/10', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800' },
      indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/10', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800' },
      pink: { bg: 'bg-pink-50 dark:bg-pink-900/10', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-200 dark:border-pink-800' },
    };
    return colors[color] || colors.blue;
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <section className="mt-8">
      <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Continue Where You Left Off
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              Pick up your in-progress lessons
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {recentLessons.map((lesson) => {
            const colorClasses = getColorClasses(lesson.color);
            return (
              <Link
                key={lesson.id}
                href={lesson.path as any}
                className="block p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colorClasses.bg} ${colorClasses.text}`}>
                        {lesson.sectionTitle}
                      </span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-500">
                        {formatTimeAgo(lesson.lastVisited)}
                      </span>
                    </div>
                    <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                      {lesson.title}
                    </h3>
                  </div>
                  <svg className="w-4 h-4 text-neutral-400 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
