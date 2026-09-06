'use client';

import React, { useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { INTERVIEW_PROMPTS, generateSessionId } from '@/lib/interview-sessions';
import { useInterviewSessions } from '@/hooks/useInterviewSessions';

export default function GymSessionPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const prompt = useMemo(() => INTERVIEW_PROMPTS.find(p => p.id === params.id), [params.id]);
  const { createSession } = useInterviewSessions();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [notes, setNotes] = useState('');
  const [currentPhase, setCurrentPhase] = useState<'prep' | 'interview' | 'review'>('prep');

  // Initialize session when component mounts
  useEffect(() => {
    if (!prompt) return;
    
    // Check if we have an active session in progress
    const activeSessionId = localStorage.getItem(`gym-session-${prompt.id}`);
    if (activeSessionId) {
      setSessionId(activeSessionId);
      // Check if we should continue or start fresh
      const sessionData = localStorage.getItem(`gym-session-data-${activeSessionId}`);
      if (sessionData) {
        const data = JSON.parse(sessionData);
        setNotes(data.notes || '');
        setTimeLeft(data.timeLeft || prompt.duration * 60);
        setCurrentPhase(data.phase || 'prep');
        setIsActive(data.isActive || false);
      } else {
        setTimeLeft(prompt.duration * 60);
      }
    }
  }, [prompt]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(time => {
          const newTime = time - 1;
          // Auto-save session data
          if (sessionId) {
            localStorage.setItem(`gym-session-data-${sessionId}`, JSON.stringify({
              notes,
              timeLeft: newTime,
              phase: currentPhase,
              isActive: newTime > 0
            }));
          }
          
          if (newTime === 0) {
            setIsActive(false);
            setCurrentPhase('review');
          }
          
          return newTime;
        });
      }, 1000);
    } else {
      if (interval) clearInterval(interval);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timeLeft, sessionId, notes, currentPhase]);

  // Save notes to localStorage
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem(`gym-session-data-${sessionId}`, JSON.stringify({
        notes,
        timeLeft,
        phase: currentPhase,
        isActive
      }));
    }
  }, [notes, sessionId, timeLeft, currentPhase, isActive]);

  const startSession = () => {
    if (!prompt) return;
    
    const newSessionId = createSession(prompt.id);
    setSessionId(newSessionId);
    localStorage.setItem(`gym-session-${prompt.id}`, newSessionId);
    
    // Set starter components for whiteboard
    const starter = { components: prompt.starter };
    localStorage.setItem('architecture-guide-components', JSON.stringify(starter));
    
    setCurrentPhase('interview');
    setIsActive(true);
    setTimeLeft(prompt.duration * 60);
  };

  const pauseResumeTimer = () => {
    setIsActive(!isActive);
  };

  const resetSession = () => {
    if (sessionId && prompt) {
      localStorage.removeItem(`gym-session-${prompt.id}`);
      localStorage.removeItem(`gym-session-data-${sessionId}`);
    }
    setSessionId(null);
    setTimeLeft(prompt?.duration ? prompt.duration * 60 : 0);
    setIsActive(false);
    setCurrentPhase('prep');
    setNotes('');
  };

  const finishSession = () => {
    setIsActive(false);
    setCurrentPhase('review');
    if (sessionId && prompt) {
      // Navigate to scoring page
      router.push(`/gym/${prompt.id}/score/${sessionId}` as any);
    }
  };

  if (!prompt) {
    return (
      <main className="max-w-[1200px] mx-auto px-4 md:px-6 py-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
            Prompt Not Found
          </h1>
          <Link 
            href="/gym"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Back to Interview Gym
          </Link>
        </div>
      </main>
    );
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeColor = () => {
    if (timeLeft <= 300) return 'text-red-600 dark:text-red-400'; // Last 5 minutes
    if (timeLeft <= 600) return 'text-yellow-600 dark:text-yellow-400'; // Last 10 minutes
    return 'text-neutral-900 dark:text-neutral-100';
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400';
      case 'Medium': return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400';
      case 'Hard': return 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400';
      default: return 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-400';
    }
  };

  return (
    <main className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <Link 
          href="/gym"
          className="inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mb-4"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Interview Gym
        </Link>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
              {prompt.title}
            </h1>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded text-sm font-medium ${getDifficultyColor(prompt.difficulty)}`}>
                {prompt.difficulty}
              </span>
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                {prompt.category} • {prompt.duration} minutes
              </span>
            </div>
          </div>
          
          {currentPhase !== 'prep' && (
            <div className="text-center">
              <div className={`text-3xl font-mono font-bold ${getTimeColor()}`}>
                {formatTime(timeLeft)}
              </div>
              <div className="text-sm text-neutral-500 dark:text-neutral-500">
                {timeLeft <= 0 ? 'Time\'s up!' : 'Time left'}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Problem Statement */}
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              Problem Statement
            </h2>
            <p className="text-neutral-700 dark:text-neutral-300 mb-4">
              {prompt.prompt}
            </p>
            
            {/* Key Expectations */}
            <div className="mb-4">
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                Key Expectations
              </h3>
              <ul className="space-y-1">
                {prompt.expectations.map((expectation, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                    <span className="text-indigo-500 mt-1">•</span>
                    {expectation}
                  </li>
                ))}
              </ul>
            </div>

            {/* Key Components */}
            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                Key Components to Consider
              </h3>
              <div className="flex flex-wrap gap-2">
                {prompt.keyComponents.map((component, index) => (
                  <span 
                    key={index}
                    className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded text-sm"
                  >
                    {component}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Session Controls */}
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
            {currentPhase === 'prep' && (
              <div className="text-center">
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
                  Ready to Start?
                </h3>
                <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                  Once you start, the timer will begin. You can use the whiteboard to design your solution and take notes in the sidebar.
                </p>
                <button
                  onClick={startSession}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
                >
                  Start {prompt.duration}-Minute Session
                </button>
              </div>
            )}

            {currentPhase === 'interview' && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={pauseResumeTimer}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      isActive 
                        ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {isActive ? 'Pause' : 'Resume'}
                  </button>
                  
                  <Link
                    href="/whiteboard"
                    target="_blank"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Open Whiteboard ↗
                  </Link>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={resetSession}
                    className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 px-3 py-2 text-sm"
                  >
                    Reset
                  </button>
                  
                  <button
                    onClick={finishSession}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Finish Session
                  </button>
                </div>
              </div>
            )}

            {currentPhase === 'review' && (
              <div className="text-center">
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
                  {timeLeft <= 0 ? 'Time\'s Up!' : 'Session Complete'}
                </h3>
                <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                  Ready to score your performance? The rubric will help you identify strengths and areas for improvement.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={resetSession}
                    className="border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 px-6 py-3 rounded-lg font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                  >
                    Try Again
                  </button>
                  
                  {sessionId && (
                    <Link
                      href={`/gym/${prompt.id}/score/${sessionId}` as any}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                      Score Performance
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Notes */}
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
              Session Notes
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Write down your approach, assumptions, capacity calculations, and trade-offs..."
              rows={12}
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm p-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-500">
              Notes are automatically saved as you type
            </div>
          </div>

          {/* Tips */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
              💡 Interview Tips
            </h3>
            <div className="space-y-3 text-sm text-neutral-700 dark:text-neutral-300">
              <div>
                <div className="font-medium mb-1">1. Clarify Requirements (5 min)</div>
                <div className="text-neutral-600 dark:text-neutral-400">Ask about scale, features, and constraints</div>
              </div>
              <div>
                <div className="font-medium mb-1">2. Capacity Planning (5 min)</div>
                <div className="text-neutral-600 dark:text-neutral-400">Estimate users, data, and throughput</div>
              </div>
              <div>
                <div className="font-medium mb-1">3. High-Level Design (15 min)</div>
                <div className="text-neutral-600 dark:text-neutral-400">Core components and data flow</div>
              </div>
              <div>
                <div className="font-medium mb-1">4. Deep Dive (15 min)</div>
                <div className="text-neutral-600 dark:text-neutral-400">Critical components and APIs</div>
              </div>
              <div>
                <div className="font-medium mb-1">5. Scale & Optimize (5 min)</div>
                <div className="text-neutral-600 dark:text-neutral-400">Bottlenecks and solutions</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}