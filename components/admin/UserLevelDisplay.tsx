'use client';

import { Star, Flame, TrendingUp, Trophy, Zap, Award } from 'lucide-react';

interface UserLevelDisplayProps {
  level: number;
  currentXP: number;
  requiredXP: number;
  variant?: 'full' | 'compact' | 'mini';
  showFireIcon?: boolean;
  className?: string;
}

// Level thresholds and colors
const getLevelConfig = (level: number) => {
  if (level <= 5) return { color: 'blue', icon: Star, gradient: 'from-blue-500 to-blue-600' };
  if (level <= 10) return { color: 'green', icon: TrendingUp, gradient: 'from-green-500 to-green-600' };
  if (level <= 20) return { color: 'purple', icon: Zap, gradient: 'from-purple-500 to-purple-600' };
  if (level <= 30) return { color: 'orange', icon: Trophy, gradient: 'from-orange-500 to-orange-600' };
  return { color: 'red', icon: Award, gradient: 'from-red-500 to-red-600' };
};

export default function UserLevelDisplay({
  level,
  currentXP,
  requiredXP,
  variant = 'full',
  showFireIcon = true,
  className = ''
}: UserLevelDisplayProps) {
  const progress = (currentXP / requiredXP) * 100;
  const config = getLevelConfig(level);
  const Icon = config.icon;

  // Mini variant - just level badge
  if (variant === 'mini') {
    return (
      <div className={`inline-flex items-center gap-1 ${className}`}>
        <Icon className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">L{level}</span>
      </div>
    );
  }

  // Compact variant - level and progress bar
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="flex items-center gap-1.5">
          <Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">L{level}</span>
        </div>

        <div className="flex-1 min-w-[100px] max-w-[200px]">
          <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`absolute inset-y-0 left-0 bg-gradient-to-r ${config.gradient} transition-all duration-500 ease-out`}
              style={{ width: `${progress}%` }}
            />
            <div className="absolute inset-0 bg-white/20 animate-pulse" />
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
          {showFireIcon && <Flame className="w-3.5 h-3.5" />}
          <span className="font-medium">{currentXP} XP</span>
        </div>
      </div>
    );
  }

  // Full variant - complete display with all details
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="space-y-3">
        {/* Level and XP display */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 bg-gradient-to-br ${config.gradient} rounded-lg text-white shadow-lg`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-gray-900 dark:text-white">Level {level}</span>
                {level >= 10 && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full">
                    Expert
                  </span>
                )}
                {level >= 20 && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full">
                    Master
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {currentXP.toLocaleString()} / {requiredXP.toLocaleString()} XP
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
            {showFireIcon && <Flame className="w-5 h-5 text-orange-500" />}
            <span className="text-sm font-semibold">{currentXP} XP</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Progress to Level {level + 1}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`absolute inset-y-0 left-0 bg-gradient-to-r ${config.gradient} transition-all duration-700 ease-out shadow-sm`}
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-white/30 animate-pulse" />
            </div>
            {/* Progress markers at 25%, 50%, 75% */}
            <div className="absolute inset-0 flex">
              {[25, 50, 75].map(marker => (
                <div
                  key={marker}
                  className="absolute h-full w-px bg-white/30"
                  style={{ left: `${marker}%` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Next level preview */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium">{requiredXP - currentXP}</span> XP to next level
          </div>
          {level < 50 && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">Next:</span>
              <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                <Icon className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">L{level + 1}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}