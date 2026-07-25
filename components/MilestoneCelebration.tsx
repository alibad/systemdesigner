'use client';

import { useState, useEffect } from 'react';
import { Trophy, Star, Zap, Flame, Sparkles } from 'lucide-react';

interface MilestoneProps {
  type: 'levelUp' | 'streakMilestone' | 'firstAchievement';
  level?: number;
  streakDays?: number;
  onComplete: () => void;
}

export default function MilestoneCelebration({ type, level, streakDays, onComplete }: MilestoneProps) {
  const [show, setShow] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    // Show celebration immediately
    setShow(true);
    
    // Start animation after a brief delay
    const animationTimer = setTimeout(() => {
      setAnimate(true);
    }, 100);

    // Auto-hide after 4 seconds
    const hideTimer = setTimeout(() => {
      setShow(false);
      setTimeout(onComplete, 300); // Wait for fade-out animation
    }, 4000);

    return () => {
      clearTimeout(animationTimer);
      clearTimeout(hideTimer);
    };
  }, [onComplete]);

  const getMilestoneContent = () => {
    switch (type) {
      case 'levelUp':
        return {
          icon: <Star className="w-12 h-12 text-yellow-500" />,
          title: 'Level Up!',
          message: `You've reached Level ${level}!`,
          color: 'from-yellow-400 to-orange-500',
          particles: '🌟'
        };
      case 'streakMilestone':
        return {
          icon: <Flame className="w-12 h-12 text-orange-500" />,
          title: 'Streak Master!',
          message: `${streakDays} days of consistent learning!`,
          color: 'from-orange-400 to-red-500',
          particles: '🔥'
        };
      case 'firstAchievement':
        return {
          icon: <Trophy className="w-12 h-12 text-purple-500" />,
          title: 'First Achievement!',
          message: 'Your learning journey has begun!',
          color: 'from-purple-400 to-pink-500',
          particles: '🏆'
        };
      default:
        return {
          icon: <Sparkles className="w-12 h-12 text-blue-500" />,
          title: 'Milestone!',
          message: 'Great progress!',
          color: 'from-blue-400 to-purple-500',
          particles: '✨'
        };
    }
  };

  const content = getMilestoneContent();

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative">
        {/* Animated particles */}
        {animate && (
          <>
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="absolute text-4xl animate-bounce"
                style={{
                  left: `${Math.cos((i * Math.PI * 2) / 12) * 150 + 150}px`,
                  top: `${Math.sin((i * Math.PI * 2) / 12) * 150 + 150}px`,
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: '2s',
                }}
              >
                {content.particles}
              </div>
            ))}
          </>
        )}

        {/* Main celebration card */}
        <div
          className={`relative bg-white dark:bg-neutral-900 rounded-2xl p-8 shadow-2xl border-4 border-transparent bg-gradient-to-br ${content.color} bg-clip-padding ${
            animate ? 'animate-pulse scale-105' : 'scale-100'
          } transition-transform duration-300`}
          style={{
            backgroundImage: `linear-gradient(135deg, ${content.color})`,
            backgroundClip: 'border-box',
            border: '4px solid transparent',
            backgroundOrigin: 'border-box'
          }}
        >
          <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 text-center">
            {/* Icon with glow effect */}
            <div className="relative mb-4">
              <div className={`absolute inset-0 bg-gradient-to-r ${content.color} rounded-full blur-xl opacity-30 scale-150`} />
              <div className="relative bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800 dark:to-neutral-900 rounded-full p-4 mx-auto w-fit">
                {content.icon}
              </div>
            </div>

            {/* Title and message */}
            <h2 className={`text-3xl font-bold mb-2 bg-gradient-to-r ${content.color} bg-clip-text text-transparent`}>
              {content.title}
            </h2>
            <p className="text-lg text-neutral-700 dark:text-neutral-300 mb-4">
              {content.message}
            </p>

            {/* Progress indicator */}
            <div className="flex items-center justify-center gap-2 text-sm text-neutral-500">
              <Zap className="w-4 h-4" />
              <span>Keep up the amazing work!</span>
            </div>
          </div>

          {/* Sparkle effects */}
          <div className="absolute -top-2 -right-2">
            <Sparkles className="w-6 h-6 text-yellow-400 animate-spin" style={{ animationDuration: '3s' }} />
          </div>
          <div className="absolute -bottom-2 -left-2">
            <Sparkles className="w-4 h-4 text-pink-400 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
          </div>
        </div>

        {/* Click to dismiss hint */}
        <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 text-center">
          <p className="text-sm text-white/80">
            Tap anywhere to continue
          </p>
        </div>
      </div>

      {/* Click to dismiss overlay */}
      <div
        className="absolute inset-0 cursor-pointer"
        onClick={() => {
          setShow(false);
          setTimeout(onComplete, 300);
        }}
      />
    </div>
  );
}