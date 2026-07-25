'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import {
  BookOpen,
  TrendingUp,
  Award,
  AlertCircle,
  Loader2,
  BarChart3,
  Highlighter,
  StickyNote,
  MessageSquare,
  ChevronLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import AdminNav from '@/components/admin/AdminNav';

interface ContentStats {
  totalLessonsCompleted: number;
  avgCompletionRate: number;
  totalHighlights: number;
  totalNotes: number;
  popularLessons: Array<{
    lesson: string;
    completions: number;
  }>;
  avgQuizScore: number;
  totalQuizAttempts: number;
}

export default function AdminContentPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<ContentStats>({
    totalLessonsCompleted: 0,
    avgCompletionRate: 0,
    totalHighlights: 0,
    totalNotes: 0,
    popularLessons: [],
    avgQuizScore: 0,
    totalQuizAttempts: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      if (!user || !isAdmin) {
        router.push('/');
      } else {
        loadContentStats();
      }
    }
  }, [user, isAdmin, authLoading, router]);

  const loadContentStats = async () => {
    try {
      const [
        usersSnapshot,
        progressSnapshot
      ] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'progress'))
      ]);

      // Calculate learning progress stats
      let totalLessonsCompleted = 0;
      let completionRateSum = 0;
      let usersWithProgress = 0;
      const lessonCompletions = new Map<string, number>();
      
      const progressByUser = new Map();
      progressSnapshot.docs.forEach(doc => {
        const progressData = doc.data();
        const userId = doc.id;
        
        if (!progressByUser.has(userId)) {
          progressByUser.set(userId, { completed: 0, total: 0 });
        }
        
        const userProgress = progressByUser.get(userId);
        userProgress.total++;
        
        if (progressData.completed) {
          totalLessonsCompleted++;
          userProgress.completed++;
          
          // Track lesson popularity
          const lessonKey = `${progressData.section}/${progressData.item}`;
          lessonCompletions.set(lessonKey, (lessonCompletions.get(lessonKey) || 0) + 1);
        }
      });

      // Calculate average completion rate
      progressByUser.forEach((progress) => {
        if (progress.total > 0) {
          completionRateSum += (progress.completed / progress.total) * 100;
          usersWithProgress++;
        }
      });
      
      const avgCompletionRate = usersWithProgress > 0 ? 
        Math.round(completionRateSum / usersWithProgress) : 0;

      // Get most popular lessons
      const popularLessons = Array.from(lessonCompletions.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([lesson, completions]) => ({ lesson, completions }));

      // Calculate highlights and notes from annotations collection
      const annotationsSnapshot = await getDocs(collection(db, 'annotations'));
      let totalHighlights = 0;
      let totalNotes = 0;
      annotationsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (Array.isArray(data.highlights)) totalHighlights += data.highlights.length;
        if (Array.isArray(data.notes)) totalNotes += data.notes.length;
      });

      // Calculate quiz stats from user documents
      let totalQuizAttempts = 0;
      let totalScore = 0;
      let validAttempts = 0;

      usersSnapshot.docs.forEach(doc => {
        const userData = doc.data();
        if (userData.stats && userData.stats.totalQuizzesTaken && userData.stats.averageQuizScore) {
          totalQuizAttempts += userData.stats.totalQuizzesTaken;
          totalScore += userData.stats.averageQuizScore * userData.stats.totalQuizzesTaken;
          validAttempts += userData.stats.totalQuizzesTaken;
        }
      });

      const avgQuizScore = validAttempts > 0 ? Math.round(totalScore / validAttempts) : 0;

      setStats({
        totalLessonsCompleted,
        avgCompletionRate,
        totalHighlights,
        totalNotes,
        popularLessons,
        avgQuizScore,
        totalQuizAttempts
      });
      setLoading(false);
    } catch (error) {
      console.error('Error loading content stats:', error);
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

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <AdminNav />
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

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Content Analytics</h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Track content performance and user engagement
          </p>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg">
                <BookOpen className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-1">{stats.totalLessonsCompleted}</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Lessons Completed</p>
            <p className="text-xs text-neutral-500 mt-1">{stats.avgCompletionRate}% avg completion rate</p>
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                <Award className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-1">{stats.avgQuizScore}%</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Avg Quiz Score</p>
            <p className="text-xs text-neutral-500 mt-1">{stats.totalQuizAttempts} total attempts</p>
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                <Highlighter className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-1">{stats.totalHighlights}</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">User Highlights</p>
            <p className="text-xs text-neutral-500 mt-1">Across all content</p>
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-pink-100 dark:bg-pink-900/20 rounded-lg">
                <StickyNote className="w-6 h-6 text-pink-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-1">{stats.totalNotes}</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">User Notes</p>
            <p className="text-xs text-neutral-500 mt-1">Personal annotations</p>
          </div>
        </div>

        {/* Popular Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                Most Popular Lessons
              </h2>
            </div>
            
            <div className="space-y-4">
              {stats.popularLessons.length > 0 ? (
                stats.popularLessons.map((item, index) => (
                  <div key={item.lesson} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 rounded-full flex items-center justify-center text-sm font-medium mr-3">
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.lesson.split('/').pop()?.replace(/-/g, ' ')}</p>
                        <p className="text-xs text-neutral-500">{item.lesson.split('/')[0]}</p>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                      {item.completions} completions
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">No completion data yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Content Insights */}
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Content Insights
              </h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Lesson Completion Rate</span>
                  <span className="text-sm text-neutral-500">{stats.avgCompletionRate}%</span>
                </div>
                <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                  <div 
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${stats.avgCompletionRate}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Quiz Performance</span>
                  <span className="text-sm text-neutral-500">{stats.avgQuizScore}%</span>
                </div>
                <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                  <div 
                    className="bg-amber-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${stats.avgQuizScore}%` }}
                  ></div>
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{stats.totalHighlights}</div>
                    <div className="text-xs text-neutral-500">Total Highlights</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-pink-600">{stats.totalNotes}</div>
                    <div className="text-xs text-neutral-500">Total Notes</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Items */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Content Recommendations</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg">
              <MessageSquare className="w-6 h-6 text-blue-600 mb-2" />
              <h3 className="font-medium mb-1">Low Completion Rate</h3>
              <p className="text-sm text-neutral-500">
                Consider simplifying lessons with completion rates below 50%
              </p>
            </div>
            
            <div className="p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600 mb-2" />
              <h3 className="font-medium mb-1">Popular Content</h3>
              <p className="text-sm text-neutral-500">
                Create more content similar to top-performing lessons
              </p>
            </div>
            
            <div className="p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg">
              <Award className="w-6 h-6 text-purple-600 mb-2" />
              <h3 className="font-medium mb-1">Quiz Optimization</h3>
              <p className="text-sm text-neutral-500">
                Review quizzes with low average scores for clarity
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}