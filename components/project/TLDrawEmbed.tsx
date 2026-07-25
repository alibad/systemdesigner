'use client';

import { useEffect, useState, useCallback } from 'react';
import { Tldraw, useEditor } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { getDiagram, updateDiagram } from '@/lib/firebase';

interface TLDrawEmbedProps {
  whiteboardId: string;
  pageId: string;
  isEditable: boolean;
  height?: string;
}

// Debounce helper
let saveTimeout: NodeJS.Timeout | null = null;
function debouncedSave(whiteboardId: string, canvas: any) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      await updateDiagram(whiteboardId, { canvas });
      console.log('Whiteboard saved:', whiteboardId);
    } catch (error) {
      console.error('Failed to save whiteboard:', error);
    }
  }, 2000);
}

// Component to handle auto-save inside Tldraw
function AutoSaveHandler({ whiteboardId, pageId, isEditable }: { whiteboardId: string; pageId: string; isEditable: boolean }) {
  const editor = useEditor();

  useEffect(() => {
    if (!editor || !isEditable) return;

    // Set current page
    try {
      const page = editor.getPage(pageId as any);
      if (page) {
        editor.setCurrentPage(page);
      }
    } catch (error) {
      console.warn('Could not set page:', pageId, error);
    }

    // Listen for changes and auto-save
    const handleChange = () => {
      const snapshot = editor.store.getSnapshot();
      debouncedSave(whiteboardId, snapshot);
    };

    const unsubscribe = editor.store.listen(handleChange, { scope: 'document' });

    return () => {
      unsubscribe();
    };
  }, [editor, whiteboardId, pageId, isEditable]);

  return null;
}

export function TLDrawEmbed({
  whiteboardId,
  pageId,
  isEditable,
  height = '400px'
}: TLDrawEmbedProps) {
  const [snapshot, setSnapshot] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadWhiteboard() {
      try {
        setIsLoading(true);
        setError(null);

        // Guard: Check if whiteboardId is defined
        if (!whiteboardId) {
          setError('No whiteboard ID provided');
          setIsLoading(false);
          return;
        }

        // Load whiteboard from Firestore
        const diagram = await getDiagram(whiteboardId);

        // Set snapshot data directly (canvas contains the store records)
        if (diagram?.canvas) {
          setSnapshot({
            store: diagram.canvas,
            schema: { schemaVersion: 2, sequences: {} }
          });
        } else {
          setSnapshot({
            store: {},
            schema: { schemaVersion: 2, sequences: {} }
          });
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load whiteboard:', err);
        setError('Failed to load whiteboard');
        setIsLoading(false);
      }
    }

    loadWhiteboard();
  }, [whiteboardId]);

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900"
        style={{ height }}
      >
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
          <p className="text-gray-600 dark:text-gray-400 text-sm">Loading whiteboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex items-center justify-center border border-red-200 dark:border-red-900 rounded-lg bg-red-50 dark:bg-red-900/10"
        style={{ height }}
      >
        <div className="text-center text-red-600 dark:text-red-400">
          <p className="font-medium mb-2">Error loading whiteboard</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div
        className="flex items-center justify-center border border-gray-200 dark:border-gray-700 rounded-lg"
        style={{ height }}
      >
        <p className="text-gray-600 dark:text-gray-400 text-sm">No whiteboard data</p>
      </div>
    );
  }

  return (
    <div
      className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
      style={{ height }}
    >
      <Tldraw
        snapshot={snapshot}
        autoFocus={false}
        hideUi={!isEditable}
        inferDarkMode={true}
        components={{
          PageMenu: null,  // Hide page menu (use our custom selector)
          MainMenu: isEditable ? undefined : null,
          Minimap: height === '800px' ? undefined : null, // Show minimap only in expanded view
        }}
      >
        <AutoSaveHandler whiteboardId={whiteboardId} pageId={pageId} isEditable={isEditable} />
      </Tldraw>
    </div>
  );
}
