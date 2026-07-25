'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { INTERVIEW_PROMPTS } from '@/lib/interview-sessions';
import { useInterviewSessions } from '@/hooks/useInterviewSessions';
import { formatDuration, getSessionPerformanceLevel } from '@/lib/interview-sessions';

export default function InterviewGymPage() {
  const { sessions, getSessionStats, getSessionsByPrompt } = useInterviewSessions();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');

  const stats = getSessionStats();
  
  const categories = ['All', 'Design', 'Scale', 'Architecture', 'Data'];
  const difficulties = ['All', 'Easy', 'Medium', 'Hard'];

  const filteredPrompts = INTERVIEW_PROMPTS.filter(prompt => {
    if (selectedCategory !== 'All' && prompt.category !== selectedCategory) return false;
    if (selectedDifficulty !== 'All' && prompt.difficulty !== selectedDifficulty) return false;
    return true;
  });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400';
      case 'Medium': return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400';
      case 'Hard': return 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400';
      default: return 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-400';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Design': return '🏗️';
      case 'Scale': return '📈';
      case 'Architecture': return '🏛️';
      case 'Data': return '📊';
      default: return '💼';
    }
  };

  const getPromptStats = (promptId: string) => {
    const promptSessions = getSessionsByPrompt(promptId);
    const completed = promptSessions.filter(s => s.status === 'completed');
    const averageScore = completed.length > 0 
      ? Math.round(completed.reduce((sum, s) => sum + (s.percentageScore || 0), 0) / completed.length)
      : null;

    return {
      attempts: promptSessions.length,
      completed: completed.length,
      averageScore
    };
  };

  return (
    <main className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
          Interview Gym 🏋️‍♂️
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400">
          Practice system design interviews with timed sessions and detailed rubric scoring. 
          Build confidence through repetition and feedback.
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 text-center">
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-1">
            {stats.total}
          </div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">Total Sessions</div>
        </div>
        
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
            {stats.completed}
          </div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">Completed</div>
        </div>
        
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 text-center">
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 mb-1">
            {stats.inProgress}
          </div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">In Progress</div>
        </div>
        
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
            {stats.averageScore}%
          </div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">Avg Score</div>
        </div>
        
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 text-center">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">
            {stats.averageDuration}m
          </div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">Avg Duration</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 mb-8">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Category:</span>
            <div className="flex gap-2">
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    selectedCategory === category
                      ? 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Difficulty:</span>
            <div className="flex gap-2">
              {difficulties.map(difficulty => (
                <button
                  key={difficulty}
                  onClick={() => setSelectedDifficulty(difficulty)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    selectedDifficulty === difficulty
                      ? 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {difficulty}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Prompts Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredPrompts.map(prompt => {
          const promptStats = getPromptStats(prompt.id);
          const bestScore = promptStats.averageScore;
          const performance = bestScore ? getSessionPerformanceLevel(bestScore) : null;

          return (
            <div
              key={prompt.id}
              className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getCategoryIcon(prompt.category)}</span>
                  <div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(prompt.difficulty)}`}>
                      {prompt.difficulty}
                    </span>
                  </div>
                </div>
                <div className="text-sm text-neutral-500 dark:text-neutral-500">
                  {formatDuration(prompt.duration)}
                </div>
              </div>

              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                {prompt.title}
              </h3>
              
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                {prompt.description}
              </p>

              {/* Stats */}
              {promptStats.attempts > 0 && (
                <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3 mb-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-neutral-600 dark:text-neutral-400">
                      Attempts: {promptStats.attempts} • Completed: {promptStats.completed}
                    </span>
                    {performance && (
                      <span className={`font-medium ${performance.color}`}>
                        Best: {bestScore}%
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Link
                  href={`/gym/${prompt.id}`}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-center text-sm font-medium transition-colors"
                >
                  Start Session
                </Link>
                
                {promptStats.completed > 0 && (
                  <Link
                    href={`/gym/${prompt.id}/history` as any}
                    className="px-4 py-2 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-lg text-sm font-medium transition-colors"
                  >
                    History
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Getting Started Section */}
      {stats.total === 0 && (
        <div className="mt-8 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800 p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
              Ready to Start Your First Interview? 🚀
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6 max-w-2xl mx-auto">
              Each session includes a timed interview, note-taking space, and detailed rubric scoring. 
              Start with an Easy prompt and work your way up!
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link
                href="/gym/url-shortener"
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Try URL Shortener (Easy)
              </Link>
              <Link
                href="/gym/chat-system"
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Try Chat System (Medium)
              </Link>
              <Link
                href="/gym/news-feed"
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Try News Feed (Hard)
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="mt-8 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
          💡 How It Works
        </h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm text-neutral-600 dark:text-neutral-400">
          <div>
            <div className="font-medium text-neutral-900 dark:text-neutral-100 mb-1">1. Choose & Start</div>
            <div>Select a prompt that matches your level and start a timed session</div>
          </div>
          <div>
            <div className="font-medium text-neutral-900 dark:text-neutral-100 mb-1">2. Design & Document</div>
            <div>Use the whiteboard to design and take notes on your approach</div>
          </div>
          <div>
            <div className="font-medium text-neutral-900 dark:text-neutral-100 mb-1">3. Score & Improve</div>
            <div>Complete the rubric scoring to identify areas for improvement</div>
          </div>
        </div>
      </div>
    </main>
  );
}