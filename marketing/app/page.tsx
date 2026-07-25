import Link from 'next/link';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-indigo-50 to-white dark:from-gray-900 dark:to-gray-800 py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Learn to Think Like<br />Senior Engineers
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-4 max-w-3xl mx-auto">
            System design is the <span className="font-semibold text-indigo-600 dark:text-indigo-400">PRIMARY MODE OF WORK</span> for senior engineers (60-65% of their time).
          </p>
          <p className="text-lg text-gray-500 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
            Yet all resources teach interview tricks. We teach you to <span className="font-semibold">"think in design mode"</span>—the actual job skill.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href={`${APP_URL}/signup` as any}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors"
            >
              Start Learning Free
            </Link>
            <Link
              href="#how-it-works"
              className="border-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-indigo-50 dark:hover:bg-gray-700 transition-colors"
            >
              See How It Works
            </Link>
          </div>

          <div className="mt-8 text-sm text-gray-500 dark:text-gray-400">
            ✓ Pass L5+ interviews in 2-3 months &nbsp;&nbsp; ✓ Master design thinking for your career &nbsp;&nbsp; ✓ $145K average salary increase
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 px-4 bg-white dark:bg-gray-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              The Problem Everyone Else Misses
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Resources teach you <span className="line-through">how to pass 45-minute interviews</span>, not how senior engineers actually work.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg p-6">
              <div className="flex items-start gap-3 mb-2">
                <svg className="w-6 h-6 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <h3 className="font-bold text-lg text-rose-900 dark:text-rose-200">Grokking & Design Gurus</h3>
              </div>
              <p className="text-rose-700 dark:text-rose-300 text-sm">
                Teach interview patterns. Memorize answers. Won't prepare you for L5+ depth or real production work.
              </p>
            </div>

            <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg p-6">
              <div className="flex items-start gap-3 mb-2">
                <svg className="w-6 h-6 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <h3 className="font-bold text-lg text-rose-900 dark:text-rose-200">ByteByteGo</h3>
              </div>
              <p className="text-rose-700 dark:text-rose-300 text-sm">
                Beautiful diagrams showing WHAT systems look like. But no way to practice HOW to think like the designers.
              </p>
            </div>

            <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg p-6">
              <div className="flex items-start gap-3 mb-2">
                <svg className="w-6 h-6 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <h3 className="font-bold text-lg text-rose-900 dark:text-rose-200">DDIA & Books</h3>
              </div>
              <p className="text-rose-700 dark:text-rose-300 text-sm">
                Deep theory, but too dense for 2-3 month timeline. "Started 3 times, never finished."
              </p>
            </div>
          </div>

          <div className="mt-12 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-8 text-center">
            <h3 className="font-bold text-2xl text-yellow-900 dark:text-yellow-200 mb-3">
              The Real Skill: "Design Mode" Thinking
            </h3>
            <p className="text-yellow-800 dark:text-yellow-300 max-w-2xl mx-auto">
              Senior engineers spend 60-65% of their time writing design docs, RFCs, ADRs—making systematic trade-off decisions. <span className="font-semibold">No one teaches this.</span>
            </p>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section id="how-it-works" className="py-20 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              How System Designer Works
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Dual-track strategy: Pass interviews (Track 1) + Master the actual job skill (Track 2)
            </p>
          </div>

          {/* Track 1 */}
          <div className="mb-12 bg-white dark:bg-gray-800 rounded-lg p-8 shadow-lg">
            <div className="flex items-start gap-4 mb-4">
              <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-3 py-1 rounded-full font-semibold text-sm">
                TRACK 1
              </span>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Interview-Ready in 2-3 Months</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Get promoted to L5+ with structured practice and AI guidance.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex gap-3">
                <span className="text-green-600 dark:text-green-400 text-xl">✓</span>
                <span className="text-gray-700 dark:text-gray-300">Structured practice problems in interview format</span>
              </div>
              <div className="flex gap-3">
                <span className="text-green-600 dark:text-green-400 text-xl">✓</span>
                <span className="text-gray-700 dark:text-gray-300">Back-of-envelope calculation training</span>
              </div>
              <div className="flex gap-3">
                <span className="text-green-600 dark:text-green-400 text-xl">✓</span>
                <span className="text-gray-700 dark:text-gray-300">Timed sessions with AI feedback</span>
              </div>
              <div className="flex gap-3">
                <span className="text-green-600 dark:text-green-400 text-xl">✓</span>
                <span className="text-gray-700 dark:text-gray-300">75%+ pass rate vs industry 50%</span>
              </div>
            </div>
          </div>

          {/* Track 2 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-lg">
            <div className="flex items-start gap-4 mb-4">
              <span className="bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 px-3 py-1 rounded-full font-semibold text-sm">
                TRACK 2
              </span>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Design Thinking Mastery</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Learn to think systematically like senior engineers—the skill you'll use 60-65% of your career.
            </p>

            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-6 mb-6">
              <h4 className="font-bold text-lg text-indigo-900 dark:text-indigo-200 mb-3">Architecture Decision Trainer</h4>
              <div className="space-y-3">
                <div className="flex gap-3 text-sm">
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold min-w-[40px]">1.</span>
                  <span className="text-indigo-700 dark:text-indigo-300"><strong>Problem Definition:</strong> AI clarifying questions like real stakeholders</span>
                </div>
                <div className="flex gap-3 text-sm">
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold min-w-[40px]">2.</span>
                  <span className="text-indigo-700 dark:text-indigo-300"><strong>Architecture Exploration:</strong> Multiple solution paths with trade-offs</span>
                </div>
                <div className="flex gap-3 text-sm">
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold min-w-[40px]">3.</span>
                  <span className="text-indigo-700 dark:text-indigo-300"><strong>Trade-Off Analysis:</strong> Real AWS/GCP/Azure pricing data</span>
                </div>
                <div className="flex gap-3 text-sm">
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold min-w-[40px]">4.</span>
                  <span className="text-indigo-700 dark:text-indigo-300"><strong>Validation & Review:</strong> AI identifies blind spots</span>
                </div>
                <div className="flex gap-3 text-sm">
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold min-w-[40px]">5.</span>
                  <span className="text-indigo-700 dark:text-indigo-300"><strong>Documentation:</strong> Export to Google Docs for work</span>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex gap-3">
                <span className="text-indigo-600 dark:text-indigo-400 text-xl">✓</span>
                <span className="text-gray-700 dark:text-gray-300">Practice with real constraints (budget, team, timeline)</span>
              </div>
              <div className="flex gap-3">
                <span className="text-indigo-600 dark:text-indigo-400 text-xl">✓</span>
                <span className="text-gray-700 dark:text-gray-300">60%+ apply to production work within 6 months</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Journey */}
      <section className="py-20 px-4 bg-white dark:bg-gray-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-12 text-center">
            The Journey: From Blocked to Promoted
          </h2>

          <div className="space-y-6">
            {[
              { week: 'Week 1', text: '"I need to pass this interview"', action: 'Signs up for interview prep' },
              { week: 'Week 4', text: '"I\'m learning to think systematically like senior engineers"', action: 'Uses Architecture Decision Trainer' },
              { week: 'Week 8', text: '"I can apply this to my projects"', action: 'Exports design to Google Docs, uses at work' },
              { week: 'Month 3', text: 'Passes L5 interview with confidence', action: 'Systematic thinking, not memorization' },
              { week: 'Month 6', text: '"I\'m writing senior-quality design docs"', action: 'Becomes go-to person for architecture' },
              { week: 'Month 12', text: 'Refers teammates', action: 'Company pays for team subscription' },
            ].map((step, i) => (
              <div key={i} className="flex gap-4 items-start bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                <div className="bg-indigo-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold flex-shrink-0">
                  {i + 1}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">{step.week}</div>
                  <div className="text-gray-600 dark:text-gray-300 italic mb-1">{step.text}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">→ {step.action}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing CTA */}
      <section className="py-20 px-4 bg-gradient-to-b from-indigo-600 to-indigo-700 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Start Learning for Free
          </h2>
          <p className="text-xl mb-8 text-indigo-100">
            Get interview-ready in 2-3 months. Master the skill you'll use for your entire career.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white/10 backdrop-blur rounded-lg p-6 text-left">
              <h3 className="font-bold text-xl mb-2">Free</h3>
              <div className="text-3xl font-bold mb-4">$0</div>
              <ul className="space-y-2 text-sm">
                <li>✓ 310+ lessons across all topics</li>
                <li>✓ 203 interactive quizzes</li>
                <li>✓ Basic practice problems</li>
                <li>✓ Limited AI guidance (5/month)</li>
              </ul>
            </div>

            <div className="bg-white text-gray-900 rounded-lg p-6 text-left border-4 border-yellow-400">
              <div className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-sm font-bold inline-block mb-2">
                BEST VALUE
              </div>
              <h3 className="font-bold text-xl mb-2">Premium</h3>
              <div className="text-3xl font-bold mb-1">$19<span className="text-lg font-normal text-gray-600">/month</span></div>
              <div className="text-sm text-gray-600 mb-4">or $190/year (save $38)</div>
              <ul className="space-y-2 text-sm">
                <li>✓ Everything in Free</li>
                <li className="font-semibold">✓ Architecture Decision Trainer (unlimited)</li>
                <li>✓ Trade-off simulators with real cloud pricing</li>
                <li>✓ Unlimited AI guidance</li>
                <li>✓ Export to Google Docs</li>
                <li className="font-semibold text-indigo-600">✓ Pass L5+ interview or money back</li>
              </ul>
            </div>
          </div>

          <Link
            href={`${APP_URL}/signup` as any}
            className="inline-block bg-white text-indigo-600 px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-100 transition-colors"
          >
            Start Free → Upgrade When Ready
          </Link>

          <div className="mt-6 text-sm text-indigo-200">
            $145K average salary increase (L4→L5) • 75%+ pass rate • No credit card required
          </div>
        </div>
      </section>
    </main>
  );
}
