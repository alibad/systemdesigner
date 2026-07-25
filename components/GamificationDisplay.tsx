'use client';

import { useGamification } from '@/contexts/GamificationContext';
import AchievementNotification from '@/components/AchievementNotification';
import MilestoneCelebration from '@/components/MilestoneCelebration';

export default function GamificationDisplay() {
  const { newAchievements, dismissAchievements, pendingMilestone, dismissMilestone } = useGamification();

  return (
    <>
      <AchievementNotification 
        achievements={newAchievements}
        onDismiss={dismissAchievements}
      />
      {pendingMilestone && (
        <MilestoneCelebration
          type={pendingMilestone.type}
          level={pendingMilestone.level}
          streakDays={pendingMilestone.streakDays}
          onComplete={dismissMilestone}
        />
      )}
    </>
  );
}