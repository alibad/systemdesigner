'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { getQuizProgressStats } from '@/lib/firestore-middleware';
import {
  BarChart3,
  TrendingUp,
  Users,
  Target,
  Clock,
  Star,
  ChevronLeft,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuizStats {
  totalQuizAttempts: number;
  quizzesByCategory: Record<string, number>;
  averageScores: Record<string, number>;
  recentQuizzes: Array<{
    lessonSlug: string;
    category: string;
    score: number;
    percentage: number;
    completedAt: Date;
    userEmail?: string;
  }>;
  topPerformingQuizzes: Array<{
    lessonSlug: string;
    category: string;
    averageScore: number;
    attemptCount: number;
  }>;
}

export default function QuizAnalyticsPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<QuizStats>({
    totalQuizAttempts: 0,
    quizzesByCategory: {},
    averageScores: {},
    recentQuizzes: [],
    topPerformingQuizzes: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user || !isAdmin) {
        router.push('/');
      } else {
        loadQuizStats();
      }
    }
  }, [user, isAdmin, authLoading, router]);

  const loadQuizStats = async () => {
    try {
      setLoading(true);
      const quizStats = await getQuizProgressStats();
      setStats(quizStats);
      setError(null);
    } catch (err) {
      console.error('Error loading quiz stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to load quiz analytics');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-500" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-neutral-500 mb-4">You don't have permission to view this page.</p>
          <Button onClick={() => router.push('/')}>Return Home</Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Error Loading Data</h1>
            <p className="text-neutral-500 mb-4">{error}</p>
            <Button onClick={loadQuizStats}>Try Again</Button>
          </div>
        </div>
      </div>
    );
  }

  const categoryColors: Record<string, string> = {
    fundamentals: 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    genai: 'bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
    'ml-systems': 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    technology: 'bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
    'case-studies': 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
    practice: 'bg-pink-100 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400',
    reference: 'bg-gray-100 text-gray-600 dark:bg-gray-900/20 dark:text-gray-400',
    tools: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400',
    unknown: 'bg-gray-100 text-gray-600 dark:bg-gray-900/20 dark:text-gray-400'
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Back button */}
        <div className="mb-6">
          <Link
            href="/admin"
            className="inline-flex items-center text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Dashboard
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <BarChart3 className="w-8 h-8" />
            Quiz Analytics
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Comprehensive analytics and insights into quiz performance and engagement.
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold">Total Quiz Attempts</h3>
            </div>
            <p className="text-2xl font-bold">{stats.totalQuizAttempts.toLocaleString()}</p>
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold">Average Score</h3>
            </div>
            <p className="text-2xl font-bold">
              {Object.keys(stats.averageScores).length > 0
                ? Math.round(
                    Object.values(stats.averageScores).reduce((sum, score) => sum + score, 0) /
                    Object.values(stats.averageScores).length
                  )
                : 0}%
            </p>
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold">Categories Active</h3>
            </div>
            <p className="text-2xl font-bold">{Object.keys(stats.quizzesByCategory).length}</p>
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                <Star className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="font-semibold">Top Performers</h3>
            </div>
            <p className="text-2xl font-bold">{stats.topPerformingQuizzes.length}</p>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
            <h2 className="text-xl font-semibold mb-4">Quiz Attempts by Category</h2>
            <div className="space-y-3">
              {Object.entries(stats.quizzesByCategory).map(([category, count]) => (
                <div key={category} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${categoryColors[category] || categoryColors.unknown}`}>
                      {category}
                    </span>
                  </div>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
              {Object.keys(stats.quizzesByCategory).length === 0 && (
                <p className="text-neutral-500 text-center py-4">No quiz data available yet</p>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
            <h2 className="text-xl font-semibold mb-4">Average Scores by Category</h2>
            <div className="space-y-3">
              {Object.entries(stats.averageScores).map(([category, score]) => (
                <div key={category} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${categoryColors[category] || categoryColors.unknown}`}>
                      {category}
                    </span>
                  </div>
                  <span className="font-semibold">{score}%</span>
                </div>
              ))}
              {Object.keys(stats.averageScores).length === 0 && (
                <p className="text-neutral-500 text-center py-4">No score data available yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Top Performing Quizzes */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Top Performing Quizzes</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800">
                  <th className="text-left py-3 px-4">Quiz</th>
                  <th className="text-left py-3 px-4">Category</th>
                  <th className="text-left py-3 px-4">Average Score</th>
                  <th className="text-left py-3 px-4">Attempts</th>
                </tr>
              </thead>
              <tbody>
                {stats.topPerformingQuizzes.map((quiz, index) => (
                  <tr key={quiz.lessonSlug} className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="py-3 px-4">
                      <div className="font-medium">{quiz.lessonSlug}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${categoryColors[quiz.category] || categoryColors.unknown}`}>
                        {quiz.category}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-green-600">{quiz.averageScore}%</span>
                    </td>
                    <td className="py-3 px-4">{quiz.attemptCount}</td>
                  </tr>
                ))}
                {stats.topPerformingQuizzes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-neutral-500">
                      No quiz performance data available yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Quiz Attempts */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Quiz Attempts</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800">
                  <th className="text-left py-3 px-4">Quiz</th>
                  <th className="text-left py-3 px-4">Category</th>
                  <th className="text-left py-3 px-4">Score</th>
                  <th className="text-left py-3 px-4">Completed</th>
                  <th className="text-left py-3 px-4">User</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentQuizzes.map((quiz, index) => (
                  <tr key={`${quiz.lessonSlug}-${index}`} className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="py-3 px-4">
                      <div className="font-medium">{quiz.lessonSlug}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${categoryColors[quiz.category] || categoryColors.unknown}`}>
                        {quiz.category}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-semibold ${quiz.percentage >= 80 ? 'text-green-600' : quiz.percentage >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {quiz.percentage}%
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 text-sm text-neutral-500">
                        <Clock className="w-4 h-4" />
                        {quiz.completedAt.toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-neutral-500">
                      {quiz.userEmail}
                    </td>
                  </tr>
                ))}
                {stats.recentQuizzes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-neutral-500">
                      No recent quiz attempts
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}