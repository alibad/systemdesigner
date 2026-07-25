import { doc, setDoc, getDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { db, getUserDocument, usersCollection, invalidateUserDocCache } from './firebase';

// Achievement types and categories
export type AchievementType =
  | 'learning_streak'
  | 'lesson_completion'
  | 'quiz_mastery'
  | 'content_explorer'
  | 'community_contributor'
  | 'milestone_achiever'
  | 'time_dedication'
  | 'learning_plan'
  | 'learning_path'
  | 'quality_learning'
  | 'specialization'
  | 'tool_mastery'
  | 'temporal_achievement';

export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // Emoji or icon name
  type: AchievementType;
  rarity: AchievementRarity;
  criteria: {
    metric: string; // 'streak_days', 'lessons_completed', 'quiz_score', etc.
    threshold: number;
    timeframe?: 'daily' | 'weekly' | 'monthly' | 'all_time';
    conditions?: {
      sections?: string[]; // Required sections for cross-section achievements
      topics?: string[]; // Required topics/tags for specialization achievements
      quality_threshold?: number; // For quality-based achievements (e.g., time spent per question)
      consecutive?: boolean; // For streak-based achievements
      percentage?: number; // For completion percentage achievements (0-100)
      session_threshold?: number; // For session-based achievements (lessons per session)
      tool_types?: string[]; // For tool usage achievements
      days_of_week?: number[]; // For temporal achievements (0=Sunday, 6=Saturday)
      months?: number[]; // For seasonal achievements (0=January, 11=December)
    };
  };
  reward?: {
    xp: number;
    badge?: string;
    title?: string; // Special title unlocked
  };
  isSecret?: boolean; // Hidden until unlocked
  seasonalAvailable?: boolean; // Only available during certain periods
}

export interface UserGameStats {
  userId: string;
  // Experience and Level
  totalXP: number;
  level: number;
  xpToNextLevel: number;

  // Streaks
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date;
  streakFrozen: boolean; // One-time streak save

  // Progress Stats
  totalLessonsCompleted: number;
  totalQuizzesTaken: number;
  averageQuizScore: number;
  totalTimeSpentMinutes: number;
  totalHighlights: number;
  totalNotes: number;

  // Achievement Progress
  unlockedAchievements: UnlockedAchievement[];
  achievementProgress: Record<string, number>; // achievement_id -> progress

  // Daily/Weekly Stats
  dailyGoalStreak: number; // Consecutive days meeting daily goal
  weeklyLessonsCompleted: number;
  monthlyLessonsCompleted: number;

  // Section Progress (for content exploration achievements)
  sectionProgress: Record<string, {
    completed: number;
    total: number;
    percentage: number;
  }>;

  // Quality Learning Metrics
  averageTimePerLesson: number; // For quality learning achievements
  averageTimePerQuizQuestion: number; // For thoughtful quiz taking

  // Session Tracking
  currentSessionLessons: number; // Lessons completed in current session
  longestSessionLessons: number; // Most lessons completed in single session
  lastSessionDate: Date;

  // Tool Usage Tracking
  calculatorUsageCount: number;
  scenarioCompletionCount: number;

  // Learning Path Tracking
  crossSectionPaths: string[]; // Completed cross-section learning paths
  specializationTracks: string[]; // Completed specialization tracks

  // Temporal Tracking
  weekendLearningStreak: number; // Consecutive weekends with learning
  earlyMorningLessons: number; // Lessons before 8 AM
  lateNightLessons: number; // Lessons after 10 PM

  // Milestones
  milestonesReached: string[];

  // Gradeable challenges (design / capacity / trade-off) the user has passed.
  // Mastery is binary per challenge — used for idempotent, evidence-based XP.
  masteredChallenges?: string[];

  // Meta
  createdAt: Date;
  updatedAt: Date;
}

export interface UnlockedAchievement {
  achievementId: string;
  userId: string;
  unlockedAt: Date;
  isNew: boolean; // For showing notifications
}

