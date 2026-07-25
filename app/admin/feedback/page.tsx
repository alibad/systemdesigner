'use client';

import { useCallback, useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ExternalLink, CheckCircle, Clock, User, Trash2, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getFeedback, updateFeedbackStatus, FirebaseFeedback } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import FirestoreMiddleware from '@/lib/firestore-middleware';
import AdminNav from '@/components/admin/AdminNav';

export default function AdminFeedbackPage() {
  const [feedback, setFeedback] = useState<FirebaseFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'resolved'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [feedbackToDelete, setFeedbackToDelete] = useState<string | null>(null);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [feedbackToResolve, setFeedbackToResolve] = useState<FirebaseFeedback | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const { user, isAuthenticated, isAdmin } = useAuth();
  const router = useRouter();

  // Get a working image URL (same logic as UserMenu)
  const getWorkingImageUrl = (photoURL: string) => {
    // Try different size parameters that might work better
    const variants = [
      photoURL.replace(/=s\d+-c$/, '=s32-c'),
      photoURL.replace(/=s\d+-c$/, '=s48-c'),
      photoURL.replace(/=s\d+-c$/, ''),
      photoURL.split('=')[0]
    ];
    return variants[0]; // Start with smallest size
  };

  const loadFeedback = useCallback(async (reset = true) => {
    try {
      setLoading(reset);
      const result = await getFeedback(20);
      setFeedback(prev => reset ? result.feedback : [...prev, ...result.feedback]);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Failed to load feedback:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!isAdmin) {
      router.push('/');
      return;
    }
    loadFeedback();
  }, [isAuthenticated, isAdmin, router, loadFeedback]);

  const loadMoreFeedback = async () => {
    if (!hasMore || loadingMore) return;
    
    setLoadingMore(true);
    try {
      const lastItem = feedback[feedback.length - 1];
      const result = await getFeedback(20, lastItem.createdAt);
      setFeedback([...feedback, ...result.feedback]);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Failed to load more feedback:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const openResolveDialog = (item: FirebaseFeedback) => {
    setFeedbackToResolve(item);
    setResolutionNotes('');
    setResolveDialogOpen(true);
  };

  const toggleResolved = async (feedbackId: string, currentStatus: boolean) => {
    // If marking as unresolved, do it immediately without dialog
    if (currentStatus) {
      try {
        await updateFeedbackStatus(feedbackId, false);
        setFeedback(prev => prev.map(item =>
          item.id === feedbackId
            ? { ...item, resolved: false }
            : item
        ));
      } catch (error) {
        console.error('Failed to update feedback:', error);
      }
    }
    // If marking as resolved, we'll handle this in handleResolve after dialog
  };

  const handleResolve = async () => {
    if (!feedbackToResolve || !feedbackToResolve.id) return;

    try {
      await updateFeedbackStatus(
        feedbackToResolve.id,
        true,
        resolutionNotes,
        feedbackToResolve.userEmail || undefined
      );

      setFeedback(prev => prev.map(item =>
        item.id === feedbackToResolve.id
          ? { ...item, resolved: true, adminNotes: resolutionNotes }
          : item
      ));

      setResolveDialogOpen(false);
      setFeedbackToResolve(null);
      setResolutionNotes('');
    } catch (error) {
      console.error('Failed to resolve feedback:', error);
      alert('Failed to resolve feedback. Please try again.');
    }
  };

  const openDeleteDialog = (feedbackId: string) => {
    setFeedbackToDelete(feedbackId);
    setDeleteDialogOpen(true);
  };

  const deleteFeedback = async () => {
    if (!feedbackToDelete) return;

    try {
      await FirestoreMiddleware.deleteDocument('feedback', feedbackToDelete);
      setFeedback(prev => prev.filter(item => item.id !== feedbackToDelete));
      setDeleteDialogOpen(false);
      setFeedbackToDelete(null);
    } catch (error) {
      console.error('Failed to delete feedback:', error);
      // You could show a toast here instead of alert
      alert('Failed to delete feedback. Please try again.');
    }
  };

  const filteredFeedback = feedback.filter(item => {
    if (filter === 'resolved' && !item.resolved) return false;
    if (filter === 'unresolved' && item.resolved) return false;
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    return true;
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold mb-2">Authentication Required</h1>
          <p className="text-neutral-600 dark:text-neutral-400">Please sign in to access this page.</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold mb-2">Access Denied</h1>
          <p className="text-neutral-600 dark:text-neutral-400">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <div className="max-w-6xl mx-auto p-6">
        {/* Back button */}
        <div className="mb-6">
          <Link
            href="/admin"
            className="inline-flex items-center text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Dashboard
          </Link>
        </div>

        <div className="bg-card rounded-lg shadow-sm border border-border">
          <div className="p-6 border-b border-border">
            <h1 className="text-2xl font-bold text-foreground mb-4">
              User Feedback Dashboard
            </h1>
            
            {/* Filters */}
            <div className="flex flex-wrap gap-6">
              <div className="space-y-2">
                <Label htmlFor="status-filter">Status Filter</Label>
                <Select value={filter} onValueChange={(value: 'all' | 'unresolved' | 'resolved') => setFilter(value)}>
                  <SelectTrigger className="w-40" id="status-filter">
                    <SelectValue placeholder="All Feedback" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Feedback</SelectItem>
                    <SelectItem value="unresolved">Unresolved</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="category-filter">Category Filter</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-40" id="category-filter">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="general">General Feedback</SelectItem>
                    <SelectItem value="bug">Bug Report</SelectItem>
                    <SelectItem value="feature">Feature Request</SelectItem>
                    <SelectItem value="content">Content Issue</SelectItem>
                    <SelectItem value="ui">UI/UX Feedback</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="space-y-4">
              {filteredFeedback.map((item) => (
                <div
                  key={item.id}
                  className={`p-6 rounded-lg border ${
                    item.resolved
                      ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                      : 'bg-card border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      {item.userPhotoURL ? (
                        <Image
                          src={getWorkingImageUrl(item.userPhotoURL)}
                          alt="User"
                          width={32}
                          height={32}
                          className="w-8 h-8 rounded-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                        style={{ display: item.userPhotoURL ? 'none' : 'flex' }}
                      >
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {item.userName || 'Anonymous User'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {item.userEmail || 'No email'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${{
                        'general': 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
                        'bug': 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300',
                        'feature': 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
                        'content': 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300',
                        'ui': 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300',
                      }[item.category]}`}>
                        {item.category}
                      </span>

                      <Button
                        onClick={() => {
                          if (item.resolved) {
                            toggleResolved(item.id!, true);
                          } else {
                            openResolveDialog(item);
                          }
                        }}
                        variant={item.resolved ? "default" : "outline"}
                        size="sm"
                        className={`px-3 py-1 h-7 text-xs ${item.resolved ? "bg-green-600 hover:bg-green-700 text-white" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                      >
                        {item.resolved ? (
                          <>
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Resolved
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3 mr-1" />
                            Mark Resolved
                          </>
                        )}
                      </Button>

                      <Button
                        onClick={() => openDeleteDialog(item.id!)}
                        variant="ghost"
                        size="sm"
                        className="w-7 h-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Delete feedback"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <p className="text-foreground mb-4">
                    {item.feedback}
                  </p>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <span>
                        {item.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown date'}
                      </span>
                      <span>
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View Page
                          </a>
                        ) : (
                          'No URL'
                        )}
                      </span>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      item.isAnonymous 
                        ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300' 
                        : 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    }`}>
                      {item.isAnonymous ? 'Anonymous' : 'Authenticated'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {hasMore && (
              <div className="mt-6 text-center">
                <Button
                  onClick={loadMoreFeedback}
                  disabled={loadingMore}
                  variant="outline"
                  size="lg"
                >
                  {loadingMore ? 'Loading...' : 'Load More'}
                </Button>
              </div>
            )}

            {filteredFeedback.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  No feedback found matching your filters.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Resolve Feedback Dialog */}
        <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Resolve Feedback</DialogTitle>
              <DialogDescription>
                Add resolution notes to send to the user. They will receive an email notification that their feedback has been addressed.
              </DialogDescription>
            </DialogHeader>

            {feedbackToResolve && (
              <div className="space-y-4">
                {/* Original Feedback */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold mb-2">Original Feedback:</h4>
                  <p className="text-sm text-muted-foreground">{feedbackToResolve.feedback}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <span className="font-medium">{feedbackToResolve.userName || feedbackToResolve.userEmail || 'Anonymous'}</span>
                    <span>•</span>
                    <span className="capitalize">{feedbackToResolve.category}</span>
                  </div>
                </div>

                {/* Resolution Notes */}
                <div className="space-y-2">
                  <Label htmlFor="resolution-notes">
                    Resolution Notes <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <textarea
                    id="resolution-notes"
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Let the user know what actions were taken or what changes were made..."
                    className="w-full min-h-[120px] p-3 rounded-md border border-input bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground">
                    💡 The user will receive an email with your notes. BCC will be sent to system-designer@googlegroups.com
                  </p>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setResolveDialogOpen(false);
                  setFeedbackToResolve(null);
                  setResolutionNotes('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleResolve}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark as Resolved & Notify User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Feedback</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this feedback? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={deleteFeedback}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
