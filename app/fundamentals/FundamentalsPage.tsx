'use client';

import Link from 'next/link';
import { useProgressTracking } from '@/hooks/useProgressTracking';
import { generateFundamentalsLearningPaths } from '@/lib/nav-generators';

export default function FundamentalsPage() {
  const { progress, loading, error, isCompleted, getCompletionPercentage, getCompletedCount } = useProgressTracking('fundamentals');
  
  // Generate learning paths from content registry (single source of truth)
  const learningPaths = generateFundamentalsLearningPaths();

  const totalLessons = learningPaths.reduce((acc, path) => acc + path.lessons.length, 0);
  const totalDuration = learningPaths.reduce((acc, path) => 
    acc + path.lessons.reduce((pathAcc, lesson) => pathAcc + parseInt(lesson.duration), 0), 0
  );
  
  const completedLessons = getCompletedCount();
  const progressPercentage = getCompletionPercentage(totalLessons);

  return (
    <main className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
          System Design Fundamentals
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-6">
          Master the core concepts of system design through structured, hands-on learning paths.
        </p>
        
        {/* Learning Progress Overview */}
        <div className="mb-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Your Learning Journey</h2>
            {!loading && progressPercentage > 0 && (
              <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{progressPercentage}% Complete</span>
            )}
          </div>
          
          {!loading && progressPercentage > 0 && (
            <div className="mb-6">
              <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{loading ? '...' : completedLessons}</div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-neutral-600 dark:text-neutral-400">{totalLessons}</div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">Total Lessons</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalDuration} min</div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">Total Duration</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {!loading && progressPercentage > 0 ? Math.round((totalDuration * progressPercentage) / 100) : 0} min
              </div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">Time Learned</div>
            </div>
          </div>
        </div>
        
        
        {!loading && progressPercentage === 100 && (
          <div className="mb-6 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-6">
            <div className="flex items-center gap-3 mb-3">
              <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-100">🎉 Fundamentals Complete!</h3>
            </div>
            <p className="text-emerald-700 dark:text-emerald-300 mb-4">
              Congratulations! You've mastered the fundamentals of system design. Ready for the next challenge?
            </p>
            <div className="flex gap-3">
              <Link 
                href="/case-studies"
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
              >
                Explore Case Studies
              </Link>
              <Link 
                href="/practice"
                className="px-4 py-2 border border-emerald-300 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-colors font-medium"
              >
                Start Practicing
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6">
        {learningPaths.map((path, pathIndex) => {
          const pathCompletedCount = path.lessons.filter(lesson => isCompleted(lesson.slug)).length;
          const pathProgressPercentage = Math.round((pathCompletedCount / path.lessons.length) * 100);
          const isPathComplete = pathProgressPercentage === 100;
          
          return (
            <div key={path.title} className={`rounded-2xl border shadow-card p-6 ${
              isPathComplete 
                ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10' 
                : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
            }`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className={`text-xl font-semibold ${
                      isPathComplete 
                        ? 'text-emerald-900 dark:text-emerald-100' 
                        : 'text-neutral-900 dark:text-neutral-100'
                    }`}>
                      {pathIndex + 1}. {path.title}
                    </h2>
                    {isPathComplete && (
                      <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <p className={`${
                    isPathComplete 
                      ? 'text-emerald-700 dark:text-emerald-300' 
                      : 'text-neutral-600 dark:text-neutral-400'
                  }`}>
                    {path.description}
                  </p>
                </div>
                <div className="text-right ml-4">
                  <div className={`text-sm font-medium ${
                    isPathComplete 
                      ? 'text-emerald-900 dark:text-emerald-100' 
                      : 'text-neutral-900 dark:text-neutral-100'
                  }`}>
                    {path.lessons.length} lessons
                  </div>
                  <div className={`text-xs ${
                    isPathComplete 
                      ? 'text-emerald-600 dark:text-emerald-400' 
                      : 'text-neutral-500 dark:text-neutral-400'
                  }`}>
                    {path.lessons.reduce((acc, lesson) => acc + parseInt(lesson.duration), 0)} min total
                  </div>
                </div>
              </div>
              
              {!loading && pathProgressPercentage > 0 && !isPathComplete && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-neutral-600 dark:text-neutral-400">Progress</span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">{pathCompletedCount}/{path.lessons.length} completed</span>
                  </div>
                  <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${pathProgressPercentage}%` }}
                    ></div>
                  </div>
                </div>
              )}
            
            <div className="grid gap-3">
              {path.lessons.map((lesson, lessonIndex) => {
                const completed = isCompleted(lesson.slug);
                return (
                  <Link
                    key={lesson.slug}
                    href={`/fundamentals/${lesson.slug}` as any}
                    className="flex items-center justify-between p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        completed 
                          ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                          : 'bg-indigo-100 dark:bg-indigo-900/30'
                      }`}>
                        {completed ? (
                          <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                            {lessonIndex + 1}
                          </span>
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium text-neutral-900 dark:text-neutral-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {lesson.title}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                          <span>{lesson.duration}</span>
                          <span>•</span>
                          <span className={`px-2 py-1 rounded font-medium ${
                            lesson.level === 'Beginner' ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' :
                            lesson.level === 'Intermediate' ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300' :
                            'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                          }`}>
                            {lesson.level}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-neutral-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
          );
        })}
      </div>

      <div className="mt-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-6">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          Ready for Advanced Topics?
        </h3>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">
          Once you've completed the fundamentals, dive deeper into real-world system design patterns and case studies.
        </p>
        <div className="flex gap-3">
          <Link 
            href="/reference"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            Explore Reference
          </Link>
          <Link 
            href="/case-studies"
            className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors font-medium"
          >
            View Case Studies
          </Link>
        </div>
      </div>
    </main>
  );
}
