'use client';

import Link from 'next/link';
import { useLessonProgress } from '@/hooks/useProgressTracking';

interface ReferenceLessonHeaderProps {
  title: string;
  description?: string;
  lessonSlug: string;
  category?: string;
  hasQuiz?: boolean;
  hasInteractive?: boolean;
  previousLesson?: string;
  nextLesson?: string;
  referenceType?: string;
}

export default function ReferenceLessonHeader({
  title,
  description,
  lessonSlug,
  category,
  hasQuiz = true,
  hasInteractive = false,
  previousLesson,
  nextLesson,
  referenceType
}: ReferenceLessonHeaderProps) {
  const { isCompleted, loading } = useLessonProgress(lessonSlug, 'reference');

  if (loading) {
    return (
      <div className="mb-6 animate-pulse">
        <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded mb-2"></div>
        <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4"></div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-neutral-100">
          {title}
        </h1>
        
        {isCompleted && (
          <div className="flex items-center gap-1 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-medium">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Completed
          </div>
        )}
      </div>

      {description && (
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">
          {description}
        </p>
      )}

      {/* Interactive Elements Available */}
      <div className="flex gap-3 mb-4">
        {hasQuiz && (
          <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Quiz Available
          </div>
        )}
        
        {hasInteractive && (
          <div className="flex items-center gap-2 px-3 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Interactive Learning
          </div>
        )}

        {category && (
          <div className="flex items-center gap-2 px-3 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z" />
            </svg>
            {category}
          </div>
        )}
      </div>

      {/* Reference type and navigation */}
      {(referenceType || previousLesson || nextLesson) && (
        <div className="flex items-center justify-between mb-4">
          <div>
            {referenceType && (
              <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                {referenceType}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm">
            {previousLesson && (
              <Link href={previousLesson as any} className="px-3 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                ← Previous
              </Link>
            )}
            {nextLesson && (
              <Link href={nextLesson as any} className="px-3 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}