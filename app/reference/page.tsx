'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ReferenceLearningPath } from '@/components/reference/ReferenceLearningPath';
import { REFERENCE_CATEGORIES } from '@/lib/referenceConfig';

export default function ReferenceIndexPage() {
  const [activeTab, setActiveTab] = useState<'library' | 'progress'>('library');
  const categories = REFERENCE_CATEGORIES;

  const totalItems = categories.reduce((acc, cat) => acc + cat.items.length, 0);
  const newItems = categories.reduce((acc, cat) => acc + cat.items.filter(item => item.isNew).length, 0);

  return (
    <main className="space-y-8">
      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('library')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'library'
              ? 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700'
              : 'bg-neutral-50 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          📚 Reference Library
        </button>
        <button
          onClick={() => setActiveTab('progress')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'progress'
              ? 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700'
              : 'bg-neutral-50 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          🎯 Learning Progress
        </button>
      </div>

      {activeTab === 'library' && (
        <>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{totalItems}</div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">Quick References</div>
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{newItems}</div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">New Comparisons</div>
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{categories.length}</div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">Categories</div>
        </div>
      </div>
        <div className="space-y-8">
        {categories.map(category => (
          <div key={category.name} className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">{category.icon}</span>
              <div>
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  {category.name}
                </h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">{category.description}</p>
              </div>
            </div>
            
            <div className="grid gap-3 md:grid-cols-2">
              {category.items.map(item => (
                <Link 
                  key={item.href} 
                  href={item.href as any} 
                  className="relative rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 p-4 hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all group"
                >
                  {item.isNew && (
                    <span className="absolute top-2 right-2 px-2 py-1 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded">
                      New
                    </span>
                  )}
                  <div className="text-base font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-1">
                    {item.title}
                  </div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">
                    {item.desc}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
        </div>

        {/* Tools Section */}
        <div className="mt-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-gradient-to-r from-indigo-50 to-emerald-50 dark:from-indigo-900/20 dark:to-emerald-900/20 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
            Looking for Interactive Tools?
          </h3>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">
            Use our interactive calculators and simulators to model system behavior and validate your designs.
          </p>
          <div className="flex gap-3">
            <Link 
              href="/tools"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Explore Tools
            </Link>
            <Link 
              href="/sandbox"
              className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors font-medium"
            >
              Try Sandbox
            </Link>
          </div>
        </div>
        </>
      )}

      {activeTab === 'progress' && (
        <ReferenceLearningPath />
      )}
    </main>
  );
}