// Predefined achievements
export const ACHIEVEMENTS: Achievement[] = [
  // Learning Streak Achievements
  {
    id: 'first_lesson',
    title: 'Getting Started',
    description: 'Complete your first lesson',
    icon: '🎯',
    type: 'lesson_completion',
    rarity: 'common',
    criteria: { metric: 'lessons_completed', threshold: 1 },
    reward: { xp: 10 }
  },
  {
    id: 'streak_3',
    title: 'On Fire',
    description: 'Learn for 3 days in a row',
    icon: '🔥',
    type: 'learning_streak',
    rarity: 'common',
    criteria: { metric: 'streak_days', threshold: 3 },
    reward: { xp: 25 }
  },
  {
    id: 'streak_7',
    title: 'Weekly Warrior',
    description: 'Maintain a 7-day learning streak',
    icon: '⚔️',
    type: 'learning_streak',
    rarity: 'rare',
    criteria: { metric: 'streak_days', threshold: 7 },
    reward: { xp: 50 }
  },
  {
    id: 'streak_30',
    title: 'Dedication Master',
    description: 'Learn consistently for 30 days',
    icon: '👑',
    type: 'learning_streak',
    rarity: 'epic',
    criteria: { metric: 'streak_days', threshold: 30 },
    reward: { xp: 200 }
  },
  {
    id: 'streak_100',
    title: 'Legendary Learner',
    description: 'Achieve a 100-day learning streak',
    icon: '🏆',
    type: 'learning_streak',
    rarity: 'legendary',
    criteria: { metric: 'streak_days', threshold: 100 },
    reward: { xp: 500 }
  },

  // Gradeable Challenge Achievements — earned only by PASSING graded design work,
  // not by visiting pages. This is the evidence-based core of the new XP model.
  {
    id: 'first_challenge',
    title: 'First Blood',
    description: 'Pass your first graded design challenge',
    icon: '✏️',
    type: 'tool_mastery',
    rarity: 'common',
    criteria: { metric: 'challenges_mastered', threshold: 1 },
    reward: { xp: 25 }
  },
  {
    id: 'challenges_5',
    title: 'Systems Sketcher',
    description: 'Pass 5 graded design challenges',
    icon: '📐',
    type: 'tool_mastery',
    rarity: 'rare',
    criteria: { metric: 'challenges_mastered', threshold: 5 },
    reward: { xp: 75 }
  },
  {
    id: 'challenges_15',
    title: 'Architect',
    description: 'Pass 15 graded design challenges',
    icon: '🏛️',
    type: 'tool_mastery',
    rarity: 'epic',
    criteria: { metric: 'challenges_mastered', threshold: 15 },
    reward: { xp: 200 }
  },
  {
    id: 'persistent_designer',
    title: 'Back to the Whiteboard',
    description: 'Make 25 challenge attempts — iteration is the real skill',
    icon: '🔁',
    type: 'tool_mastery',
    rarity: 'rare',
    criteria: { metric: 'challenge_attempts', threshold: 25 },
    reward: { xp: 50 }
  },

  // Learning Plan Achievements
  {
    id: 'first_learning_plan',
    title: 'Planned Learning',
    description: 'Complete your first AI-generated learning plan',
    icon: '🎯',
    type: 'learning_plan',
    rarity: 'rare',
    criteria: { metric: 'learning_plans_completed', threshold: 1 },
    reward: { xp: 100 }
  },
  {
    id: 'learning_plan_master',
    title: 'Learning Plan Master',
    description: 'Complete 5 learning plans',
    icon: '🎓',
    type: 'learning_plan',
    rarity: 'epic',
    criteria: { metric: 'learning_plans_completed', threshold: 5 },
    reward: { xp: 300 }
  },
  {
    id: 'ai_student',
    title: 'AI Student',
    description: 'Use AI to create your first personalized learning plan',
    icon: '🤖',
    type: 'learning_plan',
    rarity: 'common',
    criteria: { metric: 'ai_plans_created', threshold: 1 },
    reward: { xp: 50 }
  },
  {
    id: 'focused_learner',
    title: 'Focused Learner',
    description: 'Complete a learning plan with 100% topic completion',
    icon: '🎯',
    type: 'learning_plan',
    rarity: 'rare',
    criteria: { metric: 'perfect_plan_completion', threshold: 1 },
    reward: { xp: 150 }
  },
  {
    id: 'system_design_specialist',
    title: 'System Design Specialist',
    description: 'Complete a comprehensive system design learning plan',
    icon: '🏗️',
    type: 'learning_plan',
    rarity: 'epic',
    criteria: { metric: 'system_design_plan_completed', threshold: 1 },
    reward: { xp: 200 }
  },
  {
    id: 'ai_systems_expert',
    title: 'AI Systems Expert',
    description: 'Complete an AI/ML systems learning plan',
    icon: '🧠',
    type: 'learning_plan',
    rarity: 'epic',
    criteria: { metric: 'ai_systems_plan_completed', threshold: 1 },
    reward: { xp: 200 }
  },

  // Lesson Completion Achievements
  {
    id: 'lessons_10',
    title: 'Knowledge Seeker',
    description: 'Complete 10 lessons',
    icon: '📚',
    type: 'lesson_completion',
    rarity: 'common',
    criteria: { metric: 'lessons_completed', threshold: 10 },
    reward: { xp: 50 }
  },
  {
    id: 'lessons_50',
    title: 'Scholar',
    description: 'Complete 50 lessons',
    icon: '🎓',
    type: 'lesson_completion',
    rarity: 'rare',
    criteria: { metric: 'lessons_completed', threshold: 50 },
    reward: { xp: 150 }
  },
  {
    id: 'lessons_100',
    title: 'System Design Expert',
    description: 'Complete 100 lessons',
    icon: '🚀',
    type: 'lesson_completion',
    rarity: 'epic',
    criteria: { metric: 'lessons_completed', threshold: 100 },
    reward: { xp: 300 }
  },

  // Quiz Mastery Achievements
  {
    id: 'perfect_quiz',
    title: 'Perfect Score',
    description: 'Get 100% on any quiz',
    icon: '💯',
    type: 'quiz_mastery',
    rarity: 'common',
    criteria: { metric: 'perfect_quiz_count', threshold: 1 },
    reward: { xp: 30 }
  },
  {
    id: 'quiz_streak_5',
    title: 'Quiz Master',
    description: 'Score 90%+ on 5 quizzes in a row',
    icon: '🧠',
    type: 'quiz_mastery',
    rarity: 'rare',
    criteria: { metric: 'high_score_streak', threshold: 5 },
    reward: { xp: 75 }
  },

  // Content Explorer Achievements
  {
    id: 'section_complete_fundamentals',
    title: 'Fundamentals Master',
    description: 'Complete all lessons in Fundamentals',
    icon: '🏗️',
    type: 'content_explorer',
    rarity: 'rare',
    criteria: { metric: 'section_completion_fundamentals', threshold: 1 },
    reward: { xp: 100 }
  },
  {
    id: 'section_complete_genai',
    title: 'AI Pioneer',
    description: 'Complete all lessons in GenAI',
    icon: '🤖',
    type: 'content_explorer',
    rarity: 'rare',
    criteria: { metric: 'section_completion_genai', threshold: 1 },
    reward: { xp: 100 }
  },

  // Time Dedication Achievements
  {
    id: 'time_10_hours',
    title: 'Committed Learner',
    description: 'Spend 10 hours learning',
    icon: '⏰',
    type: 'time_dedication',
    rarity: 'common',
    criteria: { metric: 'total_time_minutes', threshold: 600 }, // 10 hours
    reward: { xp: 75 }
  },
  {
    id: 'time_50_hours',
    title: 'Deep Diver',
    description: 'Spend 50 hours learning',
    icon: '🏊‍♂️',
    type: 'time_dedication',
    rarity: 'rare',
    criteria: { metric: 'total_time_minutes', threshold: 3000 }, // 50 hours
    reward: { xp: 250 }
  },

  // Special Achievements
  {
    id: 'early_bird',
    title: 'Early Bird',
    description: 'Complete a lesson before 8 AM',
    icon: '🌅',
    type: 'milestone_achiever',
    rarity: 'common',
    criteria: { metric: 'early_morning_lesson', threshold: 1 },
    reward: { xp: 20 },
    isSecret: true
  },
  {
    id: 'night_owl',
    title: 'Night Owl',
    description: 'Complete a lesson after 10 PM',
    icon: '🦉',
    type: 'milestone_achiever',
    rarity: 'common',
    criteria: { metric: 'late_night_lesson', threshold: 1 },
    reward: { xp: 20 },
    isSecret: true
  },

  // =============================================================================
  // PHASE 1: CONTENT-BASED ACHIEVEMENTS
  // =============================================================================

  // All Section Completion Achievements
  {
    id: 'section_complete_ml_systems',
    title: 'ML Systems Engineer',
    description: 'Complete all lessons in ML Systems',
    icon: '🔬',
    type: 'content_explorer',
    rarity: 'rare',
    criteria: {
      metric: 'section_completion_percentage',
      threshold: 100,
      conditions: { sections: ['ml-systems'] }
    },
    reward: { xp: 100, title: 'ML Systems Engineer' }
  },
  {
    id: 'section_complete_technology',
    title: 'Technology Master',
    description: 'Complete 80% of Technology section (92+ lessons)',
    icon: '⚙️',
    type: 'content_explorer',
    rarity: 'epic',
    criteria: {
      metric: 'section_completion_percentage',
      threshold: 80,
      conditions: { sections: ['technology'] }
    },
    reward: { xp: 150, title: 'Technology Master' }
  },
  {
    id: 'section_complete_case_studies',
    title: 'Case Study Analyst',
    description: 'Complete all Case Studies',
    icon: '📊',
    type: 'content_explorer',
    rarity: 'rare',
    criteria: {
      metric: 'section_completion_percentage',
      threshold: 100,
      conditions: { sections: ['case-studies'] }
    },
    reward: { xp: 100, title: 'Case Study Analyst' }
  },
  {
    id: 'section_complete_practice',
    title: 'Practice Champion',
    description: 'Complete all Practice Problems',
    icon: '🏋️',
    type: 'content_explorer',
    rarity: 'epic',
    criteria: {
      metric: 'section_completion_percentage',
      threshold: 100,
      conditions: { sections: ['practice'] }
    },
    reward: { xp: 200, title: 'Practice Champion' }
  },
  {
    id: 'section_complete_reference',
    title: 'Reference Expert',
    description: 'Complete all Reference materials',
    icon: '📖',
    type: 'content_explorer',
    rarity: 'rare',
    criteria: {
      metric: 'section_completion_percentage',
      threshold: 100,
      conditions: { sections: ['reference'] }
    },
    reward: { xp: 75, title: 'Reference Expert' }
  },
  {
    id: 'section_complete_tools',
    title: 'Tool Master',
    description: 'Complete all Tools & Calculators',
    icon: '🛠️',
    type: 'content_explorer',
    rarity: 'rare',
    criteria: {
      metric: 'section_completion_percentage',
      threshold: 100,
      conditions: { sections: ['tools'] }
    },
    reward: { xp: 75, title: 'Tool Master' }
  },

  // Cross-Section Learning Path Achievements
  {
    id: 'full_stack_architect',
    title: 'Full Stack Architect',
    description: 'Complete Fundamentals + any 3 specialization sections',
    icon: '🏗️',
    type: 'learning_path',
    rarity: 'legendary',
    criteria: {
      metric: 'cross_section_completion',
      threshold: 4,
      conditions: { sections: ['fundamentals'] } // Must include fundamentals + 3 others
    },
    reward: { xp: 500, title: 'Full Stack Architect' }
  },
  {
    id: 'distributed_systems_expert',
    title: 'Distributed Systems Expert',
    description: 'Complete distributed systems learning path (Fundamentals → Technology → Practice)',
    icon: '🌐',
    type: 'learning_path',
    rarity: 'epic',
    criteria: {
      metric: 'learning_path_completion',
      threshold: 1,
      conditions: {
        sections: ['fundamentals', 'technology', 'practice'],
        topics: ['distributed-systems', 'scalability', 'databases', 'caching']
      }
    },
    reward: { xp: 300, title: 'Distributed Systems Expert' }
  },
  {
    id: 'ai_specialist',
    title: 'AI Specialist',
    description: 'Complete GenAI + ML Systems + related Practice problems',
    icon: '🤖',
    type: 'learning_path',
    rarity: 'epic',
    criteria: {
      metric: 'learning_path_completion',
      threshold: 1,
      conditions: {
        sections: ['genai', 'ml-systems', 'practice'],
        topics: ['machine-learning', 'artificial-intelligence', 'llm', 'rag']
      }
    },
    reward: { xp: 300, title: 'AI Specialist' }
  },

  // Topic Specialization Achievements
  {
    id: 'database_guru',
    title: 'Database Guru',
    description: 'Complete all database-related lessons across sections',
    icon: '🗄️',
    type: 'specialization',
    rarity: 'epic',
    criteria: {
      metric: 'topic_mastery',
      threshold: 1,
      conditions: {
        topics: ['database', 'sql', 'nosql', 'mysql', 'postgres', 'mongodb', 'redis']
      }
    },
    reward: { xp: 200, title: 'Database Guru' }
  },
  {
    id: 'cloud_architect',
    title: 'Cloud Architect',
    description: 'Complete all cloud technology lessons',
    icon: '☁️',
    type: 'specialization',
    rarity: 'epic',
    criteria: {
      metric: 'topic_mastery',
      threshold: 1,
      conditions: {
        topics: ['aws', 'gcp', 'azure', 'kubernetes', 'docker', 'cloud']
      }
    },
    reward: { xp: 200, title: 'Cloud Architect' }
  },
  {
    id: 'performance_optimizer',
    title: 'Performance Optimizer',
    description: 'Complete all performance and scalability content',
    icon: '⚡',
    type: 'specialization',
    rarity: 'epic',
    criteria: {
      metric: 'topic_mastery',
      threshold: 1,
      conditions: {
        topics: ['performance', 'scalability', 'optimization', 'caching', 'cdn']
      }
    },
    reward: { xp: 200, title: 'Performance Optimizer' }
  },

  // Completion Milestone Achievements
  {
    id: 'completionist',
    title: 'Completionist',
    description: 'Achieve 100% completion in any major section',
    icon: '💯',
    type: 'content_explorer',
    rarity: 'epic',
    criteria: {
      metric: 'section_completion_percentage',
      threshold: 100,
      conditions: { sections: ['fundamentals', 'genai', 'ml-systems', 'technology'] }
    },
    reward: { xp: 150, title: 'Completionist' }
  },
  {
    id: 'knowledge_collector',
    title: 'Knowledge Collector',
    description: 'Reach 75% overall platform completion',
    icon: '📚',
    type: 'milestone_achiever',
    rarity: 'legendary',
    criteria: {
      metric: 'overall_completion_percentage',
      threshold: 75
    },
    reward: { xp: 1000, title: 'Knowledge Collector' }
  },
  {
    id: 'platform_master',
    title: 'Platform Master',
    description: 'Reach 90% overall platform completion',
    icon: '👑',
    type: 'milestone_achiever',
    rarity: 'legendary',
    criteria: {
      metric: 'overall_completion_percentage',
      threshold: 90
    },
    reward: { xp: 2000, title: 'Platform Master' },
    isSecret: true
  },

  // =============================================================================
  // PHASE 2: BEHAVIORAL ACHIEVEMENTS
  // =============================================================================

  // Quality Learning Achievements
  {
    id: 'thoughtful_learner',
    title: 'Thoughtful Learner',
    description: 'Spend average 2+ minutes per quiz question (quality over speed)',
    icon: '🤔',
    type: 'quality_learning',
    rarity: 'rare',
    criteria: {
      metric: 'average_time_per_quiz_question',
      threshold: 120, // 2 minutes in seconds
      conditions: { quality_threshold: 10 } // At least 10 quizzes taken
    },
    reward: { xp: 100, title: 'Thoughtful Learner' }
  },
  {
    id: 'deep_diver',
    title: 'Deep Diver',
    description: 'Spend average 15+ minutes per lesson',
    icon: '🏊‍♂️',
    type: 'quality_learning',
    rarity: 'rare',
    criteria: {
      metric: 'average_time_per_lesson',
      threshold: 900, // 15 minutes in seconds
      conditions: { quality_threshold: 20 } // At least 20 lessons completed
    },
    reward: { xp: 150, title: 'Deep Diver' }
  },
  {
    id: 'explorer',
    title: 'Explorer',
    description: 'Visit related content links 25 times',
    icon: '🔍',
    type: 'quality_learning',
    rarity: 'common',
    criteria: {
      metric: 'related_links_clicked',
      threshold: 25
    },
    reward: { xp: 50 }
  },

  // Advanced Learning Patterns
  {
    id: 'marathon_learner',
    title: 'Marathon Learner',
    description: 'Complete 10 lessons in a single session',
    icon: '🏃‍♂️',
    type: 'time_dedication',
    rarity: 'rare',
    criteria: {
      metric: 'lessons_per_session',
      threshold: 10
    },
    reward: { xp: 100, title: 'Marathon Learner' }
  },
  {
    id: 'speed_runner',
    title: 'Speed Runner',
    description: 'Complete 20 lessons in a single session',
    icon: '💨',
    type: 'time_dedication',
    rarity: 'epic',
    criteria: {
      metric: 'lessons_per_session',
      threshold: 20
    },
    reward: { xp: 200, title: 'Speed Runner' },
    isSecret: true
  },
  {
    id: 'consistent_performer',
    title: 'Consistent Performer',
    description: 'Complete at least 1 lesson every day for 14 days',
    icon: '📈',
    type: 'learning_streak',
    rarity: 'rare',
    criteria: {
      metric: 'streak_days',
      threshold: 14,
      conditions: { consecutive: true }
    },
    reward: { xp: 100, title: 'Consistent Performer' }
  },

  // Temporal & Seasonal Achievements
  {
    id: 'weekend_warrior',
    title: 'Weekend Warrior',
    description: 'Learn on 10 consecutive weekends',
    icon: '⚔️',
    type: 'temporal_achievement',
    rarity: 'rare',
    criteria: {
      metric: 'weekend_learning_streak',
      threshold: 10,
      conditions: { days_of_week: [0, 6] } // Sunday and Saturday
    },
    reward: { xp: 150, title: 'Weekend Warrior' }
  },
  {
    id: 'morning_person',
    title: 'Morning Person',
    description: 'Complete 10 lessons before 9 AM',
    icon: '🌅',
    type: 'temporal_achievement',
    rarity: 'common',
    criteria: {
      metric: 'early_morning_lessons',
      threshold: 10
    },
    reward: { xp: 75 }
  },
  {
    id: 'night_scholar',
    title: 'Night Scholar',
    description: 'Complete 10 lessons after 10 PM',
    icon: '🌙',
    type: 'temporal_achievement',
    rarity: 'common',
    criteria: {
      metric: 'late_night_lessons',
      threshold: 10
    },
    reward: { xp: 75 }
  },
  {
    id: 'new_year_learner',
    title: 'New Year Learner',
    description: 'Complete 5 lessons in the first week of January',
    icon: '🎊',
    type: 'temporal_achievement',
    rarity: 'common',
    criteria: {
      metric: 'new_year_lessons',
      threshold: 5,
      timeframe: 'weekly',
      conditions: { months: [0] } // January
    },
    reward: { xp: 50 },
    isSecret: true,
    seasonalAvailable: true
  },
  {
    id: 'summer_scholar',
    title: 'Summer Scholar',
    description: 'Complete 25 lessons during summer months',
    icon: '☀️',
    type: 'temporal_achievement',
    rarity: 'rare',
    criteria: {
      metric: 'seasonal_lessons',
      threshold: 25,
      conditions: { months: [5, 6, 7] } // June, July, August
    },
    reward: { xp: 100 },
    seasonalAvailable: true
  },

  // Tool Mastery Achievements
  {
    id: 'calculator_enthusiast',
    title: 'Calculator Enthusiast',
    description: 'Use interactive calculators 50 times',
    icon: '🧮',
    type: 'tool_mastery',
    rarity: 'common',
    criteria: {
      metric: 'calculator_usage_count',
      threshold: 50
    },
    reward: { xp: 75 }
  },
  {
    id: 'scenario_master',
    title: 'Scenario Master',
    description: 'Complete all interactive scenarios',
    icon: '🎭',
    type: 'tool_mastery',
    rarity: 'rare',
    criteria: {
      metric: 'scenario_completion_count',
      threshold: 20 // Estimated number of scenarios across platform
    },
    reward: { xp: 100, title: 'Scenario Master' }
  },
  {
    id: 'power_user',
    title: 'Power User',
    description: 'Use calculators 100+ times and complete all scenarios',
    icon: '⚡',
    type: 'tool_mastery',
    rarity: 'epic',
    criteria: {
      metric: 'power_tool_usage',
      threshold: 1,
      conditions: {
        tool_types: ['calculator', 'scenario']
      }
    },
    reward: { xp: 200, title: 'Power User' }
  },

  // Advanced Streak Achievements
  {
    id: 'streak_master',
    title: 'Streak Master',
    description: 'Achieve multiple 7+ day streaks (5 total)',
    icon: '🔥',
    type: 'learning_streak',
    rarity: 'epic',
    criteria: {
      metric: 'multiple_streaks',
      threshold: 5,
      conditions: { consecutive: false }
    },
    reward: { xp: 250, title: 'Streak Master' }
  },
  {
    id: 'comeback_kid',
    title: 'Comeback Kid',
    description: 'Rebuild a streak to 14+ days after breaking a 30+ day streak',
    icon: '💪',
    type: 'learning_streak',
    rarity: 'rare',
    criteria: {
      metric: 'streak_comeback',
      threshold: 1
    },
    reward: { xp: 150, title: 'Comeback Kid' },
    isSecret: true
  },

  // Social Preparation (for future features)
  {
    id: 'sharing_is_caring',
    title: 'Sharing is Caring',
    description: 'Share 5 learning achievements on social media',
    icon: '📢',
    type: 'community_contributor',
    rarity: 'common',
    criteria: {
      metric: 'achievements_shared',
      threshold: 5
    },
    reward: { xp: 50 }
  },
  {
    id: 'mentor_in_training',
    title: 'Mentor in Training',
    description: 'Help others by sharing custom learning plans',
    icon: '👨‍🏫',
    type: 'community_contributor',
    rarity: 'rare',
    criteria: {
      metric: 'plans_shared',
      threshold: 3
    },
    reward: { xp: 100, title: 'Mentor in Training' }
  }
];

