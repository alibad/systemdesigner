'use client';

import { usePathname } from 'next/navigation';
import type { PropsWithChildren } from 'react';
import ContentRouteShell from '@/components/content/ContentRouteShell';

export default function ReferenceLayout({ children }: PropsWithChildren) {
  const pathname = usePathname();

  // If it's the main reference page, show the header
  if (pathname === '/reference') {
    return (
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-4">
        <header className="relative overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 md:p-8 shadow-card">
          <div className="relative z-10">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">📐 Back of the Envelope</h1>
            <p className="text-neutral-600 dark:text-neutral-300 mt-2 max-w-2xl">Master system design calculations, reference numbers, and estimation techniques</p>
          </div>
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-tr from-neutral-200/60 to-neutral-100/40 dark:from-neutral-800/40 dark:to-neutral-700/20 blur-3xl" />
          <div className="pointer-events-none absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-gradient-to-tr from-indigo-200/20 to-teal-200/20 dark:from-indigo-900/10 dark:to-teal-900/10 blur-3xl" />
        </header>
        <div className="mt-4 md:mt-6">{children}</div>
      </div>
    );
  }

  // For topic pages, use fundamentals-style layout with auto-injected header
  return (
    <ContentRouteShell section="reference">
      {children}
    </ContentRouteShell>
  );
}
