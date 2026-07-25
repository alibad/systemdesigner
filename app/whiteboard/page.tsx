'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Tldraw, useEditor, createShapeId, exportToBlob, createTLStore, type TLStoreWithStatus, DefaultMainMenu, DefaultMainMenuContent, TldrawUiMenuItem, type TLComponents } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import html2canvas from 'html2canvas';
import SimulatorPanel from '@/components/simulator/SimulatorPanel';
import UserMenu from '@/components/ui/UserMenu';
import { useToast } from '@/components/ui/toast';
import { auth, createDiagram, updateDiagram, getDiagram as getDiagramDb, db, uploadDiagramAsset, setDiagramPage, getDiagramPage, signInWithGoogle, getUserWhiteboards, updateWhiteboardMetadata } from '@/lib/firebase';
import { useWhiteboards } from '@/contexts/WhiteboardContext';
import { doc as fsDoc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useSearchParams } from 'next/navigation';

const componentTypes = [
  { type: 'user', icon: '👤', label: 'User/Client', color: 'bg-blue-100 border-blue-300 text-blue-800' },
  { type: 'server', icon: '🖥️', label: 'Server', color: 'bg-green-100 border-green-300 text-green-800' },
  { type: 'database', icon: '🗄️', label: 'Database', color: 'bg-purple-100 border-purple-300 text-purple-800' },
  { type: 'cache', icon: '⚡', label: 'Cache', color: 'bg-orange-100 border-orange-300 text-orange-800' },
  { type: 'queue', icon: '📮', label: 'Message Queue', color: 'bg-yellow-100 border-yellow-300 text-yellow-800' },
  { type: 'cdn', icon: '🌐', label: 'CDN', color: 'bg-indigo-100 border-indigo-300 text-indigo-800' },
  { type: 'balancer', icon: '⚖️', label: 'Load Balancer', color: 'bg-red-100 border-red-300 text-red-800' },
  { type: 'api', icon: '🔌', label: 'API Gateway', color: 'bg-teal-100 border-teal-300 text-teal-800' },
  { type: 'monitor', icon: '📊', label: 'Monitoring', color: 'bg-pink-100 border-pink-300 text-pink-800' },
] as const;

type BuiltInTemplate = {
  name: string;
  description: string;
  components: string[]; // array of componentTypes.type
};

type UserTemplate = {
  name: string;
  components: { type: string; dx: number; dy: number }[]; // relative to top-left of selection
};

type AnyTemplate = BuiltInTemplate | UserTemplate;

const architectureTemplates: BuiltInTemplate[] = [
  {
    name: 'Basic Web App',
    description: 'User → Load Balancer → Servers → Database',
    components: ['user', 'balancer', 'server', 'database']
  },
  {
    name: 'Microservices',
    description: 'API Gateway → Multiple Services → Databases',
    components: ['user', 'api', 'server', 'queue', 'database', 'cache']
  },
  {
    name: 'CDN Architecture',
    description: 'Global content delivery with edge caching',
    components: ['user', 'cdn', 'balancer', 'server', 'cache', 'database']
  },
  {
    name: 'Event-Driven',
    description: 'Services communicating via message queues',
    components: ['user', 'api', 'queue', 'server', 'database', 'monitor']
  }
];

// Component that runs inside Tldraw to handle drops
function DropHandler({ pendingComponent, isTemplate, onFirstAction }: { 
  pendingComponent: { component: typeof componentTypes[number], x: number, y: number, id: string } | null;
  isTemplate?: boolean;
  onFirstAction?: () => Promise<void>;
}) {
  const editor = useEditor();
  const [processedIds, setProcessedIds] = React.useState<Set<string>>(new Set());


  const addComponentToCanvas = useCallback((component: typeof componentTypes[number], x: number, y: number, id: string) => {
    if (!editor) {
      console.log('No editor available');
      return;
    }

    // Check if we already processed this ID
    if (processedIds.has(id)) {
      console.log('Already processed this component, skipping');
      return;
    }

    // Trigger diagram creation on first user action
    if (onFirstAction) {
      onFirstAction().catch(err => console.error('Failed to create diagram on first action:', err));
    }

    let finalX: number; // will be set relative to viewport center
    let finalY: number; // will be set relative to viewport center

    // Always use viewport center now
    const viewport = editor.getViewportPageBounds();
    const centerX = viewport.x + viewport.w / 2;
    const centerY = viewport.y + viewport.h / 2;
    
    if (isTemplate) {
      // For templates: offset from center based on original relative position
      finalX = centerX + (x - 400); // 400 was our original center X
      finalY = centerY + (y - 300); // 300 was our original center Y
    } else {
      // For individual components: use viewport center + small offset
      finalX = centerX + x; // x and y are already small offsets
      finalY = centerY + y;
    }
    
    const shapeId = createShapeId();

    try {
      editor.createShapes([{ id: shapeId, type: 'geo', x: finalX - 75, y: finalY - 40, props: { geo: 'rectangle', w: 150, h: 80, text: `${component.icon} ${component.label}` } }]);
      setProcessedIds(prev => new Set([...prev, id]));
    } catch (error) {
      // Fall back to a text label if geo creation fails
      editor.createShapes([{ id: shapeId, type: 'text', x: finalX - 75, y: finalY - 40, props: { text: `${component.icon} ${component.label}` } }]);
      setProcessedIds(prev => new Set([...prev, id]));
    }
  }, [editor, isTemplate, onFirstAction, processedIds]);

  // Effect to add component when pendingComponent changes
  React.useEffect(() => {
    if (pendingComponent) {
      addComponentToCanvas(pendingComponent.component, pendingComponent.x, pendingComponent.y, pendingComponent.id);
    }
  }, [pendingComponent, addComponentToCanvas]);

  return null; // This component doesn't render anything
}

// Helper inside Tldraw to export current selection when requested
function SelectionExporter({ requestId, onExport }: { requestId: string | null; onExport: (requestId: string, shapes: any[]) => void }) {
  const editor = useEditor();
  useEffect(() => {
    if (!requestId) return;
    try {
      const shapes = editor.getSelectedShapes();
      onExport(requestId, shapes as any[]);
    } catch (e) {
      onExport(requestId, []);
    }
  }, [requestId, editor, onExport]);
  return null;
}

function DocExporter({ request, onJson }: { request: string | null; onJson: (json: any) => void }) {
  const editor = useEditor();
  const handledRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!request) return;
    // Guard against React StrictMode double-invoke in dev (effects run twice)
    if (handledRef.current === request) return;
    handledRef.current = request;
    try {
      const raw: any = editor.store.serialize();
      const records = raw?.records ?? raw;
      const pageId = (editor as any).getCurrentPageId ? (editor as any).getCurrentPageId() : undefined;
      onJson({ records, pageId });
    } catch (err) { console.warn('[Whiteboard] DocExporter serialize failed', err); onJson({ records: [] }); }
  }, [request, editor, onJson]);
  return null;
}

// Inject a button into the tldraw bottom toolbar using a portal
function ToolbarComponentsButton({ onClick }: { onClick: () => void }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const find = () => {
      const el = document.querySelector('.tlui-toolbar') as HTMLElement | null;
      if (el) setTarget(el);
    };
    const id = setTimeout(find, 100); // wait for toolbar to mount
    const mo = new MutationObserver(find);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { clearTimeout(id); mo.disconnect(); };
  }, []);

  if (!target) return null;
  return createPortal(
    <button
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      title="Components"
      aria-label="Open components and templates"
      className="ml-1 rounded-md w-8 h-8 grid place-items-center border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
      style={{ marginLeft: 8, pointerEvents: 'auto', zIndex: 5 }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    </button>,
    target
  );
}

