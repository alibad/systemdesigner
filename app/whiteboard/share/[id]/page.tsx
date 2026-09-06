"use client";

import React, { useEffect, useRef, useState, use } from 'react';
import { Tldraw } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { useSearchParams } from 'next/navigation';

interface WhiteboardData {
  id: string;
  title: string;
  records: any[];
  visibility: string;
  pageId?: string;
  pageIndex?: number;
  pageName?: string;
}

// Fast API-based data fetching for public shared whiteboards.
async function fetchWhiteboardData(diagramId: string, pageId?: string): Promise<WhiteboardData> {
  console.log('[Share] Fetching whiteboard data via API:', { diagramId, pageId });
  
  const url = `/api/whiteboard/share/${diagramId}${pageId ? `?page=${pageId}` : ''}`;
  console.log('[Share] API URL:', url);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  console.log('[Share] API response status:', response.status);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }
  
  const result = await response.json();
  console.log('[Share] API response data:', result);
  
  return result.data;
}

// Track views through the public share API.
async function trackView(diagramId: string, pageId?: string): Promise<void> {
  try {
    console.log('[📊 VIEW TRACKING] Starting view track:', { diagramId, pageId });

    const url = `/api/whiteboard/share/${diagramId}/view`;
    const payload = { pageId };
    console.log('[📊 VIEW TRACKING] API URL:', url);
    console.log('[📊 VIEW TRACKING] Payload:', payload);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('[📊 VIEW TRACKING] Response status:', response.status);
    const result = await response.json();
    console.log('[📊 VIEW TRACKING] Response data:', result);

    if (result.success) {
      console.log('[📊 VIEW TRACKING] ✅ View tracked successfully!');
    } else {
      console.error('[📊 VIEW TRACKING] ❌ View tracking failed:', result);
    }
  } catch (error) {
    console.error('[📊 VIEW TRACKING] ❌ View tracking error:', error);
  }
}

