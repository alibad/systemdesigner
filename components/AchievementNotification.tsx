'use client';

import { useState, useEffect } from 'react';
import { UnlockedAchievement, ACHIEVEMENTS, AchievementRarity } from '@/lib/gamification';
import { Trophy, X, Zap } from 'lucide-react';

interface AchievementNotificationProps {
  achievements: UnlockedAchievement[];
  onDismiss: (achievementIds: string[]) => void;
}

const rarityColors: Record<AchievementRarity, { bg: string; border: string; glow: string }> = {
  common: { bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-300', glow: 'shadow-gray-200/50' },
  rare: { bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-300', glow: 'shadow-blue-300/50' },
  epic: { bg: 'bg-purple-50 dark:bg-purple-900/30', border: 'border-purple-300', glow: 'shadow-purple-300/50' },
  legendary: { bg: 'bg-yellow-50 dark:bg-yellow-900/30', border: 'border-yellow-400', glow: 'shadow-yellow-400/60' }
};

export default function AchievementNotification({ achievements, onDismiss }: AchievementNotificationProps) {
  const [visibleAchievements, setVisibleAchievements] = useState<UnlockedAchievement[]>([]);
  const [animatingOut, setAnimatingOut] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (achievements.length > 0) {
      console.log('New achievements received:', achievements);
      
      // Reset state when new achievements arrive
      setVisibleAchievements([]);
      setAnimatingOut(new Set());
      
      let currentIndex = 0;
      
      const showNext = () => {
        if (currentIndex < achievements.length) {
          const nextAchievement = achievements[currentIndex];
          console.log('Showing achievement:', nextAchievement);
          
          if (!nextAchievement?.achievementId) {
            console.error('Invalid achievement in showNext:', nextAchievement);
            return;
          }
          
          setVisibleAchievements(prev => {
            console.log('Previous visible achievements:', prev);
            const newArray = [...prev, nextAchievement];
            console.log('New visible achievements:', newArray);
            return newArray;
          });
          currentIndex += 1;
        }
      };

      // Show first achievement immediately
      showNext();
      
      // Show remaining achievements every 2 seconds
      const interval = setInterval(() => {
        if (currentIndex >= achievements.length) {
          clearInterval(interval);
          return;
        }
        showNext();
      }, 2000);

      return () => {
        console.log('Cleaning up achievement interval');
        clearInterval(interval);
      };
    } else {
      // Clear visible achievements when no achievements
      setVisibleAchievements([]);
      setAnimatingOut(new Set());
    }
  }, [achievements]);

  const handleDismiss = (achievementId: string) => {
    console.log('Dismissing achievement:', achievementId);
    
    // Add to animating out set
    setAnimatingOut(prev => new Set(prev).add(achievementId));
    
    // Remove after animation completes
    setTimeout(() => {
      setVisibleAchievements(prev => prev.filter(a => a.achievementId !== achievementId));
      setAnimatingOut(prev => {
        const newSet = new Set(prev);
        newSet.delete(achievementId);
        return newSet;
      });
      onDismiss([achievementId]);
    }, 300); // Match animation duration
  };

  const handleDismissAll = () => {
    console.log('Dismissing all achievements');
    const achievementIds = visibleAchievements.map(a => a.achievementId);
    
    // Add all to animating out
    setAnimatingOut(new Set(achievementIds));
    
    // Clear after animation
    setTimeout(() => {
      setVisibleAchievements([]);
      setAnimatingOut(new Set());
      onDismiss(achievementIds);
    }, 300);
  };

  if (visibleAchievements.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 space-y-3 max-w-sm">
      {visibleAchievements.filter(Boolean).map((unlockedAchievement) => {
        if (!unlockedAchievement?.achievementId) {
          console.error('Invalid achievement object:', unlockedAchievement);
          return null;
        }

        const achievement = ACHIEVEMENTS.find(a => a.id === unlockedAchievement.achievementId);
        if (!achievement) {
          console.error('Achievement not found for ID:', unlockedAchievement.achievementId);
          return null;
        }

        const colors = rarityColors[achievement.rarity];

        const isAnimatingOut = animatingOut.has(unlockedAchievement.achievementId);

        return (
          <div
            key={unlockedAchievement.achievementId}
            className={`${colors.bg} ${colors.border} border-2 rounded-xl p-4 ${colors.glow} shadow-xl transform transition-all duration-300 ${
              isAnimatingOut 
                ? 'translate-x-full opacity-0 scale-95' 
                : 'translate-x-0 opacity-100 scale-100 animate-in slide-in-from-right-5'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className="text-3xl animate-bounce">
                  {achievement.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Trophy className="w-4 h-4 text-yellow-500" />
                    <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      Achievement Unlocked!
                    </p>
                  </div>
                  <h4 className="font-bold text-neutral-900 dark:text-neutral-100 truncate">
                    {achievement.title}
                  </h4>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 line-clamp-2">
                    {achievement.description}
                  </p>
                  {achievement.reward?.xp && (
                    <div className="flex items-center gap-1 mt-2">
                      <Zap className="w-3 h-3 text-yellow-500" />
                      <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                        +{achievement.reward.xp} XP
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`text-xs font-medium capitalize px-2 py-0.5 rounded-full ${
                      achievement.rarity === 'legendary' ? 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200' :
                      achievement.rarity === 'epic' ? 'bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-200' :
                      achievement.rarity === 'rare' ? 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200' :
                      'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                    }`}>
                      {achievement.rarity}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDismiss(unlockedAchievement.achievementId)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 p-1 rounded transition-colors ml-2"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}

      {/* Dismiss All Button */}
      {visibleAchievements.length > 1 && (
        <div className="text-center">
          <button
            onClick={handleDismissAll}
            className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 underline transition-colors"
          >
            Dismiss all ({visibleAchievements.length})
          </button>
        </div>
      )}
    </div>
  );
}