import Link from 'next/link';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const metadata = {
  title: 'About - System Designer',
  description: 'We discovered what all competitors missed: System design is the PRIMARY MODE OF WORK for senior engineers.',
};

export default function AboutPage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-b from-indigo-50 to-white dark:from-gray-900 dark:to-gray-800 py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            We Discovered What Everyone Else Missed
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            System design isn't just an interview skill—it's the PRIMARY MODE OF WORK for senior engineers
          </p>
        </div>
      </section>

      {/* The Discovery */}
      <section className="py-20 px-4 bg-white dark:bg-gray-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
            The Problem We Found
          </h2>

          <div className="space-y-6 text-lg text-gray-700 dark:text-gray-300">
            <p>
              Mid-level engineers were getting down-leveled in senior interviews. L5 → L4. L6 → L5.
              Costing them <span className="font-semibold text-indigo-600 dark:text-indigo-400">$70-145K in salary</span>.
            </p>

            <p>
              They tried everything: Grokking (too shallow), DDIA (too dense), $5K coaching (too expensive).
              Nothing worked because they all taught the <span className="font-semibold">wrong skill</span>.
            </p>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6 my-8">
              <h3 className="font-bold text-xl text-amber-900 dark:text-amber-200 mb-3">
                The Blind Spot
              </h3>
              <p className="text-amber-800 dark:text-amber-300">
                Resources teach engineers to perform in 45-minute interviews. But senior engineers spend
                <span className="font-bold"> 60-65% of their time</span> in "design mode"—writing design docs,
                RFCs, ADRs, making trade-off decisions.
              </p>
              <p className="text-amber-800 dark:text-amber-300 mt-3">
                <span className="font-bold">No one teaches this skill.</span>
              </p>
            </div>

            <p>
              So we built System Designer: the only platform that teaches you to <span className="font-semibold">"think in design mode"</span> like senior engineers actually work.
            </p>
          </div>
        </div>
      </section>

      {/* The Data */}
      <section className="py-20 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-12 text-center">
            The Data Behind Our Insight
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
              <div className="text-3xl font-bold text-indigo-600 mb-2">60-65%</div>
              <div className="text-gray-900 dark:text-white font-semibold mb-2">AWS Engineers' Time</div>
              <div className="text-gray-600 dark:text-gray-400 text-sm">
                Spent writing design docs (source: AWS engineering data)
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
              <div className="text-3xl font-bold text-indigo-600 mb-2">$145K</div>
              <div className="text-gray-900 dark:text-white font-semibold mb-2">L4→L5 Salary Increase</div>
              <div className="text-gray-600 dark:text-gray-400 text-sm">
                Average at Meta (source: Levels.fyi)
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
              <div className="text-3xl font-bold text-indigo-600 mb-2">$462M</div>
              <div className="text-gray-900 dark:text-white font-semibold mb-2">Lost in 45 Minutes</div>
              <div className="text-gray-600 dark:text-gray-400 text-sm">
                Knight Capital—bad architecture costs millions
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
              <div className="text-3xl font-bold text-indigo-600 mb-2">200+</div>
              <div className="text-gray-900 dark:text-white font-semibold mb-2">ADR Implementations</div>
              <div className="text-gray-600 dark:text-gray-400 text-sm">
                Organizations using Architecture Decision Records
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Approach */}
      <section className="py-20 px-4 bg-white dark:bg-gray-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
            Our Approach: Dual-Track Strategy
          </h2>

          <div className="space-y-8">
            <div className="border-l-4 border-green-500 pl-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Track 1: Interview-Ready
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                Pass L5+ interviews in 2-3 months. This is the hook—the immediate pain point that gets engineers in the door.
              </p>
            </div>

            <div className="border-l-4 border-indigo-500 pl-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Track 2: Design Thinking Mastery
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                Master the skill you'll use 60-65% of your career. This is the value—the reason engineers stay and recommend us.
              </p>
            </div>
          </div>

          <div className="mt-12 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-6">
            <p className="text-lg text-indigo-900 dark:text-indigo-200">
              <span className="font-bold">The insight:</span> We attract with interview urgency, deliver genuine mastery,
              retain through work applicability. Everyone else optimizes for one or the other. We do both.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-b from-indigo-600 to-indigo-700 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Join Engineers Learning to Think in Design Mode
          </h2>
          <p className="text-xl mb-8 text-indigo-100">
            Pass interviews AND master the actual job skill
          </p>
          <Link
            href={`${APP_URL}/signup` as any}
            className="inline-block bg-white text-indigo-600 px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-100 transition-colors"
          >
            Start Learning Free
          </Link>
        </div>
      </section>
    </main>
  );
}