// XP to Level calculation
export const XP_PER_LEVEL = 100;
export const calculateLevel = (totalXP: number): number => {
  return Math.floor(totalXP / XP_PER_LEVEL) + 1;
};

export const calculateXPToNextLevel = (totalXP: number): number => {
  const currentLevelXP = totalXP % XP_PER_LEVEL;
  return XP_PER_LEVEL - currentLevelXP;
};

// Gamification Service Class
export class GamificationService {
  private static instance: GamificationService;

  public static getInstance(): GamificationService {
    if (!GamificationService.instance) {
      GamificationService.instance = new GamificationService();
    }
    return GamificationService.instance;
  }

  // Get user's game stats
  async getUserGameStats(userId: string): Promise<UserGameStats | null> {
    console.log('📖 [GET_STATS] Reading user stats from Firebase for user:', userId);

    try {
      const userDoc = await getUserDocument(userId);

      if (!userDoc) {
        console.log('❌ [GET_STATS] No user document found');
        return null;
      }

      console.log('📄 [GET_STATS] Raw userDoc.stats from Firebase:', {
        exists: !!userDoc.stats,
        totalXP: userDoc.stats?.totalXP,
        level: userDoc.stats?.level,
        totalLessonsCompleted: userDoc.stats?.totalLessonsCompleted,
        rawStats: userDoc.stats
      });

      if (!userDoc.stats) {
        // Initialize new user stats
        const initialStats: UserGameStats = {
          userId,
          totalXP: 0,
          level: 1,
          xpToNextLevel: XP_PER_LEVEL,
          currentStreak: 0,
          longestStreak: 0,
          lastActivityDate: new Date(),
          streakFrozen: false,
          totalLessonsCompleted: 0,
          totalQuizzesTaken: 0,
          averageQuizScore: 0,
          totalTimeSpentMinutes: 0,
          totalHighlights: 0,
          totalNotes: 0,
          unlockedAchievements: [],
          achievementProgress: {},
          dailyGoalStreak: 0,
          weeklyLessonsCompleted: 0,
          monthlyLessonsCompleted: 0,
          sectionProgress: {
            'fundamentals': { completed: 0, total: 18, percentage: 0 },
            'genai': { completed: 0, total: 34, percentage: 0 },
            'ml-systems': { completed: 0, total: 27, percentage: 0 },
            'technology': { completed: 0, total: 115, percentage: 0 },
            'case-studies': { completed: 0, total: 17, percentage: 0 },
            'practice': { completed: 0, total: 28, percentage: 0 },
            'reference': { completed: 0, total: 27, percentage: 0 },
            'tools': { completed: 0, total: 26, percentage: 0 }
          },
          averageTimePerLesson: 0,
          averageTimePerQuizQuestion: 0,
          currentSessionLessons: 0,
          longestSessionLessons: 0,
          lastSessionDate: new Date(),
          calculatorUsageCount: 0,
          scenarioCompletionCount: 0,
          crossSectionPaths: [],
          specializationTracks: [],
          weekendLearningStreak: 0,
          earlyMorningLessons: 0,
          lateNightLessons: 0,
          milestonesReached: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await this.saveUserGameStats(initialStats);
        return initialStats;
      }

      const statsData = userDoc.stats as any;

      const normalizeNumber = (value: any, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
      };

      const normalizeDate = (value: any, fallback = new Date()) => {
        if (!value) {
          return fallback;
        }
        if (value instanceof Date) {
          return value;
        }
        if (typeof value.toDate === 'function') {
          return value.toDate();
        }
        if (typeof value === 'string') {
          const parsed = new Date(value);
          return Number.isFinite(parsed.getTime()) ? parsed : fallback;
        }
        return fallback;
      };

      const defaultSectionProgress: Record<string, { completed: number; total: number; percentage: number }> = {
        'fundamentals': { completed: 0, total: 18, percentage: 0 },
        'genai': { completed: 0, total: 34, percentage: 0 },
        'ml-systems': { completed: 0, total: 27, percentage: 0 },
        'technology': { completed: 0, total: 115, percentage: 0 },
        'case-studies': { completed: 0, total: 17, percentage: 0 },
        'practice': { completed: 0, total: 28, percentage: 0 },
        'reference': { completed: 0, total: 27, percentage: 0 },
        'tools': { completed: 0, total: 26, percentage: 0 }
      };

      const achievementProgress =
        (statsData.achievementProgress && typeof statsData.achievementProgress === 'object')
          ? { ...statsData.achievementProgress }
          : {};

      const totalXP = normalizeNumber(statsData.totalXP, 0);
      const level = normalizeNumber(statsData.level, calculateLevel(totalXP));
      const xpToNextLevel = normalizeNumber(statsData.xpToNextLevel, calculateXPToNextLevel(totalXP));

      console.log('🔢 [GET_STATS] Normalized values:', {
        rawTotalXP: statsData.totalXP,
        normalizedTotalXP: totalXP,
        rawLevel: statsData.level,
        normalizedLevel: level,
        rawLessonsCompleted: statsData.totalLessonsCompleted,
        normalizedLessonsCompleted: normalizeNumber(statsData.totalLessonsCompleted, 0)
      });

      const unlockedAchievementsRaw = Array.isArray(statsData.unlockedAchievements)
        ? statsData.unlockedAchievements
        : [];

      const unlockedAchievements: UnlockedAchievement[] = unlockedAchievementsRaw.map((achievement: any) => ({
        achievementId: achievement.achievementId,
        userId,
        unlockedAt: normalizeDate(achievement.unlockedAt),
        isNew: Boolean(achievement.isNew)
      }));

      const sectionProgressRaw = (statsData.sectionProgress && typeof statsData.sectionProgress === 'object')
        ? statsData.sectionProgress
        : {};

      const sectionProgress = Object.keys(defaultSectionProgress).reduce<Record<string, { completed: number; total: number; percentage: number }>>((acc, key) => {
        const section = sectionProgressRaw[key] || {};
        acc[key] = {
          completed: normalizeNumber(section.completed, defaultSectionProgress[key].completed),
          total: normalizeNumber(section.total, defaultSectionProgress[key].total),
          percentage: normalizeNumber(section.percentage, defaultSectionProgress[key].percentage)
        };
        return acc;
      }, {});

      return {
        userId,
        totalXP,
        level,
        xpToNextLevel,
        currentStreak: normalizeNumber(statsData.currentStreak, 0),
        longestStreak: normalizeNumber(statsData.longestStreak, 0),
        lastActivityDate: normalizeDate(statsData.lastActivityDate),
        streakFrozen: Boolean(statsData.streakFrozen),
        totalLessonsCompleted: normalizeNumber(statsData.totalLessonsCompleted, 0),
        totalQuizzesTaken: normalizeNumber(statsData.totalQuizzesTaken, 0),
        averageQuizScore: normalizeNumber(statsData.averageQuizScore, 0),
        totalTimeSpentMinutes: normalizeNumber(
          statsData.totalTimeSpentMinutes ?? statsData.totalTimeSpent,
          0
        ),
        totalHighlights: normalizeNumber(
          statsData.totalHighlights ?? achievementProgress['highlights_created'],
          0
        ),
        totalNotes: normalizeNumber(
          statsData.totalNotes ?? achievementProgress['notes_created'],
          0
        ),
        unlockedAchievements,
        achievementProgress,
        dailyGoalStreak: normalizeNumber(
          statsData.dailyGoalStreak ?? achievementProgress['daily_goal_streak'],
          0
        ),
        weeklyLessonsCompleted: normalizeNumber(
          statsData.weeklyLessonsCompleted ?? achievementProgress['weekly_lessons'],
          0
        ),
        monthlyLessonsCompleted: normalizeNumber(
          statsData.monthlyLessonsCompleted ?? achievementProgress['monthly_lessons'],
          0
        ),
        sectionProgress,
        averageTimePerLesson: normalizeNumber(statsData.averageTimePerLesson, 0),
        averageTimePerQuizQuestion: normalizeNumber(statsData.averageTimePerQuizQuestion, 0),
        currentSessionLessons: normalizeNumber(statsData.currentSessionLessons, 0),
        longestSessionLessons: normalizeNumber(statsData.longestSessionLessons, 0),
        lastSessionDate: normalizeDate(statsData.lastSessionDate, normalizeDate(statsData.lastActivityDate)),
        calculatorUsageCount: normalizeNumber(statsData.calculatorUsageCount, 0),
        scenarioCompletionCount: normalizeNumber(statsData.scenarioCompletionCount, 0),
        crossSectionPaths: Array.isArray(statsData.crossSectionPaths) ? statsData.crossSectionPaths : [],
        specializationTracks: Array.isArray(statsData.specializationTracks) ? statsData.specializationTracks : [],
        weekendLearningStreak: normalizeNumber(statsData.weekendLearningStreak, 0),
        earlyMorningLessons: normalizeNumber(statsData.earlyMorningLessons, 0),
        lateNightLessons: normalizeNumber(statsData.lateNightLessons, 0),
        milestonesReached: Array.isArray(statsData.milestonesReached) ? statsData.milestonesReached : [],
        createdAt: normalizeDate(statsData.createdAt),
        updatedAt: normalizeDate(statsData.updatedAt)
      } as UserGameStats;
    } catch (error) {
      console.error('Error getting user game stats:', error);
      return null;
    }
  }

  // Save user game stats
  async saveUserGameStats(stats: UserGameStats): Promise<void> {
    console.log('💾 [SAVE_STATS] Starting save operation for user:', stats.userId);
    console.log('💾 [SAVE_STATS] Stats to save:', {
      totalXP: stats.totalXP,
      level: stats.level,
      totalLessonsCompleted: stats.totalLessonsCompleted,
      unlockedAchievementsCount: stats.unlockedAchievements.length
    });

    try {
      const userRef = doc(usersCollection, stats.userId);

      // Convert UserGameStats back to the UserDocument stats format
      const userStats = {
        totalXP: stats.totalXP,
        level: stats.level,
        xpToNextLevel: stats.xpToNextLevel,
        currentStreak: stats.currentStreak,
        longestStreak: stats.longestStreak,
        lastActivityDate: Timestamp.fromDate(stats.lastActivityDate),
        streakFrozen: stats.streakFrozen,
        totalLessonsCompleted: stats.totalLessonsCompleted,
        totalQuizzesTaken: stats.totalQuizzesTaken,
        averageQuizScore: stats.averageQuizScore,
        perfectQuizStreak: stats.achievementProgress['perfect_quiz_streak'] || 0,
        totalTimeSpentMinutes: stats.totalTimeSpentMinutes,
        totalHighlights: stats.totalHighlights,
        totalNotes: stats.totalNotes,
        unlockedAchievements: stats.unlockedAchievements.map(achievement => ({
          achievementId: achievement.achievementId,
          unlockedAt: Timestamp.fromDate(achievement.unlockedAt),
          isNew: achievement.isNew
        })),
        achievementProgress: stats.achievementProgress,
        dailyGoalStreak: stats.dailyGoalStreak,
        weeklyLessonsCompleted: stats.weeklyLessonsCompleted,
        monthlyLessonsCompleted: stats.monthlyLessonsCompleted,
        sectionProgress: stats.sectionProgress,
        averageTimePerLesson: stats.averageTimePerLesson,
        averageTimePerQuizQuestion: stats.averageTimePerQuizQuestion,
        currentSessionLessons: stats.currentSessionLessons,
        longestSessionLessons: stats.longestSessionLessons,
        lastSessionDate: Timestamp.fromDate(stats.lastSessionDate),
        calculatorUsageCount: stats.calculatorUsageCount,
        scenarioCompletionCount: stats.scenarioCompletionCount,
        crossSectionPaths: stats.crossSectionPaths,
        specializationTracks: stats.specializationTracks,
        weekendLearningStreak: stats.weekendLearningStreak,
        earlyMorningLessons: stats.earlyMorningLessons,
        lateNightLessons: stats.lateNightLessons,
        milestonesReached: stats.milestonesReached,
        updatedAt: Timestamp.now(),
        ...(stats.createdAt ? { createdAt: Timestamp.fromDate(stats.createdAt) } : {})
      };

      await updateDoc(userRef, {
        stats: userStats
      });

      // Invalidate cache to ensure fresh reads
      invalidateUserDocCache(stats.userId);

      console.log('✅ [SAVE_STATS] Successfully saved stats to Firebase');
    } catch (error) {
      console.error('❌ [SAVE_STATS] Error saving user game stats:', error);
      throw error;
    }
  }

  // Track lesson completion
  async trackLessonCompletion(userId: string, lessonId: string, timeSpent: number = 0, section?: string): Promise<UnlockedAchievement[]> {
    console.log('🎯 [GAMIFICATION] Starting lesson completion tracking:', {
      userId,
      lessonId,
      timeSpent,
      section,
      timestamp: new Date().toISOString()
    });

    const stats = await this.getUserGameStats(userId);
    if (!stats) {
      console.error('❌ [GAMIFICATION] No user stats found for userId:', userId);
      return [];
    }

    console.log('📊 [GAMIFICATION] Initial user stats:', {
      totalXP: stats.totalXP,
      level: stats.level,
      totalLessonsCompleted: stats.totalLessonsCompleted,
      currentStreak: stats.currentStreak,
      lastActivityDate: stats.lastActivityDate
    });

    const today = new Date();
    const isNewDay = !this.isSameDay(stats.lastActivityDate, today);
    const isNewSession = !this.isSameDay(stats.lastSessionDate, today);

    // Update session tracking
    if (isNewSession) {
      // New session - record previous session length
      if (stats.currentSessionLessons > stats.longestSessionLessons) {
        stats.longestSessionLessons = stats.currentSessionLessons;
      }
      stats.currentSessionLessons = 1;
      stats.lastSessionDate = today;
    } else {
      stats.currentSessionLessons += 1;
    }

    // Update streak
    if (isNewDay) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (this.isSameDay(stats.lastActivityDate, yesterday) || stats.currentStreak === 0) {
        // Continue streak or start new one
        stats.currentStreak += 1;
      } else {
        // Streak broken (unless frozen)
        if (!stats.streakFrozen) {
          stats.currentStreak = 1;
        }
      }

      // Check weekend learning
      const dayOfWeek = today.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
        if (stats.lastActivityDate && (stats.lastActivityDate.getDay() === 0 || stats.lastActivityDate.getDay() === 6)) {
          stats.weekendLearningStreak += 1;
        } else {
          stats.weekendLearningStreak = 1;
        }
      }
    }

