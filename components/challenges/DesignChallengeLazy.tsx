'use client';

/**
 * Client-only wrapper for DesignChallenge. tldraw is browser-only, so we must never
 * server-render it — doing so blows up static generation (the build timed out trying to
 * SSR the canvas). `ssr: false` keeps tldraw out of the server render entirely; a sized
 * skeleton holds the layout until it hydrates. Use THIS everywhere a design challenge is
 * embedded (lesson pages and Markdoc), never DesignChallenge directly.
 */

import dynamic from 'next/dynamic';

const DesignChallengeLazy = dynamic(() => import('./DesignChallenge'), {
  ssr: false,
  loading: () => (
    <div
      className="my-8 flex h-[460px] items-center justify-center rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-sm text-neutral-400"
      aria-label="Loading design canvas"
    >
      Loading design canvas…
    </div>
  ),
});

export default DesignChallengeLazy;
