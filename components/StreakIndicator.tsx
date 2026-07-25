'use client';

import { useGamification } from '@/contexts/GamificationContext';
import { Flame, Star, TrendingUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

export default function StreakIndicator() {
  const { isAuthenticated, user } = useAuth();
  const { gameStats, loading } = useGamification();

  // Don't show for anonymous or non-authenticated users
  if (!isAuthenticated || !user || user.isAnonymous || loading || !gameStats) {
    return null;
  }

  const normalizeNumber = (value: number) => (Number.isFinite(value) ? value : 0);

  const totalXP = normalizeNumber(gameStats.totalXP);
  const level = normalizeNumber(gameStats.level);
  const currentStreak = normalizeNumber(gameStats.currentStreak);
  const xpProgress = totalXP % 100;
  const isStreakActive = currentStreak > 0;

  return (
    <Link 
      href="/achievements" 
      className="hidden md:flex items-center gap-3 px-3 py-2 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-750 transition-colors cursor-pointer"
    >
      {/* Level Badge */}
      <div className="flex items-center gap-1">
        <Star className="w-4 h-4 text-indigo-500" />
        <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          L{level}
        </span>
      </div>

      {/* XP Progress Bar */}
      <div className="flex items-center gap-2">
        <div className="w-16 bg-neutral-200 dark:bg-neutral-600 rounded-full h-1.5">
          <div 
            className="bg-gradient-to-r from-indigo-500 to-purple-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${xpProgress}%` }}
          />
        </div>
        <span className="text-xs text-neutral-500">
          {xpProgress}/100
        </span>
      </div>

      {/* Streak Indicator */}
      {isStreakActive ? (
        <div className="flex items-center gap-1">
          <Flame className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
            {currentStreak}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1 opacity-50">
          <Flame className="w-4 h-4 text-neutral-400" />
          <span className="text-sm text-neutral-400">0</span>
        </div>
      )}

      {/* Total XP */}
      <div className="flex items-center gap-1 pl-2 border-l border-neutral-200 dark:border-neutral-600">
        <TrendingUp className="w-3 h-3 text-neutral-400" />
        <span className="text-xs text-neutral-500">
          {totalXP} XP
        </span>
      </div>
    </Link>
  );
}
