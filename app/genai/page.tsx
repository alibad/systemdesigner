'use client';

import Link from 'next/link';
import { useProgressTracking } from '@/hooks/useProgressTracking';
import { generateGenAILearningPaths } from '@/lib/nav-generators';

interface ExternalLink {
  title: string;
  path: string;
  duration: string;
  level: string;
}

export default function GenAISystemsPage() {
  const { progress, loading, error, isCompleted, getCompletionPercentage, getCompletedCount } = useProgressTracking('genai');
  
  // Generate learning paths from content registry (single source of truth)
  const learningPaths = generateGenAILearningPaths();

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
          🤖 Generative AI Systems
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-6">
          Build modern AI applications with LLMs, RAG, and intelligent agents. Master the technologies powering ChatGPT, Claude, and production AI systems.
        </p>
        
        {/* Learning Progress Overview */}
        <div className="mb-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Your AI Journey</h2>
            {!loading && progressPercentage > 0 && (
              <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{progressPercentage}% Complete</span>
            )}
          </div>
          
          {!loading && progressPercentage > 0 && (
            <div className="mb-6">
              <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{loading ? '...' : completedLessons}</div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-neutral-600 dark:text-neutral-400">{totalLessons}</div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">Total Lessons</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">{totalDuration} min</div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">Total Duration</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {!loading && progressPercentage > 0 ? Math.round((totalDuration * progressPercentage) / 100) : 0} min
              </div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">Time Learned</div>
            </div>
          </div>
        </div>
        
        {/* Why GenAI First? */}
        <div className="mb-6 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 p-6">
          <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-3">
            🚀 Why Start with Generative AI?
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-purple-600 dark:text-purple-400">✓</span>
                <span className="text-purple-700 dark:text-purple-300">
                  <strong>Immediate Impact:</strong> Build working AI apps from day one
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-purple-600 dark:text-purple-400">✓</span>
                <span className="text-purple-700 dark:text-purple-300">
                  <strong>Market Demand:</strong> 90% of AI jobs involve LLMs and GenAI
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-purple-600 dark:text-purple-400">✓</span>
                <span className="text-purple-700 dark:text-purple-300">
                  <strong>Lower Barrier:</strong> No PhD required - just engineering skills
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-purple-600 dark:text-purple-400">✓</span>
                <span className="text-purple-700 dark:text-purple-300">
                  <strong>Future-Ready:</strong> Foundation for AGI and next-gen AI
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {!loading && progressPercentage === 100 && (
          <div className="mb-6 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-6">
            <div className="flex items-center gap-3 mb-3">
              <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-100">🎉 GenAI Master!</h3>
            </div>
            <p className="text-emerald-700 dark:text-emerald-300 mb-4">
              Congratulations! You've mastered modern AI systems. Ready to build the next generation of AI applications?
            </p>
            <div className="flex gap-3">
              <Link 
                href="/ml-systems"
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
              >
                Learn Traditional ML
              </Link>
              <Link 
                href="/projects"
                className="px-4 py-2 border border-emerald-300 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-colors font-medium"
              >
                Build AI Projects
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
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300" 
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
                    href={`/genai/${lesson.slug}` as any}
                    className="flex items-center justify-between p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        completed 
                          ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                          : 'bg-purple-100 dark:bg-purple-900/30'
                      }`}>
                        {completed ? (
                          <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                            {lessonIndex + 1}
                          </span>
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium text-neutral-900 dark:text-neutral-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
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
                    <div className="text-neutral-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                );
              })}
              
              {/* External Links */}
              {'externalLinks' in path && path.externalLinks && path.externalLinks.map((link: ExternalLink, linkIndex: number) => (
                <Link
                  key={`external-${linkIndex}`}
                  href={link.path as any}
                  className="flex items-center justify-between p-4 rounded-lg border-2 border-dashed border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium text-blue-900 dark:text-blue-100 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                        {link.title}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                        <span>{link.duration}</span>
                        <span>•</span>
                        <span className="px-2 py-1 rounded font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                          {link.level}
                        </span>
                        <span>•</span>
                        <span className="italic">Technology Section</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-blue-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>
          );
        })}
      </div>

      <div className="mt-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-6">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          Continue Your AI Learning
        </h3>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">
          After mastering GenAI, explore traditional ML infrastructure for complete AI engineering expertise.
        </p>
        <div className="flex gap-3">
          <Link 
            href="/ml-systems"
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            Traditional ML Systems
          </Link>
          <Link 
            href="/practice"
            className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors font-medium"
          >
            Practice Problems
          </Link>
        </div>
      </div>
    </main>
  );
}