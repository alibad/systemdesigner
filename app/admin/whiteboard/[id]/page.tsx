'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Tldraw } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { Loader2, Lock, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface WhiteboardData {
  id: string;
  title: string;
  records: any[];
  currentPageId?: string;
  pages?: Array<{ id: string; name?: string }>;
  ownerId: string;
  ownerEmail?: string;
  ownerName?: string;
}

function loadRecordsIntoEditor(editor: any, records: any[]) {
  if (!Array.isArray(records) || records.length === 0) {
    console.log('[Admin View] No records to load');
    return;
  }

  // Clean records - remove props from document and page records
  const cleanedRecords = records.map((r: any) => {
    if (r?.typeName === 'document' || r?.typeName === 'page') {
      const { props, ...rest } = r;
      return rest;
    }
    return r;
  }).filter(Boolean);

  console.log('[Admin View] Loading', cleanedRecords.length, 'records into editor');

  // Put records into store
  editor.store.put(cleanedRecords);

  // Find and set the current page
  const pageRecords = cleanedRecords.filter((r: any) => r?.typeName === 'page');
  if (pageRecords.length > 0) {
    const currentPage = pageRecords[0];
    console.log('[Admin View] Setting current page to:', currentPage.id);
    editor.setCurrentPage(currentPage.id);
  }

  // Center the view with a slight delay to ensure shapes are rendered
  setTimeout(() => {
    try {
      editor.zoomToFit();
    } catch (err) {
      console.log('[Admin View] Could not zoom to fit:', err);
    }
  }, 100);
}

export default function AdminWhiteboardViewPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [whiteboard, setWhiteboard] = useState<WhiteboardData | null>(null);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<any>(null);

  const diagramId = params.id as string;

  useEffect(() => {
    if (whiteboard && editorRef.current && !pageLoading) {
      loadRecordsIntoEditor(editorRef.current, whiteboard.records);
    }
  }, [whiteboard, pageLoading]);

  const loadWhiteboard = useCallback(async (pageId?: string) => {
    try {
      if (pageId) {
        setPageLoading(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const url = `/api/admin/whiteboard/${diagramId}?userId=${user?.uid}${pageId ? `&pageId=${pageId}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load whiteboard');
      }

      const data = await response.json();
      setWhiteboard(data);

      // Set current page ID from response
      if (data.currentPageId) {
        setCurrentPageId(prev => prev ?? data.currentPageId);
      }
    } catch (err) {
      console.error('Error loading whiteboard:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  }, [diagramId, user?.uid]);

  useEffect(() => {
    if (!authLoading) {
      if (!user || !isAdmin) {
        router.push('/admin');
      } else {
        loadWhiteboard();
      }
    }
  }, [user, isAdmin, authLoading, router, diagramId, loadWhiteboard]);

  const handlePageChange = async (newPageId: string) => {
    if (newPageId === currentPageId) return;

    console.log('[Admin View] Switching to page:', newPageId);
    setCurrentPageId(newPageId);
    await loadWhiteboard(newPageId);
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <div className="text-red-600 text-lg">{error}</div>
        <Link
          href="/admin/whiteboards"
          className="text-indigo-600 hover:text-indigo-700"
        >
          Back to Whiteboards
        </Link>
      </div>
    );
  }

  if (!whiteboard) {
    return null;
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Admin Header */}
      <div className="bg-amber-500 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Lock className="w-5 h-5" />
          <div>
            <div className="font-semibold">Admin View - Read Only</div>
            <div className="text-sm opacity-90">
              {whiteboard.title} - {whiteboard.ownerName || whiteboard.ownerEmail || 'Unknown user'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Custom Page Selector - Only show if multiple pages */}
          {whiteboard.pages && whiteboard.pages.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm opacity-90">Page:</span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={pageLoading}
                  className="inline-flex items-center gap-2 bg-white text-amber-600 px-3 py-2 rounded-lg hover:bg-amber-50 transition-colors font-medium text-sm disabled:opacity-50"
                >
                  {whiteboard.pages.find(p => p.id === currentPageId)?.name || 'Select Page'}
                  <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuRadioGroup value={currentPageId || ''} onValueChange={handlePageChange}>
                    {whiteboard.pages.map((page) => (
                      <DropdownMenuRadioItem key={page.id} value={page.id}>
                        {page.name || 'Untitled Page'}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              {pageLoading && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
            </div>
          )}
          <Link
            href="/admin/whiteboards"
            className="bg-white text-amber-600 px-4 py-2 rounded-lg hover:bg-amber-50 transition-colors font-medium"
          >
            Back to Admin
          </Link>
        </div>
      </div>

      {/* Whiteboard Editor (Read-only) */}
      <div className="flex-1">
        <style jsx global>{`
          /* Hide Tldraw's built-in page menu since we have custom selector */
          .tlui-page-menu,
          .tlui-page-menu__wrapper,
          .tlui-page-menu__trigger,
          [data-testid="page-menu.button"],
          button[data-testid*="page"] {
            display: none !important;
          }

          /* Also hide the page menu container in toolbar */
          .tlui-toolbar__left > .tlui-page-menu,
          .tlui-toolbar > .tlui-page-menu {
            display: none !important;
          }
        `}</style>
        <Tldraw
          key={currentPageId || 'default'}
          onMount={(editor) => {
            editorRef.current = editor;
            if (whiteboard.records && whiteboard.records.length > 0) {
              loadRecordsIntoEditor(editor, whiteboard.records);
            }
          }}
          autoFocus={false}
          inferDarkMode
        />
      </div>
    </div>
  );
}
