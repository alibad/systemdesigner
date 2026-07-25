'use client';

import Link from 'next/link';
import { GENAI_NAV } from './genai-nav-config';
import type { Route } from 'next';

interface LessonNavigationProps {
  currentSlug: string;
}

export default function LessonNavigation({ currentSlug }: LessonNavigationProps) {
  // Flatten all lessons to find current position
  const allLessons = GENAI_NAV.flatMap(group => group.items);
  const currentIndex = allLessons.findIndex(lesson => lesson.href === `/genai/${currentSlug}`);
  
  const previousLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between">
        {/* Previous Lesson */}
        <div className="flex-1">
          {previousLesson ? (
            <Link
              href={previousLesson.href as any}
              className="group flex items-center gap-3 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-all max-w-sm"
            >
              <svg className="w-5 h-5 text-neutral-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Previous</p>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  {previousLesson.label}
                </p>
              </div>
            </Link>
          ) : (
            <Link
              href={"/genai" as Route<'/genai'>}
              className="group flex items-center gap-3 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-all max-w-sm"
            >
              <svg className="w-5 h-5 text-neutral-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Back to</p>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  GenAI Systems
                </p>
              </div>
            </Link>
          )}
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center gap-2 px-4">
          {allLessons.map((lesson, index) => (
            <div
              key={lesson.href}
              className={`w-2 h-2 rounded-full transition-colors ${
                index <= currentIndex
                  ? 'bg-purple-600 dark:bg-purple-400'
                  : 'bg-neutral-200 dark:bg-neutral-700'
              }`}
            />
          ))}
        </div>

        {/* Next Lesson */}
        <div className="flex-1 flex justify-end">
          {nextLesson ? (
            <Link
              href={nextLesson.href as any}
              className="group flex items-center gap-3 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-all max-w-sm"
            >
              <div className="text-right">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Next</p>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  {nextLesson.label}
                </p>
              </div>
              <svg className="w-5 h-5 text-neutral-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ) : (
            <div className="max-w-sm p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">Completed!</p>
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                🎉 You've finished this learning path
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}