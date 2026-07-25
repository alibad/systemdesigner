'use client';

import React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { ChevronLeft, ChevronRight, Home } from 'lucide-react';
import { ML_SYSTEMS_NAV } from './ml-systems-nav-config';

interface LessonNavigationProps {
  currentSlug: string;
  category?: string;
}

export default function LessonNavigation({ currentSlug, category = 'ml-systems' }: LessonNavigationProps) {
  const allLessons = ML_SYSTEMS_NAV.flatMap(group => group.items);
  const currentIndex = allLessons.findIndex(lesson => lesson.href === `/${category}/${currentSlug}`);
  
  const previousLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  return (
    <div className="mt-12 pt-8 border-t border-slate-700">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          {previousLesson ? (
            <Link
              href={previousLesson.href as any}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <div className="text-left">
                <div className="text-xs text-slate-400">Previous</div>
                <div className="text-sm font-medium">{previousLesson.label}</div>
              </div>
            </Link>
          ) : (
            <div />
          )}
        </div>

        <Link
          href={`/${category}` as any}
          className="px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 rounded-lg transition-colors"
        >
          <Home className="w-5 h-5" />
        </Link>

        <div className="flex-1 text-right">
          {nextLesson ? (
            <Link
              href={nextLesson.href as any}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors ml-auto"
            >
              <div className="text-left">
                <div className="text-xs opacity-80">Next</div>
                <div className="text-sm font-medium">{nextLesson.label}</div>
              </div>
              <ChevronRight className="w-5 h-5" />
            </Link>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  );
}