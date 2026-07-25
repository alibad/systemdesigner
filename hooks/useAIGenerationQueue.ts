'use client';

import { useState, useCallback, useRef } from 'react';
import { PageSection } from '@/lib/project-data-model';

interface QueueItem {
  pageId: string;
  sectionId: string;
  section: PageSection;
  projectTitle: string;
  projectDescription: string;
  pageTitle: string;
  pageDescription?: string;
}

interface UseAIGenerationQueueProps {
  onSectionUpdate: (pageId: string, sectionId: string, updates: Partial<PageSection>) => void;
  otherPagesContent?: Array<any>;
  otherSectionsInPage?: (sectionId: string) => Array<any>;
}

export function useAIGenerationQueue({
  onSectionUpdate,
  otherPagesContent = [],
  otherSectionsInPage
}: UseAIGenerationQueueProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentlyGenerating, setCurrentlyGenerating] = useState<string | null>(null);
  const queueRef = useRef<QueueItem[]>([]);
  const processingRef = useRef(false);
  const queuedSectionIdsRef = useRef<Set<string>>(new Set());

  // Process the queue one item at a time
  const processQueue = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0) {
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);

    while (queueRef.current.length > 0) {
      const item = queueRef.current[0];

      // Check if this section was cancelled
      if (item.section.progress.aiGeneration?.status === 'cancelled') {
        queueRef.current.shift();
        continue;
      }

      setCurrentlyGenerating(item.sectionId);

      const startTime = Date.now();
      const startedAt = new Date().toISOString();

      // Update status to generating
      onSectionUpdate(item.pageId, item.sectionId, {
        progress: {
          ...item.section.progress,
          aiGeneration: {
            status: 'generating',
            queuedAt: item.section.progress.aiGeneration?.queuedAt || new Date().toISOString(),
            startedAt
          }
        }
      });

      try {
        // Build the prompt for tracking
        const promptData = {
          projectTitle: item.projectTitle,
          projectDescription: item.projectDescription,
          pageTitle: item.pageTitle,
          pageDescription: item.pageDescription,
          sectionTitle: item.section.title,
          sectionType: item.section.type,
          existingContent: item.section.content,
          otherPagesContent: otherPagesContent,
          otherSectionsInPage: otherSectionsInPage ? otherSectionsInPage(item.sectionId) : []
        };

        // Call the AI generation API
        const response = await fetch('/api/generate-section', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(promptData),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('API Error:', errorText);
          throw new Error(`API returned ${response.status}: ${errorText}`);
        }

        const data = await response.json();

        if (data.success && data.content) {
          const completedAt = new Date().toISOString();
          const generationTimeMs = Date.now() - startTime;

          // Create a readable prompt summary
          const promptSummary = `Project: ${item.projectTitle}
Page: ${item.pageTitle}
Section: ${item.section.title} (${item.section.type})
Description: ${item.projectDescription}`;

          // Update section with generated content
          onSectionUpdate(item.pageId, item.sectionId, {
            content: data.content,
            progress: {
              ...item.section.progress,
              status: 'in_progress',
              aiGeneration: {
                status: 'completed',
                queuedAt: item.section.progress.aiGeneration?.queuedAt || new Date().toISOString(),
                startedAt,
                completedAt,
                prompt: promptSummary,
                generationTimeMs
              }
            }
          });
        }
      } catch (error) {
        console.error('Generation failed for', item.section.title, error);

        // Update status to error
        onSectionUpdate(item.pageId, item.sectionId, {
          progress: {
            ...item.section.progress,
            aiGeneration: {
              status: 'error',
              queuedAt: item.section.progress.aiGeneration?.queuedAt || new Date().toISOString(),
              startedAt: item.section.progress.aiGeneration?.startedAt || new Date().toISOString(),
              error: error instanceof Error ? error.message : 'Failed to generate content'
            }
          }
        });
      }

      // Remove from queue
      queueRef.current.shift();

      // Small delay between generations to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setCurrentlyGenerating(null);
    setIsProcessing(false);
    processingRef.current = false;
  }, [onSectionUpdate, otherPagesContent, otherSectionsInPage]);

  // Add sections to the queue
  const queueSections = useCallback((items: QueueItem[]) => {
    // Filter out sections that are already queued to prevent duplicates
    const newItems = items.filter(item => !queuedSectionIdsRef.current.has(item.sectionId));

    if (newItems.length === 0) {
      return;
    }

    // Track queued sections
    newItems.forEach(item => {
      queuedSectionIdsRef.current.add(item.sectionId);
    });

    // Add to queue without updating section status yet
    // Status will be updated when processing starts
    queueRef.current = [...queueRef.current, ...newItems];
    processQueue();
  }, [processQueue]);

  // Cancel a specific section
  const cancelSection = (sectionId: string) => {
    // Remove from queue if not started yet
    queueRef.current = queueRef.current.filter(item => item.sectionId !== sectionId);
    queuedSectionIdsRef.current.delete(sectionId);
  };

  // Clear the entire queue
  const clearQueue = () => {
    queueRef.current = [];
    queuedSectionIdsRef.current.clear();
    setIsProcessing(false);
    processingRef.current = false;
    setCurrentlyGenerating(null);
  };

  return {
    queueSections,
    cancelSection,
    clearQueue,
    isProcessing,
    currentlyGenerating,
    queueLength: queueRef.current.length
  };
}
