'use client';

import Link from 'next/link';
import { generateCaseStudiesData } from '@/lib/nav-generators';
import { useProgressTracking } from '@/hooks/useProgressTracking';

export default function CaseStudiesPage() {
  const caseStudies = generateCaseStudiesData();
  const { progress, loading, isCompleted, getCompletionPercentage, getCompletedCount } = useProgressTracking('case-studies');

  const totalUsers = caseStudies.reduce((acc, study) => {
    const users = parseInt(study.scale.replace(/[^\d]/g, ''));
    const multiplier = study.scale.includes('B') ? 1000 : 1;
    return acc + (users * multiplier);
  }, 0);

  const completedCount = getCompletedCount();
  const totalLessons = caseStudies.length;
  const progressPercentage = getCompletionPercentage(totalLessons);

  return (
    <main className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
          Real-world Case Studies
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-6">
          Learn from the world's most successful tech companies. Dive deep into their architectures,
          challenges, and the engineering decisions that power billions of users.
        </p>

        {/* Progress Bar */}
        {!loading && completedCount > 0 && (
          <div className="mb-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Your Progress</h2>
              <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{progressPercentage}% Complete</span>
            </div>
            <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              {completedCount} of {totalLessons} case studies completed
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{caseStudies.length}</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">In-depth Studies</div>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalUsers}B+</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">Combined Users</div>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">Real</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">Production Systems</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        {caseStudies.map((study) => {
          const completed = isCompleted(study.slug);
          return (
            <Link
              key={study.slug}
              href={`/case-studies/${study.slug}` as any}
              className="group block"
            >
              <div className={`rounded-2xl border shadow-card hover:shadow-lg transition-shadow p-6 ${
                completed
                  ? 'border-green-300 dark:border-green-700 bg-green-50/30 dark:bg-green-900/10'
                  : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
              }`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {study.company}
                    </h2>
                    {completed && (
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    <span className={`text-xs px-2 py-1 rounded font-medium ${
                      study.level === 'Advanced' ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300' :
                      'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                    }`}>
                      {study.level}
                    </span>
                  </div>
                  <h3 className="text-lg font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    {study.title}
                  </h3>
                  <p className="text-neutral-600 dark:text-neutral-400 mb-4">
                    {study.description}
                  </p>
                </div>
                <div className="text-neutral-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors ml-4">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
              
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 p-3">
                  <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">SCALE</div>
                  <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{study.scale}</div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">{study.traffic}</div>
                </div>
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 p-3">
                  <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">CHALLENGE</div>
                  <div className="text-sm text-neutral-900 dark:text-neutral-100">{study.challenge}</div>
                </div>
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 p-3">
                  <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">INFRASTRUCTURE</div>
                  <div className="text-sm text-neutral-900 dark:text-neutral-100">{study.infrastructure}</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  {study.keyTech.slice(0, 4).map((tech: string) => (
                    <span 
                      key={tech}
                      className="text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded"
                    >
                      {tech}
                    </span>
                  ))}
                  {study.keyTech.length > 4 && (
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      +{study.keyTech.length - 4} more
                    </span>
                  )}
                </div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">
                  {study.readTime}
                </div>
              </div>
            </div>
          </Link>
          );
        })}
      </div>

      <div className="mt-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-6">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          Study Methodology
        </h3>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">
          Each case study includes architecture diagrams, scaling challenges, key design decisions, 
          lessons learned, and actionable takeaways you can apply to your own systems.
        </p>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <strong className="text-neutral-900 dark:text-neutral-100">Deep Dive:</strong>
            <p className="text-neutral-600 dark:text-neutral-400">Technical architecture and implementation details</p>
          </div>
          <div>
            <strong className="text-neutral-900 dark:text-neutral-100">Real Numbers:</strong>
            <p className="text-neutral-600 dark:text-neutral-400">Actual performance metrics and scale data</p>
          </div>
          <div>
            <strong className="text-neutral-900 dark:text-neutral-100">Lessons:</strong>
            <p className="text-neutral-600 dark:text-neutral-400">Key takeaways and design principles</p>
          </div>
        </div>
      </div>
    </main>
  );
}