    // Update stats
    stats.totalLessonsCompleted += 1;
    stats.totalTimeSpentMinutes += timeSpent;
    stats.longestStreak = Math.max(stats.longestStreak, stats.currentStreak);
    stats.lastActivityDate = today;

    // Update quality metrics
    if (stats.totalLessonsCompleted > 0) {
      stats.averageTimePerLesson = stats.totalTimeSpentMinutes / stats.totalLessonsCompleted;
    }

    // Track section-specific progress
    if (section && stats.sectionProgress[section]) {
      stats.sectionProgress[section].completed += 1;
      stats.sectionProgress[section].percentage = Math.round(
        (stats.sectionProgress[section].completed / stats.sectionProgress[section].total) * 100
      );

      const sectionKey = `section_lessons_${section}`;
      stats.achievementProgress[sectionKey] = stats.sectionProgress[section].completed;

      // Update section completion percentage metrics
      stats.achievementProgress[`section_completion_percentage_${section}`] = stats.sectionProgress[section].percentage;
    }

    // Add XP for lesson completion
    const oldXP = stats.totalXP;
    stats.totalXP += 15;
    console.log('💎 [GAMIFICATION] XP awarded:', {
      oldXP,
      newXP: stats.totalXP,
      xpGained: 15
    });

    // Check for time-based achievements
    const hour = today.getHours();
    if (hour < 8) {
      stats.earlyMorningLessons += 1;
      stats.achievementProgress['early_morning_lesson'] = stats.earlyMorningLessons;
    }
    if (hour >= 22) {
      stats.lateNightLessons += 1;
      stats.achievementProgress['late_night_lesson'] = stats.lateNightLessons;
    }
    if (hour < 9) {
      stats.achievementProgress['early_morning_lessons'] = stats.earlyMorningLessons;
    }
    if (hour >= 22) {
      stats.achievementProgress['late_night_lessons'] = stats.lateNightLessons;
    }