// Custom MainMenu with Import JSON functionality
function CustomMainMenu() {
  const editor = useEditor();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  const handleImportJSON = useCallback(() => {
    console.log('🖱️ [IMPORT] Import menu item clicked');
    console.log('🖱️ [IMPORT] File input ref exists?', !!fileInputRef.current);
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('📁 [IMPORT] handleFileChange triggered');
    const file = e.target.files?.[0];
    if (!file) {
      console.log('⚠️ [IMPORT] No file selected');
      return;
    }

    console.log('📂 [IMPORT] Starting import from file:', file.name);

    let text = '';
    try {
      text = await file.text();
      console.log('📄 [IMPORT] File read successfully, size:', text.length, 'bytes');
      console.log('📄 [IMPORT] First 200 chars:', text.substring(0, 200));

      const json = JSON.parse(text);
      console.log('✅ [IMPORT] JSON parsed successfully');
      console.log('🔍 [IMPORT] JSON structure:', {
        hasStore: !!json.store,
        hasStoreRecords: !!json.store?.records,
        hasRecords: !!json.records,
        hasShapes: !!json.shapes,
        topLevelKeys: Object.keys(json)
      });

      // Support multiple TLDraw export formats
      let recordsToImport: any[] = [];

      if (json.shapes && Array.isArray(json.shapes)) {
        // NEW TLDraw export format: { schema, shapes: [...], rootShapeIds, bindings, assets }
        recordsToImport = [...json.shapes];

        // Add assets if present
        if (json.assets && Array.isArray(json.assets)) {
          recordsToImport.push(...json.assets);
        }

        console.log('✅ [IMPORT] Detected new TLDraw export format (shapes array), found', json.shapes.length, 'shapes,', json.assets?.length || 0, 'assets');
      } else if (json.store?.records) {
        // OLD TLDraw export format: { schema, store: { records: {...} } }
        recordsToImport = Object.values(json.store.records);
        console.log('✅ [IMPORT] Detected old TLDraw export format, found', recordsToImport.length, 'records');
      } else if (json.records) {
        // Simple format: { records: [...] } or { records: {...} }
        recordsToImport = Array.isArray(json.records)
          ? json.records
          : Object.values(json.records);
        console.log('✅ [IMPORT] Detected simple format, found', recordsToImport.length, 'records');
      } else {
        console.error('❌ [IMPORT] Invalid format - no shapes or records found');
        console.error('❌ [IMPORT] Available keys:', Object.keys(json));
        console.error('❌ [IMPORT] JSON sample:', JSON.stringify(json).substring(0, 500));
        addToast({
          title: 'Invalid Format',
          description: 'Expected TLDraw export format. Try exporting again from the menu.',
          variant: 'destructive',
          duration: 5000
        });
        return;
      }

      if (recordsToImport.length === 0) {
        addToast({
          title: 'Empty Import',
          description: 'No records found in the file',
          variant: 'destructive',
          duration: 4000
        });
        return;
      }

      // Update parentId for all shapes to current page AND generate new IDs to avoid conflicts
      const currentPageId = editor.getCurrentPageId();
      console.log('📄 [IMPORT] Current page ID:', currentPageId);

      // Map old IDs to new IDs for shapes
      const idMap = new Map<string, string>();

      const updatedRecords = recordsToImport.map((record: any) => {
        if (record.typeName === 'shape') {
          // Generate new unique ID for the shape to avoid overwriting existing shapes
          const newId = createShapeId();
          idMap.set(record.id, newId);

          console.log('🔄 [IMPORT] Creating new shape with ID', newId, '(original:', record.id, ')');

          return {
            ...record,
            id: newId,
            parentId: record.parentId?.startsWith('page:') ? currentPageId : record.parentId
          };
        }
        // For assets, keep the same ID (they're shared across pages)
        return record;
      });

      // Use store.put() for consistency with Firebase loading
      editor.store.put(updatedRecords);

      const shapesCount = updatedRecords.filter((r: any) => r?.typeName === 'shape').length;
      console.log('✅ [IMPORT] Successfully imported', updatedRecords.length, 'records (', shapesCount, 'shapes)');

      // Force a history entry to trigger auto-save and enable undo
      editor.mark('import-shapes');
      console.log('💾 [IMPORT] Marked history for auto-save trigger');

      addToast({
        title: 'Import Successful',
        description: `Imported ${shapesCount} shape${shapesCount !== 1 ? 's' : ''} from ${file.name}`,
        variant: 'success',
        duration: 4000
      });
    } catch (err) {
      console.error('❌ [IMPORT] Failed to import JSON:', err);
      console.error('❌ [IMPORT] Error details:', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        fileContent: text ? text.substring(0, 500) : 'No content' // Log first 500 chars for debugging
      });

      // Determine user-friendly error message
      let userMessage = 'Could not read the file. Please try again.';
      if (err instanceof SyntaxError) {
        userMessage = 'Invalid JSON file. Make sure it\'s a valid TLDraw export.';
      } else if (err instanceof Error && err.message.includes('put')) {
        userMessage = 'Some shapes couldn\'t be imported. Check the console for details.';
      }

      addToast({
        title: 'Import Failed',
        description: userMessage,
        variant: 'destructive',
        duration: 5000
      });
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [editor, addToast]);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <DefaultMainMenu>
        <DefaultMainMenuContent />
        <TldrawUiMenuItem
          id="import-json"
          label="Import JSON"
          icon="file"
          readonlyOk
          onSelect={handleImportJSON}
        />
      </DefaultMainMenu>
    </>
  );
}

