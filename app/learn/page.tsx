import Link from 'next/link';
import AppGlyph from '@/components/ui/AppGlyph';

interface LearningPath {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  features: string[];
}

const CUSTOM_LEARNING_PATH: LearningPath = {
  id: 'custom',
  title: 'Custom Learning Plan',
  description: 'AI-powered personalized learning path tailored to your specific goals and experience level.',
  href: '/learn/custom',
  icon: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  features: [
    'Personalized topic selection',
    'Prerequisites automatically included',
    'Progress tracking and gamification',
    'Adaptive learning sequence'
  ]
};

const CONTENT_PATHS: LearningPath[] = [
  {
    id: 'fundamentals',
    title: 'Fundamentals',
    description: 'Master the core concepts of system design, from scalability basics to advanced architectural patterns.',
    href: '/fundamentals',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    features: [
      'Scalability and performance',
      'Database design and modeling',
      'System architecture patterns',
      'Reliability and availability'
    ]
  },
  {
    id: 'genai',
    title: 'GenAI Systems',
    description: 'Learn to build production-ready AI applications with LLMs, RAG systems, and AI agents.',
    href: '/genai',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    features: [
      'LLM integration and serving',
      'RAG system architecture',
      'AI agent frameworks',
      'Prompt engineering at scale'
    ]
  },
  {
    id: 'ml-systems',
    title: 'ML Systems',
    description: 'Build robust machine learning infrastructure for training, serving, and monitoring ML models.',
    href: '/ml-systems',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    features: [
      'MLOps and model deployment',
      'Feature stores and pipelines',
      'Model monitoring and drift',
      'Distributed training systems'
    ]
  },
  {
    id: 'technology',
    title: 'Technologies',
    description: 'Deep dive into specific tools, databases, and platforms used in modern system architecture.',
    href: '/technology',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    features: [
      'Database technologies',
      'Cloud platforms and services',
      'Message queues and streaming',
      'Monitoring and observability'
    ]
  },
  {
    id: 'case-studies',
    title: 'Case Studies',
    description: 'Analyze real-world system designs from companies like Netflix, Uber, and Instagram.',
    href: '/case-studies',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    features: [
      'Real company architectures',
      'Design decision analysis',
      'Scalability challenges',
      'Trade-off discussions'
    ]
  },
  {
    id: 'practice',
    title: 'Interview Questions',
    description: 'Practice system design interviews with realistic problems and detailed solutions.',
    href: '/practice',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
    features: [
      'Mock interview problems',
      'Step-by-step solutions',
      'Common patterns and frameworks',
      'Interviewer tips and feedback'
    ]
  }
];

export default function LearnPage() {
  return (
    <main className="min-h-screen py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 shadow mb-6">
            <AppGlyph className="w-9 h-9" />
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">Choose Your Learning Path</h1>
          <p className="text-neutral-600 dark:text-neutral-300 text-lg max-w-2xl mx-auto">
            Start with a personalized AI-generated plan or explore our comprehensive content library.
          </p>
        </div>

        {/* Custom Learning Plan - Featured */}
        <div className="mb-8 md:mb-12">
          <div className="rounded-2xl md:rounded-3xl bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950 dark:to-violet-950 border border-indigo-200 dark:border-indigo-800 p-6 md:p-8 shadow-card">
            <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-6">
              <div className="flex justify-center md:justify-start shrink-0">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white flex items-center justify-center shadow-lg">
                  {CUSTOM_LEARNING_PATH.icon}
                </div>
              </div>
              <div className="flex-1 text-center md:text-left">
                <div className="flex flex-row items-center justify-center md:justify-start gap-2 md:gap-3 mb-3">
                  <h2 className="text-xl md:text-2xl font-semibold text-indigo-900 dark:text-indigo-100">{CUSTOM_LEARNING_PATH.title}</h2>
                  <div className="text-xs bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 px-2 py-1 rounded-full font-medium whitespace-nowrap">
                    AI Powered
                  </div>
                </div>
                <p className="text-sm md:text-base text-indigo-700 dark:text-indigo-300 mb-4 leading-relaxed">{CUSTOM_LEARNING_PATH.description}</p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6 text-left">
                  {CUSTOM_LEARNING_PATH.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-xs md:text-sm text-indigo-600 dark:text-indigo-400">
                      <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={CUSTOM_LEARNING_PATH.href as any}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 md:px-6 md:py-3 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm md:text-base font-semibold shadow-lg hover:shadow-xl transition w-full sm:w-auto"
                >
                  Create Custom Plan
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Browse Content Paths */}
        <div>
          <h2 className="text-2xl font-semibold mb-2">Browse Content</h2>
          <p className="text-neutral-600 dark:text-neutral-300 mb-8">
            Explore our structured learning paths covering all aspects of system design.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CONTENT_PATHS.map((path) => (
              <Link
                key={path.id}
                href={path.href as any}
                className="group rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-card hover:shadow-lg transition-all hover:border-neutral-300 dark:hover:border-neutral-700"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 flex items-center justify-center group-hover:bg-indigo-100 group-hover:text-indigo-600 dark:group-hover:bg-indigo-900 dark:group-hover:text-indigo-400 transition">
                    {path.icon}
                  </div>
                  <h3 className="text-lg font-semibold group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                    {path.title}
                  </h3>
                </div>
                
                <p className="text-neutral-600 dark:text-neutral-300 text-sm mb-4 leading-relaxed">
                  {path.description}
                </p>
                
                <ul className="space-y-2">
                  {path.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                      <div className="w-1 h-1 rounded-full bg-neutral-400 dark:bg-neutral-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 group-hover:gap-3 transition-all">
                    Start learning
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}