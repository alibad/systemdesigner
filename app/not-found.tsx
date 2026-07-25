'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NotFound() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center">
        {/* 404 Icon */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30">
            <svg
              className="w-12 h-12 text-indigo-600 dark:text-indigo-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        {/* Error Message */}
        <h1 className="text-6xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
          404
        </h1>
        <h2 className="text-2xl font-semibold text-neutral-800 dark:text-neutral-200 mb-4">
          Page Not Found
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-8 max-w-md mx-auto">
          The page you're looking for doesn't exist or may have been moved.
        </p>

        {/* Navigation Options */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Go Back
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition shadow-lg hover:shadow-xl"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Go to Home
          </Link>
        </div>

        {/* Quick Links */}
        <div className="border-t border-neutral-200 dark:border-neutral-800 pt-8">
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            Or explore these sections:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link
              href="/fundamentals"
              className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition group"
            >
              <div className="text-2xl mb-2">📚</div>
              <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                Fundamentals
              </div>
            </Link>
            <Link
              href="/genai"
              className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition group"
            >
              <div className="text-2xl mb-2">🤖</div>
              <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                GenAI
              </div>
            </Link>
            <Link
              href="/ml-systems"
              className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-green-300 dark:hover:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 transition group"
            >
              <div className="text-2xl mb-2">🧠</div>
              <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 group-hover:text-green-600 dark:group-hover:text-green-400">
                ML Systems
              </div>
            </Link>
            <Link
              href="/learn/my-plans"
              className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition group"
            >
              <div className="text-2xl mb-2">🎯</div>
              <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                My Plans
              </div>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
