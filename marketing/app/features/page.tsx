import Link from 'next/link';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const metadata = {
  title: 'Features - System Designer',
  description: 'Architecture Decision Trainer, AI guidance, real trade-off data, and export to production.',
};

export default function FeaturesPage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-b from-indigo-50 to-white dark:from-gray-900 dark:to-gray-800 py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Features Built for Design Thinking Mastery
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            The only platform that teaches you to think systematically like senior engineers
          </p>
          <Link
            href={`${APP_URL}/signup` as any}
            className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors"
          >
            Start Learning Free
          </Link>
        </div>
      </section>

      {/* Main Feature: Architecture Decision Trainer */}
      <section className="py-20 px-4 bg-white dark:bg-gray-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Architecture Decision Trainer
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Learn the 5-mode systematic thinking process senior engineers use
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                number: '1',
                title: 'Problem Definition Mode',
                description: 'AI asks clarifying questions like real stakeholders. Uncover hidden requirements and business context.',
                icon: (
                  <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
              },
              {
                number: '2',
                title: 'Architecture Exploration',
                description: 'Explore 3-5 solution paths with visual trade-off comparison. Pattern library for common solutions.',
                icon: (
                  <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                ),
              },
              {
                number: '3',
                title: 'Trade-Off Analysis',
                description: 'Real AWS/GCP/Azure pricing data. Cost vs performance vs reliability with actual numbers.',
                icon: (
                  <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                ),
              },
              {
                number: '4',
                title: 'Validation & Review',
                description: 'AI identifies blind spots: "Did you consider X?" Best practice checks from production learnings.',
                icon: (
                  <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
              },
              {
                number: '5',
                title: 'Documentation Mode',
                description: 'Export to Google Docs with reasoning included. Use at work immediately.',
                icon: (
                  <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                ),
              },
            ].map((mode) => (
              <div key={mode.number} className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-xl">
                      {mode.number}
                    </div>
                  </div>
                  <div>
                    <div className="mb-3">{mode.icon}</div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                      {mode.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      {mode.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Other Features */}
      <section className="py-20 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-12 text-center">
            Everything You Need to Master System Design
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <svg className="w-10 h-10 text-indigo-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                310+ Comprehensive Lessons
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                From fundamentals to advanced topics. GenAI, ML systems, databases, caching, distributed systems—all covered.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <svg className="w-10 h-10 text-indigo-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                Trade-Off Simulators
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Real cloud pricing data. Cost vs performance calculators. See consequences of decisions with actual numbers.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <svg className="w-10 h-10 text-indigo-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                AI Design Review
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Reviews your THINKING PROCESS, not just format. Identifies blind spots. Teaches comprehensive architectural thinking.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <svg className="w-10 h-10 text-indigo-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                203 Interactive Quizzes
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Immediate feedback on every topic. Know when you're actually ready, not just hoping.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <svg className="w-10 h-10 text-indigo-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                Progress Tracking
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                See exactly where you are. Track completion across all topics. Personalized recommendations for what to learn next.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <svg className="w-10 h-10 text-indigo-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                Practice Problems
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Real interview-format questions. Practice with constraints (budget, team size, timeline). AI guidance throughout.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-white dark:bg-gray-800">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Ready to Think Like a Senior Engineer?
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Start free. Upgrade when you're ready to master design thinking.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={`${APP_URL}/signup` as any}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors"
            >
              Start Learning Free
            </Link>
            <Link
              href={"/pricing" as any}
              className="border-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-indigo-50 dark:hover:bg-gray-700 transition-colors"
            >
              See Pricing
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
