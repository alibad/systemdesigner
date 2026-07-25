import { readFile } from 'fs/promises';
import { join } from 'path';
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

export default async function QuizPage() {
  const allQuizzes = await loadAllQuizzes();

  return <QuizHub allQuizzes={allQuizzes} />;
}