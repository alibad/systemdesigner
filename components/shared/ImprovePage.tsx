import { Pencil, Lightbulb } from 'lucide-react';
import { githubEditUrl, githubSuggestUrl, GITHUB_REPO_URL } from '@/lib/site-config';

interface ImprovePageProps {
  /** Public content route used for GitHub edit and issue links. */
  path: string;
  /** Content title used to prefill the GitHub issue. */
  title: string;
  className?: string;
}

/**
 * In-app "improve this content" affordance shown on every lesson page.
 *
 * SystemDesigner is open source (CC BY-SA 4.0 content) — anyone can improve a lesson with no setup:
 *  • "Edit this page on GitHub" deep-links to content/entries/<route>/index.mdoc
 *  • "Suggest an improvement" opens a prefilled Content-improvement issue
 *
 * Rendered by GeneralizedContentPage for every canonical content shell.
 */
export default function ImprovePage({ title, path, className = '' }: ImprovePageProps) {
  const editUrl = githubEditUrl(path);
  const suggestUrl = githubSuggestUrl(path, title);

  return (
    <div
      className={`mt-4 flex flex-col sm:flex-row items-center justify-center gap-x-4 gap-y-2 text-sm text-neutral-500 dark:text-neutral-400 ${className}`}
    >
      <span>
        Spotted an issue or have a better explanation?{' '}
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-dotted underline-offset-2 hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          This page is open source.
        </a>
      </span>
      <span className="flex items-center gap-3">
        <a
          href={editUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit on GitHub
        </a>
        <span className="text-neutral-300 dark:text-neutral-600">·</span>
        <a
          href={suggestUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline"
        >
          <Lightbulb className="w-3.5 h-3.5" />
          Suggest an improvement
        </a>
      </span>
    </div>
  );
}
