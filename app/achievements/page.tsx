'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { GamificationService, UserGameStats, Achievement, ACHIEVEMENTS, UnlockedAchievement, AchievementRarity, XP_PER_LEVEL } from '@/lib/gamification';
import { 
  Trophy, 
  Target, 
  Zap, 
  Calendar, 
  TrendingUp,
  Clock,
  Star,
  Award,
  Flame,
  Lock,
  CheckCircle2
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const rarityColors: Record<AchievementRarity, { bg: string; border: string; text: string; glow: string }> = {
  common: { 
    bg: 'bg-gray-50 dark:bg-gray-800/50', 
    border: 'border-gray-200 dark:border-gray-700', 
    text: 'text-gray-700 dark:text-gray-300',
    glow: 'shadow-gray-200/20'
  },
  rare: { 
    bg: 'bg-blue-50 dark:bg-blue-900/20', 
    border: 'border-blue-200 dark:border-blue-800', 
    text: 'text-blue-700 dark:text-blue-300',
    glow: 'shadow-blue-200/40'
  },
  epic: { 
    bg: 'bg-purple-50 dark:bg-purple-900/20', 
    border: 'border-purple-200 dark:border-purple-800', 
    text: 'text-purple-700 dark:text-purple-300',
    glow: 'shadow-purple-200/60'
  },
  legendary: { 
    bg: 'bg-yellow-50 dark:bg-yellow-900/20', 
    border: 'border-yellow-300 dark:border-yellow-700', 
    text: 'text-yellow-800 dark:text-yellow-200',
    glow: 'shadow-yellow-300/80'
  }
};

interface AchievementWithProgress extends Achievement {
  isUnlocked: boolean;
  progress: number;
  unlockedAt?: Date;
}

const gamificationService = GamificationService.getInstance();

export default function AchievementsPage() {
  const { user, isAuthenticated } = useAuth();
  const [gameStats, setGameStats] = useState<UserGameStats | null>(null);
  const [achievements, setAchievements] = useState<AchievementWithProgress[]>([]);
  const [unlockedAchievements, setUnlockedAchievements] = useState<UnlockedAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'to_earn'>('all');
  const [sortBy, setSortBy] = useState<'rarity' | 'progress' | 'recent'>('progress');

  const loadAchievementsData = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Load user stats which now contains unlocked achievements
      const stats = await gamificationService.getUserGameStats(user.uid);

      if (stats) {
        setGameStats(stats);
        setUnlockedAchievements(stats.unlockedAchievements || []);
        
        // Combine achievements with progress data
        const achievementsWithProgress: AchievementWithProgress[] = ACHIEVEMENTS.map(achievement => {
          const isUnlocked = stats.unlockedAchievements.some(unlocked => unlocked.achievementId === achievement.id);
          let progress = 0;
          
          // Calculate progress based on metric
          switch (achievement.criteria.metric) {
            case 'lessons_completed':
              progress = Math.min(stats.totalLessonsCompleted, achievement.criteria.threshold);
              break;
            case 'streak_days':
              progress = Math.min(stats.currentStreak, achievement.criteria.threshold);
              break;
            case 'total_time_minutes':
              progress = Math.min(stats.totalTimeSpentMinutes, achievement.criteria.threshold);
              break;
            default:
              progress = Math.min(
                stats.achievementProgress[achievement.criteria.metric] || 0, 
                achievement.criteria.threshold
              );
          }

          const unlockedData = stats.unlockedAchievements.find(u => u.achievementId === achievement.id);
          
          return {
            ...achievement,
            isUnlocked,
            progress,
            unlockedAt: unlockedData?.unlockedAt
          };
        });
        
        setAchievements(achievementsWithProgress);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading achievements data:', error);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated && user && !user.isAnonymous) {
      loadAchievementsData();
    } else if (isAuthenticated === false) {
      // User is definitely not authenticated, stop loading
      setLoading(false);
    }
    // If isAuthenticated is null/undefined, keep loading (auth state unknown)
  }, [user, isAuthenticated, loadAchievementsData]);

  const getProgressPercentage = (achievement: AchievementWithProgress) => {
    return Math.min((achievement.progress / achievement.criteria.threshold) * 100, 100);
  };

  const filteredAchievements = achievements.filter(achievement => {
    if (filter === 'unlocked') return achievement.isUnlocked;
    if (filter === 'to_earn') return !achievement.isUnlocked && !achievement.isSecret;
    return !achievement.isSecret || achievement.isUnlocked; // Hide secret achievements unless unlocked
  });

  const sortedAchievements = [...filteredAchievements].sort((a, b) => {
    if (sortBy === 'rarity') {
      const rarityOrder = { legendary: 4, epic: 3, rare: 2, common: 1 };
      return rarityOrder[b.rarity] - rarityOrder[a.rarity];
    }
    if (sortBy === 'progress') {
      const aProgress = getProgressPercentage(a);
      const bProgress = getProgressPercentage(b);
      if (a.isUnlocked !== b.isUnlocked) {
        return a.isUnlocked ? -1 : 1; // Unlocked first
      }
      return bProgress - aProgress; // Higher progress first
    }
    if (sortBy === 'recent') {
      if (a.unlockedAt && b.unlockedAt) {
        return b.unlockedAt.getTime() - a.unlockedAt.getTime();
      }
      return a.unlockedAt ? -1 : 1;
    }
    return 0;
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
        <div className="text-center" role="main" aria-labelledby="auth-heading">
          <Trophy className="w-16 h-16 text-neutral-300 mx-auto mb-4" aria-hidden="true" />
          <h1 id="auth-heading" className="text-xl font-semibold mb-2">Sign in to view achievements</h1>
          <p className="text-neutral-500">Track your progress and unlock badges!</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
        <div className="text-center" role="main" aria-labelledby="loading-heading">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" role="status" aria-label="Loading achievements"></div>
          <p id="loading-heading" className="text-neutral-500">Loading achievements...</p>
        </div>
      </div>
    );
  }

  const unlockedCount = achievements.filter(a => a.isUnlocked).length;
  const totalCount = achievements.filter(a => !a.isSecret || a.isUnlocked).length;

  const safeStats = gameStats
    ? {
        totalXP: Number.isFinite(gameStats.totalXP) ? gameStats.totalXP : 0,
        level: Number.isFinite(gameStats.level) ? gameStats.level : 1,
        currentStreak: Number.isFinite(gameStats.currentStreak) ? gameStats.currentStreak : 0,
        longestStreak: Number.isFinite(gameStats.longestStreak) ? gameStats.longestStreak : 0,
        totalLessonsCompleted: Number.isFinite(gameStats.totalLessonsCompleted) ? gameStats.totalLessonsCompleted : 0,
      }
    : null;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header Section */}
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">
            <span role="img" aria-label="Trophy">🏆</span> Achievements
          </h1>
          <p className="text-xl text-neutral-600 dark:text-neutral-400 mb-6">
            Track your learning journey and unlock rewards!
          </p>
        </header>

        {/* Stats Overview */}
        {safeStats && (
          <section aria-labelledby="stats-heading" className="mb-8">
            <h2 id="stats-heading" className="sr-only">Progress Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800" role="region" aria-labelledby="level-label">
              <div className="flex items-center justify-between">
                <div>
                  <p id="level-label" className="text-sm text-neutral-500">Level</p>
                  <p className="text-3xl font-bold text-indigo-600" aria-label={`Current level: ${safeStats.level}`}>{safeStats.level}</p>
                </div>
                <Star className="w-8 h-8 text-indigo-600" aria-hidden="true" />
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>XP Progress</span>
                  <span>{safeStats.totalXP % XP_PER_LEVEL}/{XP_PER_LEVEL}</span>
                </div>
                <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                  <div 
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-500" 
                    style={{ width: `${((safeStats.totalXP % XP_PER_LEVEL) / XP_PER_LEVEL) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-500">Current Streak</p>
                  <p className="text-3xl font-bold text-orange-600">{safeStats.currentStreak}</p>
                </div>
                <Flame className="w-8 h-8 text-orange-600" />
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                Best: {safeStats.longestStreak} days
              </p>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-500">Achievements</p>
                  <p className="text-3xl font-bold text-green-600">{unlockedCount}</p>
                </div>
                <Trophy className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                {unlockedCount} of {totalCount}
              </p>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-500">Total XP</p>
                  <p className="text-3xl font-bold text-purple-600">{safeStats.totalXP}</p>
                </div>
                <Zap className="w-8 h-8 text-purple-600" />
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                {safeStats.totalLessonsCompleted} lessons completed
              </p>
            </div>
          </div>
          </section>
        )}

        {/* Filters and Sorting */}
        <section aria-labelledby="filters-heading" className="mb-8">
          <h2 id="filters-heading" className="sr-only">Filter and Sort Achievements</h2>
          <div className="flex flex-wrap gap-4">
          <div className="flex gap-2" role="radiogroup" aria-labelledby="filter-group-label">
            <span id="filter-group-label" className="sr-only">Filter achievements by status</span>
            <button
              onClick={() => setFilter('all')}
              role="radio"
              aria-checked={filter === 'all'}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                filter === 'all'
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => setFilter('unlocked')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'unlocked'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 inline mr-1" />
              Unlocked ({unlockedCount})
            </button>
            <button
              onClick={() => setFilter('to_earn')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'to_earn'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700'
              }`}
            >
              <Target className="w-4 h-4 inline mr-1" />
              To Earn ({totalCount - unlockedCount})
            </button>
          </div>

          <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'rarity' | 'progress' | 'recent')}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="progress">Sort by Progress</SelectItem>
              <SelectItem value="rarity">Sort by Rarity</SelectItem>
              <SelectItem value="recent">Sort by Recent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        </section>

        {/* Achievements Grid */}
        <section aria-labelledby="achievements-heading">
          <h2 id="achievements-heading" className="sr-only">Your Achievements</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedAchievements.map(achievement => {
            const colors = rarityColors[achievement.rarity];
            const progressPercentage = getProgressPercentage(achievement);
            
            return (
              <div
                key={achievement.id}
                className={`${colors.bg} ${colors.border} border rounded-xl p-6 transition-all duration-300 hover:shadow-lg ${colors.glow} ${
                  achievement.isUnlocked ? 'ring-2 ring-green-200 dark:ring-green-800' : ''
                }`}
              >
                {/* Achievement Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`text-4xl ${achievement.isUnlocked ? '' : 'grayscale opacity-50'}`}>
                      {achievement.icon}
                    </div>
                    <div>
                      <h3 className={`font-semibold ${colors.text} ${achievement.isUnlocked ? '' : 'opacity-70'}`}>
                        {achievement.title}
                      </h3>
                      <p className={`text-xs capitalize font-medium ${colors.text}`}>
                        {achievement.rarity}
                      </p>
                    </div>
                  </div>
                  
                  {achievement.isUnlocked ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <Lock className="w-5 h-5 text-neutral-400 flex-shrink-0" />
                  )}
                </div>

                {/* Description */}
                <p className={`text-sm mb-4 ${achievement.isUnlocked ? colors.text : 'text-neutral-500'}`}>
                  {achievement.description}
                </p>

                {/* Progress */}
                {!achievement.isUnlocked && (
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-neutral-500 mb-1">
                      <span>Progress</span>
                      <span>{achievement.progress} / {achievement.criteria.threshold}</span>
                    </div>
                    <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercentage}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Reward */}
                {achievement.reward?.xp && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500">Reward:</span>
                    <span className={`font-medium ${colors.text} flex items-center`}>
                      <Zap className="w-3 h-3 mr-1" />
                      {achievement.reward.xp} XP
                    </span>
                  </div>
                )}

                {/* Unlock Date */}
                {achievement.isUnlocked && achievement.unlockedAt && (
                  <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-700">
                    <span className="text-neutral-500">Unlocked:</span>
                    <span className={`font-medium ${colors.text}`}>
                      {achievement.unlockedAt.toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {sortedAchievements.length === 0 && (
          <div className="text-center py-12" role="status" aria-live="polite">
            <Trophy className="w-16 h-16 text-neutral-300 mx-auto mb-4" aria-hidden="true" />
            <h3 className="text-lg font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              No achievements found
            </h3>
            <p className="text-neutral-500">
              Try changing your filter or start learning to unlock achievements!
            </p>
          </div>
        )}
        </section>
      </div>
    </div>
  );
}
