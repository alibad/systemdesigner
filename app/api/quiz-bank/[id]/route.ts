import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

let allQuizzesCache: any = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Quiz ID is required' },
        { status: 400 }
      );
    }

    // Load all quizzes from single file (with caching)
    const now = Date.now();
    if (!allQuizzesCache || (now - cacheTimestamp) > CACHE_DURATION) {
      const quizPath = join(process.cwd(), 'lib', 'quiz-bank', 'all-quizzes.json');
      const fileContent = await readFile(quizPath, 'utf8');
      allQuizzesCache = JSON.parse(fileContent);
      cacheTimestamp = now;
    }

    // Find the specific quiz
    const quiz = allQuizzesCache[id];

    if (!quiz) {
      return NextResponse.json(
        {
          error: 'Quiz not found',
          message: `No quiz found with ID: ${id}`,
          totalQuizzes: Object.keys(allQuizzesCache).length
        },
        { status: 404 }
      );
    }

    // Set appropriate cache headers
    const isProduction = process.env.NODE_ENV === 'production';
    const cacheHeaders = isProduction
      ? {
          'Cache-Control': 's-maxage=86400, stale-while-revalidate=43200', // 24h cache, 12h stale
          'CDN-Cache-Control': 'max-age=86400'
        }
      : {
          'Cache-Control': 'max-age=300, must-revalidate', // 5 minutes in dev
          'CDN-Cache-Control': 'max-age=300'
        };

    return NextResponse.json(quiz, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...cacheHeaders
      }
    });

  } catch (error) {
    console.error('Quiz bank API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}