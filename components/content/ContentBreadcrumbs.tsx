import Link from 'next/link';

interface Crumb {
  name: string;
  path: string;
}

/** Server-rendered breadcrumb trail; its JSON-LD twin comes from buildContentJsonLd. */
export default function ContentBreadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm">
      <ol className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-neutral-500 dark:text-neutral-400">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={crumb.path} className={`flex min-w-0 items-center gap-2 ${last ? 'max-w-full' : ''}`}>
              {index > 0 && <span aria-hidden="true">/</span>}
              {last ? (
                <span aria-current="page" className="truncate text-neutral-700 dark:text-neutral-300">
                  {crumb.name}
                </span>
              ) : (
                <Link
                  href={crumb.path as any}
                  className="text-indigo-600 hover:text-indigo-700 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  {crumb.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
