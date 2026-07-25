import type { PropsWithChildren } from 'react';

type RefSectionProps = PropsWithChildren<{
  id: string;
  title: string;
}>;

export default function RefSection({ id, title, children }: RefSectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id={`${id}-title`} className="text-primary-600 text-xl font-semibold border-b-4 border-primary-600 pb-1">
            {title}
          </h2>
          <a
            href={`#${id}`}
            aria-label={`Link to section ${title}`}
            className="hidden md:inline-flex items-center text-neutral-400 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded px-1"
          >
            #
          </a>
        </div>
        <div className="mt-3 space-y-3">
          {children}
        </div>
      </div>
    </section>
  );
}


