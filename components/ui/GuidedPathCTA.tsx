"use client";
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { FUNDAMENTALS_NAV } from '@/components/fundamentals/fundamentals-nav-config';
import { GENAI_NAV } from '@/components/genai/genai-nav-config';
import { ML_SYSTEMS_NAV } from '@/components/ml-systems/ml-systems-nav-config';

type State = { 
  label: 'start learning' | 'continue learning'; 
  href: string; 
  path: string;
};

export default function GuidedPathCTA() {
  const defaultHref = useMemo(() => {
    const firstGroup = FUNDAMENTALS_NAV[0];
    return firstGroup?.items?.[0]?.href || '/fundamentals/what-is-system-design';
  }, []);

  const [state, setState] = useState<State>({ label: 'start learning', href: defaultHref, path: 'System Design' });

  useEffect(() => {
    const loadState = async () => {
      try {
        // Regular progress tracking
        const progressRaw = window.localStorage.getItem('user-progress');
        const progress = progressRaw ? JSON.parse(progressRaw) : {};

        // Check progress across all learning paths
        const fundamentals = progress['fundamentals'] || {};
        const genai = progress['genai'] || {};
        const mlSystems = progress['ml-systems'] || {};

        // Get most recent activity across all paths, EXCLUDING completed lessons
        const allProgress = [
          ...Object.values(fundamentals).map((item: any) => ({ ...item, type: 'fundamentals', path: 'System Design' })),
          ...Object.values(genai).map((item: any) => ({ ...item, type: 'genai', path: 'GenAI Systems' })),
          ...Object.values(mlSystems).map((item: any) => ({ ...item, type: 'ml-systems', path: 'ML Systems' }))
        ];

        const recent = allProgress
          .filter(Boolean)
          .filter((item: any) => !item.completed) // EXCLUDE completed lessons
          .sort((a, b) => new Date(b.lastUpdated || 0).getTime() - new Date(a.lastUpdated || 0).getTime())[0];

        // Fallback to last visited page
        const lastVisitedFundamentals = window.localStorage.getItem('sd:last-fundamentals');
        const lastVisitedGenAI = window.localStorage.getItem('sd:last-genai');
        const lastVisitedMLSystems = window.localStorage.getItem('sd:last-ml-systems');

        let href = defaultHref;
        let path = 'System Design';
        
        if (recent) {
          // Handle progress data that might be just lesson slugs
          const item = recent.item as string;
          const type = recent.type;

          // If the item doesn't start with /, it's a lesson slug that needs a section prefix
          if (!item.startsWith('/')) {
            switch (type) {
              case 'fundamentals':
                href = `/fundamentals/${item}`;
                break;
              case 'genai':
                href = `/genai/${item}`;
                break;
              case 'ml-systems':
                href = `/ml-systems/${item}`;
                break;
              default:
                href = item; // fallback to original value
            }
          } else {
            href = item; // already a full path
          }
          path = recent.path;
        } else if (lastVisitedGenAI) {
          // These legacy keys might also be bare slugs, so handle them similarly
          href = lastVisitedGenAI.startsWith('/') ? lastVisitedGenAI : `/genai/${lastVisitedGenAI}`;
          path = 'GenAI Systems';
        } else if (lastVisitedMLSystems) {
          href = lastVisitedMLSystems.startsWith('/') ? lastVisitedMLSystems : `/ml-systems/${lastVisitedMLSystems}`;
          path = 'ML Systems';
        } else if (lastVisitedFundamentals) {
          href = lastVisitedFundamentals.startsWith('/') ? lastVisitedFundamentals : `/fundamentals/${lastVisitedFundamentals}`;
          path = 'System Design';
        }

        const hasProgress = Boolean(recent || lastVisitedFundamentals || lastVisitedGenAI || lastVisitedMLSystems);

        setState({ 
          label: hasProgress ? 'continue learning' as const : 'start learning', 
          href,
          path
        });
      } catch {
        setState({ label: 'start learning', href: defaultHref, path: 'System Design' });
      }
    };

    loadState();
  }, [defaultHref]);

  // If user has progress, show continue learning button
  if (state.label === 'continue learning') {
    return (
      <div className="mt-4">
        <Link className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow hover:shadow-lg transition" href={state.href as any}>
          {state.label}
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
        </Link>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Continue with {state.path}</p>
        

      </div>
    );
  }

  // For new users, link to start learning page
  return (
    <div className="mt-4">
      <Link className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow hover:shadow-lg transition" href="/learn">
        start learning
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
      </Link>
    </div>
  );
}