export default function WhiteboardPage() {
  const searchParams = useSearchParams();
  const requestedId = searchParams.get('id');
  const { reload: reloadWhiteboards } = useWhiteboards();
  
  const [showPalette, setShowPalette] = useState(false);
  const [activeTab, setActiveTab] = useState<'components' | 'templates'>('components');
  const [pendingComponent, setPendingComponent] = useState<{ component: typeof componentTypes[number], x: number, y: number, id: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);

  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([]);
  const [exportRequestId, setExportRequestId] = useState<string | null>(null);
  const [pendingSaveName, setPendingSaveName] = useState<string>('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);
  const [shareReq, setShareReq] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState<boolean>(false);
  const [boardViews, setBoardViews] = useState<number>(0);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedEmbed, setCopiedEmbed] = useState<boolean>(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [title, setTitle] = useState<string>('Untitled');
  const [lastSavedTitle, setLastSavedTitle] = useState<string | null>(null);
  const [titleSaving, setTitleSaving] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [shareBusy, setShareBusy] = useState<boolean>(false);
  const [exportBusy, setExportBusy] = useState<boolean>(false);
  const editorRef = useRef<any>(null);
  const saveDebounceRef = useRef<any>(null);
  const unsubRef = useRef<null | (() => void)>(null);
  const hasUnsavedChanges = useRef<boolean>(false);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const creatingDiagramRef = useRef<Promise<string> | null>(null);
  const justLoadedFromFirebase = useRef<boolean>(false); // Track if we just loaded to prevent immediate re-save

  // TLDraw store with async loading support
  const [storeWithStatus, setStoreWithStatus] = useState<TLStoreWithStatus>({ status: 'loading' });

  // Authentication and save state (moved here to be available in ensureDiagramId)
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentDiagramId, setCurrentDiagramId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Ensure we have a single diagram id (guards against concurrent creates)
  const ensureDiagramId = useCallback(async (): Promise<string> => {
    if (currentDiagramId) return currentDiagramId;
    if (creatingDiagramRef.current) return await creatingDiagramRef.current;
    
    // Auth must be resolved and user must be authenticated
    if (!currentUser || currentUser.isAnonymous) {
      throw new Error('Authentication required to create diagrams');
    }
    
    creatingDiagramRef.current = (async () => {
      const defaultTitle = title && title !== 'Untitled' ? title : 'Whiteboard';
      console.log('[Whiteboard] Creating new diagram with title:', defaultTitle);
      const id = await createDiagram({ title: defaultTitle, canvas: [] } as any);
      console.log('[Whiteboard] Created diagram with ID:', id);
      setCurrentDiagramId(id);
      setTitle(defaultTitle);
      setLastSavedTitle(defaultTitle);
      try { localStorage.setItem('sd-current-diagram-id', id); } catch {}
      return id;
    })();
    try {
      const id = await creatingDiagramRef.current;
      return id;
    } finally {
      creatingDiagramRef.current = null;
    }
  }, [title, currentUser, currentDiagramId]);

  // Create diagram on first user action
  const handleFirstAction = useCallback(async () => {
    if (!currentDiagramId && currentUser && !currentUser.isAnonymous) {
      try {
        console.log('[Whiteboard] Creating first diagram on user action');
        await ensureDiagramId();
      } catch (err) {
        console.error('[Whiteboard] Failed to create first diagram:', err);
      }
    }
  }, [currentDiagramId, currentUser, ensureDiagramId]);

  // Convert asset IDs to Firebase URLs for cross-machine compatibility
  const externalizeImageAssets = useCallback(async (records: any, diagramId: string): Promise<{ records: any[]; assetUrls: Record<string,string> }> => {
    const next = Array.isArray(records) ? records : Object.values(records || {});

    // Filter to allowed record types
    const allowedTypes = new Set(['document','page','shape','asset','binding']);
    let safe = next.filter((r: any) => r && typeof r.typeName === 'string' && allowedTypes.has(r.typeName));

    // For assets with asset: IDs, try to get their Firebase URLs
    // This ensures cross-machine compatibility
    safe = safe.map((record: any) => {
      if (record.typeName === 'asset' && record.props?.src) {
        const src = record.props.src;
        // If it's still an asset: ID, check if there's a Firebase URL available
        if (typeof src === 'string' && src.startsWith('asset:')) {
          // Asset hasn't been uploaded yet or upload failed
          // We'll keep the asset: ID for now, but it won't work cross-machine
          console.warn('[externalizeAssets] Asset not uploaded yet:', record.id);
        }
      }
      return record;
    });

    return { records: safe, assetUrls: {} };
  }, []);

  // Reusable save function
  const saveNow = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || !currentDiagramId) return;
    
    try {
      console.log('[Whiteboard] Manual save triggered');
      const raw: any = editor.store.serialize();
      // Ensure allRecords is always an array
      let allRecords = raw?.records ? raw.records : raw;
      if (!Array.isArray(allRecords)) {
        allRecords = Object.values(allRecords || {});
      }
      
      let pageId: string | null = null;
      try { pageId = (editor as any).getCurrentPageId?.() || null; } catch {}
      
      if (!pageId) return;
      
      const { records: externalized } = await externalizeImageAssets(allRecords, currentDiagramId);
      const pageRec = (externalized || []).find((r: any) => r?.typeName === 'page' && r?.id === pageId);
      const docRec = (externalized || []).find((r: any) => r?.typeName === 'document');
      const shapes = (externalized || []).filter((r: any) => r?.typeName === 'shape' && r?.parentId === pageId);
      const assets = (externalized || []).filter((r: any) => r?.typeName === 'asset');
      const pageRecords = [docRec, pageRec, ...shapes, ...assets].filter(Boolean);
      const pageName = (pageRec && pageRec.name) || '';
      
      const existingPage = await getDiagramPage(currentDiagramId, pageId).catch(() => null);
      const visibility = existingPage?.visibility || 'private';
      await setDiagramPage(currentDiagramId, pageId, { records: pageRecords, visibility, pageName });
      
      const allPages: any[] = allRecords.filter((r: any) => r?.typeName === 'page');
      const pagesIndex = allPages.slice().sort((a: any, b: any) => String(a.index || '').localeCompare(String(b.index || ''))).map((p: any, i: number) => ({ id: p.id, name: p.name, index: i }));
      await updateDiagram(currentDiagramId, { pages: pagesIndex } as any);
      
      setLastSavedAt(new Date());
      hasUnsavedChanges.current = false;
      console.log('[Whiteboard] Manual save completed');
    } catch (err) {
      console.error('[Whiteboard] Manual save failed:', err);
    }
  }, [currentDiagramId, externalizeImageAssets]);

  // Save before leaving page
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges.current && currentDiagramId) {
        console.log('[Whiteboard] Page unloading with unsaved changes, saving now...');
        // Trigger save synchronously (note: async won't work reliably here)
        saveNow();
        // Show browser warning
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentDiagramId, saveNow]);

  // Update share URL when page changes (if share dialog is open)
  useEffect(() => {
    console.log('[Share URL Update] Effect triggered', { shareOpen, currentDiagramId, currentPageId });
    if (!shareOpen || !currentDiagramId || !currentPageId) return;
    
    // Check if current page is shared and update URL
    console.log('[Share URL Update] Fetching page doc for:', currentPageId);
    getDiagramPage(currentDiagramId, currentPageId)
      .then(pageDoc => {
        console.log('[Share URL Update] Page doc:', pageDoc);
        if (pageDoc && pageDoc.visibility === 'public') {
          // Use pageId directly in URL - no more index calculation!
          const url = `/whiteboard/share/${currentDiagramId}?page=${currentPageId}`;
          console.log('[Share URL Update] Setting share URL:', url);
          setShareUrl(url);
        } else {
          console.log('[Share URL Update] Page not public, clearing URL');
          setShareUrl(null);
        }
      })
      .catch((err) => {
        console.error('[Share URL Update] Failed to fetch page:', err);
        setShareUrl(null);
      });
  }, [currentPageId, shareOpen, currentDiagramId]);

  // Don't use custom asset store - it breaks local persistence
  // We'll handle Firebase uploads via editor listener instead
  const customAssetStore = undefined;

  // Custom asset store will be passed to Tldraw directly with persistenceKey

  // Authentication and save state declarations moved above
  const [autoSaveReq, setAutoSaveReq] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const stopAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, []);

  const startAutoSave = useCallback(() => {
    // Auto-save every 30 seconds for logged-in users
    stopAutoSave();
    autoSaveTimerRef.current = setInterval(() => {
      if (currentDiagramId) {
        setAutoSaveReq(`autosave-${Date.now()}`);
      }
    }, 30000);
  }, [currentDiagramId, stopAutoSave]);

  // Let the root layout handle all spacing and positioning like other pages
  useEffect(() => {
    try {
      // Hide fixed global user menu/notifications on this route to avoid overlap with our custom UserMenu
      const fixedUser = document.querySelector('div.fixed.top-3.right-3');
      const prevDisplay = (fixedUser as HTMLElement | null)?.style.display || '';
      if (fixedUser) (fixedUser as HTMLElement).style.display = 'none';
      return () => { if (fixedUser) (fixedUser as HTMLElement).style.display = prevDisplay; };
    } catch (err) {
      console.warn('[Whiteboard] Layout setup failed', err);
    }
  }, [startAutoSave, stopAutoSave]);

  // Track navigation collapse state for title positioning
  useEffect(() => {
    const checkNavState = () => {
      const sideNav = document.getElementById('side-nav');
      if (sideNav) {
        const isCollapsed = sideNav.classList.contains('collapsed') || 
                           document.body.classList.contains('nav-collapsed') ||
                           window.innerWidth < 1024; // Mobile breakpoint
        setIsNavCollapsed(isCollapsed);
      }
    };

    // Check initial state
    checkNavState();

    // Listen for resize events
    window.addEventListener('resize', checkNavState);

    // Listen for nav toggle events (if they exist)
    const observer = new MutationObserver(checkNavState);
    const sideNav = document.getElementById('side-nav');
    if (sideNav) {
      observer.observe(sideNav, { attributes: true, attributeFilter: ['class'] });
    }
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    return () => {
      window.removeEventListener('resize', checkNavState);
      observer.disconnect();
    };
  }, []);

  // Fetch board views (client-side); also refresh on window focus
  const refreshViews = useCallback(async () => {
    try {
      if (!currentDiagramId) return;
      const diagram: any = await getDiagramDb(currentDiagramId);
      if (diagram && typeof diagram.views === 'number') setBoardViews(diagram.views);
    } catch (err) {
      console.warn('[Whiteboard] Failed to refresh views', err);
    }
  }, [currentDiagramId]);

  useEffect(() => { refreshViews(); }, [refreshViews, shareUrl]);

  useEffect(() => {
    const onFocus = () => { refreshViews(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshViews]);

  // Live subscribe to CURRENT PAGE view count (works for both public and private pages)
  useEffect(() => {
    if (!currentDiagramId || !currentPageId) {
      console.log('[👁️ VIEW SUBSCRIPTION] Not subscribing - missing data:', {
        currentDiagramId: !!currentDiagramId,
        currentPageId: !!currentPageId
      });
      return;
    }

    console.log('[👁️ VIEW SUBSCRIPTION] Setting up subscription:', {
      diagramId: currentDiagramId,
      pageId: currentPageId
    });

    try {
      // Listen to the current page's views, not the diagram's views
      const pageRef = fsDoc(db, 'diagrams', currentDiagramId, 'pages', currentPageId);
      console.log('[👁️ VIEW SUBSCRIPTION] Firestore path:', `diagrams/${currentDiagramId}/pages/${currentPageId}`);

      const unsubscribe = onSnapshot(
        pageRef,
        (snap) => {
          console.log('[👁️ VIEW SUBSCRIPTION] Snapshot received:', {
            exists: snap.exists(),
            data: snap.data()
          });

          const data: any = snap.data();
          if (data && typeof data.views === 'number') {
            console.log('[👁️ VIEW SUBSCRIPTION] ✅ Page views updated:', data.views);
            setBoardViews(data.views);
          } else {
            console.log('[👁️ VIEW SUBSCRIPTION] No views field, setting to 0');
            setBoardViews(0);
          }
        },
        (err: any) => {
          if (String(err?.code || '').includes('permission')) {
            console.log('[👁️ VIEW SUBSCRIPTION] Permission denied (expected for private pages)');
          } else {
            console.warn('[👁️ VIEW SUBSCRIPTION] ❌ Error:', err);
          }
        }
      );
      return () => {
        console.log('[👁️ VIEW SUBSCRIPTION] Unsubscribing');
        unsubscribe();
      };
    } catch (err) {
      console.warn('[👁️ VIEW SUBSCRIPTION] ❌ Setup failed:', err);
    }
  }, [currentDiagramId, currentPageId]);

  // Monitor authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false); // Auth is now resolved
      if (user && !user.isAnonymous) {
        // User is logged in, fetch their saved diagrams
        // Start auto-save timer
        startAutoSave();
      } else {
        // Clear auto-save timer for anonymous users
        stopAutoSave();
      }
    });
    return () => unsubscribe();
  }, [startAutoSave, stopAutoSave]);

  // Load requested whiteboard from URL or restore previously used board id
  useEffect(() => {
    (async () => {
      try {
        // If URL has an ID parameter, try to load that whiteboard
        if (requestedId) {
          // First check if this whiteboard exists in user's metadata
          const whiteboards = await getUserWhiteboards();
          const whiteboard = whiteboards.find(wb => wb.id === requestedId);
          
          if (whiteboard) {
            // Load the whiteboard metadata (title)
            setTitle(whiteboard.title);
            setLastSavedTitle(whiteboard.title);
            setCurrentDiagramId(requestedId);
            return;
          } else {
            // Fallback to old diagram loading for backward compatibility
            const d: any = await getDiagramDb(requestedId);
            const uid = auth.currentUser?.uid;
            if (d && uid && d.createdBy === uid) {
              setCurrentDiagramId(requestedId);
              return;
            } else {
              console.warn('[Whiteboard] Requested diagram not found or not owned by user');
            }
          }
        }
        
        // Fallback: restore previously used board id only if we own it
        const savedId = localStorage.getItem('sd-current-diagram-id');
        if (!savedId) return;
        const d: any = await getDiagramDb(savedId);
        const uid = auth.currentUser?.uid;
        if (d && uid && d.createdBy === uid) {
          setCurrentDiagramId(savedId);
        } else {
          localStorage.removeItem('sd-current-diagram-id');
        }
      } catch (err) {
        console.warn('[Whiteboard] Restore diagram id failed', err);
      }
    })();
  }, [currentUser, requestedId]);

  // Persist board id when it changes
  useEffect(() => {
    try {
      if (currentDiagramId) {
        localStorage.setItem('sd-current-diagram-id', currentDiagramId);
      }
    } catch (err) {
      console.warn('[Whiteboard] Persist diagram id failed', err);
    }
  }, [currentDiagramId]);

  // Load diagram details (title) when id changes
  useEffect(() => {
    (async () => {
      try {
        if (!currentDiagramId) return;
        const d: any = await getDiagramDb(currentDiagramId);
        if (d) {
          const t = (d as any).title || 'Untitled';
          setTitle(t);
          setLastSavedTitle(t);
        }
      } catch (err) {
        // noop
      }
    })();
  }, [currentDiagramId]);

  // Track the diagram ID we've loaded to prevent re-loading
  const loadedDiagramId = useRef<string | null>(null);

  // Load store with data from Firebase (proper tldraw pattern)
  useEffect(() => {
    let cancelled = false;

    async function loadStoreFromFirebase() {
      try {
        if (!currentDiagramId) {
          console.log('⏭️ [STORE] No diagram ID yet - showing blank canvas');
          const newStore = createTLStore();
          if (!cancelled) {
            setStoreWithStatus({ status: 'not-synced', store: newStore });
            loadedDiagramId.current = null;
          }
          return;
        }

        // Don't reload if we already have this diagram loaded
        if (loadedDiagramId.current === currentDiagramId) {
          console.log('⏭️ [STORE] Diagram', currentDiagramId, 'already loaded, skipping');
          return;
        }

        console.log('📂 [STORE] Loading data from Firebase for diagram:', currentDiagramId);
        setStoreWithStatus({ status: 'loading' });

        // Create a fresh store for this diagram
        const newStore = createTLStore();

        // Load ALL pages from subcollection
        let toLoad: any = null;

        {
          try {
            // Load diagram to get document record
            const diag: any = await getDiagramDb(currentDiagramId);
            const documentRecord = diag?.documentRecord;

            const { collection, getDocs } = await import('firebase/firestore');
            const pagesRef = collection(db, 'diagrams', currentDiagramId, 'pages');
            const pagesSnap = await getDocs(pagesRef);

            console.log('📄 [HYDRATE] Found', pagesSnap.size, 'page documents in Firebase');

            const allPageRecords: any[] = [];
            let shapesCount = 0;

            pagesSnap.forEach((doc) => {
              const pageData = doc.data();
              if (Array.isArray(pageData?.records)) {
                const pageShapes = pageData.records.filter((r: any) => r?.typeName === 'shape');
                const invalidRecords = pageData.records.filter((r: any) => !r?.id || !r?.typeName);
                console.log('   → Page', doc.id, ':', pageData.records.length, 'records,', pageShapes.length, 'shapes,', invalidRecords.length, 'invalid');
                if (invalidRecords.length > 0) {
                  console.warn('   ⚠️ Invalid records sample:', invalidRecords.slice(0, 2));
                }
                shapesCount += pageShapes.length;

                // Add all records (pages don't have document records anymore)
                allPageRecords.push(...pageData.records);
              }
            });

            // Add the document record from diagram level at the beginning
            if (documentRecord) {
              allPageRecords.unshift(documentRecord);
              console.log('📄 [HYDRATE] Added document record from diagram level');
            } else {
              // Create a default document record if none exists
              console.warn('⚠️ [HYDRATE] No document record found - creating default');
              const defaultDocRecord = {
                id: 'document:document',
                typeName: 'document',
                gridSize: 10,
                name: '',
                meta: {}
              };
              allPageRecords.unshift(defaultDocRecord);
            }

            if (allPageRecords.length > 0) {
              console.log('✅ [HYDRATE] Loaded', pagesSnap.size, 'pages with', allPageRecords.length, 'total records (', shapesCount, 'shapes)');
              toLoad = allPageRecords;
            } else {
              console.log('⚠️ [HYDRATE] No records found in any page documents');
            }
          } catch (err) {
            console.error('❌ [HYDRATE] Failed to load pages from subcollection:', err);
          }
        }

        if (toLoad && ((Array.isArray(toLoad) && toLoad.length > 0) || (!Array.isArray(toLoad) && Object.keys(toLoad).length > 0))) {
          try {
            console.log('🔄 [HYDRATE] Loading snapshot into TLDraw editor...');

            // Build proper snapshot format with schema
            const recordsArray = Array.isArray(toLoad) ? toLoad : Object.values(toLoad);

            // Filter out invalid records (must have id and valid typeName)
            const validTypeNames = ['page', 'document', 'shape', 'asset', 'camera', 'instance', 'pointer', 'instance_page_state'];
            const validRecords = recordsArray.filter((rec: any) => {
              if (!rec?.id || !rec?.typeName) return false;
              if (!validTypeNames.includes(rec.typeName)) {
                console.warn('⚠️ [HYDRATE] Skipping record with unknown typeName:', rec.typeName, 'id:', rec.id);
                return false;
              }
              return true;
            });
            const shapesCount = validRecords.filter((r: any) => r.typeName === 'shape').length;
            console.log('📦 [HYDRATE] Filtered', validRecords.length, 'valid records (', shapesCount, 'shapes) out of', recordsArray.length, 'total');

            if (validRecords.length === 0) {
              console.warn('⚠️ [HYDRATE] No valid records found to load');
              return;
            }

            // Use store.put() instead of loadSnapshot() - it's more forgiving with schema validation
            newStore.put(validRecords);
            const loadedShapes = Array.from(newStore.allRecords()).filter((r: any) => r.typeName === 'shape').length;
            console.log('✅ [STORE] Loaded', validRecords.length, 'records (', loadedShapes, 'shapes) from Firebase');

            // Set flag to prevent immediate auto-save of loaded data
            justLoadedFromFirebase.current = true;
            setTimeout(() => {
              justLoadedFromFirebase.current = false;
            }, 1000); // Clear flag after 1 second

            // Set the store as ready and mark this diagram as loaded
            if (!cancelled) {
              setStoreWithStatus({ status: 'not-synced', store: newStore });
              loadedDiagramId.current = currentDiagramId;
            }
          } catch (e) {
            console.error('❌ [STORE] Failed to load data into store:', e);
            if (!cancelled) {
              setStoreWithStatus({
                status: 'error',
                error: e instanceof Error ? e : new Error('Failed to load whiteboard')
              });
            }
          }
        } else {
          console.log('ℹ️ [STORE] No data to load - starting with blank canvas');
          if (!cancelled) {
            setStoreWithStatus({ status: 'not-synced', store: newStore });
            loadedDiagramId.current = currentDiagramId;
          }
        }
      } catch (err) {
        console.error('[STORE] Backend loading failed', err);
        if (!cancelled) {
          setStoreWithStatus({
            status: 'error',
            error: err instanceof Error ? err : new Error('Failed to load whiteboard')
          });
        }
      }
    }

    loadStoreFromFirebase();

    return () => {
      cancelled = true;
    };
  }, [currentDiagramId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopAutoSave();
  }, [stopAutoSave]);

  // Debounced title update when a board exists
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        if (title === lastSavedTitle) return;
        // Ensure a diagram exists before saving title
        let targetId = currentDiagramId;
        if (!targetId) {
          targetId = await createDiagram({ title, canvas: [] } as any);
          setCurrentDiagramId(targetId);
        }
        if (!targetId) return;
        setTitleSaving(true);
        
        // Update BOTH places: diagram document AND user whiteboard metadata
        await Promise.all([
          updateDiagram(targetId, { title } as any),
          updateWhiteboardMetadata(targetId, title)
        ]);
        
        setLastSavedTitle(title);
        
        // Reload whiteboard context to update navigation
        await reloadWhiteboards();
      } catch (err) {
        console.warn('[Whiteboard] Title update failed', err);
      } finally { setTitleSaving(false); }
    }, 800);
    return () => clearTimeout(t);
  }, [title, currentDiagramId, lastSavedTitle, reloadWhiteboards]);

  // Consume starter components from guide/gym
  useEffect(() => {
    try {
      const raw = localStorage.getItem('architecture-guide-components');
      if (!raw) return;
      localStorage.removeItem('architecture-guide-components');
      const payload = JSON.parse(raw);
      if (Array.isArray(payload.components)) {
        setIsProcessing(true);
        setIsCreatingTemplate(true);
        payload.components.forEach((compType: string, index: number) => {
          const component = componentTypes.find(c => c.type === compType) || componentTypes[1];
          const row = Math.floor(index / 3);
          const col = index % 3;
          const x = 200 + (col * 200);
          const y = 200 + (row * 150);
          setTimeout(() => {
            setPendingComponent({ component, x, y, id: `starter-${compType}-${Date.now()}-${Math.random()}` });
            setTimeout(() => setPendingComponent(null), 50);
          }, index * 100);
        });
        setTimeout(() => { setIsProcessing(false); setIsCreatingTemplate(false); }, (payload.components.length) * 100 + 400);
      }
    } catch (err) {
      console.warn('[Whiteboard] Starter components load failed', err);
    }
  }, []);

  // Load saved templates
  useEffect(() => {
    try {
      const raw = localStorage.getItem('sd-custom-templates');
      if (raw) setUserTemplates(JSON.parse(raw));
    } catch (err) {
      console.warn('[Whiteboard] Load custom templates failed', err);
    }
  }, []);

  const persistUserTemplates = (templates: UserTemplate[]) => {
    setUserTemplates(templates);
    try { localStorage.setItem('sd-custom-templates', JSON.stringify(templates)); } catch (err) {
      console.warn('[Whiteboard] Persist custom templates failed', err);
    }
  };

  const deleteUserTemplate = (index: number) => {
    const next = userTemplates.filter((_, i) => i !== index);
    persistUserTemplates(next);
    setSaveMessage('Template deleted');
  };

  const mapTextToComponentType = (text: string): string => {
    const lower = (text || '').toLowerCase();
    for (const comp of componentTypes) {
      if (lower.includes(comp.label.toLowerCase()) || lower.includes(comp.type)) return comp.type;
    }
    return 'server';
  };

  const saveSelectionAsTemplate = useCallback(() => {
    if (!pendingSaveName.trim()) {
      setSaveMessage('Enter a template name');
      return;
    }
    const id = `req-${Date.now()}-${Math.random()}`;
    setExportRequestId(id);
    // SelectionExporter will call handleExport with shapes
  }, [pendingSaveName]);

  const handleExport = (reqId: string, shapes: any[]) => {
    if (reqId !== exportRequestId) return; // stale
    setExportRequestId(null);
    if (!shapes || shapes.length === 0) {
      setSaveMessage('Select shapes on the canvas first');
      return;
    }
    const rects = shapes.map((s: any) => ({ x: s.x as number, y: s.y as number, text: (s.props && (s.props as any).text) || '' }));
    const minX = Math.min(...rects.map((r) => r.x));
    const minY = Math.min(...rects.map((r) => r.y));
    const components = rects.map((r) => ({ type: mapTextToComponentType(r.text), dx: Math.round(r.x - minX), dy: Math.round(r.y - minY) }));
    const tmpl: UserTemplate = { name: pendingSaveName.trim(), components };
    const next = [...userTemplates, tmpl];
    persistUserTemplates(next);
    setActiveTab('templates');
    setPendingSaveName('');
    setSaveMessage(`Saved "${tmpl.name}" (${tmpl.components.length} components)`);
  };

  const createTemplate = useCallback((template: AnyTemplate) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setIsCreatingTemplate(true);

    const isUser = (t: AnyTemplate): t is UserTemplate => {
      const first = (t as any).components?.[0];
      return first && typeof first !== 'string';
    };

    if (isUser(template) && (template as UserTemplate).components.length > 0) {
      const items = (template as UserTemplate).components;
      items.forEach((item, index) => {
        const component = componentTypes.find((c) => c.type === item.type) || componentTypes[1];
        const x = 200 + item.dx; // relative baseline for DropHandler viewport offset logic
        const y = 200 + item.dy;
        setTimeout(() => {
          setPendingComponent({ component, x, y, id: `user-template-${template.name}-${index}-${Date.now()}-${Math.random()}` });
          setTimeout(() => setPendingComponent(null), 50);
        }, index * 80);
      });
      setTimeout(() => { setIsProcessing(false); setIsCreatingTemplate(false); }, items.length * 80 + 400);
      return;
    }

    // Built-in templates: simple grid
    const builtin = template as BuiltInTemplate;
    builtin.components.forEach((compType, index) => {
      const component = componentTypes.find(c => c.type === compType) || componentTypes[1];
      const row = Math.floor(index / 3);
      const col = index % 3;
      const x = 200 + (col * 200);
      const y = 200 + (row * 150);
      setTimeout(() => {
        setPendingComponent({ component, x, y, id: `template-${builtin.name}-${compType}-${Date.now()}-${Math.random()}` });
        setTimeout(() => setPendingComponent(null), 50);
      }, index * 100);
    });
    setTimeout(() => { setIsProcessing(false); setIsCreatingTemplate(false); }, (builtin.components.length) * 100 + 500);
  }, [isProcessing]);

  // Show loading while auth is resolving
  if (authLoading) {
    return (
      <main className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <div className="text-sm text-neutral-600">Loading...</div>
        </div>
      </main>
    );
  }

  // Require sign-in for whiteboard editing (but allow shared views)
  if (!currentUser || currentUser.isAnonymous) {
    return (
      <main className="h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="mb-6">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">Create & Save Whiteboards</h2>
            <p className="text-neutral-600">Sign in to create, save, and share your whiteboards. Your work will be safely stored and accessible from any device.</p>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={async () => {
                try {
                  await signInWithGoogle();
                  // Auth state will update automatically and component will re-render
                } catch (error) {
                  console.error('Sign in failed:', error);
                  alert('Sign in failed. Please try again.');
                }
              }}
              className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </button>
            <p className="text-xs text-neutral-500">
              Free account • No credit card required
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 p-3 z-10">
        <div className={`flex items-center justify-between pr-4 ${isNavCollapsed ? 'pl-12' : 'pl-4'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                  if (currentDiagramId && title !== lastSavedTitle) {
                    try { 
                      setTitleSaving(true); 
                      // Update BOTH places: diagram document AND user whiteboard metadata
                      await Promise.all([
                        updateDiagram(currentDiagramId, { title } as any),
                        updateWhiteboardMetadata(currentDiagramId, title)
                      ]);
                      setLastSavedTitle(title);
                      
                      // Reload whiteboard context to update navigation
                      await reloadWhiteboards(); 
                    } finally { setTitleSaving(false); }
                  }
                }
              }}
              placeholder="Untitled whiteboard"
              className="text-xl font-semibold bg-transparent border-b border-transparent focus:border-indigo-500 outline-none px-1 py-0.5 text-neutral-900 dark:text-neutral-100"
              aria-label="Whiteboard title"
            />
            <span className="text-xs text-neutral-500 w-16">{titleSaving ? 'Saving…' : (title === lastSavedTitle ? '' : 'Unsaved')}</span>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <span className="text-xs text-neutral-500">{boardViews || 0} views</span>
            <button
              onClick={async () => {
                if (exportBusy) return;
                setExportBusy(true);
                try {
                  const editor = editorRef.current;
                  if (!editor) return;

                  const pages = editor.getPages();
                  if (!pages || pages.length === 0) {
                    setToast('No pages to export');
                    setTimeout(() => setToast(null), 1200);
                    return;
                  }

                  const pdf = await PDFDocument.create();
                  const font = await pdf.embedFont(StandardFonts.Helvetica);

                  const originalPageId = editor.getCurrentPageId();

                  // Clear editing state once before starting
                  editor.setEditingShape(null);
                  editor.setSelectedShapes([]);

                  for (const p of pages) {
                    try {
                      // Switch to page
                      editor.setCurrentPage(p.id);

                      // Wait for page switch and render
                      await new Promise(r => setTimeout(r, 300));

                      // Find the canvas element
                      const canvas = document.querySelector('.tl-canvas') as HTMLElement;
                      if (!canvas) {
                        console.warn('[ExportPDF] Canvas not found for page:', p.id);
                        continue;
                      }

                      // Screenshot the canvas with html2canvas at high resolution
                      const screenshot = await html2canvas(canvas, {
                        backgroundColor: '#ffffff',
                        scale: 2, // 2x for retina quality
                        logging: false,
                      });

                      // Convert canvas to blob
                      const blob = await new Promise<Blob>((resolve) => {
                        screenshot.toBlob((b) => resolve(b!), 'image/png');
                      });

                      const arrayBuf = await blob.arrayBuffer();
                      const img = await pdf.embedPng(arrayBuf);

                      // Create PDF page sized to the image (with small margin for title)
                      const margin = 36; // 0.5 inch margin
                      const headerHeight = 30;
                      const pdfPageWidth = img.width + margin * 2;
                      const pdfPageHeight = img.height + margin * 2 + headerHeight;

                      const pdfPage = pdf.addPage([pdfPageWidth, pdfPageHeight]);

                      // Draw title at top
                      const titleText = p.name || 'Untitled';
                      const fontSize = 14;
                      const titleWidth = font.widthOfTextAtSize(titleText, fontSize);
                      pdfPage.drawText(titleText, {
                        x: (pdfPageWidth - titleWidth) / 2,
                        y: pdfPageHeight - margin - fontSize,
                        size: fontSize,
                        font,
                        color: rgb(0.1, 0.1, 0.1),
                      });

                      // Draw full-size image (no scaling down)
                      pdfPage.drawImage(img, {
                        x: margin,
                        y: margin,
                        width: img.width,
                        height: img.height,
                      });
                    } catch (e) {
                      console.warn('[ExportPDF] Failed page:', p.id, e);
                    }
                  }

                  // Restore original page
                  if (originalPageId) editor.setCurrentPage(originalPageId);

                  const bytes = await pdf.save();
                  const filename = `${(title || 'whiteboard').replace(/\s+/g, '-')}.pdf`;
                  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = filename;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);

                  setToast('PDF exported');
                  setTimeout(() => setToast(null), 1500);
                } catch (err) {
                  console.error('[ExportPDF] Failed', err);
                  setToast('Export failed');
                  setTimeout(() => setToast(null), 1500);
                } finally {
                  setExportBusy(false);
                }
              }}
              disabled={exportBusy}
              className={`px-3 py-2 rounded ${exportBusy ? 'bg-neutral-300 text-neutral-600' : 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200'} border border-neutral-300 text-sm`}
              title="Export all pages to PDF"
              aria-label="Export all pages to PDF"
            >
              {exportBusy ? 'Exporting…' : 'Export PDF'}
            </button>
            <button
              onClick={async () => {
                setShareOpen(true);
                try {
                  if (!currentDiagramId) {
                    if (!shareUrl) setShareReq(`share-${Date.now()}`);
                    return;
                  }
                  // Determine current page and see if a public page doc exists
                  const pid = currentPageId || (editorRef.current as any)?.getCurrentPageId?.();
                  if (pid) {
                    try {
                      const pageDoc: any = await getDiagramPage(currentDiagramId, pid);
                      if (pageDoc && pageDoc.visibility === 'public') {
                        // Use 1-based page index for clean URLs
                        const pageIndex = pageDoc.pageIndex ?? 1;
                        setShareUrl(`/whiteboard/share/${currentDiagramId}?page=${pageIndex}`);
                      } else {
                        setShareUrl(null);
                      }
                    } catch {
                      setShareUrl(null);
                    }
                  } else {
                    setShareUrl(null);
                  }
                } catch {
                  setShareUrl(null);
                }
              }}
              className="px-3 py-2 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700"
            >
              Share
            </button>
            <div className="hidden lg:block ml-1">
              <UserMenu />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Component Palette */}
        {showPalette && (
          <div className="w-80 bg-white dark:bg-neutral-800 border-r border-neutral-200 dark:border-neutral-700 flex flex-col z-10">
            {/* Palette Header */}
            <div className="flex justify-end p-2">
              <button onClick={() => setShowPalette(false)} className="px-2 py-1 text-sm rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Close components">
                ✕
              </button>
            </div>
            {/* Palette Tabs */}
            <div className="flex border-b border-neutral-200 dark:border-neutral-700">
              <button onClick={() => setActiveTab('components')} className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'components' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600' : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'}`}>Components</button>
              <button onClick={() => setActiveTab('templates')} className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'templates' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600' : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'}`}>Templates</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'components' && (
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3 uppercase tracking-wide">System Components</h3>
                  <div className="space-y-2">
                    {componentTypes.map((component) => (
                      <div key={component.type} onClick={() => {
                        if (isProcessing) return; setIsProcessing(true); setIsCreatingTemplate(false);
                        setPendingComponent({ component, x: 0 + Math.random() * 100 - 50, y: 0 + Math.random() * 100 - 50, id: `click-${Date.now()}-${Math.random()}` });
                        setTimeout(() => { setPendingComponent(null); setIsProcessing(false); }, 200);
                      }} className={`${component.color} p-2 rounded-md border border-solid cursor-pointer hover:shadow-sm transition-colors`}>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{component.icon}</span>
                          <div>
                            <div className="text-xs font-medium">{component.label}</div>
                            <div className="text-[10px] opacity-70">{component.type}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 p-4 bg-neutral-50 dark:bg-neutral-700 rounded-lg">
                    <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-2">How to Use:</h4>
                    <ul className="text-xs text-neutral-600 dark:text-neutral-400 space-y-1">
                      <li>• <strong>Click</strong> components to add to canvas</li>
                      <li>• Use tldraw's arrow tool to connect</li>
                      <li>• Move and resize shapes as needed</li>
                      <li>• Add labels with the text tool</li>
                    </ul>
                  </div>
                </div>
              )}

              {activeTab === 'templates' && (
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-4 uppercase tracking-wide">Architecture Templates</h3>

                  <div className="mb-4 p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-800">
                    <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2">Save current selection as template</div>
                    <div className="flex items-center gap-2">
                      <input value={pendingSaveName} onChange={(e) => setPendingSaveName(e.target.value)} placeholder="Template name" className="flex-1 px-2 py-1 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-sm" />
                      <button onClick={saveSelectionAsTemplate} className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700">Save</button>
                    </div>
                    {saveMessage && <div className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">{saveMessage}</div>}
                  </div>

                  <div className="space-y-4">
                    {architectureTemplates.map((template, index) => (
                      <div
                        key={template.name}
                        onClick={() => createTemplate(template)}
                        onKeyDown={(e)=>{ if(e.key==='Enter' || e.key===' ') { e.preventDefault(); createTemplate(template);} }}
                        role="button"
                        tabIndex={0}
                        className="p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">{index + 1}</div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">{template.name}</h4>
                            <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-3">{template.description}</p>
                            <div className="flex flex-wrap gap-1">
                              {template.components.map((compType) => {
                                const comp = componentTypes.find(c => c.type === compType);
                                return comp ? (<span key={compType} className="inline-flex items-center gap-1 px-2 py-1 bg-neutral-100 dark:bg-neutral-600 rounded text-xs"><span>{comp.icon}</span><span>{comp.type}</span></span>) : null;
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* User Templates */}
                  {userTemplates.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3 uppercase tracking-wide">Your Templates</h3>
                      <div className="space-y-3">
                        {userTemplates.map((t, i) => (
                          <div
                            key={`${t.name}-${i}`}
                            onClick={() => createTemplate(t)}
                            onKeyDown={(e)=>{ if(e.key==='Enter' || e.key===' ') { e.preventDefault(); createTemplate(t);} }}
                            role="button"
                            tabIndex={0}
                            className="p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-medium truncate pr-2">{t.name}</div>
                              <div className="flex items-center gap-2">
                                <div className="text-xs text-neutral-500">{t.components.length} components</div>
                                <button
                                  className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteIdx(confirmDeleteIdx === i ? null : i); }}
                                  title={`Delete template ${t.name}`}
                                  aria-label={`Delete template ${t.name}`}
                                >
                                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-600 dark:text-neutral-300"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
                                </button>
                              </div>
                            </div>

                            {confirmDeleteIdx === i && (
                              <div className="mt-2 flex items-center justify-end gap-2 text-xs" onClick={(e)=>e.stopPropagation()}>
                                <span className="text-neutral-500">Delete “{t.name}”?</span>
                                <button className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700" onClick={() => setConfirmDeleteIdx(null)}>Cancel</button>
                                <button className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700" onClick={() => { deleteUserTemplate(i); setConfirmDeleteIdx(null); }}>Delete</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <h4 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-2">How to Use Templates:</h4>
                    <ul className="text-xs text-green-700 dark:text-green-300 space-y-1">
                      <li>• Click any template to auto-generate the architecture</li>
                      <li>• Components appear relative to your current viewport</li>
                      <li>• Save your own selection as a reusable template from the header</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tldraw Canvas */}
        <div className="flex-1 relative wb-canvas" data-disable-highlights>
          <Tldraw
            store={storeWithStatus}
            options={{ maxPages: 26 }}
            components={{ MainMenu: CustomMainMenu }}
            onMount={(editor) => {
            try {
              editorRef.current = editor;
              
              // Listen for new assets and upload to Firebase + update with URL
              if (currentDiagramId) {
                const processedAssets = new Set<string>();
                
                editor.store.listen((entry) => {
                  const { changes } = entry;
                  Object.values(changes.added).forEach(async (record: any) => {
                    if (record.typeName === 'asset' && !processedAssets.has(record.id)) {
                      processedAssets.add(record.id);
                      const assetId = record.props?.src;
                      
                      // Asset was stored in IndexedDB with ID as src
                      if (assetId && assetId.startsWith('asset:')) {
                        try {
                          // Get the blob from IndexedDB via TLDraw
                          const blob = await (editor as any).getAssetBlob?.(record.id);
                          if (blob) {
                            // Upload to Firebase
                            const url = await uploadDiagramAsset(currentDiagramId, record.id, blob, blob.type);
                            
                            // Update asset with Firebase URL
                            editor.updateAssets([{
                              ...record,
                              props: { ...record.props, src: url }
                            }]);
                            console.log('[AssetListener] ✅ Uploaded and updated:', record.id);
                          }
                        } catch (err) {
                          console.error('[AssetListener] Upload failed:', err);
                        }
                      }
                    }
                  });
                }, { scope: 'document', source: 'user' });
              }
              
              // Live listen for document changes and debounce-save to Firestore
              // Use 'document' scope and filter by source to avoid text editing interference
              if (editor?.store && typeof editor.store.listen === 'function') {
                unsubRef.current = editor.store.listen(async (entry) => {
                  try {
                    // Skip if we just loaded from Firebase (prevent immediate re-save)
                    if (justLoadedFromFirebase.current) {
                      console.log('⏸️ [AUTOSAVE] Skipping - just loaded from Firebase');
                      return;
                    }

                    // Skip if user is actively editing text (prevents focus loss)
                    const editingShapeId = editor.getEditingShapeId();
                    if (editingShapeId) {
                      return; // Silently ignore while editing text
                    }

                    hasUnsavedChanges.current = true; // Mark as unsaved
                    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);

                    // Use 5s debounce to avoid interrupting active editing
                    saveDebounceRef.current = setTimeout(async () => {
                      console.log('🔄 [AUTOSAVE] Debounced save triggered (5s after last edit)');
                      try {
                        // Use currentDiagramId, or fallback to URL param if state was lost
                        let targetId = currentDiagramId || requestedId;
                        console.log('📋 [AUTOSAVE] Diagram ID:', targetId, '(state:', currentDiagramId, ', URL:', requestedId, ')');

                        // If still no ID and user is logged in, create new diagram
                        if (!targetId && currentUser && !currentUser.isAnonymous) {
                          console.log('[Whiteboard] Creating diagram on first edit...');
                          targetId = await ensureDiagramId();
                        }

                        if (!targetId) {
                          console.log('[Whiteboard] Skipping autosave - no diagram available');
                          return;
                        }

                        console.log('📦 [AUTOSAVE] Serializing editor state...');
                        const raw: any = editor.store.serialize();
                        const allRecords = raw?.records ? raw.records : raw;
                        // Determine current page and persist page-only snapshot
                        let pageId: string | null = null;
                        try { pageId = (editor as any).getCurrentPageId?.() || null; } catch {}
                        console.log('📄 [AUTOSAVE] Current page ID:', pageId);

                        const { records: externalized } = await externalizeImageAssets(allRecords, targetId);

                        if (targetId && pageId) {
                          console.log('🔍 [AUTOSAVE] Filtering records for current page...');
                          const pageRec = (externalized || []).find((r: any) => r?.typeName === 'page' && r?.id === pageId);
                          const shapes = (externalized || []).filter((r: any) => r?.typeName === 'shape' && r?.parentId === pageId);
                          const assets = (externalized || []).filter((r: any) => r?.typeName === 'asset');
                          // Don't save document record per-page (causes duplicates on load)
                          const pageRecords = [pageRec, ...shapes, ...assets].filter(Boolean);
                          const pageName = (pageRec && pageRec.name) || '';

                          console.log('💾 [AUTOSAVE] Saving to Firebase...');
                          console.log('   → Diagram ID:', targetId);
                          console.log('   → Page ID:', pageId);
                          console.log('   → Page name:', pageName || '(unnamed)');
                          console.log('   → Total records:', pageRecords.length);
                          console.log('   → Shapes on page:', shapes.length);

                          const existingPage = await getDiagramPage(targetId, pageId).catch(() => null);
                          const visibility = existingPage?.visibility || 'private';

                          try {
                            await setDiagramPage(targetId, pageId, { records: pageRecords, visibility, pageName });
                            console.log('✅ [AUTOSAVE] Page saved to Firebase!');
                          } catch (saveErr) {
                            console.error('❌ [AUTOSAVE] Failed to save page:', saveErr);
                            throw saveErr;
                          }

                          // Save document record to diagram level (shared across all pages)
                          try {
                            const docRec = (externalized || []).find((r: any) => r?.typeName === 'document');
                            if (docRec) {
                              await updateDiagram(targetId, { documentRecord: docRec } as any);
                              console.log('📄 [AUTOSAVE] Document record saved to diagram');
                            }
                          } catch (err) {
                            console.warn('⚠️ [AUTOSAVE] Document record save failed:', err);
                          }

                          // Update pages index on the diagram doc (id,name,index) for quick routing
                          try {
                            // Convert allRecords to array if it's an object
                            const recordsArray = Array.isArray(allRecords) ? allRecords : Object.values(allRecords || {});
                            const allPages: any[] = recordsArray.filter((r: any)=>r?.typeName==='page');
                            const pagesIndex = allPages.slice().sort((a:any,b:any)=>String(a.index||'').localeCompare(String(b.index||''))).map((p:any, i:number)=>({ id: p.id, name: p.name, index: i }));
                            await updateDiagram(targetId, { pages: pagesIndex } as any);
                            console.log('📑 [AUTOSAVE] Pages index updated:', pagesIndex.length, 'total pages');
                          } catch (err) {
                            console.warn('⚠️ [AUTOSAVE] Pages index update failed:', err);
                          }

                          setLastSavedAt(new Date());
                          hasUnsavedChanges.current = false;
                          console.log('✅ [AUTOSAVE] Complete! All changes saved.');
                        }
                      } catch (err) {
                        console.error('[Whiteboard] Autosave failed:', err);
                      }
                    }, 5000); // 5 second debounce - long enough to finish typing
                  } catch (err) {
                    console.warn('[Whiteboard] Debounced save scheduling failed', err);
                  }
                }, { scope: 'document' } as any);
              }
              // Track current page id for context-aware sharing
              try {
                // Set initial page ID immediately
                const initialPageId = editor.getCurrentPageId();
                console.log('[Whiteboard] Initial page ID:', initialPageId);
                setCurrentPageId(initialPageId);
                
                // Listen ONLY for page changes - use instance state listener
                let lastPageId = initialPageId;
                editor.store.listen(
                  () => {
                    const newPageId = editor.getCurrentPageId();
                    if (lastPageId !== newPageId) {
                      console.log('🔀 [PAGE SWITCH] Changed from', lastPageId, 'to', newPageId);
                      console.log('💾 [PAGE SWITCH] Triggering auto-save for old page...');
                      lastPageId = newPageId;
                      setCurrentPageId(newPageId);

                      // Trigger auto-save immediately on page switch
                      if (currentDiagramId) {
                        setAutoSaveReq(`page-switch-${Date.now()}`);
                      }
                    }
                  },
                  { scope: 'session', source: 'user' } as any
                );
              } catch (err) {
                console.error('[Whiteboard] Failed to setup page tracking:', err);
              }
              
              // Pages index initialization disabled - auto-save handles this
              // The old logic would overwrite the pages index with TLDraw's default 1 page
              // before hydration loaded the real pages from Firebase, breaking duplicates
              console.log('[Whiteboard] Skipping initial pages index update - auto-save will handle it');
            } catch (err) {
              console.warn('[Whiteboard] onMount failed', err);
            }
          }}>
            <DropHandler pendingComponent={pendingComponent} isTemplate={isCreatingTemplate} onFirstAction={handleFirstAction} />
            <SelectionExporter requestId={exportRequestId} onExport={handleExport} />
            <DocExporter request={shareReq || autoSaveReq} onJson={async (json) => {
              try {
                // Handle different request types
                if (shareReq?.startsWith('save-')) {
                  // Save or update for logged-in user
                  const title = shareReq.split('-').slice(2).join('-');
                  
                  const externalized = json.records; // Assets are handled by TLDraw's asset store
                  if (currentDiagramId) {
                    await updateDiagram(currentDiagramId, { title, canvas: externalized } as any);
                    setLastSavedAt(new Date());
                  } else {
                    // Create new diagram
                    const id = await createDiagram({ title, canvas: externalized } as any);
                    setCurrentDiagramId(id);
                    setLastSavedAt(new Date());
                  }
                  setIsSaving(false);
                } else if (autoSaveReq) {
                  // Auto-save is now handled by the store listener (lines 1327-1410)
                  // We don't save to diagram.canvas anymore - only per-page documents
                  console.log('ℹ️ [AUTOSAVE] Legacy DocExporter path triggered (no-op - using store listener)');
                  setAutoSaveReq(null); // Clear the request
                } else if (shareReq?.startsWith('publish-')) {
                  // Publish: ensure a public board exists with the current JSON, then surface link
                  try {
                    console.log('[Share] Publish start');
                    const targetId = await ensureDiagramId();
                    const { records: ext } = await externalizeImageAssets(json.records as any[], targetId);
                    // Determine current page and filter records to that page for page-level doc
                    let pageId: string | null = null;
                    try { pageId = (editorRef.current as any)?.getCurrentPageId?.() || null; } catch {}
                    if (pageId) {
                      const pageRec = (ext || []).find((r: any) => r?.typeName === 'page' && r?.id === pageId);
                      const docRec = (ext || []).find((r: any) => r?.typeName === 'document');
                      const shapes = (ext || []).filter((r: any) => r?.typeName === 'shape' && r?.parentId === pageId);
                      const assets = (ext || []).filter((r: any) => r?.typeName === 'asset');
                      const pageRecords = [docRec, pageRec, ...shapes, ...assets].filter(Boolean);
                      // Persist/update page doc with public visibility
                      try {
                        const pageName = (pageRec && pageRec.name) || '';
                        // Compute page index from the full document
                        let pageIndex = 1; // Default to 1-based
                        try {
                          // json.records can be an array or object - convert to array
                          const recordsArray = Array.isArray(json.records) 
                            ? json.records 
                            : (json.records ? Object.values(json.records) : []);
                          
                          const allPages: any[] = recordsArray.filter((r: any)=>r?.typeName==='page');
                          const pagesSorted = allPages.slice().sort((a: any,b: any)=>String(a.index||'').localeCompare(String(b.index||'')));
                          const foundIndex = pagesSorted.findIndex((p: any)=>p?.id===pageId);
                          pageIndex = Math.max(0, foundIndex) + 1; // Convert to 1-based
                          console.log('[Share] All pages:', allPages.map(p => ({ id: p.id, name: p.name, index: p.index })));
                          console.log('[Share] Sorted pages:', pagesSorted.map(p => ({ id: p.id, name: p.name, index: p.index })));
                          console.log('[Share] Current pageId:', pageId);
                          console.log('[Share] Found index position:', foundIndex, '→ pageIndex:', pageIndex);
                        } catch (err) {
                          console.error('[Share] Error calculating page index:', err);
                        }
                        console.log('[Share] Publishing page with index:', pageIndex, 'pageId:', pageId);
                        await setDiagramPage(targetId, pageId, { records: pageRecords, visibility: 'public', pageName });
                        // Also set the parent diagram as public for easier access
                        await updateDiagram(targetId, { visibility: 'public' });
                      } catch {}
                      // Use pageId directly in URL (no more index calculation!)
                      setShareUrl(`/whiteboard/share/${targetId}?page=${pageId}`);
                    } else {
                      // No current page - cannot share
                      throw new Error('No page selected for sharing');
                    }
                    setToast('Sharing enabled');
                    setTimeout(() => setToast(null), 1500);
                    console.log('[Share] Publish success', { id: targetId });
                  } catch (e) {
                    console.error('Publish failed', e);
                    setShareUrl(null);
                    setToast('Failed to enable share');
                    setTimeout(() => setToast(null), 1500);
                  }
                } else if (shareReq?.startsWith('embed-')) {
                  // Create a shareable board then copy an iframe snippet
                  try {
                    console.log('[Share] Embed create start');
                    const targetId = await ensureDiagramId();
                    const { records: ext } = await externalizeImageAssets(json.records as any[], targetId);
                    setCurrentDiagramId(targetId);
                    let href = `/whiteboard/share/${targetId}`;
                    try {
                      const pageId = (editorRef.current as any)?.getCurrentPageId?.();
                      if (pageId) {
                        const pageRec = (ext || []).find((r: any) => r?.typeName === 'page' && r?.id === pageId);
                        const docRec = (ext || []).find((r: any) => r?.typeName === 'document');
                        const shapes = (ext || []).filter((r: any) => r?.typeName === 'shape' && r?.parentId === pageId);
                        const assets = (ext || []).filter((r: any) => r?.typeName === 'asset');
                        const pageRecords = [docRec, pageRec, ...shapes, ...assets].filter(Boolean);
                        const pageName = (pageRec && pageRec.name) || '';
                        let pageIndex = 1;
                        try { const allPages: any[] = (json.records || []).filter((r: any)=>r?.typeName==='page'); const pagesSorted = allPages.slice().sort((a:any,b:any)=>String(a.index||'').localeCompare(String(b.index||''))); pageIndex = Math.max(0, pagesSorted.findIndex((p: any)=>p?.id===pageId)) + 1; } catch {}
                        await setDiagramPage(targetId, pageId, { records: pageRecords, visibility: 'public', pageName });
                        // Also set the parent diagram as public for easier access
                        await updateDiagram(targetId, { visibility: 'public' });
                        // Use 1-based page index for URL
                        const urlPageIndex = pageIndex;
                        href = `/whiteboard/share/${targetId}?page=${urlPageIndex}`;
                      }
                    } catch {}
                    setShareUrl(href);
                    try {
                      const origin = window.location.origin;
                      const iframe = `<iframe src="${origin}${href}" width="800" height="600" style="border:0" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
                      await navigator.clipboard.writeText(iframe);
                      setToast('Embed code copied');
                      setTimeout(() => setToast(null), 2000);
                      console.log('[Share] Embed code copied');
                    } catch (err) {
                      console.warn('[Share] Clipboard write failed', err);
                    }
                  } catch (e) {
                    console.error('Embed creation failed', e);
                    setToast('Failed to create share link');
                    setTimeout(() => setToast(null), 2000);
                  }
                } else if (shareReq) {
                  // Share functionality (original) - create if needed and guard response
                  try {
                    console.log('[Share] Share create start');
                    const targetId = await ensureDiagramId();
                    const { records: ext } = await externalizeImageAssets(json.records as any[], targetId);
                    setCurrentDiagramId(targetId);
                    let href = `/whiteboard/share/${targetId}`;
                    try {
                      const pageId = (editorRef.current as any)?.getCurrentPageId?.();
                      if (pageId) {
                        const pageRec = (ext || []).find((r: any) => r?.typeName === 'page' && r?.id === pageId);
                        const docRec = (ext || []).find((r: any) => r?.typeName === 'document');
                        const shapes = (ext || []).filter((r: any) => r?.typeName === 'shape' && r?.parentId === pageId);
                        const assets = (ext || []).filter((r: any) => r?.typeName === 'asset');
                        const pageRecords = [docRec, pageRec, ...shapes, ...assets].filter(Boolean);
                        const pageName = (pageRec && pageRec.name) || '';
                        let pageIndex = 1;
                        try { const allPages: any[] = (json.records || []).filter((r: any)=>r?.typeName==='page'); const pagesSorted = allPages.slice().sort((a:any,b:any)=>String(a.index||'').localeCompare(String(b.index||''))); pageIndex = Math.max(0, pagesSorted.findIndex((p: any)=>p?.id===pageId)) + 1; } catch {}
                        await setDiagramPage(targetId, pageId, { records: pageRecords, visibility: 'public', pageName });
                        // Also set the parent diagram as public for easier access
                        await updateDiagram(targetId, { visibility: 'public' });
                        // Use 1-based page index for URL
                        const urlPageIndex = pageIndex;
                        href = `/whiteboard/share/${targetId}?page=${urlPageIndex}`;
                      }
                    } catch {}
                    setShareUrl(href);
                    setToast('Share link created');
                    setTimeout(() => setToast(null), 2000);
                    console.log('[Share] Share create success', { id: targetId });
                  } catch (e) {
                    console.error('Share creation failed', e);
                    setShareUrl(null);
                    setToast('Failed to create share link');
                    setTimeout(() => setToast(null), 2000);
                  }
                }
                setShareReq(null);
                setAutoSaveReq(null);
                setShareBusy(false);
              } catch (error) {
                console.error('Error saving:', error);
                setShareReq(null);
                setAutoSaveReq(null);
                setIsSaving(false);
                setShareBusy(false);
              }
            }} />
          </Tldraw>
          {/* Listen to live document changes and debounce-save to Firestore so the shared link stays current */}
          <script dangerouslySetInnerHTML={{ __html: '' }} />
          <ToolbarComponentsButton onClick={() => setShowPalette(true)} />
          {showSimulator && <SimulatorPanel onClose={() => setShowSimulator(false)} />}
          <style>{`
            /* Show the tools toolbar like Excalidraw to insert shapes/lines */
            .wb-canvas .tlui-toolbar { display: flex !important; }
            /* Hide only the status/debug strip at the very bottom */
            .wb-canvas .tlui-status-bar { display: none !important; }
            .wb-canvas .tlui-help-menu { display: none !important; }
            .wb-canvas .tlui-debug-panel { display: none !important; }
            .wb-canvas .tlui-performance { display: none !important; }
          `}</style>
          {toast && (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-6 px-3 py-2 rounded bg-neutral-900 text-white text-xs shadow">
              {toast}
            </div>
          )}

          {/* Share / Embed Dialog */}
          {shareOpen && (
            <div className="absolute inset-0 z-[9999] flex items-center justify-center">
              <div className="fixed inset-0 bg-black/40 z-[9998]" onClick={() => setShareOpen(false)} />
              <div className="relative bg-white dark:bg-neutral-900 w-full max-w-xl rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 z-[10000]">
                <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 rounded-t-2xl">
                  <h3 className="text-base font-semibold">Share</h3>
                  {shareBusy && (
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <div className="w-3 h-3 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                      Working...
                    </div>
                  )}
                  <button className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={() => setShareOpen(false)} aria-label="Close">✕</button>
                </div>
                <div className="p-5 space-y-5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-medium">View link</div>
                      {currentDiagramId && (
                        shareUrl ? (
                          <button
                            onClick={async () => {
                              console.log('[Share] Disable sharing clicked', { currentDiagramId });
                              setShareBusy(true);
                              try {
                                // Disable page-level sharing for the current page
                                const pid = currentPageId || (editorRef.current as any)?.getCurrentPageId?.();
                                if (pid) {
                                  await setDiagramPage(currentDiagramId, pid, { visibility: 'private' });
                                  setShareUrl(null);
                                  setToast('Sharing disabled');
                                } else {
                                  setToast('No page selected');
                                }
                                setTimeout(() => setToast(null), 1200);
                              } catch (e) {
                                console.error('[Share] Disable failed', e);
                                setToast('Failed to disable share');
                                setTimeout(() => setToast(null), 1200);
                              } finally { setShareBusy(false); }
                            }}
                            disabled={shareBusy}
                            className="text-xs px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-60"
                          >
                            Disable sharing
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              console.log('[Share] Enable sharing clicked', { currentDiagramId });
                              setShareBusy(true);
                              try {
                                // Enable sharing: set public and ensure link; always save real TL snapshot
                                // Ask the editor to serialize and then publish using that JSON
                                setShareReq(`publish-${Date.now()}`);
                              } catch (e) {
                                console.error('[Share] Enable failed', e);
                                setToast('Failed to enable share');
                                setTimeout(() => setToast(null), 1200);
                              }
                            }}
                            disabled={shareBusy}
                            className="text-xs px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                          >
                            {shareBusy ? 'Publishing…' : 'Enable sharing'}
                          </button>
                        )
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input readOnly value={shareUrl ? `${window.location.origin}${shareUrl}` : 'Sharing is off'} className="flex-1 text-sm rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 disabled:opacity-60" disabled={shareBusy} />
                      <button
                        disabled={!shareUrl || shareBusy}
                        onClick={() => { if (shareUrl) { console.log('[Share] Copy link clicked'); navigator.clipboard.writeText(`${window.location.origin}${shareUrl}`); setCopiedLink(true); setTimeout(()=>setCopiedLink(false), 1200); try{(window as any).focus();}catch{} }}}
                        className={`px-3 py-2 rounded-md text-sm ${shareUrl ? (copiedLink ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-indigo-600 text-white hover:bg-indigo-700') : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600'} disabled:opacity-60 active:translate-y-[1px]`}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e)=>{ if((e.key==='Enter'||e.key===' ') && shareUrl && !shareBusy){ e.preventDefault(); navigator.clipboard.writeText(`${window.location.origin}${shareUrl}`); setCopiedLink(true); setTimeout(()=>setCopiedLink(false), 1200);} }}
                      >
                        {copiedLink ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">{shareUrl ? 'Anyone with this link can view.' : 'Sharing is currently disabled.'}</p>
                  </div>

                  <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
                    <div className="text-sm font-medium mb-2">Embed</div>
                    <div className="flex items-center gap-2 mb-2">
                      <label htmlFor="embedSize" className="text-xs text-neutral-500">Size</label>
                      <select id="embedSize" className="text-sm rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1" defaultValue="800x600">
                        <option value="640x480">640×480</option>
                        <option value="800x600">800×600</option>
                        <option value="1024x768">1024×768</option>
                        <option value="100%x600">100%×600</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <textarea readOnly rows={3} value={
                        shareUrl ? `<iframe src="${window.location.origin}${shareUrl}" width="800" height="600" style="border:0" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>` : 'Enable sharing to generate embed code'
                      } className="flex-1 text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 disabled:opacity-60" disabled={shareBusy} />
                      <button
                        disabled={!shareUrl || shareBusy}
                        onClick={() => { if (shareUrl) { console.log('[Share] Copy embed clicked'); const code = `<iframe src=\"${window.location.origin}${shareUrl}\" width=\"800\" height=\"600\" style=\"border:0\" loading=\"lazy\" referrerpolicy=\"no-referrer-when-downgrade\"></iframe>`; navigator.clipboard.writeText(code); setCopiedEmbed(true); setTimeout(()=>setCopiedEmbed(false), 1200); try{(window as any).focus();}catch{} }}}
                        className={`self-start px-3 py-2 rounded-md text-sm ${shareUrl ? (copiedEmbed ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-indigo-600 text-white hover:bg-indigo-700') : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600'} disabled:opacity-60 active:translate-y-[1px]`}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e)=>{ if((e.key==='Enter'||e.key===' ') && shareUrl && !shareBusy){ e.preventDefault(); const code = `<iframe src=\"${window.location.origin}${shareUrl}\" width=\"800\" height=\"600\" style=\"border:0\" loading=\"lazy\" referrerpolicy=\"no-referrer-when-downgrade\"></iframe>`; navigator.clipboard.writeText(code); setCopiedEmbed(true); setTimeout(()=>setCopiedEmbed(false), 1200);} }}
                      >
                        {copiedEmbed ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
