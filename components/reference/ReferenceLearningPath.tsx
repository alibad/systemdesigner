'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { userStorage } from '@/lib/unified-storage';
import { REFERENCE_NAVIGATION } from '@/lib/referenceConfig';

interface TopicProgress {
  topicId: string;
  visited: boolean;
  quizScore?: number;
  challengesCompleted?: number;
  lastVisited?: string;
}

interface LearningPathProps {
  currentTopic?: string;
}

// Convert shared navigation to learning path format
const topics = REFERENCE_NAVIGATION.map((item, index) => ({
  id: item.slug,
  title: item.title,
  category: item.category.split(' ')[0], // Use first word of category
  difficulty: index < 5 ? 'beginner' : index < 10 ? 'intermediate' : 'advanced',
  estimatedTime: '15 min',
  description: getTopicDescription(item.slug),
  prerequisites: index > 0 && index < 3 ? [REFERENCE_NAVIGATION[index - 1].slug] : [],
  icon: getTopicIcon(item.category)
}));

function getTopicDescription(slug: string): string {
  const descriptions: Record<string, string> = {
    'rules-of-thumb': 'Back-of-the-envelope calculations',
    'latencies': 'CPU, memory, storage, and network latencies',
    'full-request-path': 'End-to-end request analysis',
    'data-sizes': 'Understanding data sizes and transfer times',
    'one-mb-transfer': 'Transfer time calculations',
    'infrastructure': 'Core infrastructure components',
    'cdn-and-network': 'Content delivery and networking',
    'load-balancing': 'Algorithms and health checks',
    'api-patterns': 'REST, GraphQL, gRPC patterns',
    'rate-limiting': 'Rate limiting strategies',
    'sql-vs-nosql': 'Database selection and trade-offs',
    'caching-strategies': 'Cache patterns and invalidation',
    'database-sharding': 'Horizontal partitioning strategies',
    'cap-theorem': 'Consistency, availability, and partition tolerance',
    'message-queues': 'Async communication patterns',
    'cloud-comparison': 'Cloud provider comparison'
  };
  return descriptions[slug] || slug;
}

function getTopicIcon(category: string): string {
  const icons: Record<string, string> = {
    'Performance & Capacity': '⚡',
    'Infrastructure & Networking': '🌐',
    'Data & Storage': '💾',
    'Architecture & Messaging': '🏗️',
    'Cloud & Deployment': '☁️'
  };
  return icons[category] || '📚';
}

