'use client';

import { useState } from 'react';
import { Plus, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ProjectPage } from '@/lib/project-data-model';

interface AddPageDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAddPage: (page: ProjectPage) => void | Promise<void>;
  isLoading?: boolean;
  existingPageCount: number;
}

export function AddPageDialog({
  isOpen,
  onOpenChange,
  onAddPage,
  isLoading = false,
  existingPageCount
}: AddPageDialogProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    setIsCreating(true);
    try {
      const pageId = `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newPage: ProjectPage = {
        id: pageId,
        title: title.trim(),
        description: description.trim() || `Custom page for ${title.trim()}`,
        order: existingPageCount + 1,
        sections: {},
        settings: {
          isVisible: true,
          allowComments: true,
          layout: { type: 'single_column', sectionSpacing: 'normal' }
        },
        progress: {
          status: 'not_started',
          completedSections: [],
          totalSections: 0,
          completionPercentage: 0,
          lastUpdated: new Date().toISOString()
        }
      };

      await onAddPage(newPage);

      // Reset form and close dialog
      setTitle('');
      setDescription('');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create page:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating && !isLoading) {
      setTitle('');
      setDescription('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <DialogTitle>Add New Page</DialogTitle>
            </div>
            <DialogDescription>
              Create a new page for your project. You can add sections and content to it later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="page-title">Page Title</Label>
              <Input
                id="page-title"
                placeholder="e.g., Architecture Overview, Database Design"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isCreating || isLoading}
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="page-description">Description (Optional)</Label>
              <Textarea
                id="page-description"
                placeholder="Brief description of what this page will contain..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isCreating || isLoading}
                rows={3}
              />
            </div>

            <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <FileText className="h-4 w-4 text-blue-600 mt-0.5" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Page Order: {existingPageCount + 1}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    This page will be added at the end of your current pages
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isCreating || isLoading}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || isCreating || isLoading}
              className="w-full sm:w-auto"
            >
              {isCreating || isLoading ? (
                <>
                  <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Page
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}