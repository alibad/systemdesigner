'use client';

import { useCallback, useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { getDiagram } from '@/lib/firebase';

interface WhiteboardPage {
  id: string;
  name: string;
  index: number;
}

interface WhiteboardPageSelectorProps {
  whiteboardId: string;
  currentPageId: string;
  onSelectPage: (pageId: string) => void;
  allowCreatePage?: boolean;
}

export function WhiteboardPageSelector({
  whiteboardId,
  currentPageId,
  onSelectPage,
  allowCreatePage = true
}: WhiteboardPageSelectorProps) {
  const [pages, setPages] = useState<WhiteboardPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newPageName, setNewPageName] = useState('');

  const loadPages = useCallback(async () => {
    try {
      setIsLoading(true);

      // Guard: Check if whiteboardId is defined
      if (!whiteboardId) {
        setPages([{
          id: 'page:page',
          name: 'Main Diagram',
          index: 0
        }]);
        setIsLoading(false);
        return;
      }

      const diagram = await getDiagram(whiteboardId);

      if (diagram?.canvas?.store) {
        // Extract pages from TLDraw canvas
        const store = diagram.canvas.store;
        const pageRecords = Object.values(store).filter((record: any) => record.typeName === 'page');

        const pageList: WhiteboardPage[] = pageRecords.map((page: any) => ({
          id: page.id,
          name: page.name || 'Untitled Page',
          index: page.index || 0
        }));

        // Sort by index
        pageList.sort((a, b) => a.index - b.index);
        setPages(pageList);
      } else {
        // No pages yet - create a default one
        setPages([{
          id: 'page:page',
          name: 'Main Diagram',
          index: 0
        }]);
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load pages:', error);
      setIsLoading(false);
    }
  }, [whiteboardId]);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  async function handleCreatePage() {
    // For now, this is a placeholder
    // In a future update, we'd integrate TLDraw's page creation API
    console.warn('Page creation not yet implemented - requires TLDraw API integration');
    setIsCreateDialogOpen(false);
    setNewPageName('');
  }

  const currentPage = pages.find(p => p.id === currentPageId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
        Loading pages...
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Page Dropdown */}
        <Select value={currentPageId} onValueChange={onSelectPage}>
          <SelectTrigger className="w-64">
            <SelectValue>
              📄 {currentPage?.name || 'Select Page'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {pages.map(page => (
              <SelectItem key={page.id} value={page.id}>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs">Page {page.index + 1}</span>
                  <span>{page.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Create New Page Button (placeholder for future) */}
        {allowCreatePage && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCreateDialogOpen(true)}
            title="Create new page (coming soon)"
            disabled
          >
            <Plus className="w-4 h-4" />
          </Button>
        )}

        {/* Link to full whiteboard */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            window.open(`/whiteboard?id=${whiteboardId}&page=${currentPageId}`, '_blank');
          }}
          title="Open in new tab"
        >
          <ExternalLink className="w-4 h-4" />
        </Button>
      </div>

      {/* Create Page Dialog (placeholder for future) */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Whiteboard Page</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Page creation will be available in a future update. For now, you can create pages
              by opening the whiteboard in a new tab and using TLDraw's page menu.
            </p>
            <Input
              value={newPageName}
              onChange={(e) => setNewPageName(e.target.value)}
              placeholder="Page name (e.g., 'API Design')"
              disabled
            />
            <Button onClick={handleCreatePage} disabled>
              Create Page (Coming Soon)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
