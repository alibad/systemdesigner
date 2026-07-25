'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { GamificationService, UserGameStats, UnlockedAchievement } from '@/lib/gamification';

interface MilestoneEvent {
  id: string;
  type: 'levelUp' | 'streakMilestone' | 'firstAchievement';
  level?: number;
  streakDays?: number;
}

interface GamificationContextType {
  gameStats: UserGameStats | null;
  newAchievements: UnlockedAchievement[];
  pendingMilestone: MilestoneEvent | null;
  loading: boolean;
  trackLessonCompletion: (lessonId: string, timeSpent?: number, section?: string) => Promise<void>;
  trackQuizCompletion: (quizId: string, score: number) => Promise<void>;
  trackChallengeCompletion: (
    challengeId: string,
    result: { passed: boolean; score: number; kind: string; xpWeight?: number }
  ) => Promise<{ xpAwarded: number; alreadyMastered: boolean }>;
  dismissAchievements: (achievementIds: string[]) => Promise<void>;
  dismissMilestone: () => void;
  refreshStats: () => Promise<void>;
}

const GamificationContext = createContext<GamificationContextType | undefined>(undefined);

interface GamificationProviderProps {
  children: ReactNode;
}

export function GamificationProvider({ children }: GamificationProviderProps) {
  const { user, isAuthenticated } = useAuth();
  const [gameStats, setGameStats] = useState<UserGameStats | null>(null);
  const [newAchievements, setNewAchievements] = useState<UnlockedAchievement[]>([]);
  const [pendingMilestone, setPendingMilestone] = useState<MilestoneEvent | null>(null);
  const [loading, setLoading] = useState(true);

  const gamificationService = GamificationService.getInstance();

  // Load initial game stats
  useEffect(() => {
    if (isAuthenticated && user && !user.isAnonymous) {
      loadGameStats();
    } else {
      setGameStats(null);
      setNewAchievements([]);
      setLoading(false);
    }
  }, [user, isAuthenticated]);

  const loadGameStats = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const stats = await gamificationService.getUserGameStats(user.uid);
      setGameStats(stats);
    } catch (error) {
      console.error('Error loading game stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const trackLessonCompletion = async (lessonId: string, timeSpent: number = 15, section?: string) => {
    console.log('🎮 [CONTEXT] trackLessonCompletion called:', {
      lessonId,
      timeSpent,
      section,
      userId: user?.uid,
      isAnonymous: user?.isAnonymous,
      isAuthenticated
    });

    if (!user || user.isAnonymous) {
      console.log('❌ [CONTEXT] User not authenticated or is anonymous, skipping tracking');
      return;
    }

    try {
      const oldStats = gameStats;
      console.log('📊 [CONTEXT] Current stats before tracking:', {
        totalXP: oldStats?.totalXP,
        level: oldStats?.level,
        totalLessonsCompleted: oldStats?.totalLessonsCompleted
      });

      const newAchievements = await gamificationService.trackLessonCompletion(user.uid, lessonId, timeSpent, section);

      // Refresh stats
      const updatedStats = await gamificationService.getUserGameStats(user.uid);
      console.log('📈 [CONTEXT] Stats after tracking:', {
        oldXP: oldStats?.totalXP,
        newXP: updatedStats?.totalXP,
        oldLevel: oldStats?.level,
        newLevel: updatedStats?.level,
        oldLessons: oldStats?.totalLessonsCompleted,
        newLessons: updatedStats?.totalLessonsCompleted
      });

      setGameStats(updatedStats);

      // Check for milestone events
      if (oldStats && updatedStats) {
        // Level up milestone
        if (updatedStats.level > oldStats.level) {
          setPendingMilestone({
            id: `levelup-${updatedStats.level}`,
            type: 'levelUp',
            level: updatedStats.level
          });
        }
        
        // Streak milestones (at 3, 7, 30, 100 days)
        const streakMilestones = [3, 7, 30, 100];
        const oldStreak = oldStats.currentStreak;
        const newStreak = updatedStats.currentStreak;
        
        const newMilestone = streakMilestones.find(milestone => 
          newStreak >= milestone && oldStreak < milestone
        );
        
        if (newMilestone && !pendingMilestone) {
          setPendingMilestone({
            id: `streak-${newMilestone}`,
            type: 'streakMilestone',
            streakDays: newMilestone
          });
        }
      }

      // Show new achievements
      if (newAchievements.length > 0) {
        // First achievement milestone
        if (oldStats && oldStats.unlockedAchievements.length === 0 && !pendingMilestone) {
          setPendingMilestone({
            id: 'first-achievement',
            type: 'firstAchievement'
          });
        }
        
        setNewAchievements(prev => [...prev, ...newAchievements]);
        
        // Auto-dismiss after 10 seconds if user doesn't interact
        setTimeout(() => {
          setNewAchievements(prev => 
            prev.filter(a => !newAchievements.find(na => na.achievementId === a.achievementId))
          );
        }, 10000);
      }
    } catch (error) {
      console.error('❌ [CONTEXT] Error tracking lesson completion:', error);
    }
  };

  const trackQuizCompletion = async (quizId: string, score: number) => {
    if (!user || user.isAnonymous) return;

    try {
      const newAchievements = await gamificationService.trackQuizCompletion(user.uid, quizId, score);
      
      // Refresh stats
      const updatedStats = await gamificationService.getUserGameStats(user.uid);
      setGameStats(updatedStats);

      // Show new achievements
      if (newAchievements.length > 0) {
        setNewAchievements(prev => [...prev, ...newAchievements]);
        
        // Auto-dismiss after 10 seconds
        setTimeout(() => {
          setNewAchievements(prev => 
            prev.filter(a => !newAchievements.find(na => na.achievementId === a.achievementId))
          );
        }, 10000);
      }
    } catch (error) {
      console.error('Error tracking quiz completion:', error);
    }
  };

  const trackChallengeCompletion = async (
    challengeId: string,
    result: { passed: boolean; score: number; kind: string; xpWeight?: number }
  ): Promise<{ xpAwarded: number; alreadyMastered: boolean }> => {
    if (!user || user.isAnonymous) return { xpAwarded: 0, alreadyMastered: false };

    try {
      const oldStats = gameStats;
      const { xpAwarded, alreadyMastered, newAchievements } =
        await gamificationService.trackChallengeCompletion(user.uid, challengeId, result);

      // Refresh stats
      const updatedStats = await gamificationService.getUserGameStats(user.uid);
      setGameStats(updatedStats);

      // Level-up milestone
      if (oldStats && updatedStats && updatedStats.level > oldStats.level && !pendingMilestone) {
        setPendingMilestone({
          id: `levelup-${updatedStats.level}`,
          type: 'levelUp',
          level: updatedStats.level,
        });
      }

      // Surface any new achievements
      if (newAchievements.length > 0) {
        setNewAchievements(prev => [...prev, ...newAchievements]);
        setTimeout(() => {
          setNewAchievements(prev =>
            prev.filter(a => !newAchievements.find(na => na.achievementId === a.achievementId))
          );
        }, 10000);
      }

      return { xpAwarded, alreadyMastered };
    } catch (error) {
      console.error('Error tracking challenge completion:', error);
      return { xpAwarded: 0, alreadyMastered: false };
    }
  };

  const dismissAchievements = async (achievementIds: string[]) => {
    if (!user) return;

    try {
      // Mark achievements as viewed in Firebase
      await gamificationService.markAchievementsAsViewed(user.uid, achievementIds);
      
      // Remove from local state
      setNewAchievements(prev => 
        prev.filter(a => !achievementIds.includes(a.achievementId))
      );
    } catch (error) {
      console.error('Error dismissing achievements:', error);
    }
  };

  const dismissMilestone = () => {
    setPendingMilestone(null);
  };

  const refreshStats = async () => {
    if (!user) return;
    await loadGameStats();
  };

  const value: GamificationContextType = {
    gameStats,
    newAchievements,
    pendingMilestone,
    loading,
    trackLessonCompletion,
    trackQuizCompletion,
    trackChallengeCompletion,
    dismissAchievements,
    dismissMilestone,
    refreshStats
  };

  return (
    <GamificationContext.Provider value={value}>
      {children}
    </GamificationContext.Provider>
  );
}

export function useGamification(): GamificationContextType {
  const context = useContext(GamificationContext);
  if (!context) {
    throw new Error('useGamification must be used within a GamificationProvider');
  }
  return context;
}