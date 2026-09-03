import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Metadata } from 'next';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { GITHUB_BRANCH, GITHUB_REPO_URL } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Product Roadmap',
  description: 'Follow the roadmap for SystemDesigner’s daily system design and coding experience, from starter lessons to portable progress and deeper practice.',
  alternates: { canonical: '/roadmap' },
};

export default async function RoadmapPage() {
  // Render the versioned source so the app and the next checkout share one plan.
  const roadmap = await readFile(path.join(process.cwd(), 'ROADMAP.md'), 'utf8');
  const sourceRoot = `${GITHUB_REPO_URL}/blob/${encodeURIComponent(GITHUB_BRANCH)}`;

  return (
    <div className="mx-auto max-w-3xl py-8 sm:py-12">
      <nav aria-label="Roadmap navigation" className="mb-8 flex flex-wrap items-center justify-between gap-4 text-sm font-semibold">
        <Link href="/learn" className="inline-flex items-center gap-2 text-emerald-700 hover:underline dark:text-emerald-400">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to learning
        </Link>
        <a href={`${sourceRoot}/docs/CONTINUE_DEVELOPMENT.md`} className="inline-flex items-center gap-2 text-neutral-600 hover:underline dark:text-neutral-300">
          Continue development <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </nav>
      <article className="rounded-3xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 sm:p-10">
        <ReactMarkdown components={{
          h1: ({ children }) => <h1 className="mb-5 text-3xl font-extrabold tracking-tight sm:text-4xl">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-4 mt-10 border-t border-neutral-200 pt-7 text-xl font-bold dark:border-neutral-700">{children}</h2>,
          p: ({ children }) => <p className="my-4 leading-relaxed text-neutral-600 dark:text-neutral-300">{children}</p>,
          ul: ({ children }) => <ul className="my-4 list-disc space-y-3 pl-5 text-neutral-600 marker:text-emerald-600 dark:text-neutral-300">{children}</ul>,
          a: ({ href, children }) => <a href={href && !/^(?:https?:|#|\/)/.test(href) ? `${sourceRoot}/${href.replace(/^\.\//, '')}` : href} className="font-semibold text-emerald-700 underline underline-offset-4 dark:text-emerald-400">{children}</a>,
        }}>{roadmap}</ReactMarkdown>
      </article>
      <p className="mt-5 text-sm text-neutral-500 dark:text-neutral-400">
        This page follows the roadmap saved with the code.{' '}
        <a href={`${sourceRoot}/ROADMAP.md`} className="underline underline-offset-4">View ROADMAP.md on GitHub</a>.
      </p>
    </div>
  );
}