function loadRecordsIntoEditor(editor: any, records: any[]) {
  console.log('[Share] Loading records into editor:', records.length);
  
  if (!Array.isArray(records) || records.length === 0) {
    console.log('[Share] No records to load');
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

  console.log('[Share] Cleaned records:', cleanedRecords.length);
  
  // Log image and video assets
  const imageAssets = cleanedRecords.filter((r: any) => r?.typeName === 'asset' && (r?.type === 'image' || r?.props?.mimeType?.startsWith('image/')));
  const videoAssets = cleanedRecords.filter((r: any) => r?.typeName === 'asset' && (r?.type === 'video' || r?.props?.mimeType?.startsWith('video/')));
  
  if (imageAssets.length > 0 || videoAssets.length > 0) {
    console.log('[Share] 🖼️ Found media assets:', {
      images: imageAssets.length,
      videos: videoAssets.length,
      imageDetails: imageAssets.map((a: any) => ({
        id: a.id,
        type: a.type,
        mimeType: a.props?.mimeType,
        src: a.props?.src?.substring(0, 50) + '...',
      })),
      videoDetails: videoAssets.map((a: any) => ({
        id: a.id,
        type: a.type,
        mimeType: a.props?.mimeType,
        src: a.props?.src?.substring(0, 50) + '...',
      })),
    });
  } else {
    console.log('[Share] No image or video assets found');
  }

  // Put records into store
  editor.store.put(cleanedRecords);
  
  // Find and set the current page
  const pageRecords = cleanedRecords.filter((r: any) => r?.typeName === 'page');
  console.log('[Share] Found pages:', pageRecords.length);
  
  if (pageRecords.length > 0) {
    const currentPage = pageRecords[0];
    console.log('[Share] Setting current page to:', currentPage.id);
    editor.setCurrentPage(currentPage.id);
  }

  // Center the view
  editor.zoomToFit();
  console.log('[Share] Records loaded and view centered');
}

export default function SharedWhiteboardPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const searchParams = useSearchParams();
  const pageParam = searchParams.get('page');
  const requestedPageId = pageParam || undefined; // Use pageId directly, not parseInt!

  const [data, setData] = useState<{ board: WhiteboardData } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const editorRef = useRef<any>(null);

  const { id } = params;

  useEffect(() => {
    let mounted = true;
    console.log('[Share] Starting data fetch with id:', id, 'pageId:', requestedPageId);
    
    // NO MORE DELAYS! Fetch immediately
    fetchWhiteboardData(id, requestedPageId)
      .then(async (whiteboardData) => {
        if (!mounted) return;
        
        console.log('[Share] Data loaded:', whiteboardData);
        
        if (whiteboardData.visibility !== 'public') {
          console.log('[Share] Whiteboard is not public, visibility:', whiteboardData.visibility);
          setError('not-public');
          setData(null);
        } else {
          console.log('[Share] Whiteboard is public, setting data');
          setData({ board: whiteboardData });
          
          // Track view (non-blocking)
          trackView(id, whiteboardData.pageId);
        }
        setLoading(false);
      })
      .catch((e) => {
        console.error('Failed to load shared whiteboard:', e);
        if (!mounted) return;
        setError(e.message || 'Failed to load');
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id, requestedPageId]);

  const records = data?.board?.records || [];

  if (loading) {
    return (
      <div className="h-screen wb-share bg-white dark:bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-neutral-600 dark:text-neutral-400">Loading shared whiteboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen wb-share bg-white dark:bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
            {error === 'not-public' ? 'Private Whiteboard' : 'Error Loading Whiteboard'}
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400">
            {error === 'not-public' 
              ? 'This whiteboard is private and cannot be shared.'
              : `Failed to load: ${error}`
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen wb-share bg-white dark:bg-neutral-950">
      {/* Minimal header for shared view */}
      <div className="absolute top-4 left-4 z-50 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm border border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
          </svg>
          <span>Shared View</span>
          
          {/* Theme toggle */}
          <button
            onClick={() => {
              const root = document.documentElement;
              const isDark = root.classList.contains('dark');
              if (isDark) {
                root.classList.remove('dark');
                root.style.backgroundColor = '#fafafa';
                root.style.colorScheme = 'light';
              } else {
                root.classList.add('dark');
                root.style.backgroundColor = '#0a0a0a';
                root.style.colorScheme = 'dark';
              }
            }}
            className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>
        </div>
      </div>

      {/* TLDraw Canvas */}
      <Tldraw
        persistenceKey={`shared-${id}-${requestedPageId || 'main'}`}
        components={{
          ActionsMenu: null,
          HelpMenu: null,
          MainMenu: null,
          // Enable Minimap for navigation
          StylePanel: null,
          PageMenu: null,
          NavigationPanel: null,
          HelperButtons: null,
          DebugPanel: null,
          DebugMenu: null,
          SharePanel: null,
          MenuPanel: null,
          TopPanel: null,
          KeyboardShortcutsDialog: null,
          // Keep ZoomMenu and Minimap for navigation
        }}
        onMount={(editor) => {
          console.log('[Share] TLDraw mounted, records available:', records.length);
          editor.updateInstanceState({ isReadonly: true });
          editor.selectNone();
          editorRef.current = editor;
          
          // Load records immediately if they're available
          if (Array.isArray(records) && records.length > 0) {
            console.log('[Share] Loading records in onMount...');
            loadRecordsIntoEditor(editor, records);
          }
          
          // Enable keyboard zoom shortcuts for shared view
          const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
              if (e.key === '=' || e.key === '+') {
                e.preventDefault();
                editor.zoomIn();
              } else if (e.key === '-') {
                e.preventDefault();
                editor.zoomOut();
              } else if (e.key === '0') {
                e.preventDefault();
                editor.resetZoom();
              }
            }
          };
          
          document.addEventListener('keydown', handleKeyDown);
          
          // Cleanup on unmount
          return () => {
            document.removeEventListener('keydown', handleKeyDown);
          };
        }}
      />
      <style jsx global>{`
        /* Hide edit-related items in the right-click menu on shared view */
        .wb-share .tlui-context-menu [aria-label="Edit"],
        .wb-share .tlui-context-menu [data-testid="context.edit"],
        .wb-share .tlui-context-menu [aria-label="Reorder"],
        .wb-share .tlui-context-menu [data-testid="context.reorder"],
        .wb-share .tlui-context-menu [aria-label="Move to page"],
        .wb-share .tlui-context-menu [data-testid="context.move-to-page"],
        .wb-share .tlui-context-menu [aria-label="Delete"],
        .wb-share .tlui-context-menu [data-testid="context.delete"],
        .wb-share .tlui-context-menu [aria-label="Duplicate"],
        .wb-share .tlui-context-menu [data-testid="context.duplicate"],
        .wb-share .tlui-context-menu [aria-label="Group"],
        .wb-share .tlui-context-menu [data-testid="context.group"],
        .wb-share .tlui-context-menu [aria-label="Ungroup"],
        .wb-share .tlui-context-menu [data-testid="context.ungroup"] {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
