'use client';

import { useState, useEffect } from 'react';
import { Settings, Save } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { ProjectPage } from '@/lib/project-data-model';

interface PageSettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  page: ProjectPage | null;
  onUpdatePage: (pageId: string, updates: Partial<ProjectPage>) => void | Promise<void>;
  isLoading?: boolean;
}

export function PageSettingsDialog({
  isOpen,
  onOpenChange,
  page,
  onUpdatePage,
  isLoading = false
}: PageSettingsDialogProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isVisible, setIsVisible] = useState(true);
  const [allowComments, setAllowComments] = useState(true);

  // Initialize form when page changes
  useEffect(() => {
    if (page) {
      setTitle(page.title);
      setDescription(page.description || '');
      setIsVisible(page.settings.isVisible);
      setAllowComments(page.settings.allowComments);
    }
  }, [page]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!page || !title.trim()) return;

    setIsUpdating(true);
    try {
      const updates: Partial<ProjectPage> = {
        title: title.trim(),
        description: description.trim(),
        settings: {
          ...page.settings,
          isVisible,
          allowComments
        }
      };

      await onUpdatePage(page.id, updates);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update page settings:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    if (!isUpdating && !isLoading) {
      // Reset form to original values
      if (page) {
        setTitle(page.title);
        setDescription(page.description || '');
        setIsVisible(page.settings.isVisible);
        setAllowComments(page.settings.allowComments);
      }
      onOpenChange(false);
    }
  };

  if (!page) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <Settings className="h-6 w-6 text-blue-600" />
              </div>
              <DialogTitle>Page Settings</DialogTitle>
            </div>
            <DialogDescription>
              Configure settings for "{page.title}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="page-title-setting">Page Title</Label>
              <Input
                id="page-title-setting"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isUpdating || isLoading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="page-description-setting">Description</Label>
              <Textarea
                id="page-description-setting"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isUpdating || isLoading}
                rows={3}
                placeholder="Brief description of this page..."
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="page-visible">Page Visibility</Label>
                  <div className="text-xs text-muted-foreground">
                    Whether this page is visible in navigation
                  </div>
                </div>
                <Switch
                  id="page-visible"
                  checked={isVisible}
                  onCheckedChange={setIsVisible}
                  disabled={isUpdating || isLoading}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="allow-comments">Allow Comments</Label>
                  <div className="text-xs text-muted-foreground">
                    Enable comments and collaboration on this page
                  </div>
                </div>
                <Switch
                  id="allow-comments"
                  checked={allowComments}
                  onCheckedChange={setAllowComments}
                  disabled={isUpdating || isLoading}
                />
              </div>
            </div>

            <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <Settings className="h-4 w-4 text-blue-600 mt-0.5" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Page Order: {page.order}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    {page.progress.totalSections} sections • {page.progress.completionPercentage}% complete
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
              disabled={isUpdating || isLoading}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || isUpdating || isLoading}
              className="w-full sm:w-auto"
            >
              {isUpdating || isLoading ? (
                <>
                  <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}