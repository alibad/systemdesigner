'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { InteractiveQuiz } from '@/components/fundamentals/InteractiveLearning';

// Helper function to get icons for sections
function getIconForSection(section: string): string {
  const icons: Record<string, string> = {
    'fundamentals': '🏗️',
    'genai': '🤖',
    'ml-systems': '⚙️',
    'technology': '💻',
    'case-studies': '📚',
    'practice': '🎯',
    'reference': '📖',
    'tools': '🔧'
  };
  return icons[section] || '📝';
}

interface QuizCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  questionCount: number;
  timeEstimate: string;
  topics: string[];
  category: string;
}

interface QuizData {
  title: string;
  section: string;
  difficulty: string;
  duration: string;
  questions: any[];
}

interface QuizHubProps {
  allQuizzes: Record<string, QuizData>;
}

export default function QuizHub({ allQuizzes }: QuizHubProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQuiz, setSelectedQuiz] = useState<string | null>(null);

  // Generate quiz statistics
  const stats = useMemo(() => {
    const total = Object.keys(allQuizzes).length;
    const bySection: Record<string, number> = {};

    Object.values(allQuizzes).forEach(quiz => {
      bySection[quiz.section] = (bySection[quiz.section] || 0) + 1;
    });

    return { total, bySection };
  }, [allQuizzes]);

  // Convert quiz data to display format
  const quizzes: QuizCategory[] = useMemo(() => {
    return Object.entries(allQuizzes).map(([id, quiz]) => ({
      id,
      title: quiz.title,
      description: `Test your understanding of ${quiz.title.toLowerCase()} concepts and applications.`,
      icon: getIconForSection(quiz.section),
      difficulty: (quiz.difficulty.charAt(0).toUpperCase() + quiz.difficulty.slice(1)) as 'Beginner' | 'Intermediate' | 'Advanced',
      questionCount: quiz.questions?.length || 4,
      timeEstimate: quiz.duration || '10 min',
      topics: [quiz.title.toLowerCase()],
      category: quiz.section.charAt(0).toUpperCase() + quiz.section.slice(1).replace('-', ' ')
    }));
  }, [allQuizzes]);

  // Filter quizzes based on search and category
  const filteredQuizzes = useMemo(() => {
    let filtered = quizzes;

    if (searchQuery) {
      filtered = filtered.filter(quiz =>
        quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        quiz.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        quiz.topics.some(topic => topic.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(quiz => quiz.category === selectedCategory);
    }

    return filtered;
  }, [quizzes, searchQuery, selectedCategory]);

  // Get unique categories
  const categories = ['All', ...Array.from(new Set(quizzes.map(quiz => quiz.category)))];

  // Show quiz modal
  if (selectedQuiz) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <button
            onClick={() => setSelectedQuiz(null)}
            className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-4"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Quiz Hub
          </button>
        </div>
        <InteractiveQuiz
          title={quizzes.find(q => q.id === selectedQuiz)?.title || 'Quiz'}
          quizId={selectedQuiz}
          lessonSlug={selectedQuiz}
        />
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
          🧠 Knowledge Assessment Hub
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-6 max-w-3xl">
          Test and validate your system design knowledge with our complete collection of {stats.total} quizzes.
          Track your progress across fundamentals, AI/ML systems, and advanced technologies.
        </p>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.total}</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">Total Quizzes</div>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.total * 4}
            </div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">Total Questions</div>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{Object.keys(stats.bySection).length}</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">Learning Sections</div>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">Complete</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">Quiz System</div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="mb-8 space-y-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Search quizzes by title, topic, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-md px-4 py-2 pl-10 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
          />
          <svg className="w-4 h-4 absolute left-3 top-3 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === category
                  ? 'bg-indigo-600 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              {category}
              {category !== 'All' && (
                <span className="ml-2 text-xs opacity-75">
                  ({quizzes.filter(q => q.category === category).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Quiz Results */}
      {filteredQuizzes.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-neutral-400 dark:text-neutral-600 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <p className="text-neutral-600 dark:text-neutral-400">No quizzes found matching your criteria.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {filteredQuizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card hover:shadow-lg transition-all p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{quiz.icon}</span>
                    <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                      {quiz.title}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-xs px-2 py-1 rounded font-medium ${difficultyColors[quiz.difficulty]}`}>
                      {quiz.difficulty}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded font-medium ${categoryColors[quiz.category as keyof typeof categoryColors] || 'bg-gray-100 text-gray-700'}`}>
                      {quiz.category}
                    </span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {quiz.questionCount} questions • {quiz.timeEstimate}
                    </span>
                  </div>
                  <p className="text-neutral-600 dark:text-neutral-400 mb-4">
                    {quiz.description}
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Topics:</div>
                <div className="flex flex-wrap gap-2">
                  {quiz.topics.map(topic => (
                    <span
                      key={topic}
                      className="text-xs px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedQuiz(quiz.id)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                  >
                    Start Quiz
                  </button>
                  <Link
                    href={(quiz.category === 'Fundamentals' ? `/fundamentals/${quiz.id}` :
                          quiz.category === 'Genai' ? `/genai/${quiz.id}` :
                          quiz.category === 'Technology' ? `/technology/${quiz.id}` : '#') as any}
                    className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                  >
                    Learn Topic
                  </Link>
                </div>
                <div className="text-sm text-emerald-600 dark:text-emerald-400">
                  ✓ Available
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quiz Statistics */}
      <div className="mt-12 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-8">
        <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
          📊 Quiz Statistics
        </h3>
        <div className="grid md:grid-cols-4 gap-6">
          {Object.entries(stats.bySection).map(([section, count]) => (
            <div key={section} className="bg-white dark:bg-neutral-800 rounded-lg p-4">
              <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                {getIconForSection(section)} {section.charAt(0).toUpperCase() + section.slice(1).replace('-', ' ')}
              </h4>
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{count}</p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">quizzes available</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

// Color definitions
const difficultyColors = {
  'Beginner': 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
  'Intermediate': 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
  'Advanced': 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
};

const categoryColors = {
  'Fundamentals': 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
  'Genai': 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
  'Ml systems': 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300',
  'Technology': 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300',
  'Case studies': 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300',
  'Practice': 'bg-pink-100 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300',
  'Reference': 'bg-gray-100 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300',
  'Tools': 'bg-cyan-100 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300'
};