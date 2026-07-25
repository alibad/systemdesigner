'use client';

import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-1">
            <Link href="/" className="text-xl font-bold text-neutral-900 dark:text-white">
              System Designer
            </Link>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Master system design with interactive learning, real-world examples, and hands-on practice.
            </p>
          </div>

          {/* Learn */}
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white uppercase tracking-wider">
              Learn
            </h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/fundamentals" className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition">
                  Fundamentals
                </Link>
              </li>
              <li>
                <Link href="/technology" className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition">
                  Technology
                </Link>
              </li>
              <li>
                <Link href="/reference" className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition">
                  Reference
                </Link>
              </li>
            </ul>
          </div>

          {/* Practice */}
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white uppercase tracking-wider">
              Practice
            </h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/practice" className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition">
                  Problems
                </Link>
              </li>
              <li>
                <Link href="/case-studies" className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition">
                  Case Studies
                </Link>
              </li>
              <li>
                <Link href="/gym" className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition">
                  Interview Gym
                </Link>
              </li>
            </ul>
          </div>

          {/* Tools */}
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white uppercase tracking-wider">
              Design
            </h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/tools/calculators" className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition">
                  Calculators
                </Link>
              </li>
              <li>
                <Link href="/whiteboard" className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition">
                  Whiteboard
                </Link>
              </li>
              <li>
                <Link href="/workshop" className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition">
                  Workshops
                </Link>
              </li>
              <li>
                <Link href="/projects" className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition">
                  Projects
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-8 border-t border-neutral-200 dark:border-neutral-800">
          <p className="text-sm text-neutral-600 dark:text-neutral-400 text-center sm:text-left">
            © {currentYear} System Designer. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}