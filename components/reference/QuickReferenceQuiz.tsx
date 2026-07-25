'use client';

import React, { useState, useEffect } from 'react';
import { userStorage } from '@/lib/unified-storage';

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface QuizProps {
  questions: QuizQuestion[];
  title: string;
  category: string;
}

export function QuickReferenceQuiz({ questions, title, category }: QuizProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [score, setScore] = useState(0);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set());
  const [isClient, setIsClient] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);

  // Load progress from Firebase
  useEffect(() => {
    setIsClient(true);
    
    const loadProgress = async () => {
      try {
        // Use UnifiedStorage to get quiz attempts for this reference category
        const allQuizAttempts = await userStorage.getQuizAttempts();
        const quizAttempt = allQuizAttempts[`reference-${category}`];
        if (quizAttempt) {
          // Note: answeredQuestions structure might be different in UnifiedStorage
          // For now, we'll skip loading answered questions to avoid structure mismatch
          setScore(Math.round((quizAttempt.score * questions.length) / 100));
        }
      } catch (error) {
        console.log('Failed to load quiz progress:', error);
      }
    };
    
    loadProgress();
  }, [category, questions.length]);

  // Save progress to Firebase
  useEffect(() => {
    if (!isClient || answeredQuestions.size === 0) return;
    
    const saveProgress = async () => {
      try {
        await userStorage.setQuizAttempt(`reference-${category}`, {
          score: (score / questions.length) * 100,
          attempts: 1,
          lastAttempt: new Date().toISOString()
        });
      } catch (error) {
        console.log('Failed to save quiz progress:', error);
      }
    };
    
    saveProgress();
  }, [answeredQuestions, score, category, isClient, questions.length]);

  const handleAnswerSelect = (answerIndex: number) => {
    setSelectedAnswer(answerIndex);
    setShowAnswer(true);
    
    const question = questions[currentQuestion];
    if (!answeredQuestions.has(question.id)) {
      setAnsweredQuestions(prev => new Set([...prev, question.id]));
      if (answerIndex === question.correctAnswer) {
        setScore(prev => prev + 1);
      }
    }
  };

  const nextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
      setSelectedAnswer(null);
      setShowAnswer(false);
    }
  };

  const prevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
      setSelectedAnswer(null);
      setShowAnswer(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-emerald-600 dark:text-emerald-400';
      case 'medium': return 'text-amber-600 dark:text-amber-400';
      case 'hard': return 'text-red-600 dark:text-red-400';
      default: return 'text-neutral-600 dark:text-neutral-400';
    }
  };

  if (!showQuiz) {
    return (
      <div className="rounded-lg border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50 dark:bg-indigo-900/10 p-4 mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-indigo-900 dark:text-indigo-100 mb-1">
              📝 Test Your Knowledge
            </h3>
            <p className="text-sm text-indigo-700 dark:text-indigo-300">
              {questions.length} questions • Progress: {answeredQuestions.size}/{questions.length}
            </p>
          </div>
          <button
            onClick={() => setShowQuiz(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            Start Quiz
          </button>
        </div>
      </div>
    );
  }

  const question = questions[currentQuestion];

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          📝 {title}
        </h3>
        <button
          onClick={() => setShowQuiz(false)}
          className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          ✕
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-400 mb-2">
          <span>Question {currentQuestion + 1} of {questions.length}</span>
          <span>Score: {score}/{answeredQuestions.size}</span>
        </div>
        <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
          <div
            className="bg-indigo-600 h-2 rounded-full transition-all"
            style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-xs font-medium ${getDifficultyColor(question.difficulty)}`}>
            {question.difficulty.toUpperCase()}
          </span>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {question.category}
          </span>
          {answeredQuestions.has(question.id) && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">
              ✓ Answered
            </span>
          )}
        </div>
        
        <h4 className="text-base font-medium text-neutral-900 dark:text-neutral-100 mb-4">
          {question.question}
        </h4>

        {/* Options */}
        <div className="space-y-2">
          {question.options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswerSelect(index)}
              disabled={showAnswer}
              className={`w-full text-left p-3 rounded-lg text-sm transition-colors ${
                showAnswer
                  ? index === question.correctAnswer
                    ? 'bg-emerald-100 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                    : index === selectedAnswer && index !== question.correctAnswer
                    ? 'bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 text-red-800 dark:text-red-300'
                    : 'bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 opacity-50'
                  : 'bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  showAnswer && index === question.correctAnswer
                    ? 'border-emerald-500 bg-emerald-500'
                    : showAnswer && index === selectedAnswer && index !== question.correctAnswer
                    ? 'border-red-500 bg-red-500'
                    : 'border-neutral-400'
                }`}>
                  {showAnswer && index === question.correctAnswer && (
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  {showAnswer && index === selectedAnswer && index !== question.correctAnswer && (
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span>{option}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Explanation */}
      {showAnswer && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/10 p-4 mb-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Explanation:</strong> {question.explanation}
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={prevQuestion}
          disabled={currentQuestion === 0}
          className="px-4 py-2 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Previous
        </button>

        {currentQuestion === questions.length - 1 ? (
          <button
            onClick={() => {
              setCurrentQuestion(0);
              setSelectedAnswer(null);
              setShowAnswer(false);
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Restart Quiz
          </button>
        ) : (
          <button
            onClick={nextQuestion}
            disabled={!showAnswer}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