    // Track session-based achievements
    stats.achievementProgress['lessons_per_session'] = stats.currentSessionLessons;

    // Update level
    const oldLevel = stats.level;
    stats.level = calculateLevel(stats.totalXP);
    stats.xpToNextLevel = calculateXPToNextLevel(stats.totalXP);

    if (oldLevel !== stats.level) {
      console.log('🆙 [GAMIFICATION] Level up!', {
        oldLevel,
        newLevel: stats.level,
        totalXP: stats.totalXP
      });
    }

    console.log('📈 [GAMIFICATION] Updated stats before achievements check:', {
      totalXP: stats.totalXP,
      level: stats.level,
      xpToNextLevel: stats.xpToNextLevel,
      totalLessonsCompleted: stats.totalLessonsCompleted,
      currentStreak: stats.currentStreak,
      sectionProgress: section ? stats.sectionProgress[section] : 'N/A'
    });

    // Check for new achievements
    const newAchievements = await this.checkForNewAchievements(stats);

    if (newAchievements.length > 0) {
      console.log('🏆 [GAMIFICATION] New achievements unlocked:', newAchievements.map(a => ({
        id: a.achievementId,
        unlocked: a.unlockedAt
      })));

      // Trigger admin notifications for rare+ achievements (async, don't block)
      this.notifyAdminAboutAchievements(userId, newAchievements).catch(err =>
        console.error('Error sending achievement notifications:', err)
      );
    } else {
      console.log('⭕ [GAMIFICATION] No new achievements unlocked');
    }

