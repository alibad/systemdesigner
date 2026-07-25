"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { userStorage } from '@/lib/unified-storage';

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalDaysActive: number;
  lastActivityDate: Date | null;
  activityByDate: Record<string, number>; // Date string -> count
}

export default function LearningStreak() {
  const { user, loading: authLoading } = useAuth();
  const [streakData, setStreakData] = useState<StreakData>({
    currentStreak: 0,
    longestStreak: 0,
    totalDaysActive: 0,
    lastActivityDate: null,
    activityByDate: {}
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStreakData = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        // Set user for unified storage
        await userStorage.setUser(user);

        // Get all progress
        const allProgress = await userStorage.getProgress();

        // Build activity map: date string -> count of lessons completed/visited that day
        const activityMap: Record<string, number> = {};
        let lastActivity: Date | null = null;

        Object.values(allProgress).forEach((sectionProgress: any) => {
          Object.values(sectionProgress).forEach((lesson: any) => {
            if (lesson.lastUpdated) {
              const date = new Date(lesson.lastUpdated);
              const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
              activityMap[dateStr] = (activityMap[dateStr] || 0) + 1;

              if (!lastActivity || date > lastActivity) {
                lastActivity = date;
              }
            }
          });
        });

        // Calculate streaks
        const sortedDates = Object.keys(activityMap).sort().reverse();
        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;

        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        // Check if there's activity today or yesterday to start current streak
        if (sortedDates.includes(today) || sortedDates.includes(yesterday)) {
          let checkDate = new Date();
          while (true) {
            const dateStr = checkDate.toISOString().split('T')[0];
            if (activityMap[dateStr]) {
              currentStreak++;
              tempStreak++;
              checkDate = new Date(checkDate.getTime() - 86400000); // Go back one day
            } else {
              break;
            }
          }
        }

        // Calculate longest streak
        let consecutiveDays = 1;
        for (let i = 0; i < sortedDates.length - 1; i++) {
          const current = new Date(sortedDates[i]);
          const next = new Date(sortedDates[i + 1]);
          const diffDays = Math.floor((current.getTime() - next.getTime()) / 86400000);

          if (diffDays === 1) {
            consecutiveDays++;
          } else {
            longestStreak = Math.max(longestStreak, consecutiveDays);
            consecutiveDays = 1;
          }
        }
        longestStreak = Math.max(longestStreak, consecutiveDays);

        setStreakData({
          currentStreak,
          longestStreak: Math.max(longestStreak, currentStreak),
          totalDaysActive: sortedDates.length,
          lastActivityDate: lastActivity,
          activityByDate: activityMap
        });
      } catch (error) {
        console.error('Error loading streak data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading) {
      loadStreakData();
    }
  }, [user, authLoading]);

  // Don't show if no user, loading, or no activity
  if (!user || isLoading || streakData.totalDaysActive === 0) {
    return null;
  }

  // Generate last 12 weeks of activity (GitHub-style)
  const generateActivityGrid = () => {
    const grid: { date: string; count: number }[] = [];
    const today = new Date();

    // Go back 84 days (12 weeks)
    for (let i = 83; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 86400000);
      const dateStr = date.toISOString().split('T')[0];
      grid.push({
        date: dateStr,
        count: streakData.activityByDate[dateStr] || 0
      });
    }

    return grid;
  };

  const activityGrid = generateActivityGrid();

  const getActivityColor = (count: number) => {
    if (count === 0) return 'bg-neutral-100 dark:bg-neutral-800';
    if (count <= 2) return 'bg-green-200 dark:bg-green-900/40';
    if (count <= 5) return 'bg-green-400 dark:bg-green-700/60';
    if (count <= 10) return 'bg-green-600 dark:bg-green-600';
    return 'bg-green-700 dark:bg-green-500';
  };

  const getEncouragementMessage = () => {
    if (streakData.currentStreak === 0) {
      return "Start a new streak today! 🎯";
    } else if (streakData.currentStreak === 1) {
      return "Great start! Keep it going! 🌱";
    } else if (streakData.currentStreak < 7) {
      return `${streakData.currentStreak} day streak! You're building momentum! 🔥`;
    } else if (streakData.currentStreak < 30) {
      return `${streakData.currentStreak} day streak! You're on fire! 🚀`;
    } else {
      return `Incredible ${streakData.currentStreak} day streak! You're unstoppable! ⭐`;
    }
  };

  return (
    <section className="mt-8">
      <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Learning Streak
              </h2>
              {streakData.currentStreak > 0 && (
                <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-medium rounded-full flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                  </svg>
                  {streakData.currentStreak}
                </span>
              )}
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              {getEncouragementMessage()}
            </p>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {streakData.totalDaysActive}
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-500">
              days active
            </div>
          </div>
        </div>

        {/* Activity Grid */}
        <div className="mb-4">
          <div className="flex gap-1 overflow-x-auto pb-2">
            {activityGrid.map((day, index) => (
              <div
                key={day.date}
                className={`w-2.5 h-2.5 rounded-sm ${getActivityColor(day.count)} flex-shrink-0 transition-all hover:ring-2 hover:ring-green-500 hover:scale-110 cursor-pointer`}
                title={`${day.date}: ${day.count} ${day.count === 1 ? 'lesson' : 'lessons'}`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-neutral-500 dark:text-neutral-500">
            <span>12 weeks ago</span>
            <div className="flex items-center gap-1">
              <span className="text-[10px]">Less</span>
              <div className="w-2 h-2 rounded-sm bg-neutral-100 dark:bg-neutral-800"></div>
              <div className="w-2 h-2 rounded-sm bg-green-200 dark:bg-green-900/40"></div>
              <div className="w-2 h-2 rounded-sm bg-green-400 dark:bg-green-700/60"></div>
              <div className="w-2 h-2 rounded-sm bg-green-600 dark:bg-green-600"></div>
              <div className="w-2 h-2 rounded-sm bg-green-700 dark:bg-green-500"></div>
              <span className="text-[10px]">More</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-3">
            <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">Current Streak</div>
            <div className="text-xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1">
              {streakData.currentStreak}
              {streakData.currentStreak > 0 && (
                <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          </div>
          <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-3">
            <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">Longest Streak</div>
            <div className="text-xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1">
              {streakData.longestStreak}
              {streakData.longestStreak > 7 && (
                <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
