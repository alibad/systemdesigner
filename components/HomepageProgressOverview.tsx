"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { userStorage } from '@/lib/unified-storage';
import { CONTENT_REGISTRY } from '@/lib/content-registry';

interface SectionProgress {
  section: string;
  title: string;
  completed: number;
  total: number;
  color: string;
  href: string;
}

export default function HomepageProgressOverview() {
  const { user, loading: authLoading } = useAuth();
  const [progressData, setProgressData] = useState<SectionProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCompleted, setTotalCompleted] = useState(0);

  useEffect(() => {
    const loadProgress = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        // Set user for unified storage
        await userStorage.setUser(user);

        // Get progress for all sections
        const allProgress = await userStorage.getProgress();

        // Calculate actual totals from content registry
        const sectionCounts = {
          'fundamentals': CONTENT_REGISTRY.filter(item => item.section === 'fundamentals').length,
          'genai': CONTENT_REGISTRY.filter(item => item.section === 'genai').length,
          'ml-systems': CONTENT_REGISTRY.filter(item => item.section === 'ml-systems').length,
          'technology': CONTENT_REGISTRY.filter(item => item.section === 'technology').length,
          'case-studies': CONTENT_REGISTRY.filter(item => item.section === 'case-studies').length,
          'practice': CONTENT_REGISTRY.filter(item => item.section === 'practice').length
        };

        // Define sections to track
        const sections = [
          { section: 'fundamentals', title: 'Fundamentals', total: sectionCounts.fundamentals, color: 'blue', href: '/fundamentals' },
          { section: 'genai', title: 'GenAI Systems', total: sectionCounts.genai, color: 'purple', href: '/genai' },
          { section: 'ml-systems', title: 'ML Systems', total: sectionCounts['ml-systems'], color: 'green', href: '/ml-systems' },
          { section: 'technology', title: 'Technologies', total: sectionCounts.technology, color: 'orange', href: '/technology' },
          { section: 'case-studies', title: 'Case Studies', total: sectionCounts['case-studies'], color: 'indigo', href: '/case-studies' },
          { section: 'practice', title: 'Practice', total: sectionCounts.practice, color: 'pink', href: '/practice' }
        ];

        // Calculate progress for each section
        const progressWithData = sections.map(section => {
          const sectionProgress = allProgress[section.section] || {};
          const completed = Object.values(sectionProgress).filter((item: any) => item.completed).length;
          return {
            ...section,
            completed
          };
        });

        // Calculate total completed lessons
        const total = progressWithData.reduce((sum, section) => sum + section.completed, 0);

        setProgressData(progressWithData);
        setTotalCompleted(total);
      } catch (error) {
        console.error('Error loading progress:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading) {
      loadProgress();
    }
  }, [user, authLoading]);

  // Don't show progress section for non-authenticated users or if no progress
  if (!user || isLoading || totalCompleted === 0) {
    return null;
  }

  const totalPossible = progressData.reduce((sum, section) => sum + section.total, 0);
  const overallPercentage = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;

  return (
    <section className="mt-8">
      <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Your Learning Progress
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              {totalCompleted} lessons completed across all sections
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {overallPercentage}%
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-500">
              Overall Progress
            </div>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-3 mb-6">
          <div
            className="bg-gradient-to-r from-indigo-500 to-violet-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${overallPercentage}%` }}
          />
        </div>

        {/* Section Progress Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {progressData.map((section) => {
            if (section.completed === 0) return null; // Only show sections with progress

            const percentage = section.total > 0 ? Math.round((section.completed / section.total) * 100) : 0;

            return (
              <Link
                key={section.section}
                href={section.href as any}
                className="group p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${
                    section.color === 'blue' ? 'bg-blue-500' :
                    section.color === 'purple' ? 'bg-purple-500' :
                    section.color === 'green' ? 'bg-green-500' :
                    section.color === 'orange' ? 'bg-orange-500' :
                    section.color === 'indigo' ? 'bg-indigo-500' :
                    'bg-pink-500'
                  }`} />
                  <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {section.title}
                  </span>
                </div>

                <div className="text-xs text-neutral-500 dark:text-neutral-500 mb-2">
                  {section.completed} / {section.total}
                </div>

                <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      section.color === 'blue' ? 'bg-blue-500' :
                      section.color === 'purple' ? 'bg-purple-500' :
                      section.color === 'green' ? 'bg-green-500' :
                      section.color === 'orange' ? 'bg-orange-500' :
                      section.color === 'indigo' ? 'bg-indigo-500' :
                      'bg-pink-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mt-1">
                  {percentage}%
                </div>
              </Link>
            );
          })}
        </div>

      </div>
    </section>
  );
}