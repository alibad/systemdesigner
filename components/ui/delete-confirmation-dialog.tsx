'use client';

import { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
  itemName?: string;
  itemType?: string;
  isLoading?: boolean;
  destructiveAction?: string;
}

export function DeleteConfirmationDialog({
  isOpen,
  onOpenChange,
  onConfirm,
  title,
  description,
  itemName,
  itemType = 'item',
  isLoading = false,
  destructiveAction = 'Delete'
}: DeleteConfirmationDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const defaultTitle = title || `${destructiveAction} ${itemType}`;
  const defaultDescription = description ||
    `Are you sure you want to ${destructiveAction.toLowerCase()} ${itemName ? `"${itemName}"` : `this ${itemType}`}? This action cannot be undone.`;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <DialogTitle className="text-left">
              {defaultTitle}
            </DialogTitle>
          </div>
          <DialogDescription className="text-left">
            {defaultDescription}
          </DialogDescription>
        </DialogHeader>

        {itemName && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Trash2 className="h-4 w-4 text-red-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  {itemName}
                </p>
                <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                  This {itemType} will be permanently deleted
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting || isLoading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting || isLoading}
            className="w-full sm:w-auto"
          >
            {isDeleting || isLoading ? (
              <>
                <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {destructiveAction}...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                {destructiveAction}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}