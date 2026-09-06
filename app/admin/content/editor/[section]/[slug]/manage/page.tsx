'use client';

import { useCallback, useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileCode2,
  FileJson2,
  FileText,
  Loader2,
  Save,
  Settings2,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';

type ContentSection =
  | 'fundamentals'
  | 'genai'
  | 'ml-systems'
  | 'technology'
  | 'case-studies'
  | 'practice'
  | 'reference'
  | 'tools';
type AssetKind = 'code' | 'quiz' | 'data';

interface ContentMetadata {
  id: string;
  title: string;
  path: string;
  section: ContentSection;
  level: 'beginner' | 'intermediate' | 'advanced';
  duration: string;
  hasQuiz: true;
  hasScenarios: boolean;
  hasCalculator: boolean;
  hasChallenge?: boolean;
  renderMode: 'mdoc';
  prerequisites: string[];
  related: string[];
  nextInSequence?: string;
  tags: string[];
  category?: string;
  seo: {
    metaDescription: string;
    keywords: string[];
    priority: number;
    changeFreq: 'weekly' | 'monthly' | 'yearly';
    lastModified: string;
  };
  status: 'active' | 'draft' | 'deprecated';
  canonicalId?: string;
  aliases?: string[];
}

interface MetadataDocument {
  metadata: ContentMetadata;
  version: string;
  categories: Array<{ key: string; title: string }>;
  commitUrl?: string;
}

interface AssetSummary {
  kind: AssetKind;
  fileName: string;
  size: number;
  publicUrl: string;
}

interface AssetDocument {
  entry: Pick<ContentMetadata, 'id' | 'title' | 'section' | 'path'>;
  version: string;
  assets: AssetSummary[];
  commitUrl?: string;
}

interface ApiErrorPayload {
  error?: string;
  issues?: string[];
}

function listFromInput(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  return `${(value / 1024).toFixed(value < 10240 ? 1 : 0)} KB`;
}

function assetIcon(kind: AssetKind) {
  if (kind === 'quiz') return FileJson2;
  if (kind === 'code') return FileCode2;
  return FileText;
}

async function readApiError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  if (payload?.issues?.length) return payload.issues.join('\n');
  return payload?.error || `Request failed with status ${response.status}.`;
}

