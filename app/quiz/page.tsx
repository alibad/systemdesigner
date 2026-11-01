import type { Metadata } from 'next';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { getContentById, getContentByPath } from '@/lib/content-registry';
import QuizHub from './QuizHub';

interface QuizData {
  title: string;
  section: string;
  difficulty: string;
  duration: string;
  questions: any[];
}

async function loadAllQuizzes(): Promise<Record<string, QuizData>> {
  try {
    const quizPath = join(process.cwd(), 'lib', 'quiz-bank', 'all-quizzes.json');
    const fileContent = await readFile(quizPath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Failed to load quiz data:', error);
    return {};
  }
}

export const metadata: Metadata = {
  title: 'System Design Knowledge Quizzes',
  description: 'Test and validate your system design knowledge with quizzes across fundamentals, AI and ML systems, and core technologies.',
  alternates: { canonical: '/quiz' },
};

export default async function QuizPage() {
  const allQuizzes = await loadAllQuizzes();
  // Quiz ids are registry ids or lesson slugs; link a quiz to its lesson only when one exists.
  const lessonPaths = Object.fromEntries(
    Object.entries(allQuizzes).flatMap(([id, quiz]) => {
      const lesson = getContentById(id) ?? getContentByPath(`/${quiz.section}/${id}`);
      return lesson ? [[id, lesson.path]] : [];
    }),
  );

  return <QuizHub allQuizzes={allQuizzes} lessonPaths={lessonPaths} />;
}