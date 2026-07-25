"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { FirebaseLearningPlan, getTopicContent, calculatePlanProgress } from '@/lib/firebase-learning-plans';
import { getLessonProgress } from '@/lib/firebase';
import { userStorage } from '@/lib/unified-storage';
import { useAuth } from '@/hooks/useAuth';
import LearningPlanEditor from './LearningPlanEditor';

interface SimpleLearningPlanDashboardProps {
  plan: FirebaseLearningPlan;
  onCreateNew: () => void;
}

export default function SimpleLearningPlanDashboard({ plan, onCreateNew }: SimpleLearningPlanDashboardProps) {
  const { user } = useAuth();
  const [currentPlan, setCurrentPlan] = useState(plan);
  const [isEditing, setIsEditing] = useState(false);
  const [topicsWithContent, setTopicsWithContent] = useState<any[]>([]);
  const [actualProgress, setActualProgress] = useState<Record<string, { completed: boolean; quizScore?: number }>>({});
  const [loadingProgress, setLoadingProgress] = useState(true);

  useEffect(() => {
    setCurrentPlan(plan);
    // Get topics with content details
    const topicsWithDetails = plan.topics.map(topicId => {
      const content = getTopicContent(topicId);
      return content ? { ...content, topicId } : null;
    }).filter(Boolean);
    setTopicsWithContent(topicsWithDetails);
  }, [plan]);

  // Load actual completion status from UnifiedStorage
  useEffect(() => {
    const loadActualProgress = async () => {
      try {
        setLoadingProgress(true);

        // Set user for UnifiedStorage
        if (user !== undefined) {
          await userStorage.setUser(user);
        }

        const progressMap: Record<string, { completed: boolean; quizScore?: number }> = {};

        // Get all quiz attempts from unified storage
        const allQuizAttempts = await userStorage.getQuizAttempts();

        // Check each topic's actual completion status
        for (const topic of topicsWithContent) {
          // Extract lesson slug from path (e.g., '/genai/llm-intro' -> 'llm-intro')
          const lessonSlug = topic.path.split('/').pop() || topic.topicId;

          console.log(`Checking progress for topic: ${topic.title}`);
          console.log(`  - topicId: ${topic.topicId}`);
          console.log(`  - path: ${topic.path}`);
          console.log(`  - extracted lessonSlug: ${lessonSlug}`);

          // Check if lesson is completed via progress tracking
          const allProgress = await userStorage.getProgress();
          const lessonProgress = Object.values(allProgress)
            .find(progress => progress.item === lessonSlug && progress.completed);
          const isCompleted = !!lessonProgress;

          console.log(`  - lessonProgress:`, lessonProgress);
          console.log(`  - isCompleted: ${isCompleted}`);

          // Get best quiz score if available
          const topicQuizAttempt = allQuizAttempts[lessonSlug] || allQuizAttempts[topic.contentId];
          const bestQuizScore = topicQuizAttempt?.score;

          console.log(`  - quiz attempt found:`, !!topicQuizAttempt);
          console.log(`  - bestQuizScore: ${bestQuizScore}`);

          progressMap[topic.topicId] = {
            completed: isCompleted,
            quizScore: bestQuizScore
          };
        }

        setActualProgress(progressMap);
      } catch (error) {
        console.error('Error loading actual progress:', error);
        if (!user) {
          console.log('Progress loading failed: No user available');
        } else {
          console.log('Progress loading failed for authenticated user:', error);
        }
      } finally {
        setLoadingProgress(false);
      }
    };

    if (topicsWithContent.length > 0) {
      loadActualProgress();
    }
      }, [topicsWithContent, user]);

  const handleTopicStart = async (contentId: string) => {
    try {
      // Navigate to the content with learning plan context
      const content = getTopicContent(contentId);
      
      if (content?.path) {
        const contextUrl = `${content.path}?from=learning-plan&planId=${currentPlan.id}&planSlug=${currentPlan.slug}&planTitle=${encodeURIComponent(currentPlan.title)}`;
        window.location.href = contextUrl;
      }
    } catch (error) {
      console.error('Error starting topic:', error);
    }
  };

  const handleTopicComplete = async (contentId: string) => {
    try {
      // For now, just mark as completed locally - proper progress tracking can be implemented later
      console.log('Topic completed:', contentId);
      // In a real implementation, this would update the user's progress in Firebase
      // Refresh plan data - in a real app, you'd want to update state more efficiently
      window.location.reload();
    } catch (error) {
      console.error('Error completing topic:', error);
    }
  };

  // Current topic is determined by actual progress, not stored status
  const currentTopic = topicsWithContent.find(topic => !actualProgress[topic.topicId]?.completed);
  
  const actualCompletedCount = Object.values(actualProgress).filter(p => p.completed).length;
  const progressPercentage = topicsWithContent.length > 0 
    ? Math.round((actualCompletedCount / topicsWithContent.length) * 100)
    : 0;

  const getTopicIcon = (contentId: string, index: number) => {
    if (loadingProgress) {
      return (
        <div className="w-8 h-8 rounded-full border-2 border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 animate-pulse flex items-center justify-center">
          <div className="w-3 h-3 bg-neutral-300 dark:bg-neutral-600 rounded-full"></div>
        </div>
      );
    }
    
    const progress = actualProgress[contentId];
    
    if (progress?.completed) {
      return (
        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      );
    }
    
    return (
      <div className="w-8 h-8 rounded-full border-2 border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 flex items-center justify-center">
        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {index + 1}
        </span>
      </div>
    );
  };

  const handlePlanSaved = (updatedPlan: FirebaseLearningPlan) => {
    setCurrentPlan(updatedPlan);
    setIsEditing(false);
  };

  const getSectionColor = (section: string) => {
    const colors = {
      fundamentals: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      genai: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'ml-systems': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      technology: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'case-studies': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
      practice: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      reference: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
      tools: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    };
    return colors[section as keyof typeof colors] || colors.fundamentals;
  };

  // Show editor if in editing mode
  if (isEditing) {
    return (
      <LearningPlanEditor
        plan={currentPlan}
        onSave={handlePlanSaved}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-3 md:px-6">
      {/* Header - Left Aligned */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
          {currentPlan.title}
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-6">
          {currentPlan.description}
        </p>
        
        {/* Progress Bar - Full Width */}
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Progress</span>
            {loadingProgress ? (
              <div className="animate-pulse">
                <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-32"></div>
              </div>
            ) : (
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                {actualCompletedCount} of {topicsWithContent.length} completed
              </span>
            )}
          </div>
          <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-4">
            {loadingProgress ? (
              <div className="bg-neutral-300 dark:bg-neutral-600 h-4 rounded-full animate-pulse"></div>
            ) : (
              <div 
                className="bg-gradient-to-r from-indigo-500 to-violet-500 h-4 rounded-full transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
            )}
          </div>
          <div className="flex items-center justify-between mt-3">
            {loadingProgress ? (
              <div className="animate-pulse flex items-center justify-between w-full">
                <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-16"></div>
                <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-24"></div>
              </div>
            ) : (
              <>
                <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {progressPercentage}%
                </span>
                <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  {currentPlan.topics.length} topics total
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Current Topic */}
      {currentTopic && (
        <div className="rounded-2xl bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950 dark:to-violet-950 border border-indigo-200 dark:border-indigo-800 p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-indigo-900 dark:text-indigo-100">
                Up Next
              </h3>
              <p className="text-indigo-700 dark:text-indigo-300">Your learning journey continues</p>
            </div>
          </div>
          
          <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 md:p-6 border border-indigo-200 dark:border-indigo-800">
            {/* Mobile: Stack layout, Desktop: Side-by-side */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1">
                <h4 className="text-lg md:text-xl font-semibold mb-2">{currentTopic.title}</h4>
                <p className="text-neutral-600 dark:text-neutral-300 mb-4">
                  Ready to continue your learning journey
                </p>
                {/* Mobile: Wrap metadata tags */}
                <div className="flex items-center flex-wrap gap-2 md:gap-4 text-sm">
                  <span className={`px-3 py-1 rounded-full ${getSectionColor(currentTopic.section)}`}>
                    {currentTopic.section}
                  </span>
                  <span className="text-neutral-500 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {currentTopic.duration}
                  </span>
                  <span className="text-neutral-500 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 712-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    {currentTopic.level}
                  </span>
                  {currentTopic.hasQuiz && (
                    <span className="text-neutral-500 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Quiz
                    </span>
                  )}
                </div>
              </div>

              {/* Mobile: Full width button, Desktop: Compact button */}
              <div className="w-full md:w-auto md:shrink-0">
                <button
                  onClick={() => handleTopicStart(currentTopic.topicId)}
                  className="inline-flex items-center justify-center gap-2 w-full md:w-auto px-4 md:px-6 py-2 rounded-lg bg-indigo-600 text-white text-sm md:text-base font-medium shadow hover:shadow-lg transition"
                >
                  Start Learning
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All Topics */}
      <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">Learning Path</h3>
          <div className="flex gap-3">
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
            >
              Edit Plan
            </button>
          </div>
        </div>
        
                            <div className="space-y-4">
                      {topicsWithContent.map((topic, index) => (
            <div key={`${topic.topicId}-${index}`} className="flex items-start gap-3 md:gap-4 p-4 md:p-6 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition border border-neutral-100 dark:border-neutral-700">
              {getTopicIcon(topic.topicId, index)}
              
              <div className="flex-1 min-w-0">
                {/* Mobile: Stack layout, Desktop: Side-by-side */}
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <button
                      onClick={() => handleTopicStart(topic.topicId)}
                      className="text-base md:text-lg font-medium hover:text-indigo-600 dark:hover:text-indigo-400 transition block text-left"
                    >
                      {topic.title}
                    </button>
                    <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1 leading-relaxed">
                      {topic.aiReasoning}
                    </p>

                    {/* Mobile: Wrap metadata tags */}
                    <div className="flex items-center flex-wrap gap-2 md:gap-3 mt-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${getSectionColor(topic.section)}`}>
                        {topic.section}
                      </span>
                      <span className="text-xs text-neutral-500 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {topic.duration}
                      </span>
                      <span className="text-xs text-neutral-500 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        {topic.level}
                      </span>

                      {topic.hasQuiz && (
                        <span className="text-xs text-neutral-500 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Quiz
                        </span>
                      )}
                      {loadingProgress ? (
                        <div className="animate-pulse">
                          <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded-full w-16"></div>
                        </div>
                      ) : (
                        <>
                          {actualProgress[topic.topicId]?.quizScore && (
                            <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded-full">
                              Quiz: {actualProgress[topic.topicId].quizScore}%
                            </span>
                          )}
                          {actualProgress[topic.topicId]?.completed && (
                            <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded-full flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Completed
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Mobile: Full width button, Desktop: Compact button */}
                  <div className="flex items-center w-full md:w-auto md:shrink-0">
                    {loadingProgress ? (
                      <div className="animate-pulse w-full md:w-24">
                        <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded-lg w-full"></div>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleTopicStart(topic.topicId)}
                        className="inline-flex items-center justify-center gap-2 w-full md:w-auto px-3 md:px-4 py-2 text-xs md:text-sm rounded-lg bg-indigo-600 text-white font-medium shadow hover:shadow-lg transition"
                      >
                        {actualProgress[topic.topicId]?.completed ? 'Review Topic' : 'Start Learning'}
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Plan Completed */}
      {progressPercentage === 100 && (
        <div className="text-center p-8 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border border-green-200 dark:border-green-800">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500 flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-green-900 dark:text-green-100 mb-2">
            Congratulations!
          </h3>
          <p className="text-green-700 dark:text-green-300 mb-4">
            You've completed your learning plan! Great job mastering all {currentPlan.topics.length} topics.
          </p>
          <button
            onClick={onCreateNew}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-green-600 text-white font-medium shadow hover:shadow-lg transition"
          >
            Start New Learning Plan
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
