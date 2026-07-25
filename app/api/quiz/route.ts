import { NextResponse } from 'next/server';
import { userStorage } from '@/lib/unified-storage';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId parameter is required' }, { status: 400 });
    }

    // Create a user-like object for UnifiedStorage
    const userObj = { uid: userId, isAnonymous: false };
    await userStorage.setUser(userObj as any);
    const quizAttempts = await userStorage.getQuizAttempts();

    // Convert UnifiedStorage format to legacy API format for compatibility
    const legacyFormat = Object.entries(quizAttempts).map(([quizId, attempt]) => ({
      id: `${quizId}-${Date.now()}`,
      userId: userId,
      topicId: quizId,
      score: attempt.score,
      answers: attempt.answers ? Object.values(attempt.answers) : [],
      timeSpent: 0, // UnifiedStorage doesn't track time spent yet
      completedAt: { toDate: () => new Date(attempt.lastAttempt) },
      attempts: attempt.attempts
    }));

    return NextResponse.json(legacyFormat);
  } catch (error) {
    console.error('Error fetching quiz attempts:', error);
    return NextResponse.json({ error: 'Failed to fetch quiz attempts' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, topicId, score, answers } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Create a user-like object for UnifiedStorage
    const userObj = { uid: userId, isAnonymous: false };
    await userStorage.setUser(userObj as any);

    // Save quiz attempt using UnifiedStorage (consolidated model)
    await userStorage.setQuizAttempt(topicId, {
      score: score,
      answers: answers || [],
      attempts: 1, // For now, just track as single attempt
      lastAttempt: new Date().toISOString()
    });

    return NextResponse.json({ id: `${topicId}-${Date.now()}` }, { status: 201 });
  } catch (error) {
    console.error('Error saving quiz attempt:', error);
    return NextResponse.json({ error: 'Failed to save quiz attempt' }, { status: 500 });
  }
}