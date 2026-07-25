'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  topic: string;
}

export default function ScalabilityBasicsQuiz() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [quizStarted, setQuizStarted] = useState(false);

  const questions: QuizQuestion[] = [
    {
      id: 'q1',
      question: 'What is the primary difference between horizontal and vertical scaling?',
      options: [
        'Horizontal scaling increases processing power, vertical scaling adds more servers',
        'Horizontal scaling adds more servers, vertical scaling increases processing power',
        'Both achieve the same result with identical cost structures',
        'Vertical scaling is always more cost-effective than horizontal scaling'
      ],
      correctAnswer: 1,
      explanation: 'Horizontal scaling (scale out) means adding more servers to handle increased load, while vertical scaling (scale up) means increasing the processing power of existing servers.',
      difficulty: 'Easy',
      topic: 'Scaling Fundamentals'
    },
    {
      id: 'q2',
      question: 'Which load balancing algorithm distributes requests based on server response times?',
      options: [
        'Round Robin',
        'Least Connections',
        'Least Response Time',
        'IP Hash'
      ],
      correctAnswer: 2,
      explanation: 'Least Response Time algorithm routes requests to the server with the fastest response time, optimizing for performance.',
      difficulty: 'Medium',
      topic: 'Load Balancing'
    },
    {
      id: 'q3',
      question: 'What is a key advantage of stateless application design for scalability?',
      options: [
        'Reduces memory usage on individual servers',
        'Eliminates the need for databases',
        'Allows any server to handle any request',
        'Automatically provides fault tolerance'
      ],
      correctAnswer: 2,
      explanation: 'Stateless design means no session data is stored on servers, allowing any server to handle any request, which greatly simplifies horizontal scaling.',
      difficulty: 'Medium',
      topic: 'Stateless Design'
    },
    {
      id: 'q4',
      question: 'In auto-scaling, what metric is most commonly used to trigger scaling decisions?',
      options: [
        'Memory utilization',
        'CPU utilization',
        'Network bandwidth',
        'Disk I/O'
      ],
      correctAnswer: 1,
      explanation: 'CPU utilization is the most commonly used metric for auto-scaling decisions because it directly correlates with processing load and is easy to measure.',
      difficulty: 'Easy',
      topic: 'Auto Scaling'
    },
    {
      id: 'q5',
      question: 'What is the "thundering herd" problem in distributed systems?',
      options: [
        'When too many servers are added at once',
        'When multiple processes wake up simultaneously to handle an event',
        'When load balancers become overwhelmed',
        'When databases receive too many concurrent connections'
      ],
      correctAnswer: 1,
      explanation: 'The thundering herd problem occurs when multiple processes or threads wake up simultaneously to handle an event, but only one can actually process it, wasting resources.',
      difficulty: 'Hard',
      topic: 'Distributed Systems'
    },
    {
      id: 'q6',
      question: 'Which caching pattern helps reduce database load for read-heavy workloads?',
      options: [
        'Write-through',
        'Write-behind',
        'Cache-aside (Lazy loading)',
        'Refresh-ahead'
      ],
      correctAnswer: 2,
      explanation: 'Cache-aside (lazy loading) pattern loads data into cache only when requested, which is ideal for read-heavy workloads as it reduces database load for frequently accessed data.',
      difficulty: 'Medium',
      topic: 'Caching Strategies'
    },
    {
      id: 'q7',
      question: 'What is the primary purpose of database sharding?',
      options: [
        'To improve data security',
        'To distribute data across multiple databases',
        'To create backup copies of data',
        'To optimize SQL query performance'
      ],
      correctAnswer: 1,
      explanation: 'Database sharding distributes data across multiple databases (shards) to improve scalability by reducing the load on individual database instances.',
      difficulty: 'Medium',
      topic: 'Database Scaling'
    },
    {
      id: 'q8',
      question: 'In a microservices architecture, what is the benefit of service discovery?',
      options: [
        'It reduces the number of network calls',
        'It automatically handles load balancing',
        'It allows services to find and communicate with each other dynamically',
        'It eliminates the need for API documentation'
      ],
      correctAnswer: 2,
      explanation: 'Service discovery allows microservices to find and communicate with each other dynamically, without hardcoding service locations, which is essential for scalable microservices architectures.',
      difficulty: 'Medium',
      topic: 'Microservices'
    },
    {
      id: 'q9',
      question: 'What is the purpose of connection pooling in database systems?',
      options: [
        'To encrypt database connections',
        'To reuse database connections and reduce connection overhead',
        'To automatically backup database connections',
        'To distribute queries across multiple databases'
      ],
      correctAnswer: 1,
      explanation: 'Connection pooling reuses existing database connections instead of creating new ones for each request, reducing the overhead of connection establishment and improving performance.',
      difficulty: 'Easy',
      topic: 'Database Optimization'
    },
    {
      id: 'q10',
      question: 'Which pattern is most effective for handling sudden traffic spikes?',
      options: [
        'Adding more CPU cores to existing servers',
        'Implementing auto-scaling with load balancers',
        'Increasing database connection limits',
        'Using larger server instances'
      ],
      correctAnswer: 1,
      explanation: 'Auto-scaling with load balancers can automatically add more server instances to handle traffic spikes and distribute the load effectively, providing the most flexible response to sudden demand changes.',
      difficulty: 'Medium',
      topic: 'Traffic Management'
    }
  ];

  useEffect(() => {
    if (quizStarted && timeLeft > 0 && !showResults) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0) {
      handleFinishQuiz();
    }
  }, [timeLeft, quizStarted, showResults]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleStartQuiz = () => {
    setQuizStarted(true);
  };

  const handleAnswerSelect = (answerIndex: number) => {
    const newAnswers = [...selectedAnswers];
    newAnswers[currentQuestion] = answerIndex;
    setSelectedAnswers(newAnswers);
  };

  const handleNextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      handleFinishQuiz();
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleFinishQuiz = () => {
    setShowResults(true);
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach((question, index) => {
      if (selectedAnswers[index] === question.correctAnswer) {
        correct++;
      }
    });
    return {
      correct,
      total: questions.length,
      percentage: Math.round((correct / questions.length) * 100)
    };
  };

  const getPerformanceLevel = (percentage: number) => {
    if (percentage >= 90) return { level: 'Expert', color: 'text-emerald-600 dark:text-emerald-400' };
    if (percentage >= 80) return { level: 'Advanced', color: 'text-blue-600 dark:text-blue-400' };
    if (percentage >= 70) return { level: 'Proficient', color: 'text-amber-600 dark:text-amber-400' };
    if (percentage >= 60) return { level: 'Developing', color: 'text-orange-600 dark:text-orange-400' };
    return { level: 'Needs Review', color: 'text-red-600 dark:text-red-400' };
  };

  if (!quizStarted) {
    return (
      <main className="max-w-[1200px] mx-auto px-4 md:px-6 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4 text-sm">
            <Link href="/quiz" className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">
              🧠 Quiz Hub
            </Link>
            <span className="text-neutral-400">/</span>
            <span className="text-neutral-900 dark:text-neutral-100 font-medium">Scalability Basics</span>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8 text-center">
          <div className="text-4xl mb-4">📈</div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
            Scalability Fundamentals Quiz
          </h1>
          <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-8 max-w-2xl mx-auto">
            Test your understanding of horizontal vs vertical scaling, load balancing, and scalability patterns. 
            This quiz covers essential concepts for building scalable systems.
          </p>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 p-4">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{questions.length}</div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">Questions</div>
            </div>
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 p-4">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">10</div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">Minutes</div>
            </div>
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 p-4">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">70%</div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">Pass Rate</div>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Topics Covered:</h3>
            <div className="flex flex-wrap gap-2 justify-center">
              {['Horizontal Scaling', 'Vertical Scaling', 'Load Balancing', 'Auto Scaling', 'Stateless Design', 'Caching Strategies'].map(topic => (
                <span key={topic} className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm">
                  {topic}
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={handleStartQuiz}
            className="px-8 py-3 bg-indigo-600 text-white rounded-lg text-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            Start Quiz
          </button>
        </div>
      </main>
    );
  }

  if (showResults) {
    const score = calculateScore();
    const performance = getPerformanceLevel(score.percentage);

    return (
      <main className="max-w-[1200px] mx-auto px-4 md:px-6 py-6">
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8">
          <div className="text-center mb-8">
            <div className="text-4xl mb-4">🎯</div>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
              Quiz Complete!
            </h1>
            <div className={`text-2xl font-bold ${performance.color} mb-4`}>
              {score.percentage}% • {performance.level}
            </div>
            <p className="text-neutral-600 dark:text-neutral-400">
              You answered {score.correct} out of {score.total} questions correctly
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="text-center p-4 rounded-lg border border-neutral-200 dark:border-neutral-800">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{score.correct}</div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">Correct</div>
            </div>
            <div className="text-center p-4 rounded-lg border border-neutral-200 dark:border-neutral-800">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{score.total - score.correct}</div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">Incorrect</div>
            </div>
            <div className="text-center p-4 rounded-lg border border-neutral-200 dark:border-neutral-800">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatTime(600 - timeLeft)}</div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">Time Taken</div>
            </div>
          </div>

          <div className="space-y-6 mb-8">
            <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">Review Answers</h3>
            {questions.map((question, index) => {
              const userAnswer = selectedAnswers[index];
              const isCorrect = userAnswer === question.correctAnswer;
              
              return (
                <div key={question.id} className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                      isCorrect ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' 
                                : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                    }`}>
                      {isCorrect ? '✓' : '✗'}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                        {index + 1}. {question.question}
                      </h4>
                      <div className="space-y-1 mb-3">
                        {question.options.map((option, optionIndex) => (
                          <div key={optionIndex} className={`text-sm p-2 rounded ${
                            optionIndex === question.correctAnswer ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' :
                            optionIndex === userAnswer && !isCorrect ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300' :
                            'text-neutral-600 dark:text-neutral-400'
                          }`}>
                            {option}
                          </div>
                        ))}
                      </div>
                      <div className="text-sm text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800 p-3 rounded">
                        <strong>Explanation:</strong> {question.explanation}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-4 justify-center">
            <Link href="/quiz" className="px-6 py-2 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
              Back to Quiz Hub
            </Link>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Retake Quiz
            </button>
          </div>
        </div>
      </main>
    );
  }

  const question = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <main className="max-w-[1200px] mx-auto px-4 md:px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/quiz" className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">
              🧠 Quiz Hub
            </Link>
            <span className="text-neutral-400">/</span>
            <span className="text-neutral-900 dark:text-neutral-100 font-medium">Scalability Basics</span>
          </div>
          <div className={`text-lg font-bold ${timeLeft < 60 ? 'text-red-600 dark:text-red-400' : 'text-neutral-700 dark:text-neutral-300'}`}>
            ⏱ {formatTime(timeLeft)}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 mb-4">
          <div 
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <div className="text-sm text-neutral-600 dark:text-neutral-400">
          Question {currentQuestion + 1} of {questions.length}
        </div>
      </div>

      {/* Question */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8">
        <div className="flex items-center gap-3 mb-6">
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            question.difficulty === 'Easy' ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' :
            question.difficulty === 'Medium' ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300' :
            'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
          }`}>
            {question.difficulty}
          </span>
          <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded text-xs font-medium">
            {question.topic}
          </span>
        </div>

        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-6">
          {question.question}
        </h2>

        <div className="space-y-3 mb-8">
          {question.options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswerSelect(index)}
              className={`w-full text-left p-4 rounded-lg border transition-colors ${
                selectedAnswers[currentQuestion] === index
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                  : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 text-neutral-700 dark:text-neutral-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedAnswers[currentQuestion] === index
                    ? 'border-indigo-500 bg-indigo-500'
                    : 'border-neutral-300 dark:border-neutral-600'
                }`}>
                  {selectedAnswers[currentQuestion] === index && (
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  )}
                </div>
                <span>{option}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="flex justify-between">
          <button
            onClick={handlePreviousQuestion}
            disabled={currentQuestion === 0}
            className="px-6 py-2 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          <button
            onClick={handleNextQuestion}
            disabled={selectedAnswers[currentQuestion] === undefined}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {currentQuestion === questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
          </button>
        </div>
      </div>
    </main>
  );
}