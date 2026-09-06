'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { RenderableTreeNode } from '@markdoc/markdoc';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Blocks,
  CheckCircle2,
  Clock3,
  Cloud,
  CloudOff,
  Code2,
  Copy,
  Eye,
  ExternalLink,
  FileCheck2,
  History,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, use } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import {
  deleteContentBlock,
  duplicateContentBlock,
  getContentBlockTemplates,
  insertContentBlock,
  moveContentBlock,
  parseEditableContentBlocks,
  replaceContentBlock,
} from '@/lib/content-block-editor';

const MarkdocLesson = dynamic(() => import('@/components/markdoc/MarkdocLesson'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-64 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
    </div>
  ),
});

type EditorMode = 'blocks' | 'source' | 'preview';
type DraftSaveState = 'saved' | 'unsaved' | 'saving' | 'error';

interface ContentActor {
  uid: string;
  email: string;
}

interface ContentDraft {
  source: string;
  version: string;
  baseVersion: string;
  updatedAt: string;
  updatedBy: ContentActor;
}

interface ContentStudioDocument {
  entry: {
    id: string;
    title: string;
    section: string;
    slug: string;
    path: string;
    status: string;
    level: string;
    duration: string;
  };
  published: { source: string; version: string };
  draft: ContentDraft | null;
  workflowState: 'published' | 'draft' | 'conflicted';
  persistence: 'filesystem' | 'github';
  branch?: string;
  draftBranch?: string;
}

interface SavedDraftResponse {
  draft: ContentDraft;
  persistence: 'filesystem' | 'github';
  draftBranch?: string;
}

interface PreviewResponse {
  valid: true;
  derived: {
    hasChallenge: boolean;
    hasQuiz: boolean;
    hasCalculator: boolean;
  };
  tree: RenderableTreeNode;
}

interface PublishResponse {
  source: string;
  version: string;
  persistence: 'filesystem' | 'github';
  branch?: string;
  commitUrl?: string;
  publishedAt: string;
  draftDiscarded: boolean;
}

interface RevisionSummary {
  id: string;
  version: string;
  createdAt: string;
  actor: string;
  message: string;
  url?: string;
}

interface ApiErrorPayload {
  error?: string;
  issues?: string[];
}

interface LocalRecovery {
  source: string;
  updatedAt: string;
}

async function readApiError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  if (payload?.issues?.length) return payload.issues.join('\n');
  return payload?.error || `Request failed with status ${response.status}.`;
}

function workflowBadge(state: ContentStudioDocument['workflowState']) {
  if (state === 'conflicted') return <Badge variant="destructive">Conflict</Badge>;
  if (state === 'draft') return <Badge>Draft</Badge>;
  return <Badge variant="secondary">Published</Badge>;
}

