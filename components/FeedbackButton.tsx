'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { submitFeedback, FirebaseFeedback } from '@/lib/firebase';
import { useFeedback } from '@/contexts/FeedbackContext';
import { useNotificationTriggers } from '@/hooks/useNotificationTriggers';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AIChat from '@/components/AIChat';

export default function FeedbackButton() {
  const { isOpen, setIsOpen } = useFeedback();
  const [feedback, setFeedback] = useState('');
  const [category, setCategory] = useState<FirebaseFeedback['category']>('general');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showOptions, setShowOptions] = useState(true);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [pageContent, setPageContent] = useState<string>('');
  const { user } = useAuth();
  const { triggerFeedback } = useNotificationTriggers();

  // Extract page content when dialog opens
  useEffect(() => {
    if (isOpen && !pageContent) {
      try {
        // Get the main content area
        const mainContent = document.querySelector('main, article, [role="main"]');
        if (mainContent) {
          setPageContent(mainContent.textContent || '');
        }
      } catch (error) {
        console.error('Failed to extract page content:', error);
      }
    }
  }, [isOpen, pageContent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const feedbackId = await submitFeedback({
        feedback: feedback.trim(),
        category,
        userId: user?.uid || null,
        userEmail: user?.email || null,
        userName: user?.displayName || null,
        userPhotoURL: user?.photoURL || null,
        isAnonymous: user?.isAnonymous ?? true,
        timestamp: new Date(),
        url: window.location.href,
        userAgent: navigator.userAgent
      });

      // Trigger notification to admins
      const isUrgent = feedback.toLowerCase().includes('urgent') ||
                      feedback.toLowerCase().includes('critical') ||
                      feedback.toLowerCase().includes('bug') ||
                      category === 'bug';

      await triggerFeedback({
        id: feedbackId,
        feedback: feedback.trim(),
        category,
        userEmail: user?.email || undefined,
        urgent: isUrgent,
        url: window.location.href,
        pageTitle: document.title
      });

      setSubmitted(true);
      setFeedback('');
      setTimeout(() => {
        setIsOpen(false);
        setSubmitted(false);
        setShowOptions(true);
        setShowFeedbackForm(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenFeedback = () => {
    setShowOptions(false);
    setShowFeedbackForm(true);
  };

  const handleOpenAIChat = () => {
    setIsOpen(false);
    setShowAIChat(true);
  };

  const handleCloseDialog = () => {
    setIsOpen(false);
    setShowOptions(true);
    setShowFeedbackForm(false);
    setSubmitted(false);
  };

  const handleCloseAIChat = () => {
    setShowAIChat(false);
  };

  return (
    <>
      {/* Feedback Button */}
      <Button
        onClick={() => setIsOpen(true)}
        size="icon"
        className="h-9 w-9 rounded-full bg-muted hover:bg-muted/80"
        variant="secondary"
      >
        <MessageSquare className="h-4 w-4" />
        <span className="sr-only">Send feedback</span>
      </Button>

      {/* Feedback Modal */}
      <Dialog open={isOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-md">
          {submitted ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <DialogTitle className="text-center mb-2">Thank you!</DialogTitle>
              <p className="text-muted-foreground">
                Your feedback has been submitted successfully.
              </p>
            </div>
          ) : showOptions ? (
            <>
              <DialogHeader>
                <DialogTitle>How can we help?</DialogTitle>
              </DialogHeader>

              <div className="space-y-3 py-4">
                {/* Learn with AI Option */}
                <button
                  onClick={handleOpenAIChat}
                  className="w-full p-6 rounded-lg border-2 border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors text-left group"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-purple-600 text-white rounded-lg group-hover:scale-110 transition-transform">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1 text-purple-900 dark:text-purple-100">
                        Learn with AI
                      </h3>
                      <p className="text-sm text-purple-700 dark:text-purple-300">
                        Ask questions and get explanations about this page's content
                      </p>
                    </div>
                  </div>
                </button>

                {/* Give Feedback Option */}
                <button
                  onClick={handleOpenFeedback}
                  className="w-full p-6 rounded-lg border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-750 transition-colors text-left group"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-neutral-600 text-white rounded-lg group-hover:scale-110 transition-transform">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1 text-neutral-900 dark:text-neutral-100">
                        Give Feedback
                      </h3>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        Report bugs, request features, or share your thoughts
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </>
          ) : showFeedbackForm ? (
            <>
              <DialogHeader>
                <DialogTitle>Send Feedback</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={category} onValueChange={(value: FirebaseFeedback['category']) => setCategory(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Feedback</SelectItem>
                      <SelectItem value="bug">Bug Report</SelectItem>
                      <SelectItem value="feature">Feature Request</SelectItem>
                      <SelectItem value="content">Content Issue</SelectItem>
                      <SelectItem value="ui">UI/UX Feedback</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feedback">Your feedback</Label>
                  <Textarea
                    id="feedback"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Tell us what you think..."
                    className="min-h-[120px] resize-none"
                    required
                  />
                </div>

                <DialogFooter className="gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseDialog}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!feedback.trim() || isSubmitting}
                  >
                    {isSubmitting ? 'Sending...' : 'Send Feedback'}
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* AI Chat Panel */}
      <AIChat
        isOpen={showAIChat}
        onClose={handleCloseAIChat}
        pageUrl={typeof window !== 'undefined' ? window.location.href : ''}
        pageTitle={typeof window !== 'undefined' ? document.title : ''}
        pageContent={pageContent}
      />
    </>
  );
}