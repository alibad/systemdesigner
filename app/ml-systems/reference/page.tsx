'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ML_REFERENCE } from '@/components/ml-systems/ml-nav-config';

export default function MLReferencePage() {
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = ['all', ...new Set(ML_REFERENCE.map(item => item.category))];
  
  const filteredItems = selectedCategory === 'all' 
    ? ML_REFERENCE 
    : ML_REFERENCE.filter(item => item.category === selectedCategory);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300';
      case 'intermediate': return 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300';
      case 'advanced': return 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300';
      default: return 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return '✅';
      case 'coming-soon': return '🔜';
      case 'in-progress': return '🚧';
      default: return '📚';
    }
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      'Performance': '⚡',
      'Architecture': '🏗️',
      'Tools': '🔧',
      'Economics': '💰'
    };
    return icons[category] || '📚';
  };

  return (
    <main className="max-w-[1200px] mx-auto px-4 md:px-6 py-8">
      <article className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
            🤖 ML Systems Reference
          </h1>
          <p className="text-lg text-neutral-600 dark:text-neutral-400">
            Quick decision guides for ML infrastructure choices. Get the right answer fast for production ML systems.
          </p>
        </div>

        {/* Introduction */}
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-6">
          <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
            <strong>ML Systems Reference</strong> provides quick decision frameworks for the unique challenges of 
            production machine learning. Unlike traditional system design, ML systems involve probabilistic behavior, 
            data dependencies, and specialized infrastructure requirements.
          </p>
          <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
            Each reference page includes decision matrices, performance benchmarks, cost analyses, and 
            real-world examples to help you choose the right architecture for your ML use case.
          </p>
        </div>

        {/* Category Filter */}
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-6">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Browse by Category</h2>
          
          <div className="flex flex-wrap gap-2 mb-6">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedCategory === category
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-2 border-indigo-200 dark:border-indigo-800'
                    : 'bg-neutral-50 dark:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300 border-2 border-transparent hover:border-neutral-200 dark:hover:border-neutral-700'
                }`}
              >
                {category === 'all' ? 'All References' : `${getCategoryIcon(category)} ${category}`}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map(item => (
              <div
                key={item.id}
                className={`rounded-xl border transition-all ${
                  item.status === 'coming-soon'
                    ? 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/30 opacity-75'
                    : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50 hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-md'
                }`}
              >
                {item.status === 'coming-soon' ? (
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="text-xl">{getStatusIcon(item.status)}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium text-neutral-500 dark:text-neutral-400">
                            {item.title}
                          </h3>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${getDifficultyColor(item.difficulty)}`}>
                            {item.difficulty}
                          </span>
                        </div>
                        <p className="text-sm text-neutral-400 dark:text-neutral-500 mb-2">
                          {item.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-neutral-400 dark:text-neutral-500">
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {item.estimatedTime}
                          </span>
                          <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs rounded">
                            Coming Soon
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Link
                    href={`/ml-systems/reference/${item.slug}` as any}
                    className="block p-4 group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-xl">{getStatusIcon(item.status)}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium text-neutral-900 dark:text-neutral-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {item.title}
                          </h3>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${getDifficultyColor(item.difficulty)}`}>
                            {item.difficulty}
                          </span>
                        </div>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                          {item.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {item.estimatedTime}
                          </span>
                          <span className="text-neutral-400 dark:text-neutral-500">
                            {getCategoryIcon(item.category)} {item.category}
                          </span>
                        </div>
                      </div>
                      <div className="text-neutral-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* What Makes ML Reference Different */}
        <div className="rounded-2xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/10 p-6">
          <h2 className="text-2xl font-semibold text-purple-900 dark:text-purple-100 mb-4">
            🎯 What Makes ML Reference Different
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-3">Traditional Systems</h3>
              <div className="space-y-2 text-purple-700 dark:text-purple-300 text-sm">
                <div>• Fixed performance characteristics</div>
                <div>• Deterministic behavior patterns</div>
                <div>• Well-established best practices</div>
                <div>• Linear cost scaling</div>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-3">ML Systems</h3>
              <div className="space-y-2 text-purple-700 dark:text-purple-300 text-sm">
                <div>• Performance depends on data distribution</div>
                <div>• Probabilistic outputs and drift</div>
                <div>• Rapidly evolving tooling landscape</div>
                <div>• Exponential complexity with scale</div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Start Guide */}
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 p-6">
          <h2 className="text-2xl font-semibold text-emerald-900 dark:text-emerald-100 mb-4">🚀 Quick Start Guide</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-xl bg-white dark:bg-neutral-900 border border-emerald-200 dark:border-emerald-800">
              <div className="text-3xl mb-2">⚡</div>
              <div className="font-bold text-emerald-900 dark:text-emerald-100">Performance First</div>
              <div className="text-sm text-emerald-700 dark:text-emerald-300 mt-2">
                Start with ML Latencies and Data Sizes to understand performance constraints
              </div>
            </div>
            
            <div className="text-center p-4 rounded-xl bg-white dark:bg-neutral-900 border border-emerald-200 dark:border-emerald-800">
              <div className="text-3xl mb-2">🏗️</div>
              <div className="font-bold text-emerald-900 dark:text-emerald-100">Architecture Patterns</div>
              <div className="text-sm text-emerald-700 dark:text-emerald-300 mt-2">
                Learn Feature Store and Model Serving patterns for your use case
              </div>
            </div>
            
            <div className="text-center p-4 rounded-xl bg-white dark:bg-neutral-900 border border-emerald-200 dark:border-emerald-800">
              <div className="text-3xl mb-2">💰</div>
              <div className="font-bold text-emerald-900 dark:text-emerald-100">Cost Optimization</div>
              <div className="text-sm text-emerald-700 dark:text-emerald-300 mt-2">
                Use Cost Estimation and Tool Comparison for budget planning
              </div>
            </div>
          </div>
        </div>

        {/* Learning Path Integration */}
        <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 p-6">
          <h2 className="text-2xl font-semibold text-blue-900 dark:text-blue-100 mb-4">🎓 Continue Learning</h2>
          <p className="text-blue-700 dark:text-blue-300 mb-4">
            These reference guides complement the ML Systems fundamentals. For comprehensive learning:
          </p>
          <div className="flex flex-wrap gap-3">
            <Link 
              href="/ml-systems"
              className="px-4 py-2 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors"
            >
              📚 ML Fundamentals
            </Link>
            <Link 
              href="/ml-systems/technology"
              className="px-4 py-2 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors"
            >
              ⚙️ ML Technology Deep Dives
            </Link>
            <Link 
              href={"/ml-systems/practice" as any}
              className="px-4 py-2 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors"
            >
              🎯 ML Practice Problems
            </Link>
          </div>
        </div>
      </article>
    </main>
  );
}