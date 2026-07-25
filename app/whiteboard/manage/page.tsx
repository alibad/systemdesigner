'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit3, Trash2, Calendar, Copy } from 'lucide-react';
import { createWhiteboardMetadata, updateWhiteboardMetadata, deleteWhiteboard, duplicateWhiteboard } from '@/lib/firebase';
import { useWhiteboards } from '@/contexts/WhiteboardContext';
import { useAuth } from '@/hooks/useAuth';
import UserMenu from '@/components/ui/UserMenu';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import SignInPrompt from '@/components/ui/SignInPrompt';

export default function WhiteboardManagePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { whiteboards, loading, error, reload } = useWhiteboards();
  
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [whiteboardToDelete, setWhiteboardToDelete] = useState<{id: string, title: string} | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  // Require authentication
  if (authLoading) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-neutral-200 dark:bg-neutral-800 rounded w-64 mb-4"></div>
          <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-96"></div>
        </div>
      </div>
    );
  }

  if (!user || user.isAnonymous) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-8">
        <SignInPrompt 
          title="Sign in to create whiteboards"
          description="Create, save, and share your system design whiteboards."
        />
      </div>
    );
  }

  const handleCreateNew = async () => {
    if (!newTitle.trim()) return;
    
    try {
      setCreating(true);
      console.log('[Create] Creating whiteboard:', newTitle);
      const id = await createWhiteboardMetadata(newTitle.trim(), newDescription.trim() || undefined);
      console.log('[Create] Whiteboard created with ID:', id);
      setNewTitle('');
      setNewDescription('');
      setShowCreateForm(false);
      console.log('[Create] Reloading list...');
      await reload();
      console.log('[Create] List reloaded');
    } catch (error) {
      console.error('Failed to create whiteboard:', error);
      alert('Failed to create whiteboard. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = (whiteboard: any) => {
    setEditingId(whiteboard.id);
    setEditTitle(whiteboard.title);
    setEditDescription(whiteboard.description || '');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editTitle.trim()) return;
    
    try {
      console.log('[Edit] Updating whiteboard:', editingId);
      await updateWhiteboardMetadata(editingId, editTitle.trim(), editDescription.trim() || undefined);
      console.log('[Edit] Whiteboard updated, reloading list...');
      setEditingId(null);
      setEditTitle('');
      setEditDescription('');
      await reload();
      console.log('[Edit] List reloaded');
    } catch (error) {
      console.error('Failed to update whiteboard:', error);
      alert('Failed to update whiteboard. Please try again.');
    }
  };

  const handleDeleteClick = (id: string, title: string) => {
    setWhiteboardToDelete({ id, title });
    setDeleteDialogOpen(true);
  };

  const handleDuplicate = async (id: string, title: string) => {
    try {
      setDuplicatingId(id);
      await duplicateWhiteboard(id, `${title} (Copy)`);
      await reload();
    } catch (error) {
      console.error('Failed to duplicate whiteboard:', error);
      alert('Failed to duplicate whiteboard. Please try again.');
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!whiteboardToDelete) return;
    
    try {
      console.log('[Delete] Deleting whiteboard:', whiteboardToDelete.id);
      await deleteWhiteboard(whiteboardToDelete.id);
      console.log('[Delete] Whiteboard deleted, reloading list...');
      await reload();
      console.log('[Delete] List reloaded, closing dialog');
      setDeleteDialogOpen(false);
      setWhiteboardToDelete(null);
    } catch (error) {
      console.error('Failed to delete whiteboard:', error);
      alert('Failed to delete whiteboard. Please try again.');
      setWhiteboardToDelete(null);
    }
  };

  const formatDate = (date: any) => {
    try {
      let d: Date;
      
      if (date instanceof Date) {
        d = date;
      } else if (date && typeof date === 'object' && date.seconds) {
        // Firebase Timestamp object
        d = new Date(date.seconds * 1000);
      } else if (date && typeof date === 'object' && date.toDate) {
        // Firebase Timestamp with toDate method
        d = date.toDate();
      } else if (typeof date === 'string' || typeof date === 'number') {
        d = new Date(date);
      } else {
        return 'Unknown';
      }
      
      if (isNaN(d.getTime())) {
        return 'Unknown';
      }
      
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
          My Whiteboards
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-6">
          Create and manage your system design whiteboards.
        </p>
        
        <button
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Whiteboard
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="mb-8 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-card">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Create New Whiteboard</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Title *</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Enter whiteboard title"
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Description</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCreateNew}
                disabled={!newTitle.trim() || creating}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-4 py-2 rounded-md font-medium"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setNewTitle('');
                  setNewDescription('');
                }}
                className="bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-300 px-4 py-2 rounded-md font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Whiteboards List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse"></div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-red-600">Error loading whiteboards: {error}</p>
          <button onClick={reload} className="mt-4 text-indigo-600 hover:text-indigo-700">
            Try again
          </button>
        </div>
      ) : whiteboards.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-neutral-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">No whiteboards yet</h3>
          <p className="text-neutral-600 dark:text-neutral-400">Click "New Whiteboard" above to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {whiteboards.map((whiteboard) => (
            <div
              key={whiteboard.id}
              className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 hover:shadow-card transition-shadow"
            >
              {editingId === whiteboard.id ? (
                <div className="space-y-4">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-900"
                  />
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-900"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEdit}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-sm"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="bg-neutral-200 hover:bg-neutral-300 text-neutral-700 px-3 py-1 rounded text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-2">
                      {whiteboard.title}
                    </h3>
                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={() => handleEdit(whiteboard)}
                        className="p-1 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDuplicate(whiteboard.id, whiteboard.title)}
                        className="p-1 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                        title="Duplicate"
                        disabled={duplicatingId === whiteboard.id}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(whiteboard.id, whiteboard.title)}
                        className="p-1 text-neutral-500 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {whiteboard.description && (
                    <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-4 line-clamp-3">
                      {whiteboard.description}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-xs text-neutral-500 gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(whiteboard.createdAt)}
                    </div>
                    <button
                      onClick={() => router.push(`/whiteboard?id=${whiteboard.id}`)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                    >
                      Open
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        itemName={whiteboardToDelete?.title}
        itemType="whiteboard"
        destructiveAction="Delete"
      />
    </div>
  );
}
