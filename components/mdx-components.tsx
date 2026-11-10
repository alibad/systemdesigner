import type { MDXRemoteProps } from 'next-mdx-remote/rsc';
import type React from 'react';

export function Note({ children, variant = 'tip' }: { children: React.ReactNode; variant?: 'tip' | 'warn' | 'info' }) {
  // Night variants: without them the pale tints turned muddy on the dark page, with dark text on top.
  const tone = variant === 'warn'
    ? 'from-amber-200/60 to-yellow-100/60 border-amber-400 text-amber-900 dark:from-amber-900/35 dark:to-amber-950/20 dark:border-amber-500 dark:text-amber-100'
    : variant === 'info'
    ? 'from-sky-200/60 to-blue-100/60 border-sky-400 text-sky-900 dark:from-sky-900/35 dark:to-sky-950/20 dark:border-sky-500 dark:text-sky-100'
    : 'from-emerald-200/60 to-green-100/60 border-emerald-400 text-emerald-900 dark:from-emerald-900/35 dark:to-emerald-950/20 dark:border-emerald-500 dark:text-emerald-100';
  return (
    <div className={`bg-gradient-to-br ${tone} border-l-4 rounded-md p-3 text-sm my-3`}>
      {children}
    </div>
  );
}

export function RuleBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gradient-to-br from-violet-200/60 to-fuchsia-100/60 border-l-4 border-violet-500 rounded-xl p-4 mb-3 dark:from-violet-900/35 dark:to-fuchsia-950/20">
      <div className="font-semibold text-violet-900 mb-2 dark:text-violet-200">{title}</div>
      <div className="text-sm text-gray-800 dark:text-gray-200">{children}</div>
    </div>
  );
}

export function Citation({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <sup className="ml-0.5 text-xs align-super">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary-600 hover:underline"
      >
        {children}
      </a>
    </sup>
  );
}

export function MetricTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        {children}
      </table>
    </div>
  );
}

export const components: MDXRemoteProps['components'] = {
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
  Note,
  RuleBox,
  Citation,
  MetricTable
};