export function ReferenceLearningPath({ currentTopic }: LearningPathProps) {
  const [progress, setProgress] = useState<Map<string, TopicProgress>>(new Map());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    // Load progress from Firebase
    const loadProgress = async () => {
      try {
        const firebaseProgress = await userStorage.getProgress('reference');
        const localProgress = new Map<string, TopicProgress>();
        
        // Convert Firebase data to local format
        Object.entries(firebaseProgress).forEach(([topicId, fbProgress]) => {
          if (fbProgress && fbProgress.completed) {
            localProgress.set(topicId, {
              topicId,
              visited: true,
              lastVisited: fbProgress.completedAt || new Date().toISOString()
            });
          }
        });
        
        setProgress(localProgress);
      } catch (error) {
        console.log('Failed to load progress:', error);
      }
    };
    
    loadProgress();
  }, []);

  useEffect(() => {
    if (currentTopic && isClient) {
      // Mark current topic as visited and save to Firebase
      const updateProgress = async () => {
        setProgress(prev => {
          const newProgress = new Map(prev);
          const existing = newProgress.get(currentTopic) || { topicId: currentTopic, visited: false };
          newProgress.set(currentTopic, {
            ...existing,
            visited: true,
            lastVisited: new Date().toISOString()
          });
          return newProgress;
        });
        
        try {
          await userStorage.setProgress('reference', currentTopic, {
            completed: true,
            completedAt: new Date().toISOString()
          });
        } catch (error) {
          console.log('Failed to save reference progress:', error);
        }
      };
      
      updateProgress();
    }
  }, [currentTopic, isClient]);

  const categories = ['all', ...new Set(topics.map(t => t.category))];
  
  const filteredTopics = selectedCategory === 'all' 
    ? topics 
    : topics.filter(t => t.category === selectedCategory);

  const getTopicStatus = (topicId: string) => {
    const topicProgress = progress.get(topicId);
    const topic = topics.find(t => t.id === topicId);
    
    if (!topic) return 'locked';
    
    // Check prerequisites
    const prereqsMet = topic.prerequisites.every(prereq => {
      const prereqProgress = progress.get(prereq);
      return prereqProgress?.visited;
    });
    
    if (!prereqsMet) return 'locked';
    if (topicProgress?.visited) return 'completed';
    return 'available';
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300';
      case 'intermediate': return 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300';
      case 'advanced': return 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300';
      default: return 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300';
    }
  };

  const totalTopics = topics.length;
  const completedTopics = Array.from(progress.values()).filter(p => p.visited).length;
  const progressPercent = (completedTopics / totalTopics) * 100;

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            🎯 Learning Path
          </h3>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            {completedTopics} / {totalTopics} completed
          </div>
        </div>
        
        {/* Overall Progress */}
        <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-3 mb-4">
          <div
            className="bg-gradient-to-r from-indigo-500 to-purple-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === category
                  ? 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700'
                  : 'bg-neutral-50 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              {category === 'all' ? 'All Topics' : category}
            </button>
          ))}
        </div>
      </div>

      {/* Topics Grid */}
      <div className="grid gap-3">
        {filteredTopics.map(topic => {
          const status = getTopicStatus(topic.id);
          const topicProgress = progress.get(topic.id);
          const isLocked = status === 'locked';
          const isCompleted = status === 'completed';
          const isCurrent = currentTopic === topic.id;

          return (
            <div
              key={topic.id}
              className={`relative rounded-lg border transition-all ${
                isCurrent
                  ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/10'
                  : isLocked
                  ? 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/30 opacity-60'
                  : isCompleted
                  ? 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/10'
                  : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50 hover:border-neutral-300 dark:hover:border-neutral-600'
              }`}
            >
              {isLocked ? (
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl opacity-50">🔒</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-neutral-500 dark:text-neutral-400">
                          {topic.title}
                        </h4>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${getDifficultyColor(topic.difficulty)}`}>
                          {topic.difficulty}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-400 dark:text-neutral-500 mb-2">
                        {topic.description}
                      </p>
                      <div className="text-xs text-amber-600 dark:text-amber-400">
                        Prerequisites: {topic.prerequisites.map(p => topics.find(t => t.id === p)?.title).join(', ')}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <Link
                  href={`/reference/${topic.id}` as any}
                  className="block p-4 group"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{topic.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className={`font-medium ${
                          isCurrent
                            ? 'text-indigo-900 dark:text-indigo-100'
                            : isCompleted
                            ? 'text-emerald-900 dark:text-emerald-100'
                            : 'text-neutral-900 dark:text-neutral-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                        } transition-colors`}>
                          {topic.title}
                        </h4>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${getDifficultyColor(topic.difficulty)}`}>
                          {topic.difficulty}
                        </span>
                        {isCompleted && (
                          <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                        {isCurrent && (
                          <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 text-xs font-medium rounded">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                        {topic.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {topic.estimatedTime}
                        </span>
                        {topicProgress?.quizScore !== undefined && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Quiz: {topicProgress.quizScore}%
                          </span>
                        )}
                        {topicProgress?.lastVisited && (
                          <span className="text-neutral-400">
                            Last visited: {new Date(topicProgress.lastVisited).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-neutral-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* Achievements */}
      <div className="mt-6 p-4 rounded-lg border border-purple-200 dark:border-purple-900/40 bg-purple-50 dark:bg-purple-900/10">
        <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-3">🏆 Achievements</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className={`text-center p-2 rounded ${completedTopics >= 1 ? 'bg-white dark:bg-purple-900/20' : 'opacity-50'}`}>
            <div className="text-2xl mb-1">🎯</div>
            <div className="text-xs font-medium">First Step</div>
          </div>
          <div className={`text-center p-2 rounded ${completedTopics >= 5 ? 'bg-white dark:bg-purple-900/20' : 'opacity-50'}`}>
            <div className="text-2xl mb-1">📚</div>
            <div className="text-xs font-medium">Knowledge Seeker</div>
          </div>
          <div className={`text-center p-2 rounded ${completedTopics >= 8 ? 'bg-white dark:bg-purple-900/20' : 'opacity-50'}`}>
            <div className="text-2xl mb-1">🎓</div>
            <div className="text-xs font-medium">Expert</div>
          </div>
          <div className={`text-center p-2 rounded ${completedTopics === totalTopics ? 'bg-white dark:bg-purple-900/20' : 'opacity-50'}`}>
            <div className="text-2xl mb-1">👑</div>
            <div className="text-xs font-medium">Master</div>
          </div>
        </div>
      </div>
    </div>
  );
}