    // Save updated stats
    console.log('💾 [GAMIFICATION] Saving user stats to Firebase...');
    try {
      await this.saveUserGameStats(stats);
      console.log('✅ [GAMIFICATION] Stats saved successfully');
    } catch (error) {
      console.error('❌ [GAMIFICATION] Failed to save stats:', error);
      throw error;
    }

    console.log('🎯 [GAMIFICATION] Lesson completion tracking complete:', {
      finalXP: stats.totalXP,
      finalLevel: stats.level,
      newAchievementsCount: newAchievements.length
    });

    return newAchievements;
  }

  // Track quiz completion
  async trackQuizCompletion(userId: string, quizId: string, score: number, timeSpent: number = 0, questionCount: number = 1): Promise<UnlockedAchievement[]> {
    const stats = await this.getUserGameStats(userId);
    if (!stats) return [];

    // Update quiz stats
    const oldAverage = stats.averageQuizScore;
    const oldCount = stats.totalQuizzesTaken;
    stats.totalQuizzesTaken += 1;
    stats.averageQuizScore = ((oldAverage * oldCount) + score) / stats.totalQuizzesTaken;

    // Update quality metrics - average time per quiz question
    if (timeSpent > 0 && questionCount > 0) {
      const timePerQuestion = timeSpent / questionCount;
      const totalQuestionTime = stats.averageTimePerQuizQuestion * (stats.totalQuizzesTaken - 1) + timePerQuestion;
      stats.averageTimePerQuizQuestion = totalQuestionTime / stats.totalQuizzesTaken;
    }

    // Track perfect scores
    if (score === 100) {
      stats.achievementProgress['perfect_quiz_count'] = (stats.achievementProgress['perfect_quiz_count'] || 0) + 1;
    }

    // Track high score streaks
    if (score >= 90) {
      stats.achievementProgress['high_score_streak'] = (stats.achievementProgress['high_score_streak'] || 0) + 1;
    } else {
      stats.achievementProgress['high_score_streak'] = 0; // Reset streak
    }

    // Update quality learning metrics
    stats.achievementProgress['average_time_per_quiz_question'] = Math.round(stats.averageTimePerQuizQuestion);

    // Add XP based on score
    const xpGain = Math.floor(score / 10) + 5; // 5-15 XP based on score
    stats.totalXP += xpGain;
    stats.level = calculateLevel(stats.totalXP);
    stats.xpToNextLevel = calculateXPToNextLevel(stats.totalXP);

    // Check for new achievements
    const newAchievements = await this.checkForNewAchievements(stats);

    await this.saveUserGameStats(stats);
    return newAchievements;
  }

  /**
   * Track a graded interactive challenge (design / capacity / trade-off).
   *
   * Unlike "mark lesson complete", XP here is EVIDENCE-BASED: it is awarded ONLY
   * when the learner passes (GradeResult.passed), scales with the rubric score and
   * weight, and is idempotent per challenge — re-passing never re-awards, which also
   * closes the documented double-count race. A failed attempt earns 0 XP but still
   * advances the streak (showing up and iterating is the habit we reward). This is
   * the un-gameable replacement for the flat 15-XP-on-a-button-click loop.
   */
  async trackChallengeCompletion(
    userId: string,
    challengeId: string,
    result: { passed: boolean; score: number; kind: string; xpWeight?: number }
  ): Promise<{ xpAwarded: number; alreadyMastered: boolean; newAchievements: UnlockedAchievement[] }> {
    const stats = await this.getUserGameStats(userId);
    if (!stats) return { xpAwarded: 0, alreadyMastered: false, newAchievements: [] };

    const mastered = stats.masteredChallenges || (stats.masteredChallenges = []);
    const alreadyMastered = mastered.includes(challengeId);

    // Streak / activity bookkeeping applies to any genuine attempt (forgiving habit loop).
    this.applyActivity(stats);

    // Count attempts for "kept iterating" signals — without ever paying XP for attempts.
    stats.achievementProgress['challenge_attempts'] =
      (stats.achievementProgress['challenge_attempts'] || 0) + 1;

    let xpAwarded = 0;
    if (result.passed && !alreadyMastered) {
      mastered.push(challengeId);
      stats.achievementProgress['challenges_mastered'] = mastered.length;
      const byKind = `challenges_mastered_${result.kind}`;
      stats.achievementProgress[byKind] = (stats.achievementProgress[byKind] || 0) + 1;

      const weight = typeof result.xpWeight === 'number' ? result.xpWeight : 25;
      const clampedScore = Math.max(0, Math.min(1, result.score));
      xpAwarded = Math.max(1, Math.round(weight * clampedScore));
      stats.totalXP += xpAwarded;
      stats.level = calculateLevel(stats.totalXP);
      stats.xpToNextLevel = calculateXPToNextLevel(stats.totalXP);
    }

    const newAchievements = await this.checkForNewAchievements(stats);
    await this.saveUserGameStats(stats);
    return { xpAwarded, alreadyMastered, newAchievements };
  }

  /** Shared streak / activity bookkeeping so challenges and lessons stay consistent. */
  private applyActivity(stats: UserGameStats): void {
    const today = new Date();
    const isNewDay = !this.isSameDay(stats.lastActivityDate, today);
    if (isNewDay) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (this.isSameDay(stats.lastActivityDate, yesterday) || stats.currentStreak === 0) {
        stats.currentStreak += 1;
      } else if (!stats.streakFrozen) {
        stats.currentStreak = 1;
      }
      stats.longestStreak = Math.max(stats.longestStreak, stats.currentStreak);
    }
    stats.lastActivityDate = today;
  }

  // Check for newly unlocked achievements
  private async checkForNewAchievements(stats: UserGameStats): Promise<UnlockedAchievement[]> {
    const newAchievements: UnlockedAchievement[] = [];

    for (const achievement of ACHIEVEMENTS) {
      if (stats.unlockedAchievements.some(unlocked => unlocked.achievementId === achievement.id)) continue;

      let currentProgress = 0;
      let meetsConditions = true;

      // Get base progress value
      switch (achievement.criteria.metric) {
        case 'lessons_completed':
          currentProgress = stats.totalLessonsCompleted;
          break;
        case 'streak_days':
          currentProgress = stats.currentStreak;
          break;
        case 'perfect_quiz_count':
          currentProgress = stats.achievementProgress['perfect_quiz_count'] || 0;
          break;
        case 'high_score_streak':
          currentProgress = stats.achievementProgress['high_score_streak'] || 0;
          break;
        case 'total_time_minutes':
          currentProgress = stats.totalTimeSpentMinutes;
          break;
        case 'early_morning_lesson':
          currentProgress = stats.earlyMorningLessons;
          break;
        case 'late_night_lesson':
          currentProgress = stats.lateNightLessons;
          break;
        case 'early_morning_lessons':
          currentProgress = stats.earlyMorningLessons;
          break;
        case 'late_night_lessons':
          currentProgress = stats.lateNightLessons;
          break;
        case 'learning_plans_completed':
          currentProgress = stats.achievementProgress['learning_plans_completed'] || 0;
          break;
        case 'ai_plans_created':
          currentProgress = stats.achievementProgress['ai_plans_created'] || 0;
          break;
        case 'perfect_plan_completion':
          currentProgress = stats.achievementProgress['perfect_plan_completion'] || 0;
          break;
        case 'system_design_plan_completed':
          currentProgress = stats.achievementProgress['system_design_plan_completed'] || 0;
          break;
        case 'ai_systems_plan_completed':
          currentProgress = stats.achievementProgress['ai_systems_plan_completed'] || 0;
          break;
        case 'section_completion_fundamentals':
          currentProgress = stats.achievementProgress['section_completion_fundamentals'] || 0;
          break;
        case 'section_completion_genai':
          currentProgress = stats.achievementProgress['section_completion_genai'] || 0;
          break;
        case 'section_completion_percentage':
          currentProgress = this.checkSectionCompletionPercentage(stats, achievement.criteria.conditions?.sections);
          break;
        case 'cross_section_completion':
          currentProgress = this.checkCrossSectionCompletion(stats, achievement.criteria.conditions?.sections);
          break;
        case 'learning_path_completion':
          currentProgress = this.checkLearningPathCompletion(stats, achievement.criteria.conditions);
          break;
        case 'topic_mastery':
          currentProgress = this.checkTopicMastery(stats, achievement.criteria.conditions?.topics);
          break;
        case 'overall_completion_percentage':
          currentProgress = this.calculateOverallCompletionPercentage(stats);
          break;
        case 'average_time_per_quiz_question':
          currentProgress = Math.round(stats.averageTimePerQuizQuestion);
          // Check quality threshold condition
          if (achievement.criteria.conditions?.quality_threshold && stats.totalQuizzesTaken < achievement.criteria.conditions.quality_threshold) {
            meetsConditions = false;
          }
          break;
        case 'average_time_per_lesson':
          currentProgress = Math.round(stats.averageTimePerLesson);
          // Check quality threshold condition
          if (achievement.criteria.conditions?.quality_threshold && stats.totalLessonsCompleted < achievement.criteria.conditions.quality_threshold) {
            meetsConditions = false;
          }
          break;
        case 'lessons_per_session':
          currentProgress = stats.currentSessionLessons;
          break;
        case 'weekend_learning_streak':
          currentProgress = stats.weekendLearningStreak;
          break;
        case 'challenges_mastered':
          currentProgress = stats.achievementProgress['challenges_mastered'] || 0;
          break;
        case 'challenge_attempts':
          currentProgress = stats.achievementProgress['challenge_attempts'] || 0;
          break;
        case 'calculator_usage_count':
          currentProgress = stats.calculatorUsageCount;
          break;
        case 'scenario_completion_count':
          currentProgress = stats.scenarioCompletionCount;
          break;
        case 'power_tool_usage':
          currentProgress = this.checkPowerToolUsage(stats);
          break;
        case 'related_links_clicked':
          currentProgress = stats.achievementProgress['related_links_clicked'] || 0;
          break;
        case 'multiple_streaks':
          currentProgress = stats.achievementProgress['multiple_streaks'] || 0;
          break;
        case 'streak_comeback':
          currentProgress = stats.achievementProgress['streak_comeback'] || 0;
          break;
        case 'achievements_shared':
          currentProgress = stats.achievementProgress['achievements_shared'] || 0;
          break;
        case 'plans_shared':
          currentProgress = stats.achievementProgress['plans_shared'] || 0;
          break;
        case 'new_year_lessons':
        case 'seasonal_lessons':
          currentProgress = this.checkSeasonalLessons(stats, achievement.criteria.conditions);
          break;
        default:
          currentProgress = stats.achievementProgress[achievement.criteria.metric] || 0;
      }

      // Update progress tracking
      stats.achievementProgress[achievement.id] = currentProgress;

      // Check if achievement is unlocked
      if (meetsConditions && currentProgress >= achievement.criteria.threshold) {
        // Award XP
        if (achievement.reward?.xp) {
          stats.totalXP += achievement.reward.xp;
          stats.level = calculateLevel(stats.totalXP);
          stats.xpToNextLevel = calculateXPToNextLevel(stats.totalXP);
        }

        const unlockedAchievement: UnlockedAchievement = {
          achievementId: achievement.id,
          userId: stats.userId,
          unlockedAt: new Date(),
          isNew: true
        };

        // Store the full achievement object in gameStats
        stats.unlockedAchievements.push(unlockedAchievement);
        newAchievements.push(unlockedAchievement);
      }
    }

    return newAchievements;
  }

  // Mark achievements as viewed (remove "isNew" flag)
  async markAchievementsAsViewed(userId: string, achievementIds: string[]): Promise<void> {
    try {
      const stats = await this.getUserGameStats(userId);
      if (stats) {
        let updated = false;
        for (const achievementId of achievementIds) {
          const achievement = stats.unlockedAchievements.find(a => a.achievementId === achievementId);
          if (achievement && achievement.isNew) {
            achievement.isNew = false;
            updated = true;
          }
        }
        if (updated) {
          await this.saveUserGameStats(stats);
        }
      }
    } catch (error) {
      console.error('Error marking achievements as viewed:', error);
    }
  }

  // Check section completion
  private async checkSectionCompletion(stats: UserGameStats, section: string): Promise<void> {
    // Define expected lesson counts per section based on content registry
    const sectionLessonCounts: Record<string, number> = {
      'fundamentals': 15, // Based on content registry
      'genai': 24,
      'ml-systems': 22,
      'technology': 64,
      'case-studies': 11,
      'practice': 11,
      'reference': 16,
      'tools': 15
    };

    const sectionKey = `section_lessons_${section}`;
    const completedCount = stats.achievementProgress[sectionKey] || 0;
    const requiredCount = sectionLessonCounts[section] || 999; // Default to high number if unknown

    if (completedCount >= requiredCount) {
      // Mark section as complete
      stats.achievementProgress[`section_completion_${section}`] = 1;
    }
  }

  // Track learning plan completion
  async trackLearningPlanCompletion(userId: string, planType: 'ai' | 'manual' | 'system_design' | 'ai_systems'): Promise<UnlockedAchievement[]> {
    const stats = await this.getUserGameStats(userId);
    if (!stats) return [];

    // Update learning plan stats
    stats.achievementProgress['learning_plans_completed'] = (stats.achievementProgress['learning_plans_completed'] || 0) + 1;
    
    // Track specific plan types
    if (planType === 'ai') {
      stats.achievementProgress['ai_plans_created'] = (stats.achievementProgress['ai_plans_created'] || 0) + 1;
    } else if (planType === 'system_design') {
      stats.achievementProgress['system_design_plan_completed'] = 1;
    } else if (planType === 'ai_systems') {
      stats.achievementProgress['ai_systems_plan_completed'] = 1;
    }

    // Add XP for completing learning plan
    stats.totalXP += 25;
    stats.level = calculateLevel(stats.totalXP);
    stats.xpToNextLevel = calculateXPToNextLevel(stats.totalXP);

    // Check for new achievements
    const newAchievements = await this.checkForNewAchievements(stats);
    
    await this.saveUserGameStats(stats);
    return newAchievements;
  }

  // Track perfect learning plan completion
  async trackPerfectPlanCompletion(userId: string): Promise<UnlockedAchievement[]> {
    const stats = await this.getUserGameStats(userId);
    if (!stats) return [];

    stats.achievementProgress['perfect_plan_completion'] = (stats.achievementProgress['perfect_plan_completion'] || 0) + 1;
    
    // Bonus XP for perfect completion
    stats.totalXP += 50;
    stats.level = calculateLevel(stats.totalXP);
    stats.xpToNextLevel = calculateXPToNextLevel(stats.totalXP);

    const newAchievements = await this.checkForNewAchievements(stats);
    await this.saveUserGameStats(stats);
    return newAchievements;
  }

  // Helper functions for achievement checking
  private checkSectionCompletionPercentage(stats: UserGameStats, sections?: string[]): number {
    if (!sections || sections.length === 0) return 0;

    const section = sections[0]; // For single section achievements
    return stats.sectionProgress[section]?.percentage || 0;
  }

  private checkCrossSectionCompletion(stats: UserGameStats, requiredSections?: string[]): number {
    if (!requiredSections) return 0;

    let completedSections = 0;
    for (const section of requiredSections) {
      if (stats.sectionProgress[section]?.percentage >= 100) {
        completedSections++;
      }
    }

    // Also count any other fully completed sections
    for (const [section, progress] of Object.entries(stats.sectionProgress)) {
      if (!requiredSections.includes(section) && progress.percentage >= 100) {
        completedSections++;
      }
    }

    return completedSections;
  }

  private checkLearningPathCompletion(stats: UserGameStats, conditions?: any): number {
    if (!conditions?.sections || !conditions?.topics) return 0;

    // Check if required sections have sufficient completion
    const requiredSectionProgress = conditions.sections.every((section: string) =>
      stats.sectionProgress[section]?.percentage >= 80 // 80% completion threshold for learning paths
    );

    if (!requiredSectionProgress) return 0;

    // For now, return 1 if sections are completed (topic tracking would require content registry integration)
    return 1;
  }

  private checkTopicMastery(stats: UserGameStats, topics?: string[]): number {
    if (!topics) return 0;

    // This would require integration with content registry to track topic-specific lessons
    // For now, estimate based on overall progress across relevant sections
    const relevantSections = ['fundamentals', 'technology', 'genai', 'ml-systems'];
    const averageProgress = relevantSections.reduce((sum, section) =>
      sum + (stats.sectionProgress[section]?.percentage || 0), 0) / relevantSections.length;

    return averageProgress >= 70 ? 1 : 0; // 70% threshold for topic mastery
  }

  private calculateOverallCompletionPercentage(stats: UserGameStats): number {
    const totalSections = Object.keys(stats.sectionProgress).length;
    const totalProgress = Object.values(stats.sectionProgress).reduce((sum, progress) =>
      sum + progress.percentage, 0);

    return Math.round(totalProgress / totalSections);
  }

  private checkPowerToolUsage(stats: UserGameStats): number {
    const hasHighCalculatorUsage = stats.calculatorUsageCount >= 100;
    const hasCompletedScenarios = stats.scenarioCompletionCount >= 20;

    return (hasHighCalculatorUsage && hasCompletedScenarios) ? 1 : 0;
  }

  private checkSeasonalLessons(stats: UserGameStats, conditions?: any): number {
    if (!conditions?.months) return 0;

    // This would require tracking lessons by date - for now return existing progress
    return stats.achievementProgress['seasonal_lessons'] || 0;
  }

  // Add new tracking methods
  async trackCalculatorUsage(userId: string): Promise<UnlockedAchievement[]> {
    const stats = await this.getUserGameStats(userId);
    if (!stats) return [];

    stats.calculatorUsageCount += 1;
    stats.achievementProgress['calculator_usage_count'] = stats.calculatorUsageCount;

    const newAchievements = await this.checkForNewAchievements(stats);
    await this.saveUserGameStats(stats);
    return newAchievements;
  }

  async trackScenarioCompletion(userId: string): Promise<UnlockedAchievement[]> {
    const stats = await this.getUserGameStats(userId);
    if (!stats) return [];

    stats.scenarioCompletionCount += 1;
    stats.achievementProgress['scenario_completion_count'] = stats.scenarioCompletionCount;

    const newAchievements = await this.checkForNewAchievements(stats);
    await this.saveUserGameStats(stats);
    return newAchievements;
  }

  async trackRelatedLinkClick(userId: string): Promise<UnlockedAchievement[]> {
    const stats = await this.getUserGameStats(userId);
    if (!stats) return [];

    stats.achievementProgress['related_links_clicked'] = (stats.achievementProgress['related_links_clicked'] || 0) + 1;

    const newAchievements = await this.checkForNewAchievements(stats);
    await this.saveUserGameStats(stats);
    return newAchievements;
  }

  // Data integrity and repair functions
  async recalculateUserXP(userId: string): Promise<{ oldXP: number; newXP: number; achievementsXP: number; activityXP: number } | null> {
    try {
      const stats = await this.getUserGameStats(userId);
      if (!stats) return null;

      const oldXP = stats.totalXP;

      // Calculate XP from achievements
      let achievementsXP = 0;
      for (const unlockedAchievement of stats.unlockedAchievements) {
        const achievement = ACHIEVEMENTS.find(a => a.id === unlockedAchievement.achievementId);
        if (achievement?.reward?.xp) {
          achievementsXP += achievement.reward.xp;
        }
      }

      // Calculate XP from activities
      let activityXP = 0;

      // Lesson completion XP: 15 XP per lesson
      activityXP += stats.totalLessonsCompleted * 15;

      // Quiz XP: Estimate based on average quiz score (5-15 XP per quiz)
      // Use a conservative estimate of 10 XP per quiz if we don't have detailed score data
      activityXP += stats.totalQuizzesTaken * 10;

      // Learning plan XP: This is harder to reconstruct without detailed tracking
      // We'll add this based on the achievement progress if available
      const learningPlansCompleted = stats.achievementProgress['learning_plans_completed'] || 0;
      activityXP += learningPlansCompleted * 25; // 25 XP per learning plan

      const newXP = achievementsXP + activityXP;

      // Update the user's XP
      stats.totalXP = newXP;
      stats.level = calculateLevel(newXP);
      stats.xpToNextLevel = calculateXPToNextLevel(newXP);
      stats.updatedAt = new Date();

      await this.saveUserGameStats(stats);

      return {
        oldXP,
        newXP,
        achievementsXP,
        activityXP
      };
    } catch (error) {
      console.error('Error recalculating user XP:', error);
      return null;
    }
  }

  // Validate user stats and identify potential data integrity issues
  async validateUserStats(userId: string): Promise<{
    isValid: boolean;
    issues: string[];
    stats: UserGameStats | null;
  }> {
    try {
      const stats = await this.getUserGameStats(userId);
      if (!stats) {
        return {
          isValid: false,
          issues: ['User stats not found'],
          stats: null
        };
      }

      const issues: string[] = [];

      // Check if totalXP makes sense given achievements
      let expectedMinXP = 0;
      for (const unlockedAchievement of stats.unlockedAchievements) {
        const achievement = ACHIEVEMENTS.find(a => a.id === unlockedAchievement.achievementId);
        if (achievement?.reward?.xp) {
          expectedMinXP += achievement.reward.xp;
        }
      }

      // Add XP from basic activities
      expectedMinXP += stats.totalLessonsCompleted * 15; // 15 XP per lesson
      expectedMinXP += stats.totalQuizzesTaken * 5; // Minimum 5 XP per quiz

      if (stats.totalXP < expectedMinXP) {
        issues.push(`Total XP (${stats.totalXP}) is less than expected minimum (${expectedMinXP}) based on achievements and activities`);
      }

      // Check level calculation
      const expectedLevel = calculateLevel(stats.totalXP);
      if (stats.level !== expectedLevel) {
        issues.push(`Level (${stats.level}) doesn't match calculated level (${expectedLevel}) for ${stats.totalXP} XP`);
      }

      // Check XP to next level calculation
      const expectedXPToNext = calculateXPToNextLevel(stats.totalXP);
      if (stats.xpToNextLevel !== expectedXPToNext) {
        issues.push(`XP to next level (${stats.xpToNextLevel}) doesn't match calculated value (${expectedXPToNext})`);
      }

      // Check for NaN values
      if (!Number.isFinite(stats.totalXP)) {
        issues.push('Total XP is not a finite number');
      }
      if (!Number.isFinite(stats.level)) {
        issues.push('Level is not a finite number');
      }
      if (!Number.isFinite(stats.xpToNextLevel)) {
        issues.push('XP to next level is not a finite number');
      }

      // Check achievements consistency
      const uniqueAchievementIds = new Set(stats.unlockedAchievements.map(a => a.achievementId));
      if (uniqueAchievementIds.size !== stats.unlockedAchievements.length) {
        issues.push('Duplicate achievements found in unlocked achievements list');
      }

      return {
        isValid: issues.length === 0,
        issues,
        stats
      };
    } catch (error) {
      console.error('Error validating user stats:', error);
      return {
        isValid: false,
        issues: ['Error validating stats: ' + error],
        stats: null
      };
    }
  }

  // Batch repair function for multiple users
  async batchRepairUserStats(userIds: string[]): Promise<{
    success: string[];
    failed: string[];
    results: Record<string, any>;
  }> {
    const success: string[] = [];
    const failed: string[] = [];
    const results: Record<string, any> = {};

    for (const userId of userIds) {
      try {
        console.log(`Repairing stats for user: ${userId}`);

        // First validate to identify issues
        const validation = await this.validateUserStats(userId);

        if (!validation.isValid) {
          console.log(`Found issues for user ${userId}:`, validation.issues);

          // Try to recalculate XP
          const recalcResult = await this.recalculateUserXP(userId);

          if (recalcResult) {
            results[userId] = {
              validation: validation.issues,
              repair: recalcResult,
              status: 'repaired'
            };
            success.push(userId);
            console.log(`Successfully repaired user ${userId}: ${recalcResult.oldXP} → ${recalcResult.newXP} XP`);
          } else {
            results[userId] = {
              validation: validation.issues,
              status: 'failed_repair'
            };
            failed.push(userId);
            console.log(`Failed to repair user ${userId}`);
          }
        } else {
          results[userId] = {
            status: 'no_issues_found'
          };
          success.push(userId);
          console.log(`No issues found for user ${userId}`);
        }
      } catch (error) {
        console.error(`Error processing user ${userId}:`, error);
        results[userId] = {
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        };
        failed.push(userId);
      }
    }

    return { success, failed, results };
  }

  // Helper functions
  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  // Notify admins about achievement unlocks (rare+ achievements only)
  private async notifyAdminAboutAchievements(userId: string, achievements: UnlockedAchievement[]) {
    try {
      const { NotificationService } = await import('./notification-service');
      const { getUserDocument } = await import('./firebase');

      const userDoc = await getUserDocument(userId);
      if (!userDoc) return;

      for (const achievement of achievements) {
        const achievementDef = ACHIEVEMENTS.find(a => a.id === achievement.achievementId);
        if (!achievementDef) continue;

        // Send notification via service with device info
        await NotificationService.notifyAchievementUnlocked({
          achievementId: achievement.achievementId,
          achievementTitle: achievementDef.title,
          achievementRarity: achievementDef.rarity,
          achievementIcon: achievementDef.icon,
          achievementDescription: achievementDef.description,
          userEmail: userDoc.email,
          userName: userDoc.displayName,
          userId,
          xpReward: achievementDef.reward?.xp,
          deviceInfo: (userDoc as any).lastDevice ? {
            browser: (userDoc as any).lastDevice.browser,
            os: (userDoc as any).lastDevice.os,
            device: (userDoc as any).lastDevice.device,
            isMobile: (userDoc as any).lastDevice.isMobile,
          } : undefined,
        });

        // Check for achievement milestones
        const stats = await this.getUserGameStats(userId);
        if (stats) {
          const totalAchievements = stats.unlockedAchievements.length;
          const milestones = [5, 10, 25, 50];

          if (milestones.includes(totalAchievements)) {
            await NotificationService.notifyAchievementMilestone({
              userId,
              userEmail: userDoc.email,
              userName: userDoc.displayName,
              totalAchievements,
              milestone: totalAchievements,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error notifying admin about achievements:', error);
    }
  }
}
