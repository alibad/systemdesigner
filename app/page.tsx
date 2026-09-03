import Link from 'next/link';
import GuidedPathCTA from '@/components/ui/GuidedPathCTA';
import AppGlyph from '@/components/ui/AppGlyph';
import PageHeader from '@/components/ui/PageHeader';
import Footer from '@/components/ui/Footer';
import HomepageLearningPlans from '@/components/HomepageLearningPlans';
import HomepageProgressOverview from '@/components/HomepageProgressOverview';
import RecentIncompleteLessons from '@/components/RecentIncompleteLessons';
import LearningStreak from '@/components/LearningStreak';

export default function HomePage() {
  return (
    <main>
      <section className="relative overflow-hidden rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-6 md:px-10 py-4 mt-8 shadow-card">
        <div className="relative z-10 flex items-start gap-4 md:gap-5">
          <div className="shrink-0">
            <div className="h-16 w-16 md:h-16 md:w-16 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 shadow grid place-items-center">
              <AppGlyph className="w-9 h-9 md:w-10 md:h-10" />
            </div>
          </div>
          <div className="flex-1">
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">A little practice. A better engineer.</h1>
            <p className="text-neutral-600 dark:text-neutral-300 mt-2 max-w-2xl">Build a daily habit with bite-sized system design lessons and hands-on coding. Learn a concept, put it into practice, and take the next step.</p>
            <Link href="/learn" className="mt-5 inline-flex items-center gap-2 rounded-xl border-b-4 border-emerald-800 bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700">Start your daily learning path <span aria-hidden="true">→</span></Link>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-tr from-indigo-400/30 to-violet-400/30 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-gradient-to-tr from-emerald-400/20 to-teal-400/20 blur-3xl" />
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-4">
        {/* Continue Learning - Now takes 2/4 width on large screens */}
        <div className="lg:col-span-2 rounded-2xl bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/50 dark:to-violet-950/50 border border-indigo-200 dark:border-indigo-800 p-6 shadow-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <div className="text-xl font-semibold text-indigo-900 dark:text-indigo-100">Continue Learning</div>
              <p className="text-sm text-indigo-700 dark:text-indigo-300">Master system design through comprehensive learning paths</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-5">
            <Link href="/fundamentals" className="bg-white dark:bg-neutral-900/50 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all group">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-semibold flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">F</div>
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">Fundamentals</span>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-300 transition-colors">Core patterns &amp; scalability</p>
            </Link>
            <Link href="/genai" className="bg-white dark:bg-neutral-900/50 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-sm transition-all group">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs font-semibold flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">AI</div>
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">GenAI Systems</span>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-300 transition-colors">LLMs, RAG &amp; AI agents</p>
            </Link>
            <Link href="/ml-systems" className="bg-white dark:bg-neutral-900/50 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3 hover:border-green-300 dark:hover:border-green-600 hover:shadow-sm transition-all group">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-semibold flex items-center justify-center group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">ML</div>
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 group-hover:text-green-700 dark:group-hover:text-green-300 transition-colors">ML Systems</span>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-300 transition-colors">MLOps &amp; production ML</p>
            </Link>
          </div>

          <GuidedPathCTA />
        </div>

        {/* Whiteboards - Free-form design */}
        <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 shadow-card hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <div className="text-lg font-semibold">Whiteboards</div>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4">Free-form canvas for brainstorming and sketching architectures.</p>
          <div className="space-y-2 mb-4 text-xs text-neutral-600 dark:text-neutral-400">
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-amber-400" />
              <span>Draw diagrams</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-amber-400" />
              <span>Collaborative sketching</span>
            </div>
          </div>
          <Link className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium shadow hover:shadow-lg transition" href="/whiteboard">
            Open Whiteboard
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
          </Link>
        </div>

        {/* Projects - Structured design docs */}
        <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 shadow-card hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="text-lg font-semibold">Projects</div>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4">Guided templates for complete system design documentation.</p>
          <div className="space-y-2 mb-4 text-xs text-neutral-600 dark:text-neutral-400">
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-emerald-400" />
              <span>Interview frameworks</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-emerald-400" />
              <span>AI-powered sections</span>
            </div>
          </div>
          <Link className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow hover:shadow-lg transition" href="/projects">
            Start Project
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
          </Link>
        </div>
      </section>

      {/* Progress Overview */}
      <HomepageProgressOverview />

      {/* Learning Streak - Gamification and encouragement */}
      <LearningStreak />

      {/* Recent Incomplete Lessons - Show before learning plans for quick access */}
      <RecentIncompleteLessons />

      {/* Learning Plans Section */}
      <HomepageLearningPlans />

      <section className="mt-8">
        <div className="relative rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/20 dark:to-violet-950/20 p-6 shadow-card overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-1">
                <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h4v10h-10z"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-indigo-900 dark:text-indigo-100 text-base md:text-lg font-medium leading-relaxed italic">
                  Great engineering, with or without AI assistance, still needs engineering judgment. Learn the trade‑offs.
                </p>
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-gradient-to-tr from-indigo-300/20 to-violet-300/20 blur-2xl" />
        </div>
      </section>
      <Footer />
    </main>
  );
}

