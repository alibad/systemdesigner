'use client';

import { useProgressTracking } from '@/hooks/useProgressTracking';
import { useQuizProgress } from '@/hooks/useQuizProgress';
import type { LearningCategory } from '@/hooks/useProgressTracking';

interface LessonHeaderProps {
  title: string;
  duration?: string;
  level?: 'Beginner' | 'Intermediate' | 'Advanced';
  lessonSlug: string;
  hasQuiz?: boolean;
  category?: LearningCategory;
  description?: string;
}

export default function LessonHeader({ 
  title, 
  duration, 
  level, 
  lessonSlug, 
  hasQuiz = false,
  category = 'fundamentals',
  description
}: LessonHeaderProps) {
  const { isCompleted } = useProgressTracking(category);
  const completed = isCompleted(lessonSlug);
  
  // Always call the hook to avoid conditional hook usage
  const { getBestScore, loading: quizLoading } = useQuizProgress(lessonSlug);
  
  // Only use quiz results if this lesson has a quiz
  const bestScore = hasQuiz ? getBestScore() : null;

  const getLevelStyles = (level: string) => {
    switch (level) {
      case 'Beginner':
        return 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300';
      case 'Intermediate':
        return 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300';
      case 'Advanced':
        return 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300';
      default:
        return 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300';
    }
  };

  const getQuizScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 60) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const scrollToQuiz = () => {
    // First try to find the quiz section by id
    const quizElement = document.getElementById('quiz-section') || 
                       // Fallback: find element with 📝 emoji (quiz icon)
                       Array.from(document.querySelectorAll('h3')).find(el => el.textContent?.includes('📝'));
    
    if (quizElement) {
      quizElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start',
        inline: 'nearest'
      });
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-6 pb-3 bg-transparent"> 
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            {title}
          </h1>
          {description && (
            <p className="text-neutral-600 dark:text-neutral-400 mb-3">
              {description}
            </p>
          )}
          <div className="flex items-center gap-3 text-sm">
            {duration && (
              <>
                <span className="text-neutral-600 dark:text-neutral-400">{duration} read</span>
                <span className="text-neutral-400">•</span>
              </>
            )}
            {level && (
              <span className={`px-2 py-1 rounded font-medium text-xs ${getLevelStyles(level)}`}>
                {level}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 ml-4">
          {/* Completion Status */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-6 h-6 rounded-full ${
              completed 
                ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                : 'bg-neutral-200 dark:bg-neutral-700'
            }`}>
              {completed ? (
                <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <div className="w-1.5 h-1.5 bg-neutral-400 dark:bg-neutral-500 rounded-full"></div>
              )}
            </div>
            <span className={`text-xs font-medium ${
              completed 
                ? 'text-emerald-600 dark:text-emerald-400' 
                : 'text-neutral-500 dark:text-neutral-400'
            }`}>
              {completed ? 'Completed' : 'Not Started'}
            </span>
          </div>

          {/* Quiz Score */}
          {hasQuiz && (
            <div className="flex items-center gap-2 sm:pl-3 sm:border-l sm:border-neutral-200 sm:dark:border-neutral-700">
              <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {bestScore !== null && !quizLoading ? (
                <button
                  onClick={scrollToQuiz}
                  className={`text-xs font-medium hover:underline cursor-pointer ${getQuizScoreColor(bestScore)}`}
                >
                  Quiz: {bestScore}%
                </button>
              ) : quizLoading ? (
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  Loading...
                </span>
              ) : (
                <button
                  onClick={scrollToQuiz}
                  className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer"
                >
                  Quiz Available
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}