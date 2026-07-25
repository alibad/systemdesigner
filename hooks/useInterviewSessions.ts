'use client';

import { useState, useEffect } from 'react';
import { 
  InterviewSession, 
  InterviewSessionStorage, 
  generateSessionId,
  calculateSessionScore,
  SessionScore
} from '@/lib/interview-sessions';

export function useInterviewSessions() {
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = () => {
    try {
      const storedSessions = InterviewSessionStorage.getAllSessions();
      setSessions(storedSessions);
    } catch (error) {
      console.error('Error loading interview sessions:', error);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const createSession = (promptId: string): string => {
    const sessionId = generateSessionId();
    const newSession: InterviewSession = {
      id: sessionId,
      promptId,
      startTime: new Date().toISOString(),
      duration: 0,
      status: 'in_progress',
      notes: '',
      createdAt: new Date().toISOString()
    };

    try {
      InterviewSessionStorage.saveSession(newSession);
      loadSessions();
      return sessionId;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  };

  const updateSession = (session: InterviewSession) => {
    try {
      InterviewSessionStorage.saveSession(session);
      loadSessions();
    } catch (error) {
      console.error('Error updating session:', error);
      throw error;
    }
  };

  const endSession = (sessionId: string, notes: string) => {
    const session = InterviewSessionStorage.getSession(sessionId);
    if (!session) return;

    const endTime = new Date().toISOString();
    const startTime = new Date(session.startTime);
    const duration = Math.round((new Date(endTime).getTime() - startTime.getTime()) / (1000 * 60));

    const updatedSession: InterviewSession = {
      ...session,
      endTime,
      duration,
      notes,
      status: 'completed'
    };

    updateSession(updatedSession);
  };

  const scoreSession = (sessionId: string, scores: SessionScore[]) => {
    const session = InterviewSessionStorage.getSession(sessionId);
    if (!session) return;

    const { total, percentage } = calculateSessionScore(scores);

    const updatedSession: InterviewSession = {
      ...session,
      scores,
      totalScore: total,
      percentageScore: percentage
    };

    updateSession(updatedSession);
  };

  const deleteSession = (sessionId: string) => {
    try {
      InterviewSessionStorage.deleteSession(sessionId);
      loadSessions();
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  };

  const getSessionStats = () => {
    const completed = sessions.filter(s => s.status === 'completed');
    const inProgress = sessions.filter(s => s.status === 'in_progress');
    
    const averageScore = completed.length > 0 
      ? completed.reduce((sum, s) => sum + (s.percentageScore || 0), 0) / completed.length 
      : 0;

    const averageDuration = completed.length > 0 
      ? completed.reduce((sum, s) => sum + s.duration, 0) / completed.length 
      : 0;

    return {
      total: sessions.length,
      completed: completed.length,
      inProgress: inProgress.length,
      averageScore: Math.round(averageScore),
      averageDuration: Math.round(averageDuration)
    };
  };

  const getSessionsByPrompt = (promptId: string) => {
    return sessions.filter(session => session.promptId === promptId);
  };

  return {
    sessions,
    loading,
    createSession,
    updateSession,
    endSession,
    scoreSession,
    deleteSession,
    getSessionStats,
    getSessionsByPrompt,
    refreshSessions: loadSessions
  };
}

export function useInterviewSession(sessionId: string) {
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const loadSession = () => {
    try {
      const foundSession = InterviewSessionStorage.getSession(sessionId);
      setSession(foundSession);
    } catch (error) {
      console.error('Error loading session:', error);
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  const updateSessionNotes = (notes: string) => {
    if (!session) return;

    const updatedSession = { ...session, notes };
    try {
      InterviewSessionStorage.saveSession(updatedSession);
      setSession(updatedSession);
    } catch (error) {
      console.error('Error updating session notes:', error);
      throw error;
    }
  };

  const updateSessionStatus = (status: InterviewSession['status']) => {
    if (!session) return;

    const updatedSession = { ...session, status };
    if (status === 'completed' && !session.endTime) {
      updatedSession.endTime = new Date().toISOString();
      const startTime = new Date(session.startTime);
      const duration = Math.round((new Date().getTime() - startTime.getTime()) / (1000 * 60));
      updatedSession.duration = duration;
    }

    try {
      InterviewSessionStorage.saveSession(updatedSession);
      setSession(updatedSession);
    } catch (error) {
      console.error('Error updating session status:', error);
      throw error;
    }
  };

  return {
    session,
    loading,
    updateSessionNotes,
    updateSessionStatus,
    refreshSession: loadSession
  };
}