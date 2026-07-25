'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import FirestoreMiddleware from '@/lib/firestore-middleware';
import { UserDetailView } from '@/lib/firebase-types';
import { getContentById } from '@/lib/content-registry';
import { getUserConversationHistory, getUserActiveConversations, AIConversationHistory, AIConversation } from '@/lib/firebase';
import { getBaseUrl } from '@/lib/env-utils';
import {
  User,
  TrendingUp,
  BookOpen,
  Award,
  Calendar,
  Clock,
  Highlighter,
  StickyNote,
  MessageSquare,
  ChevronLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Target,
  Activity,
  FileText,
  Zap,
  ExternalLink,
  Sparkles,
  Trash2,
  Copy,
  Check,
  Monitor,
  Smartphone,
  Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import AdminNav from '@/components/admin/AdminNav';
import UserLevelDisplay from '@/components/admin/UserLevelDisplay';
import { ACHIEVEMENTS } from '@/lib/gamification';

interface PageProps {
  params: { userId: string };
}

export default function UserDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();
  const [userDetails, setUserDetails] = useState<UserDetailView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [showAchievementsModal, setShowAchievementsModal] = useState(false);
  const [showAllAchievements, setShowAllAchievements] = useState(false);
  const [conversations, setConversations] = useState<(AIConversation | AIConversationHistory)[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'learning' | 'activity' | 'conversations' | 'admin'>('overview');
  const [copiedUserId, setCopiedUserId] = useState(false);

  // Helper function to get achievement details
  const getAchievementDetails = (achievementId: string) => {
    return ACHIEVEMENTS.find(a => a.id === achievementId);
  };

  // Get achievement rarity color
  const getRarityColor = (rarity: string) => {
    const colors = {
      common: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
      rare: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
      epic: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
      legendary: 'bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 text-amber-800 dark:text-amber-200'
    };
    return colors[rarity as keyof typeof colors] || colors.common;
  };

  // Get achievement type label
  const getAchievementTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'learning_streak': 'Streak',
      'lesson_completion': 'Progress',
      'quiz_mastery': 'Quiz',
      'content_explorer': 'Explorer',
      'community_contributor': 'Community',
      'milestone_achiever': 'Milestone',
      'time_dedication': 'Time',
      'learning_plan': 'Learning Plan'
    };
    return labels[type] || 'Achievement';
  };

  // Check if lesson exists in content registry
  const lessonExists = (lessonSlug: string) => {
    // Try exact match first
    if (getContentById(lessonSlug)) return true;

    // Try with common prefixes
    const prefixes = ['case-study-', 'practice-', 'reference-', 'tool-'];
    for (const prefix of prefixes) {
      if (getContentById(prefix + lessonSlug)) return true;
    }

    return false;
  };

  // Get lesson title from content registry
  const getLessonTitle = (lessonSlug: string) => {
    // Handle undefined or empty slug
    if (!lessonSlug) {
      return 'Unknown Lesson';
    }

    // Try exact match first
    let contentNode = getContentById(lessonSlug);
    if (contentNode) {
      return contentNode.title;
    }

    // Try with common prefixes
    const prefixes = ['case-study-', 'practice-', 'reference-', 'tool-'];
    for (const prefix of prefixes) {
      contentNode = getContentById(prefix + lessonSlug);
      if (contentNode) {
        return contentNode.title;
      }
    }

    // Fallback to formatted slug with duplicate word removal
    const words = lessonSlug.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    );

    // Remove duplicate consecutive words (case-insensitive)
    const deduplicatedWords = words.filter((word, index) => {
      if (index === 0) return true;
      return word.toLowerCase() !== words[index - 1].toLowerCase();
    });

    return deduplicatedWords.join(' ') + ' (Legacy)';
  };

  // Get lesson URL from content registry
  const getLessonUrl = (lessonSlug: string, category: string) => {
    // Try exact match first
    let contentNode = getContentById(lessonSlug);
    if (contentNode) {
      return contentNode.path;
    }

    // Try with common prefixes
    const prefixes = ['case-study-', 'practice-', 'reference-', 'tool-'];
    for (const prefix of prefixes) {
      contentNode = getContentById(prefix + lessonSlug);
      if (contentNode) {
        return contentNode.path;
      }
    }

    // Fallback to category-based URL construction
    const categoryPaths: Record<string, string> = {
      'fundamentals': '/fundamentals',
      'genai': '/genai',
      'ml-systems': '/ml-systems',
      'technology': '/technology',
      'case-studies': '/case-studies',
      'practice': '/practice',
      'reference': '/reference',
      'tools': '/tools'
    };

    const basePath = categoryPaths[category] || `/${category}`;
    return `${basePath}/${lessonSlug}`;
  };

  // Get a working image URL (same logic as UserMenu)
  const getWorkingImageUrl = (photoURL: string) => {
    const variants = [
      photoURL.replace(/=s\d+-c$/, '=s64-c'),
      photoURL.replace(/=s\d+-c$/, '=s96-c'),
      photoURL.replace(/=s\d+-c$/, ''),
      photoURL.split('=')[0]
    ];
    return variants[0];
  };

  const loadUserDetails = useCallback(async () => {
    try {
      setLoading(true);
      const details = await FirestoreMiddleware.getUserDetailView(params.userId);
      setUserDetails(details);
    } catch (error) {
      console.error('Failed to load user details:', error);
      setError('Failed to load user details');
    } finally {
      setLoading(false);
    }
  }, [params.userId]);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/' as any);
      return;
    }

    if (!authLoading && isAdmin) {
      setImageError(false); // Reset image error when loading new user
      loadUserDetails();
    }
  }, [authLoading, isAdmin, params.userId, router, loadUserDetails]);

  const loadConversations = async () => {
    try {
      setConversationsLoading(true);

      // Load both active and archived conversations
      // Try active first, but don't fail if index missing
      let activeConvos: AIConversation[] = [];
      let archivedConvos: AIConversationHistory[] = [];

      try {
        activeConvos = await getUserActiveConversations(params.userId);
        console.log('✅ Loaded active conversations:', activeConvos.length);
      } catch (activeError) {
        console.warn('⚠️ Could not load active conversations (may need Firestore index):', activeError);
      }

      try {
        archivedConvos = await getUserConversationHistory(params.userId);
        console.log('✅ Loaded archived conversations:', archivedConvos.length);
      } catch (archiveError) {
        console.error('❌ Failed to load archived conversations:', archiveError);
      }

      // Merge and sort by most recent activity
      const allConversations = [
        ...activeConvos.map(c => ({ ...c, isActive: true })),
        ...archivedConvos.map(c => ({ ...c, isActive: false }))
      ].sort((a, b) => {
        const aDate = 'updatedAt' in a ? a.updatedAt : a.archivedAt;
        const bDate = 'updatedAt' in b ? b.updatedAt : b.archivedAt;
        return bDate.getTime() - aDate.getTime();
      });

      console.log('📊 Total conversations:', allConversations.length);
      setConversations(allConversations);
    } catch (error) {
      console.error('❌ Fatal error loading conversations:', error);
    } finally {
      setConversationsLoading(false);
    }
  };

  const copyUserId = async () => {
    try {
      await navigator.clipboard.writeText(params.userId);
      setCopiedUserId(true);
      setTimeout(() => setCopiedUserId(false), 2000);
    } catch (error) {
      console.error('Failed to copy user ID:', error);
    }
  };

  const handleDeleteUser = async () => {
    try {
      setIsDeleting(true);

      // Delete the user document
      try {
        await FirestoreMiddleware.deleteDocument('users', params.userId);
      } catch (error: any) {
        throw new Error(`Failed to delete user profile: ${error.message || 'Permission denied'}`);
      }

      // Delete related documents (best effort - don't fail if they don't exist)
      try {
        await FirestoreMiddleware.deleteDocument('progress', params.userId);
      } catch (e) {
        console.log('No progress document to delete or permission denied');
      }

      try {
        await FirestoreMiddleware.deleteDocument('annotations', params.userId);
      } catch (e) {
        console.log('No annotations document to delete or permission denied');
      }

      // Note: Learning plans, feedback, conversations, and other collections
      // would need to be deleted via a backend Cloud Function for proper cleanup
      // For now, we only delete the main user document

      // Redirect back to users list
      router.push('/admin/users' as any);
    } catch (error: any) {
      console.error('Failed to delete user:', error);
      const errorMessage = error.message || 'Failed to delete user. You may not have permission to perform this action.';
      alert(errorMessage);
      setIsDeleting(false);
      setShowDeleteDialog(false);
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
          <Button onClick={() => router.push('/' as any)}>Return Home</Button>
        </div>
      </div>
    );
  }

  if (error || !userDetails) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Error</h1>
          <p className="text-neutral-500 mb-4">{error || 'User not found'}</p>
          <Button onClick={() => router.push('/admin/users' as any)}>Back to Users</Button>
        </div>
      </div>
    );
  }

  const { profile, progress, learningPlans: rawLearningPlans = [], annotations, feedbackHistory } = userDetails;

  // Transform learning plans to handle nested structure
  const learningPlans = rawLearningPlans.flatMap((doc: any) => {
    // If document has a 'plans' object with nested plans, extract them
    if (doc.plans && typeof doc.plans === 'object' && !doc.title) {
      return Object.values(doc.plans);
    }
    // Otherwise return the document as-is (new structure)
    return [doc];
  });

  // Debug: Log learning plans
  console.log('Learning Plans in admin (raw):', rawLearningPlans);
  console.log('Learning Plans in admin (transformed):', learningPlans);
  console.log('Learning Plans count:', learningPlans.length);
  if (learningPlans.length > 0) {
    console.log('First plan:', learningPlans[0]);
    console.log('First plan topics:', (learningPlans[0] as any).topics);
  }

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'Never';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Back button */}
        <div className="mb-6">
          <Link
            href="/admin/users"
            className="inline-flex items-center text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Users
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {profile.photoURL && !imageError ? (
                <Image
                  src={getWorkingImageUrl(profile.photoURL)}
                  alt={profile.displayName || 'User'}
                  width={64}
                  height={64}
                  className="w-16 h-16 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <User className="w-8 h-8 text-white" />
                </div>
              )}

              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  {profile.displayName || 'Anonymous User'}
                  {profile.isAdmin && (
                    <Badge className="bg-purple-100 text-purple-700">Admin</Badge>
                  )}
                </h1>
                <p className="text-neutral-600 dark:text-neutral-400">
                  {profile.email || 'No email'}
                </p>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="flex items-center gap-1 text-neutral-500">
                    <Calendar className="w-3 h-3" />
                    Joined {formatDate(profile.createdAt)}
                  </span>
                  <span className="flex items-center gap-1 text-neutral-500">
                    <Clock className="w-3 h-3" />
                    Last active {formatDate(profile.lastLoginAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs text-neutral-500">User ID:</span>
                  <code className="text-xs bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded font-mono text-neutral-700 dark:text-neutral-300">
                    {params.userId}
                  </code>
                  <button
                    onClick={copyUserId}
                    className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                    title="Copy User ID"
                  >
                    {copiedUserId ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3 text-neutral-500" />
                    )}
                  </button>
                  {copiedUserId && (
                    <span className="text-xs text-green-600 dark:text-green-400">
                      Copied!
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                className="flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete User
              </Button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 mb-6">
          <div className="flex border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-4 font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400'
                  : 'text-neutral-500 border-transparent hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Overview
              </div>
            </button>

            <button
              onClick={() => setActiveTab('learning')}
              className={`px-6 py-4 font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === 'learning'
                  ? 'text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400'
                  : 'text-neutral-500 border-transparent hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Learning
                {progress && <Badge variant="secondary" className="text-xs">{progress.lessons?.length || 0}</Badge>}
              </div>
            </button>

            <button
              onClick={() => setActiveTab('activity')}
              className={`px-6 py-4 font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === 'activity'
                  ? 'text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400'
                  : 'text-neutral-500 border-transparent hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Highlighter className="w-4 h-4" />
                Activity
                {annotations && <Badge variant="secondary" className="text-xs">
                  {(annotations.highlights?.length || 0) + (annotations.notes?.length || 0)}
                </Badge>}
              </div>
            </button>

            <button
              onClick={() => {
                setActiveTab('conversations');
                if (conversations.length === 0 && !conversationsLoading) {
                  loadConversations();
                }
              }}
              className={`px-6 py-4 font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === 'conversations'
                  ? 'text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400'
                  : 'text-neutral-500 border-transparent hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                AI Conversations
                {conversations.length > 0 && <Badge variant="secondary" className="text-xs">{conversations.length}</Badge>}
              </div>
            </button>

            <button
              onClick={() => setActiveTab('admin')}
              className={`px-6 py-4 font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === 'admin'
                  ? 'text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400'
                  : 'text-neutral-500 border-transparent hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Admin
                {feedbackHistory.length > 0 && <Badge variant="secondary" className="text-xs">{feedbackHistory.length}</Badge>}
              </div>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Stats */}
          <div className="space-y-6">
            {/* Gamification Stats */}
            {profile.stats ? (
              <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  Gamification
                </h2>

                {/* Level Display Component */}
                <div className="mb-4">
                  <UserLevelDisplay
                    level={profile.stats.level || 0}
                    currentXP={(profile.stats.totalXP || 0) % 1000}
                    requiredXP={1000}
                    variant="full"
                  />
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-400">Total XP</span>
                    <span className="font-bold">{profile.stats.totalXP || 0}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-400">Current Streak</span>
                    <span className="font-bold flex items-center gap-1">
                      {profile.stats.currentStreak || 0}
                      <span className="text-xs">🔥</span>
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-neutral-600 dark:text-neutral-400">Longest Streak</span>
                    <span className="font-bold">{profile.stats.longestStreak || 0} days</span>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex justify-between mb-3">
                      <span className="text-neutral-600 dark:text-neutral-400">Achievements</span>
                      <span className="font-bold">{profile.stats.unlockedAchievements?.length || 0}</span>
                    </div>

                    <div className="space-y-2">
                      {profile.stats.unlockedAchievements?.length > 0 ? (
                        profile.stats.unlockedAchievements.slice(0, 3).map(unlockedAchievement => {
                          const achievement = getAchievementDetails(unlockedAchievement.achievementId);
                          if (!achievement) {
                            return (
                              <div key={unlockedAchievement.achievementId} className="text-sm text-neutral-500 italic">
                                {unlockedAchievement.achievementId}
                              </div>
                            );
                          }
                          return (
                            <div
                              key={achievement.id}
                              className={`p-2 rounded-lg ${getRarityColor(achievement.rarity)} transition-all hover:scale-[1.02]`}
                            >
                              <div className="flex items-start gap-2">
                                <span className="text-xl" role="img" aria-label={achievement.title}>
                                  {achievement.icon}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="font-semibold text-sm truncate">
                                      {achievement.title}
                                    </p>
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1.5 py-0 h-4 capitalize"
                                    >
                                      {achievement.rarity}
                                    </Badge>
                                  </div>
                                  <p className="text-xs opacity-90 mt-0.5">
                                    {achievement.description}
                                  </p>
                                  <div className="flex items-center justify-between mt-1">
                                    <span className="text-[10px] opacity-75">
                                      {getAchievementTypeLabel(achievement.type)}
                                    </span>
                                    {achievement.reward?.xp && (
                                      <span className="text-[10px] font-medium">
                                        +{achievement.reward.xp} XP
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-neutral-500 italic">No achievements yet</p>
                      )}
                    </div>

                    {profile.stats.unlockedAchievements?.length > 3 && (
                      <button
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-2 w-full text-center"
                        onClick={() => setShowAchievementsModal(true)}
                      >
                        View {profile.stats.unlockedAchievements.length - 3} more achievements →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  Gamification
                </h2>
                <p className="text-sm text-neutral-500 italic">No gamification data yet</p>
              </div>
            )}

            {/* Learning Stats */}
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Learning Stats
              </h2>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-neutral-600 dark:text-neutral-400">Lessons Completed</span>
                  <span className="font-bold">{profile.stats?.totalLessonsCompleted || 0}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-neutral-600 dark:text-neutral-400">Quizzes Taken</span>
                  <span className="font-bold">{profile.stats?.totalQuizzesTaken || 0}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-neutral-600 dark:text-neutral-400">Average Quiz Score</span>
                  <span className="font-bold">{Math.round(profile.stats?.averageQuizScore || 0)}%</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-neutral-600 dark:text-neutral-400">Time Spent</span>
                  <span className="font-bold">
                    {Math.round((profile.stats?.totalTimeSpentMinutes || 0) / 60)}h
                  </span>
                </div>
              </div>
            </div>

            {/* Devices & Location */}
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Monitor className="w-5 h-5 text-indigo-500" />
                Devices & Location
              </h2>

              {profile.devices && profile.devices.length > 0 ? (
                <div className="space-y-3">
                  {profile.devices.map((device: any, idx: number) => (
                    <div key={idx} className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {device.isMobile ? (
                            <Smartphone className="w-4 h-4 text-neutral-500" />
                          ) : (
                            <Monitor className="w-4 h-4 text-neutral-500" />
                          )}
                          <span className="font-medium text-sm">
                            {device.browser || 'Unknown'} • {device.os || 'Unknown'}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {device.loginCount || 0} logins
                        </Badge>
                      </div>
                      <div className="text-xs text-neutral-500 space-y-1">
                        <div>Device: {device.device || 'Unknown'}</div>
                        {device.ipAddress && (
                          <div className="flex items-center gap-1 font-mono">
                            IP: {device.ipAddress}
                          </div>
                        )}
                        {device.location && (
                          <div className="flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            {[
                              device.location.city,
                              device.location.region,
                              device.location.country_name || device.location.country
                            ].filter(Boolean).join(', ')}
                          </div>
                        )}
                        {device.location?.timezone && (
                          <div className="text-xs opacity-75">
                            Timezone: {device.location.timezone}
                          </div>
                        )}
                        {device.location?.isp && (
                          <div className="text-xs opacity-75">
                            ISP: {device.location.isp}
                          </div>
                        )}
                        <div>
                          First seen: {formatDate(device.firstSeen)}
                        </div>
                        <div>
                          Last seen: {formatDate(device.lastSeen)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : profile.lastDevice ? (
                <div className="text-sm text-neutral-600 dark:text-neutral-400">
                  <div className="flex items-center gap-2 mb-2">
                    {profile.lastDevice.isMobile ? (
                      <Smartphone className="w-4 h-4" />
                    ) : (
                      <Monitor className="w-4 h-4" />
                    )}
                    <span className="font-medium">
                      {profile.lastDevice.browser || 'Unknown'} • {profile.lastDevice.os || 'Unknown'}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-500">
                    {profile.lastDevice.device || 'Unknown device'}
                  </div>
                  <p className="text-xs text-neutral-400 mt-2 italic">
                    (Legacy device info - detailed tracking will be available from next login)
                  </p>
                </div>
              ) : (
                <p className="text-sm text-neutral-500 italic">No device information available</p>
              )}
            </div>
          </div>

          {/* Right Column - Quick Stats Summary */}
          <div className="space-y-6">
            {/* Recent Activity Summary */}
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-500" />
                Recent Activity
              </h2>

              <div className="space-y-4">
                {progress && progress.lessons && progress.lessons.length > 0 ? (
                  <div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                      Latest completed lessons
                    </p>
                    {progress.lessons
                      .filter(lesson =>
                        !lesson.slug?.toLowerCase().includes('scenario') &&
                        !lesson.slug?.toLowerCase().includes('legacy')
                      )
                      .slice(0, 3)
                      .map((lesson, idx) => (
                      <div key={idx} className="text-sm py-2 border-b last:border-0">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                          <span className="text-neutral-700 dark:text-neutral-300">
                            {getLessonTitle(lesson.slug)}
                          </span>
                        </div>
                        <div className="text-xs text-neutral-500 ml-5 mt-1">
                          {formatDate(lesson.completedAt)}
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => setActiveTab('learning')}
                      className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline mt-2"
                    >
                      View all learning progress →
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500 italic">No recent activity</p>
                )}

                {learningPlans.length > 0 && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                      Active Learning Plans: {learningPlans.filter((p: any) => p.status === 'active').length}
                    </p>
                    <button
                      onClick={() => setActiveTab('learning')}
                      className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      View learning plans →
                    </button>
                  </div>
                )}

                {annotations && ((annotations.highlights?.length || 0) + (annotations.notes?.length || 0)) > 0 && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                      {(annotations.highlights?.length || 0)} highlights, {(annotations.notes?.length || 0)} notes
                    </p>
                    <button
                      onClick={() => setActiveTab('activity')}
                      className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      View annotations →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
        )}

        {/* Learning Tab */}
        {activeTab === 'learning' && (
          <div className="space-y-6">
            {/* Learning Progress - reuse existing component */}
            {progress ? (
              <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-500" />
                  Learning Progress
                </h2>

                {/* Progress by Section */}
                {(progress as any)?.progressBySection && (
                  <div className="space-y-4">
                    {Object.entries((progress as any)?.progressBySection || {}).map(([section, sectionData]: [string, any]) => (
                      <div key={section} className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-medium capitalize text-sm">
                            {section.replace('-', ' ')}
                            <span className="text-neutral-500 font-normal ml-2">
                              ({sectionData.completedCount}/{sectionData.totalCount})
                            </span>
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-neutral-500">
                              {sectionData.completionRate}%
                            </span>
                            <div className="w-12 bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                              <div
                                className="bg-indigo-500 h-2 rounded-full"
                                style={{ width: `${sectionData.completionRate}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {sectionData.lessons
                            .filter((lesson: any) =>
                              !lesson.slug?.toLowerCase().includes('scenario') &&
                              !lesson.slug?.toLowerCase().includes('legacy') &&
                              !lesson.title?.toLowerCase().includes('scenario') &&
                              !lesson.title?.toLowerCase().includes('legacy')
                            )
                            .map((lesson: any, idx: number) => {
                            const lessonUrl = getLessonUrl(lesson.slug, lesson.category);
                            return (
                              <div key={idx} className="py-1.5 text-sm">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {lesson.completed ? (
                                      <CheckCircle className="w-3 h-3 text-green-500" />
                                    ) : (
                                      <div className="w-3 h-3 rounded-full border-2 border-neutral-300" />
                                    )}
                                    {lessonExists(lesson.slug) ? (
                                      <Link
                                        href={lessonUrl as any}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`hover:underline transition-colors ${
                                          lesson.completed
                                            ? "text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                                            : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                                        }`}
                                      >
                                        {getLessonTitle(lesson.slug)}
                                      </Link>
                                    ) : (
                                      <span className="text-red-500 dark:text-red-400 text-sm italic">
                                        {getLessonTitle(lesson.slug)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                                    {lesson.bestQuizScore && (
                                      <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                                        Quiz: {lesson.bestQuizScore}%
                                      </span>
                                    )}
                                    {lesson.completed && (
                                      <span>{formatDate(lesson.completedAt)}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-500" />
                  Learning Progress
                </h2>
                <p className="text-sm text-neutral-500 italic">No learning progress yet</p>
              </div>
            )}

            {/* Learning Plans */}
            {learningPlans.length > 0 ? (
              <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-500" />
                  Learning Plans ({learningPlans.length})
                </h2>

                {learningPlans.map((plan: any) => {
                  // Get total topics count
                  const totalCount = Array.isArray(plan.topics) ? plan.topics.length : 0;

                  // Calculate completed topics from user progress
                  const completedLessonSlugs = (progress?.lessons || []).map(l => l.slug);
                  const completedTopics = completedLessonSlugs.filter((lessonId: string) =>
                    Array.isArray(plan.topics) && plan.topics.includes(lessonId)
                  );
                  const completedCount = completedTopics.length;

                  const percentage = totalCount > 0
                    ? Math.round((completedCount / totalCount) * 100)
                    : 0;

                  return (
                    <div
                      key={plan.id}
                      className="py-3 border-b last:border-0 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded px-2 -mx-2 transition-colors"
                      onClick={() => router.push(`/learn/plan/${plan.slug}` as any)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{plan.title}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
                            {plan.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-sm text-neutral-500">
                        {completedCount} / {totalCount} completed
                      </div>
                      <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 mt-2">
                        <div
                          className="bg-indigo-500 h-2 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-500" />
                  Learning Plans
                </h2>
                <p className="text-sm text-neutral-500 italic">No learning plans yet</p>
              </div>
            )}
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="space-y-6">
            {annotations ? (
              <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
                <h2 className="text-lg font-semibold mb-4">User Annotations</h2>

                <div className="space-y-6">
                  {/* Highlights */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="flex items-center gap-2 font-medium">
                        <Highlighter className="w-4 h-4 text-yellow-500" />
                        Highlights ({annotations.highlights?.length || 0})
                      </span>
                    </div>

                    <div className="space-y-3">
                      {annotations.highlights && annotations.highlights.length > 0 ? (
                        annotations.highlights.map((highlight, index) => {
                          // Extract lesson slug from URL and get actual title
                          const getPageTitle = () => {
                            if (highlight.pageUrl) {
                              const url = new URL(highlight.pageUrl, getBaseUrl());
                              const pathParts = url.pathname.split('/').filter(Boolean);
                              const lessonSlug = pathParts[pathParts.length - 1];

                              // Only try to get title if we have a valid slug
                              if (lessonSlug) {
                                // Try to get title from content registry
                                const title = getLessonTitle(lessonSlug);
                                if (title && !title.includes('(Legacy)')) {
                                  return title;
                                }

                                // Fallback to formatted path
                                return pathParts.map(p =>
                                  p.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                                ).join(' › ');
                              }
                            }
                            return highlight.pageTitle === 'System Designer' ? 'Unknown Page' : highlight.pageTitle;
                          };

                          return (
                            <div key={index} className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                              <div className="flex items-start justify-between mb-2">
                                <p className="text-xs text-neutral-500 font-medium">
                                  {getPageTitle()}
                                </p>
                                <span className="text-xs text-neutral-400">
                                  {formatDate(highlight.timestamp)}
                                </span>
                              </div>
                            <blockquote className="text-sm text-neutral-700 dark:text-neutral-300 border-l-2 border-yellow-400 pl-3">
                              "{highlight.text}"
                            </blockquote>
                            {highlight.pageUrl && (
                              <a
                                href={highlight.pageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center mt-2"
                              >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                View Page
                              </a>
                            )}
                          </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-neutral-500 italic">No highlights yet</p>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="flex items-center gap-2 font-medium">
                        <StickyNote className="w-4 h-4 text-pink-500" />
                        Notes ({annotations.notes?.length || 0})
                      </span>
                    </div>

                    <div className="space-y-3">
                      {annotations.notes && annotations.notes.length > 0 ? (
                        annotations.notes.map((note, index) => {
                          // Extract lesson slug from URL and get actual title
                          const getPageTitle = () => {
                            if (note.pageUrl) {
                              const url = new URL(note.pageUrl, getBaseUrl());
                              const pathParts = url.pathname.split('/').filter(Boolean);
                              const lessonSlug = pathParts[pathParts.length - 1];

                              // Only try to get title if we have a valid slug
                              if (lessonSlug) {
                                // Try to get title from content registry
                                const title = getLessonTitle(lessonSlug);
                                if (title && !title.includes('(Legacy)')) {
                                  return title;
                                }

                                // Fallback to formatted path
                                return pathParts.map(p =>
                                  p.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                                ).join(' › ');
                              }
                            }
                            return note.pageTitle === 'System Designer' ? 'Unknown Page' : note.pageTitle;
                          };

                          return (
                            <div key={index} className="p-3 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 rounded-lg">
                              <div className="flex items-start justify-between mb-2">
                                <p className="text-xs text-neutral-500 font-medium">
                                  {getPageTitle()}
                                </p>
                                <span className="text-xs text-neutral-400">
                                  {formatDate(note.timestamp)}
                                </span>
                              </div>
                            {note.text && (
                              <blockquote className="text-xs text-neutral-600 dark:text-neutral-400 border-l-2 border-pink-400 pl-3 mb-2">
                                "{note.text}"
                              </blockquote>
                            )}
                            <p className="text-sm text-neutral-800 dark:text-neutral-200">{note.note}</p>
                            {note.pageUrl && (
                              <a
                                href={note.pageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center mt-2"
                              >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                View Page
                              </a>
                            )}
                          </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-neutral-500 italic">No notes yet</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
                <h2 className="text-lg font-semibold mb-4">User Annotations</h2>
                <p className="text-sm text-neutral-500 italic">No annotations yet</p>
              </div>
            )}
          </div>
        )}

        {/* Conversations Tab */}
        {activeTab === 'conversations' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                  AI Conversations
                </h2>
                {!conversationsLoading && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadConversations}
                  >
                    Refresh
                  </Button>
                )}
              </div>

              {conversationsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                </div>
              ) : conversations.length > 0 ? (
                <div className="space-y-3">
                  {conversations.map((conv, index) => {
                    // Extract lesson slug from URL and get actual title
                    const getConversationPageTitle = () => {
                      if (conv.pageUrl) {
                        try {
                          const url = new URL(conv.pageUrl, getBaseUrl());
                          const pathParts = url.pathname.split('/').filter(Boolean);
                          const lessonSlug = pathParts[pathParts.length - 1];

                          // Only try to get title if we have a valid slug
                          if (lessonSlug) {
                            // Try to get title from content registry
                            const title = getLessonTitle(lessonSlug);
                            if (title && !title.includes('(Legacy)') && !title.includes('Unknown')) {
                              return title;
                            }

                            // Fallback to formatted path
                            return pathParts.map(p =>
                              p.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                            ).join(' › ');
                          }
                        } catch (e) {
                          // Invalid URL, continue to fallback
                        }
                      }
                      return conv.pageTitle === 'System Designer' ? 'Unknown Page' : conv.pageTitle;
                    };

                    const isActive = 'isActive' in conv && conv.isActive;

                    return (
                    <div
                      key={conv.id || index}
                      className="p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                              {getConversationPageTitle()}
                            </p>
                            {isActive && (
                              <Badge variant="default" className="text-xs bg-green-500">Active</Badge>
                            )}
                          </div>
                          <a
                            href={conv.pageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center mt-1"
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            View Page
                          </a>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="text-xs">
                            Session {'sessionNumber' in conv ? conv.sessionNumber : 1}
                          </Badge>
                          <p className="text-xs text-neutral-500 mt-1">
                            {conv.messages?.length || 0} messages
                          </p>
                        </div>
                      </div>

                      <div className="text-xs text-neutral-500 flex items-center justify-between">
                        <span>Created: {formatDate(conv.createdAt)}</span>
                        {isActive ? (
                          <span>Last active: {formatDate((conv as AIConversation).updatedAt)}</span>
                        ) : (
                          <span>Archived: {formatDate((conv as AIConversationHistory).archivedAt)}</span>
                        )}
                      </div>

                      {conv.selectedText && (
                        <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs">
                          <p className="text-yellow-800 dark:text-yellow-200 line-clamp-2">
                            "{conv.selectedText}"
                          </p>
                        </div>
                      )}

                      {conv.messages && conv.messages.length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline">
                            View conversation
                          </summary>
                          <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                            {conv.messages.map((msg, msgIdx) => (
                              <div
                                key={msgIdx}
                                className={`p-2 rounded text-xs ${
                                  msg.role === 'user'
                                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                                    : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                                }`}
                              >
                                <p className="font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                                  {msg.role === 'user' ? 'User' : 'AI'}
                                </p>
                                <p className="text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap">
                                  {msg.content}
                                </p>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-neutral-500 italic text-center py-4">
                  No AI conversations found for this user.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Admin Tab */}
        {activeTab === 'admin' && (
          <div className="space-y-6">
            {/* Feedback */}
            {feedbackHistory.length > 0 ? (
              <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-purple-500" />
                  Feedback ({feedbackHistory.length})
                </h2>

                <div className="space-y-3">
                  {feedbackHistory.map(feedback => (
                    <div key={feedback.id} className="pb-3 border-b last:border-0">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-xs">
                          {feedback.category}
                        </Badge>
                        {feedback.resolved ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <div className="text-sm text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap">
                        {feedback.feedback}
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">
                        {formatDate(feedback.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-purple-500" />
                  Feedback
                </h2>
                <p className="text-sm text-neutral-500 italic">No feedback submitted yet</p>
              </div>
            )}

            {/* Delete User Card */}
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-2 flex items-center gap-2 text-red-700 dark:text-red-400">
                <Trash2 className="w-5 h-5" />
                Danger Zone
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                Permanently delete this user account and all associated data. This action cannot be undone.
              </p>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                className="flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete User Account
              </Button>
            </div>
          </div>
        )}

        {/* Achievements Modal */}
        {showAchievementsModal && (
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowAchievementsModal(false)}>
            <div
              className="bg-white dark:bg-neutral-900 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Award className="w-6 h-6 text-yellow-500" />
                    All Achievements
                    <span className="text-sm font-normal text-neutral-500">
                      ({profile.stats.unlockedAchievements?.length || 0} unlocked)
                    </span>
                  </h2>
                  <button
                    onClick={() => setShowAchievementsModal(false)}
                    className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {/* Tab Navigation */}
                <div className="flex gap-2 mb-6 border-b border-neutral-200 dark:border-neutral-800">
                  <button
                    className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                      !showAllAchievements
                        ? 'text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400'
                        : 'text-neutral-500 border-transparent hover:text-neutral-700 dark:hover:text-neutral-300'
                    }`}
                    onClick={() => setShowAllAchievements(false)}
                  >
                    Unlocked ({profile.stats.unlockedAchievements?.length || 0})
                  </button>
                  <button
                    className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                      showAllAchievements
                        ? 'text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400'
                        : 'text-neutral-500 border-transparent hover:text-neutral-700 dark:hover:text-neutral-300'
                    }`}
                    onClick={() => setShowAllAchievements(true)}
                  >
                    All Achievements ({ACHIEVEMENTS.length})
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {!showAllAchievements ? (
                    // Show only unlocked achievements
                    profile.stats.unlockedAchievements?.map(unlockedAchievement => {
                    const achievement = getAchievementDetails(unlockedAchievement.achievementId);
                    if (!achievement) {
                      return (
                        <div key={unlockedAchievement.achievementId} className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                          <p className="text-sm text-neutral-500 italic">
                            Unknown: {unlockedAchievement.achievementId}
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={achievement.id}
                        className={`p-3 rounded-lg ${getRarityColor(achievement.rarity)} transition-all hover:scale-[1.02]`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl" role="img" aria-label={achievement.title}>
                            {achievement.icon}
                          </span>
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div>
                                <p className="font-semibold">
                                  {achievement.title}
                                </p>
                                <p className="text-sm opacity-90 mt-0.5">
                                  {achievement.description}
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className="text-xs px-2 py-0.5 capitalize shrink-0"
                              >
                                {achievement.rarity}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs opacity-75">
                                {getAchievementTypeLabel(achievement.type)}
                              </span>
                              <div className="flex items-center gap-3 text-xs">
                                {achievement.reward?.xp && (
                                  <span className="font-medium">
                                    +{achievement.reward.xp} XP
                                  </span>
                                )}
                                <span className="opacity-75">
                                  {formatDate(unlockedAchievement.unlockedAt)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                  ) : (
                    // Show all achievements with progress
                    ACHIEVEMENTS.map(achievement => {
                      const isUnlocked = profile.stats.unlockedAchievements?.some(
                        ua => ua.achievementId === achievement.id
                      );
                      const unlockedData = profile.stats.unlockedAchievements?.find(
                        ua => ua.achievementId === achievement.id
                      );

                      // Calculate progress based on achievement type
                      let progress = 0;
                      let currentValue = 0;

                      if (achievement.criteria.metric === 'lessons_completed') {
                        currentValue = profile.stats?.totalLessonsCompleted || 0;
                        progress = Math.min(100, (currentValue / achievement.criteria.threshold) * 100);
                      } else if (achievement.criteria.metric === 'streak_days') {
                        currentValue = profile.stats?.longestStreak || 0;
                        progress = Math.min(100, (currentValue / achievement.criteria.threshold) * 100);
                      } else if (achievement.criteria.metric === 'total_time_minutes') {
                        currentValue = profile.stats?.totalTimeSpentMinutes || 0;
                        progress = Math.min(100, (currentValue / achievement.criteria.threshold) * 100);
                      } else if (achievement.criteria.metric === 'perfect_quiz_count') {
                        currentValue = profile.stats?.totalQuizzesTaken || 0; // Approximate
                        progress = isUnlocked ? 100 : Math.min(90, (currentValue / achievement.criteria.threshold) * 100);
                      }

                      return (
                        <div
                          key={achievement.id}
                          className={`p-3 rounded-lg transition-all ${
                            isUnlocked
                              ? getRarityColor(achievement.rarity) + ' hover:scale-[1.02]'
                              : 'bg-neutral-100 dark:bg-neutral-800 opacity-60'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className={`text-2xl ${!isUnlocked && 'grayscale'}`} role="img" aria-label={achievement.title}>
                              {achievement.icon}
                            </span>
                            <div className="flex-1">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <div>
                                  <p className={`font-semibold ${!isUnlocked && 'text-neutral-500'}`}>
                                    {achievement.title}
                                  </p>
                                  <p className={`text-sm ${isUnlocked ? 'opacity-90' : 'text-neutral-500'} mt-0.5`}>
                                    {achievement.description}
                                  </p>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={`text-xs px-2 py-0.5 capitalize shrink-0 ${
                                    !isUnlocked && 'opacity-50'
                                  }`}
                                >
                                  {achievement.rarity}
                                </Badge>
                              </div>

                              {/* Progress bar for locked achievements */}
                              {!isUnlocked && progress > 0 && (
                                <div className="mt-2">
                                  <div className="flex justify-between text-xs text-neutral-500 mb-1">
                                    <span>Progress</span>
                                    <span>
                                      {currentValue} / {achievement.criteria.threshold}
                                    </span>
                                  </div>
                                  <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5">
                                    <div
                                      className="bg-indigo-500 h-1.5 rounded-full transition-all"
                                      style={{ width: `${progress}%` }}
                                    />
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs opacity-75">
                                  {getAchievementTypeLabel(achievement.type)}
                                </span>
                                <div className="flex items-center gap-3 text-xs">
                                  {achievement.reward?.xp && (
                                    <span className={`font-medium ${!isUnlocked && 'opacity-50'}`}>
                                      +{achievement.reward.xp} XP
                                    </span>
                                  )}
                                  {isUnlocked && unlockedData && (
                                    <span className="opacity-75">
                                      {formatDate(unlockedData.unlockedAt)}
                                    </span>
                                  )}
                                  {!isUnlocked && (
                                    <span className="text-neutral-500">Locked</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {(!profile.stats.unlockedAchievements || profile.stats.unlockedAchievements.length === 0) && (
                  <div className="text-center py-12">
                    <Award className="w-16 h-16 text-neutral-300 dark:text-neutral-700 mx-auto mb-4" />
                    <p className="text-neutral-500">No achievements unlocked yet</p>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                      <span className="text-neutral-600 dark:text-neutral-400">Common</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-blue-400 dark:bg-blue-600"></span>
                      <span className="text-neutral-600 dark:text-neutral-400">Rare</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-purple-400 dark:bg-purple-600"></span>
                      <span className="text-neutral-600 dark:text-neutral-400">Epic</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-gradient-to-r from-yellow-400 to-amber-400"></span>
                      <span className="text-neutral-600 dark:text-neutral-400">Legendary</span>
                    </div>
                  </div>
                  <div className="text-neutral-500">
                    Total XP from achievements: <span className="font-semibold">
                      {profile.stats.unlockedAchievements?.reduce((total, ua) => {
                        const achievement = getAchievementDetails(ua.achievementId);
                        return total + (achievement?.reward?.xp || 0);
                      }, 0) || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete User Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete User Account</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this user account? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="text-sm">
                <p><strong>User:</strong> {profile.displayName || 'Anonymous User'} ({profile.email || 'No email'})</p>
                <p><strong>User ID:</strong> {params.userId}</p>
              </div>

              <div className="text-sm">
                <p className="font-semibold mb-2">This will delete:</p>
                <ul className="list-disc ml-6 space-y-1 text-neutral-600 dark:text-neutral-400">
                  <li>User profile and settings</li>
                  <li>Learning progress and quiz history</li>
                  <li>Annotations and highlights</li>
                  <li>Related data (learning plans, feedback, etc.)</li>
                </ul>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteUser}
                disabled={isDeleting}
                className="flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Permanently
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