export default function AdminContentManagementPage(
  props: {
    params: Promise<{ section: string; slug: string }>;
  }
) {
  const params = use(props.params);
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [metadataDocument, setMetadataDocument] = useState<MetadataDocument | null>(null);
  const [assetsDocument, setAssetsDocument] = useState<AssetDocument | null>(null);
  const [metadata, setMetadata] = useState<ContentMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [savingAsset, setSavingAsset] = useState(false);
  const [deletingAsset, setDeletingAsset] = useState('');
  const [assetKind, setAssetKind] = useState<AssetKind>('code');
  const [assetFileName, setAssetFileName] = useState('');
  const [assetContent, setAssetContent] = useState('');
  const [metadataMessage, setMetadataMessage] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const authorizedFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!user) throw new Error('Admin authentication is required.');
      const token = await user.getIdToken();
      return fetch(input, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });
    },
    [user],
  );

  const baseEndpoint = `/api/admin/content/${encodeURIComponent(
    params.section,
  )}/${encodeURIComponent(params.slug)}`;

  const loadWorkspace = useCallback(async () => {
    setError('');
    try {
      const [metadataResponse, assetsResponse] = await Promise.all([
        authorizedFetch(`${baseEndpoint}/metadata`),
        authorizedFetch(`${baseEndpoint}/assets`),
      ]);
      if (!metadataResponse.ok) throw new Error(await readApiError(metadataResponse));
      if (!assetsResponse.ok) throw new Error(await readApiError(assetsResponse));
      const [nextMetadata, nextAssets] = (await Promise.all([
        metadataResponse.json(),
        assetsResponse.json(),
      ])) as [MetadataDocument, AssetDocument];
      setMetadataDocument(nextMetadata);
      setMetadata(nextMetadata.metadata);
      setAssetsDocument(nextAssets);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Unable to load lesson management.',
      );
    } finally {
      setLoading(false);
    }
  }, [authorizedFetch, baseEndpoint]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) {
      router.replace('/');
      return;
    }
    void loadWorkspace();
  }, [authLoading, isAdmin, loadWorkspace, router, user]);

  const assetsByKind = useMemo(() => {
    const grouped: Record<AssetKind, AssetSummary[]> = { code: [], quiz: [], data: [] };
    for (const asset of assetsDocument?.assets ?? []) grouped[asset.kind].push(asset);
    return grouped;
  }, [assetsDocument]);

  const updateMetadata = <Key extends keyof ContentMetadata>(
    key: Key,
    value: ContentMetadata[Key],
  ) => {
    setMetadata((current) => (current ? { ...current, [key]: value } : current));
  };

  const updateSeo = <Key extends keyof ContentMetadata['seo']>(
    key: Key,
    value: ContentMetadata['seo'][Key],
  ) => {
    setMetadata((current) =>
      current
        ? {
            ...current,
            seo: { ...current.seo, [key]: value },
          }
        : current,
    );
  };

  const saveMetadata = async () => {
    if (!metadata || !metadataDocument) return;
    if (
      !window.confirm(
        'Publish these metadata and navigation changes? This creates a repository commit and starts a site deployment.',
      )
    ) {
      return;
    }
    setSavingMetadata(true);
    setError('');
    setNotice('');
    try {
      const response = await authorizedFetch(`${baseEndpoint}/metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata,
          expectedVersion: metadataDocument.version,
          message: metadataMessage.trim() || undefined,
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const result = (await response.json()) as MetadataDocument;
      setNotice(
        result.commitUrl
          ? 'Metadata published. The production deployment has started.'
          : 'Metadata saved to the local repository.',
      );
      setMetadataMessage('');
      await loadWorkspace();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save metadata.');
    } finally {
      setSavingMetadata(false);
    }
  };

  const chooseAssetFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setError('Assets must be smaller than 1 MB.');
      return;
    }
    setAssetFileName(file.name);
    setAssetContent(await file.text());
  };

  const editAsset = async (asset: AssetSummary) => {
    setError('');
    setNotice('');
    try {
      const search = new URLSearchParams({ kind: asset.kind, file: asset.fileName });
      const response = await authorizedFetch(`${baseEndpoint}/assets?${search}`);
      if (!response.ok) throw new Error(await readApiError(response));
      const payload = (await response.json()) as { content: string };
      setAssetKind(asset.kind);
      setAssetFileName(asset.fileName);
      setAssetContent(payload.content);
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } catch (assetError) {
      setError(assetError instanceof Error ? assetError.message : 'Unable to load the asset.');
    }
  };

  const saveAsset = async () => {
    if (!assetsDocument || !assetFileName.trim() || !assetContent.trim()) return;
    setSavingAsset(true);
    setError('');
    setNotice('');
    try {
      const response = await authorizedFetch(`${baseEndpoint}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: assetKind,
          fileName: assetFileName.trim(),
          content: assetContent,
          expectedVersion: assetsDocument.version,
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      setNotice(
        assetKind === 'quiz'
          ? 'Quiz published and its deployment has started.'
          : 'Lesson asset published and its deployment has started.',
      );
      setAssetFileName('');
      setAssetContent('');
      await loadWorkspace();
    } catch (assetError) {
      setError(assetError instanceof Error ? assetError.message : 'Unable to save the asset.');
    } finally {
      setSavingAsset(false);
    }
  };

  const deleteAsset = async (asset: AssetSummary) => {
    if (!assetsDocument || asset.kind === 'quiz') return;
    if (!window.confirm(`Delete ${asset.kind}/${asset.fileName}? This cannot be undone in the CMS.`)) {
      return;
    }
    const key = `${asset.kind}/${asset.fileName}`;
    setDeletingAsset(key);
    setError('');
    setNotice('');
    try {
      const response = await authorizedFetch(`${baseEndpoint}/assets`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: asset.kind,
          fileName: asset.fileName,
          expectedVersion: assetsDocument.version,
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      setNotice('Unused asset removed. The deployment has started.');
      await loadWorkspace();
    } catch (assetError) {
      setError(assetError instanceof Error ? assetError.message : 'Unable to delete the asset.');
    } finally {
      setDeletingAsset('');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
      </div>
    );
  }

  if (!metadata || !metadataDocument || !assetsDocument) {
    return (
      <div className="mx-auto max-w-3xl py-16">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100">
          <AlertCircle className="mb-3 h-7 w-7" />
          <h1 className="text-xl font-semibold">Lesson management unavailable</h1>
          <p className="mt-2 whitespace-pre-wrap text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link
            href={`/admin/content/editor/${params.section}/${params.slug}` as any}
            className="mb-4 inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Lesson editor
          </Link>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <Settings2 className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
            Manage {metadata.title}
          </h1>
          <p className="mt-2 max-w-3xl text-neutral-600 dark:text-neutral-400">
            Control discovery metadata, learning relationships, publication status, quizzes,
            code examples, and structured lesson data.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={metadata.path as any} target="_blank">
            <ExternalLink className="mr-2 h-4 w-4" />
            Published page
          </Link>
        </Button>
      </header>

      {error && (
        <div
          role="alert"
          className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="whitespace-pre-wrap text-sm">{error}</p>
        </div>
      )}
      {notice && !error && (
        <div
          role="status"
          className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm">{notice}</p>
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="border-b border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="text-xl font-semibold">Lesson metadata</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Registry identity and URL are protected. Everything that controls how the lesson is
            found, sequenced, and published can be updated here.
          </p>
        </div>
        <div className="grid gap-5 p-5 md:grid-cols-2">
          <label>
            <span className="mb-1.5 block text-sm font-medium">Registry ID</span>
            <Input value={metadata.id} disabled />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium">URL path</span>
            <Input value={metadata.path} disabled />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium">Lesson title</span>
            <Input
              value={metadata.title}
              maxLength={140}
              onChange={(event) => updateMetadata('title', event.target.value)}
            />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium">Level</span>
            <select
              value={metadata.level}
              onChange={(event) =>
                updateMetadata('level', event.target.value as ContentMetadata['level'])
              }
              className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium">Estimated duration</span>
            <Input
              value={metadata.duration}
              onChange={(event) => updateMetadata('duration', event.target.value)}
              placeholder="20 min"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium">Category</span>
            <select
              value={metadata.category ?? ''}
              onChange={(event) =>
                updateMetadata('category', event.target.value || undefined)
              }
              className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            >
              <option value="">Uncategorized</option>
              {metadataDocument.categories.map((category) => (
                <option key={category.key} value={category.key}>
                  {category.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium">Publication status</span>
            <select
              value={metadata.status}
              onChange={(event) =>
                updateMetadata('status', event.target.value as ContentMetadata['status'])
              }
              className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            >
              <option value="active">Active and visible</option>
              <option value="draft">Draft and hidden</option>
              <option value="deprecated">Deprecated</option>
            </select>
          </label>
          <label className="md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium">Tags</span>
            <Input
              value={metadata.tags.join(', ')}
              onChange={(event) => updateMetadata('tags', listFromInput(event.target.value))}
              placeholder="scalability, caching, system-design"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium">Prerequisite lesson IDs</span>
            <Textarea
              value={metadata.prerequisites.join('\n')}
              onChange={(event) =>
                updateMetadata('prerequisites', listFromInput(event.target.value))
              }
              className="min-h-28"
              placeholder="one-id-per-line"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium">Related lesson IDs</span>
            <Textarea
              value={metadata.related.join('\n')}
              onChange={(event) => updateMetadata('related', listFromInput(event.target.value))}
              className="min-h-28"
              placeholder="one-id-per-line"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium">Next lesson ID</span>
            <Input
              value={metadata.nextInSequence ?? ''}
              onChange={(event) =>
                updateMetadata('nextInSequence', event.target.value.trim() || undefined)
              }
              placeholder="Optional explicit next lesson"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium">Canonical lesson ID</span>
            <Input
              value={metadata.canonicalId ?? ''}
              onChange={(event) =>
                updateMetadata('canonicalId', event.target.value.trim() || undefined)
              }
              placeholder="Only for duplicate coverage"
            />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium">URL aliases</span>
            <Textarea
              value={(metadata.aliases ?? []).join('\n')}
              onChange={(event) => updateMetadata('aliases', listFromInput(event.target.value))}
              className="min-h-24"
              placeholder="/old-section/old-lesson"
            />
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <input
              type="checkbox"
              checked={metadata.hasScenarios}
              onChange={(event) => updateMetadata('hasScenarios', event.target.checked)}
              className="h-4 w-4"
            />
            <span>
              <span className="block text-sm font-medium">Scenario-driven lesson</span>
              <span className="block text-xs text-neutral-500">
                Marks the lesson as containing scenario exploration.
              </span>
            </span>
          </label>
          <div className="rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
            <p className="font-medium">Derived automatically from the lesson body</p>
            <p className="mt-2 text-neutral-500">
              Quiz: required · Calculator: {metadata.hasCalculator ? 'yes' : 'no'} · Graded
              challenge: {metadata.hasChallenge ? 'yes' : 'no'}
            </p>
          </div>
        </div>

        <div className="border-t border-neutral-200 p-5 dark:border-neutral-800">
          <h3 className="font-semibold">Search and sharing</h3>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className="mb-1.5 flex justify-between text-sm font-medium">
                Meta description
                <span className="font-normal text-neutral-400">
                  {metadata.seo.metaDescription.length}/160
                </span>
              </span>
              <Textarea
                value={metadata.seo.metaDescription}
                maxLength={160}
                onChange={(event) => updateSeo('metaDescription', event.target.value)}
                className="min-h-24"
              />
            </label>
            <label className="md:col-span-2">
              <span className="mb-1.5 block text-sm font-medium">SEO keywords</span>
              <Input
                value={metadata.seo.keywords.join(', ')}
                onChange={(event) => updateSeo('keywords', listFromInput(event.target.value))}
              />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium">Sitemap priority</span>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={metadata.seo.priority}
                onChange={(event) => updateSeo('priority', Number(event.target.value))}
              />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium">Expected change frequency</span>
              <select
                value={metadata.seo.changeFreq}
                onChange={(event) =>
                  updateSeo(
                    'changeFreq',
                    event.target.value as ContentMetadata['seo']['changeFreq'],
                  )
                }
                className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-neutral-200 p-5 dark:border-neutral-800 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="mb-1.5 block text-sm font-medium">Publication note</span>
            <Input
              value={metadataMessage}
              maxLength={160}
              onChange={(event) => setMetadataMessage(event.target.value)}
              placeholder={`Update ${metadata.title} metadata`}
            />
          </label>
          <Button onClick={() => void saveMetadata()} disabled={savingMetadata}>
            {savingMetadata ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save and publish metadata
          </Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="border-b border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="text-xl font-semibold">Lesson assets</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Manage the quiz, external code examples, and structured data used by Markdoc blocks.
            Referenced files cannot be deleted, and the required quiz can only be replaced.
          </p>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-3">
          {(['quiz', 'code', 'data'] as const).map((kind) => {
            const Icon = assetIcon(kind);
            return (
              <div key={kind} className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
                  <Icon className="h-4 w-4 text-indigo-500" />
                  <h3 className="font-semibold capitalize">{kind}</h3>
                  <span className="ml-auto text-xs text-neutral-400">
                    {assetsByKind[kind].length}
                  </span>
                </div>
                <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {assetsByKind[kind].length === 0 ? (
                    <p className="p-4 text-sm text-neutral-500">No {kind} files.</p>
                  ) : (
                    assetsByKind[kind].map((asset) => {
                      const key = `${asset.kind}/${asset.fileName}`;
                      return (
                        <div key={key} className="p-3">
                          <p className="break-all font-mono text-xs">{asset.fileName}</p>
                          <p className="mt-1 text-xs text-neutral-400">{formatBytes(asset.size)}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" asChild>
                              <a href={asset.publicUrl} target="_blank" rel="noreferrer">
                                View
                              </a>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void editAsset(asset)}
                            >
                              Edit
                            </Button>
                            {asset.kind !== 'quiz' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={deletingAsset === key}
                                onClick={() => void deleteAsset(asset)}
                              >
                                {deletingAsset === key ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                )}
                                <span className="sr-only">Delete {asset.fileName}</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-neutral-200 p-5 dark:border-neutral-800">
          <h3 className="font-semibold">Add or replace a text asset</h3>
          <p className="mt-1 text-sm text-neutral-500">
            Choose an existing file above to edit it, upload a local text file, or paste content.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
            <label>
              <span className="mb-1.5 block text-sm font-medium">Asset type</span>
              <select
                value={assetKind}
                onChange={(event) => setAssetKind(event.target.value as AssetKind)}
                className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              >
                <option value="code">Code example</option>
                <option value="quiz">Quiz JSON</option>
                <option value="data">Structured data</option>
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium">Filename</span>
              <Input
                value={assetFileName}
                onChange={(event) => setAssetFileName(event.target.value)}
                placeholder={
                  assetKind === 'quiz'
                    ? 'lesson-check.json'
                    : assetKind === 'code'
                      ? 'example.ts'
                      : 'sample-data.json'
                }
              />
            </label>
            <label className="md:col-span-2">
              <span className="mb-1.5 block text-sm font-medium">Choose a text file</span>
              <Input
                type="file"
                onChange={(event) => void chooseAssetFile(event.target.files?.[0])}
              />
            </label>
            <label className="md:col-span-2">
              <span className="mb-1.5 block text-sm font-medium">File content</span>
              <Textarea
                value={assetContent}
                onChange={(event) => setAssetContent(event.target.value)}
                spellCheck={false}
                className="min-h-72 font-mono text-xs leading-5"
                placeholder="Paste or upload the asset content."
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => void saveAsset()}
              disabled={savingAsset || !assetFileName.trim() || !assetContent.trim()}
            >
              {savingAsset ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Publish asset
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
