import Link from 'next/link';
import type { ContentLink } from '@/lib/content-seo';

interface SequenceLink {
  title: string;
  path: string;
}

interface ContentRelatedLinksProps {
  previous?: SequenceLink;
  next?: SequenceLink;
  prerequisites: ContentLink[];
  related: ContentLink[];
}

function LinkCard({ link }: { link: ContentLink }) {
  return (
    <li>
      <Link
        href={link.path as any}
        className="group block h-full rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-indigo-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-indigo-700"
      >
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {link.sectionTitle}
        </span>
        <span className="mt-1 block font-semibold text-neutral-900 group-hover:text-indigo-700 dark:text-neutral-100 dark:group-hover:text-indigo-300">
          {link.title}
        </span>
        <span className="mt-1 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">{link.description}</span>
      </Link>
    </li>
  );
}

/**
 * Server-rendered links under every registry page: prerequisites, related lessons and the
 * previous/next lesson in the section. They give readers a next step and give crawlers
 * contextual paths between lessons beyond the section sidebar.
 */
export default function ContentRelatedLinks({ previous, next, prerequisites, related }: ContentRelatedLinksProps) {
  if (!previous && !next && prerequisites.length === 0 && related.length === 0) return null;

  return (
    <nav aria-labelledby="keep-learning-heading" className="mt-12 border-t border-neutral-200 pt-8 dark:border-neutral-800">
      <h2 id="keep-learning-heading" className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        Keep learning
      </h2>

      {prerequisites.length > 0 && (
        <section className="mt-6">
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Read first</h3>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {prerequisites.map((link) => (
              <LinkCard key={link.id} link={link} />
            ))}
          </ul>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-6">
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Related lessons</h3>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((link) => (
              <LinkCard key={link.id} link={link} />
            ))}
          </ul>
        </section>
      )}

      {(previous || next) && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {previous ? (
            <Link
              href={previous.path as any}
              className="rounded-xl border border-neutral-200 p-4 hover:border-indigo-300 dark:border-neutral-800 dark:hover:border-indigo-700"
            >
              <span className="block text-xs text-neutral-500 dark:text-neutral-400">Previous lesson</span>
              <span className="mt-1 block font-medium text-indigo-700 dark:text-indigo-300">
                <span aria-hidden="true">&larr; </span>
                {previous.title}
              </span>
            </Link>
          ) : (
            <span className="hidden sm:block" />
          )}
          {next && (
            <Link
              href={next.path as any}
              className="rounded-xl border border-neutral-200 p-4 text-right hover:border-indigo-300 dark:border-neutral-800 dark:hover:border-indigo-700"
            >
              <span className="block text-xs text-neutral-500 dark:text-neutral-400">Next lesson</span>
              <span className="mt-1 block font-medium text-indigo-700 dark:text-indigo-300">
                {next.title}
                <span aria-hidden="true"> &rarr;</span>
              </span>
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