export default function AdminContentStudioPage(
  props: {
    params: Promise<{ section: string; slug: string }>;
  }
) {
  const params = use(props.params);
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [document, setDocument] = useState<ContentStudioDocument | null>(null);
  const [source, setSource] = useState('');
  const [lastDraftedSource, setLastDraftedSource] = useState('');
  const [draftVersion, setDraftVersion] = useState<string | null>(null);
  const [draftSaveState, setDraftSaveState] = useState<DraftSaveState>('saved');
  const [mode, setMode] = useState<EditorMode>('blocks');
  const [selectedBlockIndex, setSelectedBlockIndex] = useState(0);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewedSource, setPreviewedSource] = useState('');
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid'>('idle');
  const [previewError, setPreviewError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishMessage, setPublishMessage] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [restoringRevision, setRestoringRevision] = useState('');
  const [recovery, setRecovery] = useState<LocalRecovery | null>(null);

  const sourceRef = useRef('');
  const draftVersionRef = useRef<string | null>(null);
  const lastDraftedSourceRef = useRef('');
  const savePromiseRef = useRef<Promise<string> | null>(null);
  const previewRequestRef = useRef(0);

  const baseEndpoint = useMemo(
    () =>
      `/api/admin/content/${encodeURIComponent(params.section)}/${encodeURIComponent(params.slug)}`,
    [params.section, params.slug],
  );
  const recoveryKey = useMemo(
    () => `systemdesigner-cms-recovery:${params.section}/${params.slug}`,
    [params.section, params.slug],
  );
  const parsedBlocks = useMemo(() => parseEditableContentBlocks(source), [source]);
  const templates = useMemo(() => getContentBlockTemplates(), []);
  const selectedBlock = parsedBlocks.blocks[selectedBlockIndex] ?? null;
  const hasUndraftedChanges = source !== lastDraftedSource;
  const sourceStats = useMemo(
    () => ({
      lines: source.split('\n').length,
      bytes: new TextEncoder().encode(source).byteLength,
    }),
    [source],
  );
  const previewIsCurrent = previewStatus === 'valid' && previewedSource === source;
  const hasPublishableWork = Boolean(draftVersion) || source !== document?.published.source;
  const canPublish = Boolean(
    document &&
      hasPublishableWork &&
      previewIsCurrent &&
      document.workflowState !== 'conflicted' &&
      draftSaveState !== 'saving' &&
      !publishing,
  );

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  useEffect(() => {
    if (selectedBlockIndex >= parsedBlocks.blocks.length) {
      setSelectedBlockIndex(Math.max(parsedBlocks.blocks.length - 1, 0));
    }
  }, [parsedBlocks.blocks.length, selectedBlockIndex]);

  const authorizedFetch = useCallback(
    async (url: string, init?: RequestInit) => {
      if (!user) throw new Error('Sign in as an admin to manage content.');
      const token = await user.getIdToken();
      return fetch(url, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...init?.headers,
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });
    },
    [user],
  );

  const applyLoadedDocument = useCallback(
    (payload: ContentStudioDocument) => {
      const workingSource = payload.draft?.source ?? payload.published.source;
      setDocument(payload);
      setSource(workingSource);
      sourceRef.current = workingSource;
      setLastDraftedSource(workingSource);
      lastDraftedSourceRef.current = workingSource;
      setDraftVersion(payload.draft?.version ?? null);
      draftVersionRef.current = payload.draft?.version ?? null;
      setDraftSaveState('saved');
      setSelectedBlockIndex(0);
      setError('');
      setNotice('');

      try {
        const rawRecovery = window.localStorage.getItem(recoveryKey);
        if (rawRecovery) {
          const localRecovery = JSON.parse(rawRecovery) as LocalRecovery;
          const serverUpdatedAt = payload.draft?.updatedAt ?? '';
          if (
            localRecovery.source !== workingSource &&
            localRecovery.updatedAt > serverUpdatedAt
          ) {
            setRecovery(localRecovery);
          } else {
            window.localStorage.removeItem(recoveryKey);
            setRecovery(null);
          }
        }
      } catch {
        window.localStorage.removeItem(recoveryKey);
      }
    },
    [recoveryKey],
  );

  const loadDocument = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await authorizedFetch(baseEndpoint);
      if (!response.ok) throw new Error(await readApiError(response));
      applyLoadedDocument((await response.json()) as ContentStudioDocument);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load this lesson.');
    } finally {
      setLoading(false);
    }
  }, [applyLoadedDocument, authorizedFetch, baseEndpoint]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) {
      router.replace('/');
      return;
    }
    void loadDocument();
  }, [authLoading, isAdmin, loadDocument, router, user]);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUndraftedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [hasUndraftedChanges]);

  useEffect(() => {
    if (!document || !hasUndraftedChanges) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(
        recoveryKey,
        JSON.stringify({ source, updatedAt: new Date().toISOString() }),
      );
    }, 500);
    return () => window.clearTimeout(timer);
  }, [document, hasUndraftedChanges, recoveryKey, source]);

  const persistDraft = useCallback(
    async (candidate: string): Promise<string> => {
      if (!document) throw new Error('The content document is not loaded.');
      if (savePromiseRef.current) await savePromiseRef.current;
      if (
        candidate === lastDraftedSourceRef.current &&
        draftVersionRef.current
      ) {
        return draftVersionRef.current;
      }

      setDraftSaveState('saving');
      const request = (async () => {
        const response = await authorizedFetch(`${baseEndpoint}/draft`, {
          method: 'PUT',
          body: JSON.stringify({
            source: candidate,
            baseVersion: document.published.version,
            expectedVersion: draftVersionRef.current,
          }),
        });
        if (!response.ok) throw new Error(await readApiError(response));
        const payload = (await response.json()) as SavedDraftResponse;
        draftVersionRef.current = payload.draft.version;
        lastDraftedSourceRef.current = candidate;
        setDraftVersion(payload.draft.version);
        setLastDraftedSource(candidate);
        setDocument((current) =>
          current
            ? {
                ...current,
                draft: payload.draft,
                workflowState:
                  payload.draft.baseVersion === current.published.version
                    ? 'draft'
                    : 'conflicted',
              }
            : current,
        );
        setDraftSaveState('saved');
        setNotice(`Draft autosaved at ${new Date(payload.draft.updatedAt).toLocaleTimeString()}.`);
        if (sourceRef.current === candidate) {
          window.localStorage.removeItem(recoveryKey);
          setRecovery(null);
        }
        return payload.draft.version;
      })();

      savePromiseRef.current = request;
      try {
        return await request;
      } catch (saveError) {
        setDraftSaveState('error');
        setError(saveError instanceof Error ? saveError.message : 'Unable to save the draft.');
        throw saveError;
      } finally {
        savePromiseRef.current = null;
      }
    },
    [authorizedFetch, baseEndpoint, document, recoveryKey],
  );

  useEffect(() => {
    if (!document || !hasUndraftedChanges || draftSaveState === 'saving') return;
    setDraftSaveState('unsaved');
    const timer = window.setTimeout(() => {
      void persistDraft(source).catch(() => undefined);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [document, draftSaveState, hasUndraftedChanges, persistDraft, source]);

  useEffect(() => {
    if (!document) return;
    const requestId = previewRequestRef.current + 1;
    previewRequestRef.current = requestId;
    const timer = window.setTimeout(async () => {
      setPreviewStatus('loading');
      setPreviewError('');
      try {
        const response = await authorizedFetch(baseEndpoint, {
          method: 'POST',
          body: JSON.stringify({ source }),
        });
        if (!response.ok) throw new Error(await readApiError(response));
        if (previewRequestRef.current !== requestId) return;
        setPreview((await response.json()) as PreviewResponse);
        setPreviewedSource(source);
        setPreviewStatus('valid');
      } catch (previewFailure) {
        if (previewRequestRef.current !== requestId) return;
        setPreview(null);
        setPreviewedSource(source);
        setPreviewStatus('invalid');
        setPreviewError(
          previewFailure instanceof Error ? previewFailure.message : 'Preview validation failed.',
        );
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [authorizedFetch, baseEndpoint, document, source]);

  const discardDraft = useCallback(async () => {
    if (!document) return;
    if (!window.confirm('Discard this draft and restore the currently published lesson?')) return;
    setError('');
    try {
      if (draftVersionRef.current) {
        const response = await authorizedFetch(`${baseEndpoint}/draft`, {
          method: 'DELETE',
          body: JSON.stringify({ expectedVersion: draftVersionRef.current }),
        });
        if (!response.ok) throw new Error(await readApiError(response));
      }
      const publishedSource = document.published.source;
      setSource(publishedSource);
      sourceRef.current = publishedSource;
      setLastDraftedSource(publishedSource);
      lastDraftedSourceRef.current = publishedSource;
      setDraftVersion(null);
      draftVersionRef.current = null;
      setDraftSaveState('saved');
      setDocument({ ...document, draft: null, workflowState: 'published' });
      window.localStorage.removeItem(recoveryKey);
      setRecovery(null);
      setNotice('Draft discarded. The editor now shows the published lesson.');
    } catch (discardError) {
      setError(discardError instanceof Error ? discardError.message : 'Unable to discard the draft.');
    }
  }, [authorizedFetch, baseEndpoint, document, recoveryKey]);

  const rebaseDraft = useCallback(async () => {
    if (!document) return;
    if (
      !window.confirm(
        'Rebase this draft onto the newest published version? Review the draft carefully first; its content will win on publish.',
      )
    ) {
      return;
    }
    setError('');
    try {
      const savedVersion = await persistDraft(sourceRef.current);
      const response = await authorizedFetch(`${baseEndpoint}/draft`, {
        method: 'PATCH',
        body: JSON.stringify({ expectedVersion: savedVersion }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const payload = (await response.json()) as SavedDraftResponse;
      draftVersionRef.current = payload.draft.version;
      setDraftVersion(payload.draft.version);
      setDocument((current) =>
        current ? { ...current, draft: payload.draft, workflowState: 'draft' } : current,
      );
      setNotice('Draft rebased onto the latest published version.');
    } catch (rebaseError) {
      setError(rebaseError instanceof Error ? rebaseError.message : 'Unable to rebase the draft.');
    }
  }, [authorizedFetch, baseEndpoint, document, persistDraft]);

  const publishDraft = useCallback(async () => {
    if (!document || !previewIsCurrent) return;
    setPublishing(true);
    setError('');
    try {
      const version = await persistDraft(sourceRef.current);
      const response = await authorizedFetch(`${baseEndpoint}/publish`, {
        method: 'POST',
        body: JSON.stringify({
          draftVersion: version,
          publishedVersion: document.published.version,
          message: publishMessage.trim() || undefined,
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const payload = (await response.json()) as PublishResponse;

      if (!payload.draftDiscarded) {
        setPublishOpen(false);
        setPublishMessage('');
        setRevisions([]);
        await loadDocument();
        setError(
          'The lesson published successfully, but its draft could not be cleaned up. The retained draft is shown as conflicted; confirm the published page, then discard it.',
        );
        return;
      }

      setSource(payload.source);
      sourceRef.current = payload.source;
      setLastDraftedSource(payload.source);
      lastDraftedSourceRef.current = payload.source;
      setDraftVersion(null);
      draftVersionRef.current = null;
      setDraftSaveState('saved');
      setDocument({
        ...document,
        published: { source: payload.source, version: payload.version },
        draft: null,
        workflowState: 'published',
      });
      setPublishOpen(false);
      setPublishMessage('');
      window.localStorage.removeItem(recoveryKey);
      setRecovery(null);
      setNotice(
        payload.persistence === 'github'
          ? 'Published. The repository commit will deploy through the normal pipeline.'
          : 'Published to the repository file and revalidated the lesson route.',
      );
      setRevisions([]);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'Unable to publish the draft.');
    } finally {
      setPublishing(false);
    }
  }, [
    authorizedFetch,
    baseEndpoint,
    document,
    loadDocument,
    persistDraft,
    previewIsCurrent,
    publishMessage,
    recoveryKey,
  ]);

  const loadRevisions = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await authorizedFetch(`${baseEndpoint}/revisions`);
      if (!response.ok) throw new Error(await readApiError(response));
      setRevisions(((await response.json()) as { revisions: RevisionSummary[] }).revisions);
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : 'Unable to load revisions.');
    } finally {
      setHistoryLoading(false);
    }
  }, [authorizedFetch, baseEndpoint]);

  useEffect(() => {
    if (historyOpen && revisions.length === 0) void loadRevisions();
  }, [historyOpen, loadRevisions, revisions.length]);

  const restoreRevision = useCallback(
    async (revision: RevisionSummary) => {
      if (
        hasUndraftedChanges &&
        !window.confirm('Replace your unsaved local changes with this revision?')
      ) {
        return;
      }
      setRestoringRevision(revision.id);
      setError('');
      try {
        const response = await authorizedFetch(
          `${baseEndpoint}/revisions/${encodeURIComponent(revision.id)}`,
          {
            method: 'POST',
            body: JSON.stringify({ expectedDraftVersion: draftVersionRef.current }),
          },
        );
        if (!response.ok) throw new Error(await readApiError(response));
        const payload = (await response.json()) as SavedDraftResponse;
        setSource(payload.draft.source);
        sourceRef.current = payload.draft.source;
        setLastDraftedSource(payload.draft.source);
        lastDraftedSourceRef.current = payload.draft.source;
        setDraftVersion(payload.draft.version);
        draftVersionRef.current = payload.draft.version;
        setDraftSaveState('saved');
        setDocument((current) =>
          current ? { ...current, draft: payload.draft, workflowState: 'draft' } : current,
        );
        setHistoryOpen(false);
        setNotice(`Revision from ${new Date(revision.createdAt).toLocaleString()} restored as a draft.`);
      } catch (restoreError) {
        setError(restoreError instanceof Error ? restoreError.message : 'Unable to restore the revision.');
      } finally {
        setRestoringRevision('');
      }
    },
    [authorizedFetch, baseEndpoint, hasUndraftedChanges],
  );

  useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void persistDraft(sourceRef.current).catch(() => undefined);
      }
    };
    window.addEventListener('keydown', handleSaveShortcut);
    return () => window.removeEventListener('keydown', handleSaveShortcut);
  }, [persistDraft]);

  const updateSource = useCallback((nextSource: string) => {
    setSource(nextSource);
    setNotice('');
    setDraftSaveState('unsaved');
  }, []);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-500" aria-label="Loading content studio" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="mx-auto max-w-3xl py-16">
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100"
        >
          <AlertCircle className="mb-3 h-7 w-7" />
          <h1 className="text-xl font-semibold">Unable to open Content Studio</h1>
          <p className="mt-2 whitespace-pre-wrap text-sm">{error}</p>
          <Button variant="outline" className="mt-5" onClick={() => void loadDocument()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const previewPanel = (
    <section className="min-h-[640px] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <div>
          <p className="text-sm font-semibold">Draft preview</p>
          <p className="text-xs text-neutral-500">Rendered with the production Markdoc components</p>
        </div>
        {previewStatus === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />}
        {previewStatus === 'valid' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
        {previewStatus === 'invalid' && <AlertCircle className="h-4 w-4 text-red-500" />}
      </div>
      {previewStatus === 'invalid' ? (
        <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100">
          <p className="font-semibold">Preview unavailable</p>
          <p className="mt-2 whitespace-pre-wrap font-mono text-xs leading-5">{previewError}</p>
        </div>
      ) : preview ? (
        <div className="p-5 md:p-8">
          <div className="mb-8 border-b border-neutral-200 pb-5 dark:border-neutral-800">
            <p className="text-xs font-medium uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              {document.entry.section} · {document.entry.level}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{document.entry.title}</h1>
          </div>
          <article className="prose prose-neutral max-w-none dark:prose-invert">
            <MarkdocLesson tree={preview.tree} />
          </article>
        </div>
      ) : (
        <div className="flex min-h-80 items-center justify-center text-sm text-neutral-500">
          Preparing preview…
        </div>
      )}
    </section>
  );

  return (
    <div className="mx-auto max-w-[1700px] space-y-5 pb-12">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link
            href="/admin/content/editor"
            onClick={(event) => {
              if (hasUndraftedChanges && !window.confirm('Leave before the latest changes autosave?')) {
                event.preventDefault();
              }
            }}
            className="mb-4 inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Content Studio
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold">{document.entry.title}</h1>
            {workflowBadge(document.workflowState)}
          </div>
          <p className="mt-1 font-mono text-sm text-neutral-500">{document.entry.path}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={document.entry.path as any} target="_blank">
              <ExternalLink className="mr-2 h-4 w-4" />
              Published page
            </Link>
          </Button>
          <Button variant="outline" onClick={() => setHistoryOpen(true)}>
            <History className="mr-2 h-4 w-4" />
            Revisions
          </Button>
          <Button
            variant="outline"
            onClick={() => void persistDraft(sourceRef.current).catch(() => undefined)}
            disabled={!hasUndraftedChanges || draftSaveState === 'saving'}
          >
            {draftSaveState === 'saving' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save draft
          </Button>
          <Button onClick={() => setPublishOpen(true)} disabled={!canPublish}>
            <Send className="mr-2 h-4 w-4" />
            Publish
          </Button>
        </div>
      </header>

      <div className="flex flex-col justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-900 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-neutral-600 dark:text-neutral-300">
          <span className="inline-flex items-center gap-1.5">
            {draftSaveState === 'error' ? (
              <CloudOff className="h-4 w-4 text-red-500" />
            ) : draftSaveState === 'saving' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Cloud className="h-4 w-4 text-emerald-500" />
            )}
            {draftSaveState === 'saving'
              ? 'Autosaving…'
              : hasUndraftedChanges
                ? 'Local changes pending'
                : draftVersion
                  ? 'Draft saved'
                  : 'Published version'}
          </span>
          <span>{sourceStats.lines.toLocaleString()} lines</span>
          <span>{sourceStats.bytes.toLocaleString()} bytes</span>
          <span>{parsedBlocks.blocks.length} blocks</span>
          <span>
            {document.persistence === 'github'
              ? `${document.branch} · drafts on ${document.draftBranch}`
              : 'Local repository storage'}
          </span>
        </div>
        <div className="flex rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
          {(
            [
              ['blocks', 'Blocks', Blocks],
              ['source', 'Source', Code2],
              ['preview', 'Preview', Eye],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === value
                  ? 'bg-white text-neutral-950 shadow-sm dark:bg-neutral-950 dark:text-white'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {recovery && (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100 sm:flex-row sm:items-center">
          <Clock3 className="h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">A newer browser recovery copy is available</p>
            <p className="text-sm">It was captured at {new Date(recovery.updatedAt).toLocaleString()}.</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              updateSource(recovery.source);
              setRecovery(null);
            }}
          >
            Restore it
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              window.localStorage.removeItem(recoveryKey);
              setRecovery(null);
            }}
          >
            Dismiss
          </Button>
        </div>
      )}

      {document.workflowState === 'conflicted' && (
        <div className="flex flex-col gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-red-950 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-100 sm:flex-row sm:items-center">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Published content changed after this draft began</p>
            <p className="text-sm">Publishing is blocked until you review and rebase the draft.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void rebaseDraft()}>
            Rebase reviewed draft
          </Button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Content Studio needs attention</p>
            <p className="mt-1 whitespace-pre-wrap font-mono text-xs leading-5">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadDocument()}>
            Reload
          </Button>
        </div>
      )}

      {notice && !error && (
        <div role="status" className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          {notice}
        </div>
      )}

      {mode === 'blocks' && (
        <div className="grid gap-5 xl:grid-cols-[260px_minmax(420px,0.95fr)_minmax(460px,1.05fr)]">
          <aside className="self-start overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 xl:sticky xl:top-20">
            <div className="border-b border-neutral-200 p-4 dark:border-neutral-800">
              <p className="font-semibold">Document outline</p>
              <p className="mt-1 text-xs text-neutral-500">Top-level Markdoc blocks</p>
            </div>
            <div className="max-h-[610px] space-y-1 overflow-y-auto p-2">
              {parsedBlocks.blocks.map((block, index) => (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => setSelectedBlockIndex(index)}
                  className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                    selectedBlockIndex === index
                      ? 'bg-indigo-50 text-indigo-950 dark:bg-indigo-950/50 dark:text-indigo-100'
                      : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    {index + 1} · {block.kind}
                  </span>
                  <span className="mt-0.5 block truncate text-sm font-medium">{block.label}</span>
                </button>
              ))}
            </div>
            <div className="border-t border-neutral-200 p-3 dark:border-neutral-800">
              <label className="relative block">
                <span className="sr-only">Add a content block</span>
                <Plus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <select
                  defaultValue=""
                  onChange={(event) => {
                    const template = templates.find((item) => item.id === event.target.value);
                    if (!template) return;
                    updateSource(insertContentBlock(source, selectedBlockIndex, template.source));
                    setSelectedBlockIndex(Math.min(selectedBlockIndex + 1, parsedBlocks.blocks.length));
                    event.target.value = '';
                  }}
                  className="h-10 w-full rounded-md border border-neutral-300 bg-white pl-9 pr-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                >
                  <option value="" disabled>Add block…</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>{template.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </aside>

          <section className="self-start overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 xl:sticky xl:top-20">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 p-3 dark:border-neutral-800">
              <div>
                <p className="text-sm font-semibold">{selectedBlock?.label ?? 'No block selected'}</p>
                <p className="text-xs text-neutral-500">
                  {selectedBlock ? `${selectedBlock.kind} · starts on line ${selectedBlock.startLine}` : 'Add a block to begin.'}
                </p>
              </div>
              {selectedBlock && (
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Move block up"
                    disabled={selectedBlockIndex === 0}
                    onClick={() => {
                      updateSource(moveContentBlock(source, selectedBlockIndex, -1));
                      setSelectedBlockIndex(selectedBlockIndex - 1);
                    }}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Move block down"
                    disabled={selectedBlockIndex >= parsedBlocks.blocks.length - 1}
                    onClick={() => {
                      updateSource(moveContentBlock(source, selectedBlockIndex, 1));
                      setSelectedBlockIndex(selectedBlockIndex + 1);
                    }}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Duplicate block"
                    onClick={() => {
                      updateSource(duplicateContentBlock(source, selectedBlockIndex));
                      setSelectedBlockIndex(selectedBlockIndex + 1);
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete block"
                    onClick={() => {
                      if (!window.confirm('Delete this block from the draft?')) return;
                      updateSource(deleteContentBlock(source, selectedBlockIndex));
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              )}
            </div>
            {selectedBlock ? (
              <Textarea
                value={selectedBlock.source}
                onChange={(event) =>
                  updateSource(replaceContentBlock(source, selectedBlockIndex, event.target.value))
                }
                spellCheck={false}
                aria-label={`Source for ${selectedBlock.label}`}
                className="min-h-[610px] resize-y rounded-none border-0 bg-neutral-950 p-5 font-mono text-[13px] leading-6 text-neutral-100 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            ) : (
              <div className="flex min-h-[610px] items-center justify-center p-8 text-center text-sm text-neutral-500">
                Choose “Add block” to add the first section.
              </div>
            )}
          </section>

          {previewPanel}
        </div>
      )}

      {mode === 'source' && (
        <div className="grid gap-5 xl:grid-cols-[minmax(520px,1fr)_minmax(460px,0.95fr)]">
          <section className="self-start overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 xl:sticky xl:top-20">
            <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3 text-xs text-neutral-400">
              <span>content/entries/{document.entry.section}/{document.entry.slug}/index.mdoc</span>
              <span>⌘/Ctrl + S saves a draft</span>
            </div>
            <Textarea
              value={source}
              onChange={(event) => updateSource(event.target.value)}
              spellCheck={false}
              aria-label={`Complete Markdoc source for ${document.entry.title}`}
              className="min-h-[720px] resize-y rounded-none border-0 bg-neutral-950 p-5 font-mono text-[13px] leading-6 text-neutral-100 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </section>
          {previewPanel}
        </div>
      )}

      {mode === 'preview' && <div className="mx-auto max-w-[1100px]">{previewPanel}</div>}

      <div className="flex flex-col justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900/60 sm:flex-row sm:items-center">
        <div>
          <p className="font-semibold">Document metadata</p>
          <p className="mt-1 text-neutral-500">
            {document.entry.section} · {document.entry.level} · {document.entry.duration} · {document.entry.status}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Navigation, SEO, quizzes, code examples, and structured data are managed separately.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link
              href={
                `/admin/content/editor/${document.entry.section}/${document.entry.slug}/manage` as any
              }
            >
              Manage metadata and assets
            </Link>
          </Button>
          {(draftVersion || hasUndraftedChanges) && (
            <Button variant="outline" onClick={() => void discardDraft()}>
              <Trash2 className="mr-2 h-4 w-4" />
              Discard draft
            </Button>
          )}
        </div>
      </div>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish “{document.entry.title}”?</DialogTitle>
            <DialogDescription>
              The current draft passed Markdoc validation. Publishing updates the live repository source and records a recoverable revision.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="publish-message" className="text-sm font-medium">Publication note</label>
            <Input
              id="publish-message"
              value={publishMessage}
              maxLength={160}
              onChange={(event) => setPublishMessage(event.target.value)}
              placeholder={`Update ${document.entry.title}`}
            />
            <p className="text-xs text-neutral-500">Used as the Git commit or local revision message.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)} disabled={publishing}>Cancel</Button>
            <Button onClick={() => void publishDraft()} disabled={publishing || !canPublish}>
              {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Publish now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Published revisions</DialogTitle>
            <DialogDescription>
              Restoring a revision creates a new draft. It never changes the published lesson immediately.
            </DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex min-h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : revisions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
              No prior CMS revisions are available yet.
            </div>
          ) : (
            <div className="space-y-2">
              {revisions.map((revision) => (
                <div key={revision.id} className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{revision.message}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {new Date(revision.createdAt).toLocaleString()} · {revision.actor}
                    </p>
                    <p className="mt-1 truncate font-mono text-[11px] text-neutral-400">{revision.version}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {revision.url && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={revision.url} target="_blank" rel="noreferrer">Commit</a>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={restoringRevision === revision.id}
                      onClick={() => void restoreRevision(revision)}
                    >
                      {restoringRevision === revision.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                      Restore to draft
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
