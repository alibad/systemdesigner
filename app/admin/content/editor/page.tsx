'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  ExternalLink,
  FilePenLine,
  Loader2,
  Plus,
  Search,
  Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';

interface EditableContentSummary {
  id: string;
  title: string;
  section: string;
  slug: string;
  path: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  status: 'active' | 'draft' | 'deprecated';
  duration: string;
  lastModified: string;
  hasDraft?: boolean;
}

interface ContentIndexResponse {
  entries: EditableContentSummary[];
  persistence: 'filesystem' | 'github';
  branch?: string;
  draftBranch?: string;
}

const ALL_SECTIONS = 'all';

async function readApiError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error || `Request failed with status ${response.status}.`;
}

export default function AdminContentEditorIndexPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [data, setData] = useState<ContentIndexResponse | null>(null);
  const [query, setQuery] = useState('');
  const [section, setSection] = useState(ALL_SECTIONS);
  const [draftsOnly, setDraftsOnly] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) {
      router.replace('/');
      return;
    }

    let cancelled = false;
    const loadEntries = async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/admin/content', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(await readApiError(response));
        const payload = (await response.json()) as ContentIndexResponse;
        if (!cancelled) setData(payload);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load content.');
        }
      }
    };

    void loadEntries();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAdmin, router, user]);

  const sections = useMemo(
    () => [...new Set(data?.entries.map((entry) => entry.section) ?? [])].sort(),
    [data],
  );

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (data?.entries ?? []).filter((entry) => {
      const matchesSection = section === ALL_SECTIONS || entry.section === section;
      const matchesWorkflow = !draftsOnly || entry.hasDraft;
      const matchesQuery =
        !normalizedQuery ||
        entry.title.toLowerCase().includes(normalizedQuery) ||
        entry.slug.toLowerCase().includes(normalizedQuery) ||
        entry.id.toLowerCase().includes(normalizedQuery);
      return matchesSection && matchesWorkflow && matchesQuery;
    });
  }, [data, draftsOnly, query, section]);

  const draftCount = useMemo(
    () => data?.entries.filter((entry) => entry.hasDraft).length ?? 0,
    [data],
  );

  if (authLoading || (!data && !error)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-500" aria-label="Loading content" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl py-16">
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100"
        >
          <AlertCircle className="mb-3 h-7 w-7" />
          <h1 className="text-xl font-semibold">Content editor unavailable</h1>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <Link
          href="/admin"
          className="mb-5 inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Admin dashboard
        </Link>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-bold">
              <FilePenLine className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              Content Studio
            </h1>
            <p className="mt-2 max-w-3xl text-neutral-600 dark:text-neutral-400">
              Draft safely, compose structured lesson blocks, preview the real rendered page,
              publish deliberately, manage lesson metadata and assets, create new lessons, and
              restore earlier revisions.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:items-end">
            <Button asChild>
              <Link href={'/admin/content/editor/new' as any}>
                <Plus className="mr-2 h-4 w-4" />
                New lesson
              </Link>
            </Button>
            <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
              Published via <span className="font-semibold">{data?.persistence}</span>
              {data?.branch ? ` · ${data.branch}` : ''}
              {data?.draftBranch ? ` · drafts: ${data.draftBranch}` : ''}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 sm:grid-cols-[minmax(0,1fr)_220px_auto_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, slug, or registry ID"
            className="pl-9"
          />
        </label>
        <label>
          <span className="sr-only">Filter by section</span>
          <select
            value={section}
            onChange={(event) => setSection(event.target.value)}
            className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          >
            <option value={ALL_SECTIONS}>All sections</option>
            {sections.map((sectionName) => (
              <option key={sectionName} value={sectionName}>
                {sectionName}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          variant={draftsOnly ? 'default' : 'outline'}
          onClick={() => setDraftsOnly((current) => !current)}
          aria-pressed={draftsOnly}
        >
          Drafts {draftCount}
        </Button>
        <div className="flex items-center justify-end text-sm text-neutral-500">
          {filteredEntries.length} of {data?.entries.length ?? 0}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        {filteredEntries.length === 0 ? (
          <div className="py-16 text-center">
            <BookOpen className="mx-auto mb-3 h-8 w-8 text-neutral-300" />
            <p className="font-medium">No lessons match those filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {filteredEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col gap-4 p-4 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-950/60 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate font-semibold">{entry.title}</h2>
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                      {entry.section}
                    </span>
                    {entry.status !== 'active' && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                        {entry.status}
                      </span>
                    )}
                    {entry.hasDraft && (
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200">
                        Unpublished draft
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate font-mono text-xs text-neutral-500">{entry.path}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {entry.level} · {entry.duration} · registry updated{' '}
                    {new Date(entry.lastModified).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={entry.path as any} target="_blank">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={
                        `/admin/content/editor/${entry.section}/${entry.slug}/manage` as any
                      }
                    >
                      <Settings2 className="mr-2 h-4 w-4" />
                      Manage
                    </Link>
                  </Button>
                  <Button size="sm" asChild>
                    <Link
                      href={`/admin/content/editor/${entry.section}/${entry.slug}` as any}
                    >
                      <FilePenLine className="mr-2 h-4 w-4" />
                      {entry.hasDraft ? 'Continue' : 'Edit'}
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
