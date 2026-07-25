'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Highlighter, StickyNote, X, Sparkles, Copy, Loader2, Edit2, Trash2, Save, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { submitFeedback, FirebaseFeedback } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useStorage } from '@/contexts/StorageContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/toast';
import AIChat from '@/components/AIChat';
import ReactMarkdown from 'react-markdown';

interface TextSelection {
  text: string;
  context: string;
  rect: DOMRect;
}

interface StoredNote {
  id: string;
  text: string;
  note: string;
  pageUrl: string;
  timestamp: string;
}

export default function TextSelectionFeedback() {
  const { user } = useAuth();
  const storage = useStorage();
  const { addToast } = useToast();
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'feedback' | 'note' | 'explain'>('feedback');
  const [category, setCategory] = useState<FirebaseFeedback['category']>('content');
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [notePopoverPosition, setNotePopoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [userNotes, setUserNotes] = useState<StoredNote[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState<string>('');
  const [explanation, setExplanation] = useState<string>('');
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanationError, setExplanationError] = useState<string>('');
  const [showAIChat, setShowAIChat] = useState(false);
  const [pageContent, setPageContent] = useState<string>('');
  const chatInitialMessageRef = useRef<string | undefined>(undefined);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const selectionTimeoutRef = useRef<NodeJS.Timeout>();
  const highlightTextOnPageRef = useRef<(text: string) => void>(() => {});
  const highlightCodeTextOnPageRef = useRef<(text: string, codeBlockId?: string) => void>(() => {});
  const highlightTextAtPositionRef = useRef<(codeBlock: Element, text: string, startOffset: number, endOffset: number, groupId?: string) => boolean>(() => false);
  const addNoteIndicatorRef = useRef<(note: StoredNote) => void>(() => {});
  const [showMobileSheet, setShowMobileSheet] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const feedbackTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Note: Do NOT early-return here based on route; it changes hook order between renders

  // Detect mobile/tablet device (including iPads)
  useEffect(() => {
    // Disable entirely on whiteboard routes (including dialogs)
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/whiteboard')) {
      return () => {};
    }
    const checkMobile = () => {
      // Check for touch capability and mobile user agents
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      // Check user agent for mobile devices (including iPad)
      const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
      const isMobileUA = mobileRegex.test(navigator.userAgent);

      // Also check for iPad on iOS 13+ which reports as Mac
      const isIPad = (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
                     navigator.userAgent.includes('iPad');

      // Consider it mobile/tablet if it has touch and (mobile UA or iPad or small screen)
      const isMobileDevice = hasTouch && (isMobileUA || isIPad || window.innerWidth < 1024);

      setIsMobile(isMobileDevice);

      // Only log device detection in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log('Device detection:', {
          hasTouch,
          isMobileUA,
          isIPad,
          platform: navigator.platform,
          maxTouchPoints: navigator.maxTouchPoints,
          innerWidth: window.innerWidth,
          result: isMobileDevice
        });
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Extract page content on mount
  useEffect(() => {
    try {
      const mainContent = document.querySelector('main, article, [role="main"]');
      if (mainContent) {
        setPageContent(mainContent.textContent || '');
      }
    } catch (error) {
      console.error('Failed to extract page content:', error);
    }
  }, []);

  // Load user annotations using unified storage
  useEffect(() => {
    let hasLoaded = false;

    // Wait for DOM to be fully loaded and stable before applying highlights
    const loadUserAnnotations = async () => {
      try {
        if (!storage || hasLoaded) {
          return;
        }

        hasLoaded = true;
        const pageUrl = window.location.href;
        // Loading annotations for current page

        // Get highlights and notes for this page
        const [highlights, notes] = await Promise.all([
          storage.getHighlights(pageUrl),
          storage.getNotes(pageUrl),
        ]);

        // Found existing highlights and notes

        // Apply highlights with validation - use requestAnimationFrame for better timing
        requestAnimationFrame(() => {
          setTimeout(() => {
            highlights.forEach(highlight => {
              if (highlight.isCodeHighlight) {
                // Check if we have position information for more accurate restoration
                if (highlight.textStartIndex !== undefined && highlight.textEndIndex !== undefined && highlight.codeBlockId) {
                  const codeBlock = document.getElementById(highlight.codeBlockId);
                  if (codeBlock) {
                    // Restoring code highlight with position data

                    // Validate that the position still contains the expected text
                    const currentText = codeBlock.textContent || '';
                    const positionText = currentText.substring(highlight.textStartIndex, highlight.textEndIndex);

                    if (positionText === highlight.text) {
                      // Position data is still valid, using position-based restoration
                      const groupId = `highlight-restore-${highlight.text.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 50)}`;
                      const success = highlightTextAtPositionRef.current(codeBlock, highlight.text, highlight.textStartIndex, highlight.textEndIndex, groupId);
                      if (success) {
                        // Position-based restoration successful
                        return;
                      }
                    } else {
                      // Position data is stale, falling back to text search
                    }
                  }
                }
                // Fallback to text-based restoration
                highlightCodeTextOnPageRef.current(highlight.text, highlight.context);
              } else {
                highlightTextOnPageRef.current(highlight.text);
              }
            });

            // Store notes for local state
            setUserNotes(notes);

            // Apply note indicators
            notes.forEach(note => {
              addNoteIndicatorRef.current(note);
            });
          }, 100); // Small additional delay after requestAnimationFrame
        });
      } catch (error) {
        console.error('Error loading user annotations:', error);
      }
    };

    // Use multiple checks to ensure DOM is ready
    const checkAndLoad = () => {
      if (document.readyState === 'complete') {
        // Document is fully loaded
        setTimeout(loadUserAnnotations, 1500); // Increased delay for better stability
      } else {
        // Wait for window load event
        window.addEventListener('load', () => {
          setTimeout(loadUserAnnotations, 1500);
        }, { once: true });
      }
    };

    checkAndLoad();
  }, [storage, user]);

  // Simple code block detection
  const isSelectionInCodeBlock = (selection: Selection): boolean => {
    const range = selection.getRangeAt(0);
    let element = range.commonAncestorContainer;

    // Walk up the DOM tree to find a code block
    while (element && element !== document.body) {
      if (element.nodeType === Node.ELEMENT_NODE) {
        const el = element as Element;
        if (el.tagName === 'CODE' || el.hasAttribute('data-code-source')) {
          return true;
        }
      }
      element = element.parentNode as Node;
    }
    return false;
  };

  const highlightTextOnPage = (text: string) => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (parent?.tagName === 'SCRIPT' || parent?.tagName === 'STYLE') {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent?.hasAttribute('data-highlight')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let node;
    while (node = walker.nextNode()) {
      const textNode = node as Text;
      const content = textNode.textContent || '';
      const index = content.indexOf(text);

      if (index !== -1) {
        const beforeText = content.substring(0, index);
        const matchText = content.substring(index, index + text.length);
        const afterText = content.substring(index + text.length);

        const parent = textNode.parentNode;
        if (parent) {
          const span = document.createElement('span');
          span.className = 'bg-yellow-100 dark:bg-yellow-900/30 cursor-pointer hover:bg-yellow-200 dark:hover:bg-yellow-800/50 transition-colors inline';
          span.setAttribute('data-highlight', 'true');
          span.title = 'Click to remove highlight';
          span.textContent = matchText;
          span.onclick = async (e) => {
            console.log('🔥 RESTORED HIGHLIGHT CLICKED FOR REMOVAL!');
            e.stopPropagation();
            e.preventDefault();
            // SIMPLE REMOVAL - just replace with text content
            const textContent = span.textContent || '';
            const spanParent = span.parentNode;
            if (spanParent) {
              console.log('🗑️ Removing restored highlight with text:', textContent);

              // Remove from storage first
              try {
                // Get all highlights for this page and find the one that matches
                const highlights = await storage.getHighlights(window.location.href);
                const matchingHighlight = highlights.find(h => h.text === textContent);
                if (matchingHighlight) {
                  await storage.removeHighlight(matchingHighlight.id);
                  console.log('💾 Removed from storage');
                } else {
                  console.log('⚠️ Highlight not found in storage');
                }
              } catch (error) {
                console.error('❌ Failed to remove from storage:', error);
              }

              // Remove visual highlight
              const textNode = document.createTextNode(textContent);
              spanParent.replaceChild(textNode, span);
              spanParent.normalize();
              console.log('✅ Restored highlight removed successfully');
            } else {
              console.log('❌ No parent found for restored highlight span');
            }
          };

          if (beforeText) {
            parent.insertBefore(document.createTextNode(beforeText), textNode);
          }
          parent.insertBefore(span, textNode);
          if (afterText) {
            parent.insertBefore(document.createTextNode(afterText), textNode);
          }
          // Defensive: node may have been re-parented by concurrent DOM ops
          if (textNode.parentNode) {
            textNode.parentNode.removeChild(textNode);
          }
          break;
        }
      }
    }
  };

  const highlightCodeTextOnPage = (text: string, codeBlockId?: string) => {
    console.log('🔍 Restoring code highlight:', text, 'in block:', codeBlockId);

    // Simple approach: try to find the text in the specific code block
    if (codeBlockId) {
      const targetBlock = document.getElementById(codeBlockId);
      if (targetBlock) {
        console.log('📍 Found specific code block:', codeBlockId);

        // Use the simple cross-node highlighting (it works, just was being used wrong)
        if (highlightTextInCodeBlock(targetBlock, text)) {
          console.log('✅ Code highlight restored in specific block');
          return;
        }
      } else {
        console.log('⚠️ Code block ID not found:', codeBlockId);
      }
    }

    // Fallback: search all code blocks
    const codeBlocks = document.querySelectorAll('code[id]');
    console.log('🔍 Searching', codeBlocks.length, 'code blocks for text:', text);

    for (const codeBlock of codeBlocks) {
      if (highlightTextInCodeBlock(codeBlock as Element, text)) {
        console.log('✅ Code highlight restored in block:', (codeBlock as Element).id);
        break;
      }
    }
  };

  const highlightTextAtPosition = (codeBlock: Element, text: string, startOffset: number, endOffset: number, groupId?: string): boolean => {
    console.log(`🎯 Highlighting at exact position ${startOffset}-${endOffset}`);

    // Check if this text is already highlighted to avoid duplicates
    const existingHighlights = codeBlock.querySelectorAll('[data-highlight-group]');
    for (const existing of existingHighlights) {
      const existingText = existing.getAttribute('data-original-text');
      if (existingText === text) {
        console.log('⚠️ This text is already highlighted, skipping to avoid duplicates');
        return true; // Return true to indicate we handled it (by skipping)
      }
    }

    // Collect all text nodes with their positions
    const textNodes: { node: Text; startPos: number; content: string }[] = [];
    let currentPos = 0;

    const walker = document.createTreeWalker(
      codeBlock,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (parent?.hasAttribute('data-highlight')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let node;
    while (node = walker.nextNode()) {
      const textNode = node as Text;
      const content = textNode.textContent || '';
      textNodes.push({
        node: textNode,
        startPos: currentPos,
        content: content
      });
      currentPos += content.length;
    }

    // Find which text nodes contain our target range
    const affectedNodes: {
      node: Text;
      startOffset: number;
      endOffset: number;
    }[] = [];

    for (const textNodeInfo of textNodes) {
      const nodeStart = textNodeInfo.startPos;
      const nodeEnd = textNodeInfo.startPos + textNodeInfo.content.length;

      // Check if this node overlaps with our target range
      if (nodeStart < endOffset && nodeEnd > startOffset) {
        const nodeStartOffset = Math.max(0, startOffset - nodeStart);
        const nodeEndOffset = Math.min(textNodeInfo.content.length, endOffset - nodeStart);

        affectedNodes.push({
          node: textNodeInfo.node,
          startOffset: nodeStartOffset,
          endOffset: nodeEndOffset
        });
      }
    }

    console.log(`🎯 Found ${affectedNodes.length} nodes at position ${startOffset}-${endOffset}`);

    // Create a unique group ID for this highlight group if not provided
    const highlightGroupId = groupId || `highlight-group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Apply highlighting to the affected nodes
    try {
      for (let i = affectedNodes.length - 1; i >= 0; i--) {
        const { node, startOffset: nodeStartOffset, endOffset: nodeEndOffset } = affectedNodes[i];
        const content = node.textContent || '';

        const beforeText = content.substring(0, nodeStartOffset);
        const highlightText = content.substring(nodeStartOffset, nodeEndOffset);
        const afterText = content.substring(nodeEndOffset);

        const parent = node.parentNode;
        if (!parent) continue;

        // Create highlight span with group ID
        const span = document.createElement('span');
        span.className = 'bg-yellow-200 dark:bg-yellow-800 cursor-pointer relative';
        span.setAttribute('data-highlight', 'code');
        span.setAttribute('data-highlight-group', highlightGroupId);
        span.setAttribute('data-original-text', text); // Store the FULL original text for ALL spans in the group
        span.title = 'Click to remove code highlight';
        span.textContent = highlightText;
        span.onclick = async (e) => {
          console.log('🔥 CODE HIGHLIGHT CLICKED FOR REMOVAL!');
          e.stopPropagation();
          e.preventDefault();

          // Remove the entire highlight group (which will handle storage removal)
          await removeHighlightGroup(highlightGroupId, span);
        };

        // Replace the text node with highlighted version
        if (beforeText) {
          parent.insertBefore(document.createTextNode(beforeText), node);
        }
        parent.insertBefore(span, node);
        if (afterText) {
          parent.insertBefore(document.createTextNode(afterText), node);
        }
        // Defensive: only remove if still a child of this parent
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      }

      console.log('✅ Position-based highlight applied successfully');
      return true;
    } catch (error) {
      console.log('❌ Error applying position-based highlight:', error);
      return false;
    }
  };

  const highlightTextInCodeBlock = (codeBlock: Element, text: string): boolean => {
    const fullText = codeBlock.textContent || '';
    console.log('🔍 Code block full text length:', fullText.length);
    console.log('🔍 Looking for text:', JSON.stringify(text));
    console.log('🔍 Code block contains text:', fullText.includes(text));

    if (!fullText.includes(text)) {
      console.log('❌ Text not found in code block');
      return false;
    }

    console.log('✅ Text found! Attempting cross-node highlighting...');

    // Collect all text nodes and their positions
    const textNodes: { node: Text; startPos: number; content: string }[] = [];
    let currentPos = 0;

    const walker = document.createTreeWalker(
      codeBlock,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (parent?.hasAttribute('data-highlight')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let node;
    while (node = walker.nextNode()) {
      const textNode = node as Text;
      const content = textNode.textContent || '';
      textNodes.push({
        node: textNode,
        startPos: currentPos,
        content: content
      });
      currentPos += content.length;
    }

    // Find the start position of our text in the full text
    const searchIndex = fullText.indexOf(text);
    if (searchIndex === -1) {
      console.log('❌ Text not found in concatenated content');
      return false;
    }

    const searchEnd = searchIndex + text.length;
    console.log(`🎯 Target text spans from ${searchIndex} to ${searchEnd} in full text`);
    console.log(`📝 Expected text: "${text}"`);
    console.log(`📝 Found text at position: "${fullText.substring(searchIndex, searchEnd)}"`);

    // Verify the text at the found position matches exactly
    const foundText = fullText.substring(searchIndex, searchEnd);
    if (foundText !== text) {
      console.log(`❌ Text mismatch! Expected: "${text}", Found: "${foundText}"`);
      return false;
    }

    // Additional validation: check if this code block already has highlights to avoid double-highlighting
    const existingHighlights = codeBlock.querySelectorAll('[data-highlight-group]');
    for (const existing of existingHighlights) {
      const existingText = existing.getAttribute('data-original-text');
      if (existingText === text) {
        console.log('⚠️ This text is already highlighted, skipping to avoid duplicates');
        return true; // Return true to indicate we handled it (by skipping)
      }
    }

    // Find which text nodes contain the start and end of our target text
    const affectedNodes: {
      node: Text;
      startOffset: number;
      endOffset: number;
      isFirst: boolean;
      isLast: boolean;
    }[] = [];

    for (const textNodeInfo of textNodes) {
      const nodeStart = textNodeInfo.startPos;
      const nodeEnd = textNodeInfo.startPos + textNodeInfo.content.length;

      // Check if this node overlaps with our target range
      if (nodeStart < searchEnd && nodeEnd > searchIndex) {
        const startOffset = Math.max(0, searchIndex - nodeStart);
        const endOffset = Math.min(textNodeInfo.content.length, searchEnd - nodeStart);

        const highlightedPortion = textNodeInfo.content.substring(startOffset, endOffset);
        console.log(`📄 Node will highlight: "${highlightedPortion}" (offset ${startOffset}-${endOffset})`);

        affectedNodes.push({
          node: textNodeInfo.node,
          startOffset,
          endOffset,
          isFirst: nodeStart <= searchIndex,
          isLast: nodeEnd >= searchEnd
        });
      }
    }

    console.log(`🎯 Found ${affectedNodes.length} nodes spanning the target text`);

    // Verify we're highlighting the exact character count
    let totalHighlightLength = 0;
    for (const { startOffset, endOffset } of affectedNodes) {
      totalHighlightLength += (endOffset - startOffset);
    }

    if (totalHighlightLength !== text.length) {
      console.log(`❌ Character count mismatch: expected ${text.length}, got ${totalHighlightLength}`);
      return false;
    }

    console.log(`✅ Character count verified: ${totalHighlightLength} characters`);

    // Create a unique group ID for this highlight group - FOR RESTORATION, USE THE ORIGINAL TEXT AS ID
    const groupId = `highlight-restore-${text.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 50)}`;
    console.log(`🔗 Restoring highlight group: ${groupId}`);

    // Apply highlighting across the affected nodes with group ID
    try {
      for (let i = affectedNodes.length - 1; i >= 0; i--) {
        const { node, startOffset, endOffset } = affectedNodes[i];
        const content = node.textContent || '';

        const beforeText = content.substring(0, startOffset);
        const highlightText = content.substring(startOffset, endOffset);
        const afterText = content.substring(endOffset);

        const parent = node.parentNode;
        if (!parent) continue;

        // Create highlight span with group ID
        const span = document.createElement('span');
        span.className = 'bg-yellow-200 dark:bg-yellow-800 cursor-pointer relative';
        span.setAttribute('data-highlight', 'code');
        span.setAttribute('data-highlight-group', groupId);
        span.setAttribute('data-original-text', text); // Store the FULL original text for ALL spans in the group
        span.title = 'Click to remove entire highlight';
        span.textContent = highlightText;
        span.onclick = async (e) => {
          console.log('🔥 RESTORED CODE HIGHLIGHT CLICKED FOR REMOVAL!');
          e.stopPropagation();
          e.preventDefault();

          // Remove the entire highlight group (which will handle storage removal)
          await removeHighlightGroup(groupId, span);
        };

        // Replace the text node with highlighted version
        if (beforeText) {
          parent.insertBefore(document.createTextNode(beforeText), node);
        }
        parent.insertBefore(span, node);
        if (afterText) {
          parent.insertBefore(document.createTextNode(afterText), node);
        }
        // Defensive: only remove if still a child of this parent
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      }

      console.log('✅ Cross-node highlight applied successfully');
      return true;
    } catch (error) {
      console.log('❌ Error applying cross-node highlight:', error);
      return false;
    }
  };

  const addNoteIndicator = (note: StoredNote) => {
    // Find text and add note indicator
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node;
    while (node = walker.nextNode()) {
      const textNode = node as Text;
      if (textNode.textContent?.includes(note.text) && !textNode.parentElement?.hasAttribute('data-note')) {
        const wrapper = document.createElement('span');
        // Simple underline with minimal visual impact
        wrapper.className = 'relative inline-block border-b border-blue-400 dark:border-blue-500 border-dotted cursor-pointer hover:border-blue-600 dark:hover:border-blue-300 transition-colors';
        wrapper.setAttribute('data-note', note.id);

        // Add a simple note icon as a superscript
        const noteIcon = document.createElement('span');
        noteIcon.className = 'absolute text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 pointer-events-none select-none';
        noteIcon.style.top = '-2px';
        noteIcon.style.right = '-16px';
        noteIcon.style.width = '8px';
        noteIcon.style.height = '8px';
        noteIcon.setAttribute('aria-hidden', 'true');
        noteIcon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M14,17H7V15H14M17,13H7V11H17M17,9H7V7H17M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3Z"/></svg>';
        wrapper.onclick = (event) => {
          event.preventDefault();
          event.stopPropagation();
          const rect = wrapper.getBoundingClientRect();
          setNotePopoverPosition({
            x: rect.left + rect.width / 2,
            y: rect.top
          });
          showNotePopup(note);
        };
        
        const parent = textNode.parentNode;
        if (parent) {
          try {
            // Use replace with a cloned node to avoid intermediate removeChild errors
            const cloned = document.createTextNode(textNode.textContent || '');
            parent.replaceChild(wrapper, textNode);
            wrapper.appendChild(cloned);
            wrapper.appendChild(noteIcon);
          } catch (e) {
            console.warn('Failed to insert note indicator, falling back:', e);
            // Best-effort fallback: append to parent end
            parent.appendChild(wrapper);
            wrapper.appendChild(document.createTextNode(textNode.textContent || ''));
            wrapper.appendChild(noteIcon);
          }
        }
      }
    }
  };

  highlightTextOnPageRef.current = highlightTextOnPage;
  highlightCodeTextOnPageRef.current = highlightCodeTextOnPage;
  highlightTextAtPositionRef.current = highlightTextAtPosition;
  addNoteIndicatorRef.current = addNoteIndicator;

  const showNotePopup = (note: StoredNote) => {
    setActiveNoteId(note.id);
  };

  const handleEditNote = (note: StoredNote) => {
    setEditingNoteId(note.id);
    setEditingNoteText(note.note);
    setActiveNoteId(null); // Close the popup
    setNotePopoverPosition(null); // Clear position
  };

  const handleSaveNoteEdit = async () => {
    if (!editingNoteId || !editingNoteText.trim()) return;

    try {
      // Update in storage
      await storage.updateNote(editingNoteId, editingNoteText);

      // Update local state
      setUserNotes(prev =>
        prev.map(note =>
          note.id === editingNoteId
            ? { ...note, note: editingNoteText, timestamp: new Date().toISOString() }
            : note
        )
      );

      // Reset editing state
      setEditingNoteId(null);
      setEditingNoteText('');

      // Note updated successfully
    } catch (error) {
      console.error('Error updating note:', error);
    }
  };

  const handleCancelNoteEdit = () => {
    setEditingNoteId(null);
    setEditingNoteText('');
  };

  const handleRemoveNote = async (noteId: string) => {
    try {
      // Remove from storage
      await storage.removeNote(noteId);

      // Remove from local state
      setUserNotes(prev => prev.filter(note => note.id !== noteId));

      // Remove visual indicator
      const noteElement = document.querySelector(`[data-note="${noteId}"]`);
      if (noteElement) {
        const parent = noteElement.parentNode;
        const textContent = noteElement.textContent || '';
        if (parent) {
          const textNode = document.createTextNode(textContent.replace(/[📝✏️🗑️]/g, '').trim());
          parent.replaceChild(textNode, noteElement);
          parent.normalize();
        }
      }

      // Close popup
      setActiveNoteId(null);
      setNotePopoverPosition(null);

      // Note removed successfully
    } catch (error) {
      console.error('Error removing note:', error);
    }
  };

  useEffect(() => {
    const clearSelectionTimeout = () => {
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
        selectionTimeoutRef.current = undefined;
      }
    };

    const clearActionTimeout = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
    };

    const handleSelection = () => {
      // Clear any existing timeout
      clearActionTimeout();
      clearSelectionTimeout();

      // Small delay to ensure selection is complete
      timeoutRef.current = setTimeout(() => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
          const range = sel.getRangeAt(0);
          let selectedText = sel.toString().trim();

          // Enhanced text extraction - handle Prism.js processed code elements
          if (!selectedText && range.cloneContents) {
            const clonedContent = range.cloneContents();
            selectedText = (clonedContent.textContent || '').trim();
          }


          if (selectedText.length > 2 && selectedText.length < 500) {
            const rect = range.getBoundingClientRect();

            // Enhanced context extraction - look for code block or parent container
            let container = range.commonAncestorContainer;
            let contextText = '';

            // Try to find a meaningful container (code block, paragraph, etc.)
            let currentElement = container.nodeType === Node.TEXT_NODE ?
              container.parentElement : container as Element;

            while (currentElement && !contextText) {
              // Check if we're in a code block
              if (currentElement.tagName === 'CODE' ||
                  currentElement.tagName === 'PRE' ||
                  currentElement.classList?.contains('language-')) {
                contextText = currentElement.textContent || '';
                break;
              }
              // Check if we're in a regular content container
              if (currentElement.tagName === 'P' ||
                  currentElement.tagName === 'DIV' ||
                  currentElement.tagName === 'SECTION') {
                contextText = currentElement.textContent || '';
                if (contextText.length > 100) break; // Good enough context
              }
              currentElement = currentElement.parentElement;
            }

            // Fallback to original method if no good container found
            if (!contextText) {
              contextText = container.textContent || '';
            }

            const startIndex = Math.max(0, contextText.indexOf(selectedText) - 50);
            const endIndex = Math.min(contextText.length, contextText.indexOf(selectedText) + selectedText.length + 50);
            const context = contextText.substring(startIndex, endIndex);

            setSelection({
              text: selectedText,
              context: context,
              rect: rect,
            });

            // On mobile, show bottom sheet immediately
            if (isMobile) {
              setShowMobileSheet(true);
            }
          }
        }
      }, 150); // Longer delay for mobile
    };

    // Mouse events for desktop
    const handleMouseUp = handleSelection;

    const handleMouseDown = (e: MouseEvent) => {
      // Don't clear selection if clicking on the toolbar
      if (toolbarRef.current && toolbarRef.current.contains(e.target as Node)) {
        return true;
      }
      
      // Don't clear selection if dialog is open
      if (isDialogOpen) {
        return true;
      }
      
      // Clear selection when clicking elsewhere
      // console.log('Clearing selection - clicked elsewhere');
      clearSelectionTimeout();
      setSelection(null);
      setShowMobileSheet(false);
    };

    // Touch events for mobile
    const handleTouchEnd = () => {
      // Use longer delay for touch events since they're slower
      // Only trigger if this isn't part of an ongoing selection gesture
      setTimeout(() => {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && sel.toString().trim().length > 2) {
          handleSelection();
        }
      }, 500); // Even longer delay for mobile to allow selection gestures to complete
    };

    const handleTouchStart = (e: TouchEvent) => {
      // Don't interfere with selection at all - let native behavior handle it
      const target = e.target as Element;

      // Only clear if touching outside content area and not on our UI
      if (target.closest('[data-mobile-sheet]') ||
          toolbarRef.current?.contains(target) ||
          isDialogOpen) {
        return true;
      }

      // Only clear selection if we're definitely touching empty space
      // (not text that could be part of a new selection)
      const isTextElement = target.tagName === 'P' ||
                           target.tagName === 'SPAN' ||
                           target.tagName === 'DIV' ||
                           target.closest('p, span, div, article, section');

      if (!isTextElement) {
        setTimeout(() => {
          const sel = window.getSelection();
          if (!sel || sel.isCollapsed) {
            clearSelectionTimeout();
            setSelection(null);
            setShowMobileSheet(false);
          }
        }, 200); // Longer delay
      }
    };

    // Selection change event (works on both mobile and desktop)
    const handleSelectionChange = () => {
      setTimeout(() => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
          handleSelection();
        } else if (sel && sel.isCollapsed && !isDialogOpen) {
          // Clear when selection is truly collapsed, even if sheet is open
          setTimeout(() => {
            const currentSel = window.getSelection();
            if (currentSel && currentSel.isCollapsed) {
              clearSelectionTimeout();
              setSelection(null);
              setShowMobileSheet(false);
            }
          }, 500); // Even longer delay to allow for selection extension
        }
      }, 100); // Longer initial delay too
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Clear selection on Escape
      if (e.key === 'Escape' && !isDialogOpen) {
        clearSelectionTimeout();
        setSelection(null);
        setShowMobileSheet(false);
        window.getSelection()?.removeAllRanges();
      }
    };

    // Add all event listeners
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);

    // Only add touch events on desktop to avoid interference on mobile
    if (!isMobile) {
      document.addEventListener('touchend', handleTouchEnd, { passive: true });
      document.addEventListener('touchstart', handleTouchStart, { passive: true });
    }

    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearActionTimeout();
      clearSelectionTimeout();
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);

      // Only remove touch events if they were added
      if (!isMobile) {
        document.removeEventListener('touchend', handleTouchEnd);
        document.removeEventListener('touchstart', handleTouchStart);
      }

      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDialogOpen, isMobile]);

  // Handle dialog focus and cleanup
  useEffect(() => {
    if (isDialogOpen && (feedbackType === 'feedback' || feedbackType === 'note')) {
      // Ensure focus after dialog mount/animation for iOS
      const delay = isMobile ? 250 : 50;
      requestAnimationFrame(() => {
        setTimeout(() => {
          const textarea = feedbackTextareaRef.current || (document.getElementById('feedback') as HTMLTextAreaElement | null);
          if (textarea) {
            textarea.focus();
            try {
              // Place cursor at end to trigger keyboard reliably on mobile
              const len = textarea.value.length;
              textarea.setSelectionRange(len, len);
            } catch {}
          }
        }, delay);
      });
    } else if (!isDialogOpen) {
      // Clear all state when dialog closes
      setSelection(null);
      setFeedback('');
      setSubmitted(false);
      setCategory('content');
      setExplanation('');
      setExplanationError('');
    }
  }, [isDialogOpen, isMobile, feedbackType]);

  const handleAction = (type: 'feedback' | 'highlight' | 'note' | 'explain') => {
    // Close mobile UI when action is taken
    if (isMobile) {
      setShowMobileSheet(false);
    }

    // Important: DO NOT clear selection for highlight; we need it
    if (type !== 'highlight') {
      // Clear text selection to prevent visual interference with dialog
      if (window.getSelection) {
        // Clearing selection for action
        window.getSelection()?.removeAllRanges();
      }
    } else {
      // Highlight action invoked; keeping current selection
    }

    if (type === 'highlight') {
      handleHighlight();
    } else if (type === 'note') {
      setFeedbackType('note');
      setCategory('general');
      setIsDialogOpen(true);
      // Don't clear selection until dialog is closed - keep for note dialog
    } else if (type === 'explain') {
      handleExplain();
    } else {
      setFeedbackType('feedback');
      setCategory('content');
      setIsDialogOpen(true);
      // Don't clear selection until dialog is closed
    }
  };

  const highlightCodeBlockSelection = async (selection: Selection) => {
    const range = selection.getRangeAt(0);
    const selectedText = range.toString().trim();

    console.log('🔍 Code highlight attempt:', selectedText);
    console.log('🔍 Selection range:', {
      startContainer: range.startContainer,
      startOffset: range.startOffset,
      endContainer: range.endContainer,
      endOffset: range.endOffset
    });

    if (selectedText.length === 0) return;

    // Find the specific code block this selection belongs to
    let codeBlock = range.commonAncestorContainer;
    while (codeBlock && codeBlock !== document.body) {
      if (codeBlock.nodeType === Node.ELEMENT_NODE) {
        const el = codeBlock as Element;
        if (el.tagName === 'CODE' && el.id) {
          console.log('📍 Found target code block with ID:', el.id);
          break;
        }
      }
      codeBlock = codeBlock.parentNode as Node;
    }

    // Calculate exact position within the code block for restoration
    const { start: startOffset, end: endOffset } = getSelectionOffsetInCodeBlock(range, codeBlock as Element);
    console.log('🎯 Selection position in code block:', startOffset, 'to', endOffset);

    try {
      // Create group ID for multi-span highlighting
      const groupId = `highlight-new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Use position-based highlighting to ensure exact boundaries
      const success = highlightTextAtPosition(codeBlock as Element, selectedText, startOffset, endOffset);

      if (success) {
        // Show toast immediately for UX responsiveness
        addToast({
          title: 'Highlighted',
          description: 'Saved to your annotations',
          variant: 'success',
          duration: 2000,
        });

        // Save code highlight to storage with position information
        try {
          await storage.addHighlight({
            text: selectedText,
            context: (codeBlock as Element)?.id || '',
            pageUrl: window.location.href,
            pageTitle: document.title,
            isCodeHighlight: true,
            // Store position for more accurate restoration
            textStartIndex: startOffset,
            textEndIndex: endOffset,
            codeBlockId: (codeBlock as Element)?.id
          });
        } catch (err) {
          console.warn('Failed saving code highlight:', err);
        }

        console.log('✅ Position-based code highlight applied successfully');
      } else {
        // Fallback to simple approach if position-based fails
        const span = document.createElement('span');
        span.className = 'bg-yellow-200 dark:bg-yellow-800 cursor-pointer relative';
        span.setAttribute('data-highlight', 'code');
        span.setAttribute('data-original-text', selectedText);
        span.title = 'Click to remove code highlight';
        span.onclick = async (e) => {
          console.log('🔥 CODE HIGHLIGHT CLICKED FOR REMOVAL!');
          e.stopPropagation();
          e.preventDefault();

          const originalText = span.getAttribute('data-original-text') || span.textContent || '';
          const parent = span.parentNode;
          if (parent) {
            console.log('🗑️ Removing code highlight with original text:', originalText);

            // Remove from storage
            try {
              const highlights = await storage.getHighlights(window.location.href);
              const matchingHighlight = highlights.find(h => h.text === originalText && h.isCodeHighlight);
              if (matchingHighlight) {
                await storage.removeHighlight(matchingHighlight.id);
                console.log('💾 Removed code highlight from storage');
              }
            } catch (error) {
              console.error('❌ Failed to remove code highlight from storage:', error);
            }

            // Remove visual highlight
            const textNode = document.createTextNode(span.textContent || '');
            parent.replaceChild(textNode, span);
            parent.normalize();
            console.log('✅ Code highlight removed successfully');
          }
        };

        // Use extractContents + appendChild for complex DOM structure
        const contents = range.extractContents();
        span.appendChild(contents);
        range.insertNode(span);

        // Toast immediately
        addToast({
          title: 'Highlighted',
          description: 'Saved to your annotations',
          variant: 'success',
          duration: 2000,
        });

        // Save to storage
        try {
          await storage.addHighlight({
            text: selectedText,
            context: (codeBlock as Element)?.id || '',
            pageUrl: window.location.href,
            pageTitle: document.title,
            isCodeHighlight: true,
          });
        } catch (err) {
          console.warn('Failed saving fallback code highlight:', err);
        }

        console.log('✅ Fallback code highlight applied successfully');
      }
    } catch (error) {
      console.warn('❌ Could not highlight code selection:', error);
      addToast({
        title: 'Highlight failed',
        description: 'Could not apply highlight to code block',
        variant: 'destructive',
        duration: 3000,
      });
    }
  };

  const getSelectionOffsetInCodeBlock = (range: Range, codeBlock: Element): { start: number; end: number } => {
    const walker = document.createTreeWalker(
      codeBlock,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentOffset = 0;
    let startOffset = -1;
    let endOffset = -1;
    let node;

    while (node = walker.nextNode()) {
      const textNode = node as Text;
      const nodeLength = textNode.textContent?.length || 0;

      // Check if range starts in this node
      if (range.startContainer === textNode) {
        startOffset = currentOffset + range.startOffset;
      }

      // Check if range ends in this node
      if (range.endContainer === textNode) {
        endOffset = currentOffset + range.endOffset;
      }

      currentOffset += nodeLength;

      // If we found both, we can stop
      if (startOffset !== -1 && endOffset !== -1) {
        break;
      }
    }

    return { start: startOffset, end: endOffset };
  };

  const removeHighlight = (highlightElement: HTMLElement) => {
    const textContent = highlightElement.textContent || '';
    const parent = highlightElement.parentNode;
    if (parent) {
      const textNode = document.createTextNode(textContent);
      parent.replaceChild(textNode, highlightElement);
      parent.normalize();
    }
  };

  const removeHighlightGroup = async (groupId: string, clickedElement?: HTMLElement) => {
    console.log(`🗑️ Removing highlight group: ${groupId}`);

    // Find all spans with this group ID
    const groupSpans = document.querySelectorAll(`[data-highlight-group="${groupId}"]`);
    console.log(`🎯 Found ${groupSpans.length} spans in group`);

    if (groupSpans.length === 0) return;

    // Try to get original text from any span in the group that has it
    let originalText = clickedElement?.dataset.originalText;

    // If clicked element doesn't have it, check other spans in the group
    if (!originalText) {
      for (const span of groupSpans) {
        const spanElement = span as HTMLElement;
        if (spanElement.dataset.originalText) {
          originalText = spanElement.dataset.originalText;
          break;
        }
      }
    }

    // If still no original text, reconstruct from all spans
    if (!originalText) {
      originalText = Array.from(groupSpans)
        .map(span => span.textContent || '')
        .join('');
    }

    console.log('Original text for storage removal:', originalText);

    // Remove from storage if we have original text
    if (originalText && storage) {
      try {
        const highlights = await storage.getHighlights(window.location.href);
        const matchingHighlight = highlights.find(h => h.text === originalText && h.isCodeHighlight);
        if (matchingHighlight) {
          await storage.removeHighlight(matchingHighlight.id);
          console.log('💾 Removed code highlight from storage');
        } else {
          console.log('⚠️ Code highlight not found in storage for text:', originalText);
        }
      } catch (error) {
        console.error('❌ Failed to remove code highlight from storage:', error);
      }
    }

    // Collect text content from all spans in order
    const textParts: string[] = [];
    groupSpans.forEach(span => {
      textParts.push(span.textContent || '');
    });

    // Get the parent of the first span to insert the combined text
    const firstSpan = groupSpans[0] as HTMLElement;
    const parent = firstSpan.parentNode;
    if (!parent) return;

    // Create a single text node with all the text and replace the entire group range safely
    const combinedText = textParts.join('');

    try {
      const textNode = document.createTextNode(combinedText);
      if (firstSpan.parentNode) {
        firstSpan.parentNode.insertBefore(textNode, firstSpan);
      }
    } catch (e) {
      console.warn('Failed to reinsert combined text for highlight removal:', e);
    }

    // Remove all highlight spans in the group safely
    groupSpans.forEach(span => {
      const parentNode = span.parentNode;
      if (parentNode && parentNode.contains(span)) {
        try {
          parentNode.removeChild(span);
        } catch (e) {
          // Ignore concurrent DOM changes
        }
      }
    });

    // Normalize the parent to merge adjacent text nodes
    parent.normalize();

    console.log(`✅ Removed highlight group: ${groupId}`);
  };

  const handleHighlight = async () => {
    // Starting highlight operation
    if (!selection) {
      // Aborted: no selection state
      return;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      // Aborted: window.getSelection() empty
      return;
    }

    // Selected text for highlighting

    if (isSelectionInCodeBlock(sel)) {
      // Selection detected inside code block
      await highlightCodeBlockSelection(sel);
    } else {
      // Handle regular text highlighting with robust fallback
      const range = sel.getRangeAt(0);
      // Processing regular text range

      try {
        // Create the highlight span and a reusable click handler
        const createHighlightSpan = () => {
          const span = document.createElement('span');
          span.className = 'bg-yellow-100 dark:bg-yellow-900/30 cursor-pointer hover:bg-yellow-200 dark:hover:bg-yellow-800/50 transition-colors inline';
          span.setAttribute('data-highlight', 'true');
          span.title = 'Click to remove highlight';
          span.onclick = async (e) => {
            console.log('🔥 HIGHLIGHT CLICKED FOR REMOVAL!');
            e.stopPropagation();
            e.preventDefault();
            const textContent = span.textContent || '';
            const parent = span.parentNode;
            if (parent) {
              console.log('🗑️ Removing highlight with text:', textContent);
              try {
                const highlights = await storage.getHighlights(window.location.href);
                const matchingHighlight = highlights.find(h => h.text === textContent && !h.isCodeHighlight);
                if (matchingHighlight) {
                  await storage.removeHighlight(matchingHighlight.id);
                }
              } catch (_) {}
              const textNode = document.createTextNode(textContent);
              parent.replaceChild(textNode, span);
              parent.normalize();
            }
          };
          return span;
        };

        let applied = false;
        let parentToNormalize: Node | null = null;

        try {
          // Preferred simple approach
          const span = createHighlightSpan();
          parentToNormalize = range.commonAncestorContainer.parentNode;
          range.surroundContents(span);
          applied = true;
          // surroundContents success
        } catch (err) {
          // Fallback: extract contents and wrap (works across fragmented nodes)
          const span = createHighlightSpan();
          parentToNormalize = range.commonAncestorContainer.parentNode;
          const contents = range.extractContents();
          span.appendChild(contents);
          range.insertNode(span);
          applied = true;
          // Fallback extractContents+insertNode applied
        }

        // Normalize the parent to prevent layout issues
        if (applied && parentToNormalize && parentToNormalize.nodeType === Node.ELEMENT_NODE) {
          try {
            parentToNormalize.normalize();
          } catch (e) {
            // Ignore normalization errors
          }
        }

        if (applied) {
          // Toast immediately for responsiveness
          addToast({
            title: 'Highlighted',
            description: 'Saved to your annotations',
            variant: 'success',
            duration: 2000,
          });

          // Save to storage (non-blocking UX)
          try {
            await storage.addHighlight({
              text: selection.text,
              context: selection.context,
              pageUrl: window.location.href,
              pageTitle: document.title,
              isCodeHighlight: false,
            });

            // Trigger content engagement notification (async, don't block)
            if (user && !user.isAnonymous) {
              import('@/lib/notification-service').then(({ NotificationService }) => {
                NotificationService.notifyContentEngagement({
                  userId: user.uid,
                  userEmail: user.email || undefined,
                  userName: user.displayName || undefined,
                  engagementType: 'highlight',
                  pageUrl: window.location.href,
                  textSnippet: selection.text.substring(0, 100),
                }).catch((err: any) => console.error('Error sending highlight notification:', err));
              });
            }
          } catch (err) {
            console.warn('Failed saving text highlight:', err);
          }
        }

        console.log('✅ Simple text highlight applied');
      } catch (error) {
        console.error('❌ Error applying text highlight:', error);
        addToast({
          title: 'Highlight failed',
          description: 'Could not apply highlight to selection',
          variant: 'destructive',
          duration: 3000,
        });
      }
    }

    // Clear selection after operation with small delay to let DOM settle
    setTimeout(() => {
      try {
        sel.removeAllRanges();
      } catch (_) {}
      setSelection(null);
      setShowMobileSheet(false);
    }, 50);
  };

  const handleRemoveHighlight = async (highlightId: string, highlightElement: HTMLElement) => {
    try {
      await storage.removeHighlight(highlightId);

      const textContent = highlightElement.textContent || '';
      const parent = highlightElement.parentNode;
      if (parent) {
        const textNode = document.createTextNode(textContent);
        parent.replaceChild(textNode, highlightElement);
        parent.normalize();
      }
    } catch (error) {
      console.error('Error removing highlight:', error);
    }
  };

  const handleExplain = async () => {
    if (!selection) return;

    setFeedbackType('explain');
    setIsExplaining(true);
    setExplanationError('');
    setExplanation('');
    setIsDialogOpen(true);
    window.getSelection()?.removeAllRanges();

    try {
      const response = await fetch('/api/openai/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selectedText: selection.text,
          context: selection.context,
          pageUrl: window.location.href,
          pageTitle: document.title,
          pageContent: pageContent, // Include full page content
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate explanation');
      }

      // Read the stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode the chunk and add to accumulated text
        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;

        // Update the explanation as it streams in
        setExplanation(accumulatedText);
      }

      setIsExplaining(false);

      // Trigger AI interaction notification (async, don't block)
      if (user && !user.isAnonymous) {
        import('@/lib/notification-service').then(({ NotificationService }) => {
          NotificationService.notifyAIInteraction({
            userId: user.uid,
            userEmail: user.email || undefined,
            userName: user.displayName || undefined,
            interactionType: 'explain',
            pageUrl: window.location.href,
            queryText: selection.text,
          }).catch((err: any) => console.error('Error sending AI explain notification:', err));
        });
      }
    } catch (error) {
      console.error('Error getting explanation:', error);
      setExplanationError(error instanceof Error ? error.message : 'Failed to generate explanation');
      setIsExplaining(false);
    }
  };

  const handleCopyExplanation = () => {
    navigator.clipboard.writeText(explanation);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim() || !selection || isSubmitting) return;

    // Dismiss keyboard on mobile
    if (isMobile) {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement?.tagName === 'TEXTAREA') {
        activeElement.blur();
      }
    }

    setIsSubmitting(true);
    try {
      if (feedbackType === 'note') {
        // Save note using unified storage
        await storage.addNote({
          text: selection.text,
          note: feedback,
          pageUrl: window.location.href,
          pageTitle: document.title,
        });

        // Add to local state and apply indicator
        const noteId = `note-${Date.now()}`;
        const note: StoredNote = {
          id: noteId,
          text: selection.text,
          note: feedback,
          pageUrl: window.location.href,
          timestamp: new Date().toISOString(),
        };

        addNoteIndicator(note);
        setUserNotes([...userNotes, note]);

        // Trigger content engagement notification (async, don't block)
        if (user && !user.isAnonymous) {
          import('@/lib/notification-service').then(({ NotificationService }) => {
            NotificationService.notifyContentEngagement({
              userId: user.uid,
              userEmail: user.email || undefined,
              userName: user.displayName || undefined,
              engagementType: 'note',
              pageUrl: window.location.href,
              textSnippet: feedback.substring(0, 100),
            }).catch((err: any) => console.error('Error sending note notification:', err));
          });
        }
      } else {
        // Send feedback to Firebase for admins
        await submitFeedback({
          category,
          feedback,
          userId: user?.uid || null,
          userEmail: user?.email || null,
          userName: user?.displayName || null,
          userPhotoURL: user?.photoURL || null,
          isAnonymous: user?.isAnonymous ?? true,
          timestamp: new Date(),
          url: window.location.href,
          userAgent: navigator.userAgent,
          metadata: {
            selectionType: feedbackType === 'explain' ? 'feedback' : feedbackType,
            selectedText: selection.text,
            textContext: selection.context,
            pageTitle: document.title,
          },
        });
      }
      
      // Show lightweight toast and close dialog immediately (better mobile UX)
      addToast({
        title: feedbackType === 'note' ? 'Note saved' : 'Thank you!',
        description: feedbackType === 'note' ? 'Your note has been attached to this text.' : 'Your feedback has been sent to our team.',
        variant: 'success',
        duration: 3500,
      });

      setIsDialogOpen(false);
      setSubmitted(false);
      setFeedback('');
      setSelection(null);
      setShowMobileSheet(false);
    } catch (error) {
      console.error('Failed to submit:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getToolbarPosition = () => {
    if (!selection) return {};

    // Position toolbar above the selection (rect is already in viewport coordinates for fixed positioning)
    return {
      position: 'fixed' as const,
      top: `${selection.rect.top - 48}px`,
      left: `${selection.rect.left + (selection.rect.width / 2) - 85}px`,
      zIndex: 9999,
      WebkitUserSelect: 'none' as const,
      userSelect: 'none' as const,
      WebkitTouchCallout: 'none' as const,
    };
  };

  const activeNote = userNotes.find(n => n.id === activeNoteId);

  return (
    <TooltipProvider delayDuration={0}>
      {/* Desktop Selection Toolbar - Medium-style floating buttons */}
      {selection && !isDialogOpen && !isMobile && (
        <div
          ref={toolbarRef}
          style={getToolbarPosition()}
          className="bg-neutral-900 dark:bg-neutral-800 rounded-full shadow-xl flex items-center p-1 gap-0.5 animate-in fade-in-0 zoom-in-95 duration-200"
          onTouchStart={(e) => e.preventDefault()}
          onTouchEnd={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleAction('highlight')}
                className="h-8 w-8 p-0 rounded-full hover:bg-yellow-500/20 text-white hover:text-yellow-300"
              >
                <Highlighter className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Highlight</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleAction('note')}
                className="h-8 w-8 p-0 rounded-full hover:bg-blue-500/20 text-white hover:text-blue-300"
              >
                <StickyNote className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Add Note</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleAction('explain')}
                className="h-8 w-8 p-0 rounded-full hover:bg-purple-500/20 text-white hover:text-purple-300"
              >
                <Sparkles className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Explain with AI</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleAction('feedback')}
                className="h-8 w-8 p-0 rounded-full hover:bg-green-500/20 text-white hover:text-green-300"
              >
                <MessageSquare className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Send Feedback</p>
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Mobile Bottom Sheet */}
      {showMobileSheet && selection && (
        <>
          {/* Bottom Sheet - no backdrop to allow selection extension */}
          <div
            data-mobile-sheet
            className="fixed bottom-0 left-0 right-0 z-[9999] bg-white dark:bg-neutral-900 rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom duration-300 pointer-events-auto"
            style={{ maxHeight: '40vh' }}
          >
            {/* Header with close button */}
            <div className="flex justify-between items-center pt-3 pb-2 px-4">
              <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Tools</h3>
              <button
                onClick={() => setShowMobileSheet(false)}
                className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
              </button>
            </div>

            {/* Selected text preview */}
            <div className="px-4 pb-4">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Selected text</p>
              <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 max-h-24 overflow-y-auto bg-neutral-50 dark:bg-neutral-800 rounded p-3 border">
                "{selection.text}"
              </div>
            </div>

            {/* Actions grid */}
            <div className="grid grid-cols-4 gap-2 px-4 py-3 border-t border-neutral-200 dark:border-neutral-800">
              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAction('highlight');
                }}
                className="flex flex-col items-center justify-center p-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors active:bg-neutral-200 dark:active:bg-neutral-700"
              >
                <Highlighter className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mb-1" />
                <span className="text-xs text-neutral-700 dark:text-neutral-300">Highlight</span>
              </button>

              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAction('note');
                }}
                className="flex flex-col items-center justify-center p-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors active:bg-neutral-200 dark:active:bg-neutral-700"
              >
                <StickyNote className="w-4 h-4 text-blue-600 dark:text-blue-400 mb-1" />
                <span className="text-xs text-neutral-700 dark:text-neutral-300">Note</span>
              </button>

              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAction('explain');
                }}
                className="flex flex-col items-center justify-center p-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors active:bg-neutral-200 dark:active:bg-neutral-700"
              >
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 mb-1" />
                <span className="text-xs text-neutral-700 dark:text-neutral-300">Explain</span>
              </button>

              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAction('feedback');
                }}
                className="flex flex-col items-center justify-center p-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors active:bg-neutral-200 dark:active:bg-neutral-700"
              >
                <MessageSquare className="w-4 h-4 text-green-600 dark:text-green-400 mb-1" />
                <span className="text-xs text-neutral-700 dark:text-neutral-300">Feedback</span>
              </button>
            </div>


            {/* Safe area for iOS */}
            <div className="h-safe pb-2" />
          </div>
        </>
      )}

      {/* Note Popup - Shows when clicking a note indicator */}
      {activeNote && (notePopoverPosition || isMobile) && (
        <>
          {/* Backdrop to close popover */}
          <div
            className="fixed inset-0 z-[9999]"
            onClick={() => {
              setActiveNoteId(null);
              setNotePopoverPosition(null);
            }}
          />
          {/* Popover positioned near the note indicator */}
          <div className="fixed z-[10000] bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl p-4 max-w-xs sm:max-w-sm animate-in fade-in-0 zoom-in-95 duration-200"
               style={isMobile ? {
                 left: '16px',
                 right: '16px',
                 bottom: '16px',
                 top: 'auto',
                 transform: 'none'
               } : {
                 top: `${notePopoverPosition!.y - 8}px`,
                 left: `${Math.max(16, Math.min((notePopoverPosition!.x - 150), window.innerWidth - 320))}px`,
                 transform: 'translateY(-100%)'
               }}>
            {/* Arrow - hide on mobile */}
            {!isMobile && (
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white dark:border-t-neutral-950 drop-shadow-md"></div>
            )}
          <div className="flex items-start justify-between mb-2">
            <h4 className="font-medium text-sm sm:text-base">Your Note</h4>
            <button
              onClick={() => {
                setActiveNoteId(null);
                setNotePopoverPosition(null);
              }}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
          <p className="text-sm sm:text-[0.95rem] text-neutral-600 dark:text-neutral-400 mb-2">
            "{activeNote.text}"
          </p>
          <p className="text-sm sm:text-[0.95rem] mb-3 leading-relaxed">{activeNote.note}</p>
          <div className="flex items-center justify-between">
            <p className="text-xs sm:text-[0.8rem] text-neutral-400">
              {new Date(activeNote.timestamp).toLocaleDateString()}
            </p>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleEditNote(activeNote)}
                className="p-2 rounded-md text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                title="Edit note"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleRemoveNote(activeNote.id)}
                className="p-2 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Delete note"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          </div>
        </>
      )}

      {/* Note Editing Interface */}
      {editingNoteId && (
        <div className="fixed z-[10000] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg p-4 max-w-md"
             style={{
               top: '50%',
               left: '50%',
               transform: 'translate(-50%, -50%)'
             }}>
          <div className="flex items-start justify-between mb-3">
            <h4 className="font-medium text-sm">Edit Note</h4>
            <button
              onClick={handleCancelNoteEdit}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <Textarea
            value={editingNoteText}
            onChange={(e) => setEditingNoteText(e.target.value)}
            placeholder="Update your note..."
            className="min-h-[80px] mb-3"
            autoFocus
          />
          <div className="flex items-center justify-end space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelNoteEdit}
            >
              <XCircle className="w-4 h-4 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveNoteEdit}
              disabled={!editingNoteText.trim()}
            >
              <Save className="w-4 h-4 mr-1" />
              Save
            </Button>
          </div>
        </div>
      )}

      {/* Feedback/Note Dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsDialogOpen(false);
            setFeedback('');
            setSubmitted(false);
            // DON'T clear explanation here - it might be needed for AIChat
            // Only clear when explicitly closing via Close button or after AIChat closes
            // Clear selection when dialog closes
            window.getSelection()?.removeAllRanges();
            setSelection(null);
            setShowMobileSheet(false);
          }
        }}
      >
        <DialogContent className={`
          ${feedbackType === 'explain' ? "sm:max-w-2xl" : "sm:max-w-md"}
          ${isMobile ? "h-[90vh] max-h-[90vh] flex flex-col [&>button]:hidden" : ""}
        `}>
          {/* Enhanced mobile close button */}
          {isMobile && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-3 top-3 h-8 w-8 p-0 rounded-full z-10 hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => {
                // Dismiss keyboard on mobile
                const activeElement = document.activeElement as HTMLElement;
                if (activeElement?.tagName === 'TEXTAREA') {
                  activeElement.blur();
                }
                setIsDialogOpen(false);
              }}
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </Button>
          )}
          {submitted ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                {feedbackType === 'note' ? (
                  <StickyNote className="w-8 h-8 text-green-600 dark:text-green-400" />
                ) : (
                  <MessageSquare className="w-8 h-8 text-green-600 dark:text-green-400" />
                )}
              </div>
              <DialogTitle className="text-center mb-2">
                {feedbackType === 'note' ? 'Note Saved!' : 'Thank you!'}
              </DialogTitle>
              <p className="text-muted-foreground">
                {feedbackType === 'note' ? 
                  'Your note has been saved and attached to this text.' : 
                  'Your feedback has been sent to our team.'}
              </p>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>
                  {feedbackType === 'feedback' ? 'Send Feedback' :
                   feedbackType === 'note' ? 'Add Note' :
                   'AI Explanation'}
                </DialogTitle>
                <DialogDescription>
                  {feedbackType === 'feedback' ? 'Help us improve by sharing your thoughts on this content.' :
                   feedbackType === 'note' ? 'Add a personal note that will be saved with this text selection.' :
                   'Get an AI-powered explanation of the selected text.'}
                </DialogDescription>
              </DialogHeader>
              
              {/* Selected Text Preview */}
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Selected text:</p>
                <p className="text-sm font-medium line-clamp-3">"{selection?.text}"</p>
              </div>
              
              {/* Explanation Content */}
              {feedbackType === 'explain' && (
                <div className="space-y-4">
                  {explanationError && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <div className="flex items-start space-x-2">
                        <X className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-red-800 dark:text-red-200">
                            Failed to generate explanation
                          </h4>
                          <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                            {explanationError}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {(explanation || isExplaining) && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                          <h4 className="font-medium text-purple-800 dark:text-purple-200">
                            AI Explanation
                          </h4>
                        </div>
                        {explanation && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCopyExplanation}
                            className="h-8 px-2 text-purple-600 hover:text-purple-700 dark:text-purple-400"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="prose prose-sm max-w-none text-purple-900 dark:text-purple-100">
                        {explanation === '' && isExplaining ? (
                          // Show thinking animation while waiting for first token
                          <div className="flex items-center gap-1 py-2">
                            <span className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        ) : (
                          <div className="leading-relaxed">
                            <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2">
                              <ReactMarkdown
                                components={{
                                  // Style code blocks
                                  code: ({ node, className, children, ...props }: any) => {
                                    const inline = !className;
                                    return inline ? (
                                      <code className="bg-purple-100 dark:bg-purple-900/30 px-1 py-0.5 rounded text-xs" {...props}>
                                        {children}
                                      </code>
                                    ) : (
                                      <code className="block bg-purple-100 dark:bg-purple-900/30 p-2 rounded text-xs overflow-x-auto" {...props}>
                                        {children}
                                      </code>
                                    );
                                  },
                                  // Style links
                                  a: ({ node, className, ...props }: any) => (
                                    <a className="text-purple-600 dark:text-purple-400 hover:underline" {...props} />
                                  ),
                                }}
                              >
                                {explanation}
                              </ReactMarkdown>
                            </div>
                            {isExplaining && explanation !== '' && (
                              <span className="inline-block w-2 h-4 ml-1 bg-purple-600 dark:bg-purple-400 animate-pulse" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsDialogOpen(false);
                        setExplanation('');
                        setExplanationError('');
                      }}
                    >
                      Close
                    </Button>
                    {explanation && (
                      <Button
                        onClick={() => {
                          console.log('🚀 Continue in Chat clicked - explanation length:', explanation.length);
                          // Capture the explanation in a ref so it survives re-renders
                          chatInitialMessageRef.current = explanation;
                          setShowAIChat(true);
                          setIsDialogOpen(false);
                          console.log('🚀 Saved to ref:', chatInitialMessageRef.current?.substring(0, 50));
                        }}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Continue in Chat
                      </Button>
                    )}
                  </div>
                </div>
              )}
              
              {/* Form for feedback and notes */}
              {(feedbackType === 'feedback' || feedbackType === 'note') && (
                <form onSubmit={handleSubmit} className="space-y-4">
                {feedbackType === 'feedback' && (
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={category} onValueChange={(value: FirebaseFeedback['category']) => setCategory(value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bug">Bug Report</SelectItem>
                        <SelectItem value="feature">Feature Request</SelectItem>
                        <SelectItem value="content">Content Issue</SelectItem>
                        <SelectItem value="ui">UI/UX Feedback</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="feedback">
                    {feedbackType === 'note' ? 'Your note' : 'Your feedback'}
                  </Label>
                  <Textarea
                    id="feedback"
                    ref={feedbackTextareaRef}
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder={feedbackType === 'note' ?
                      "Add a note for your future reference..." :
                      "What would you like to tell us about this content?"}
                    className={`${isMobile ? "min-h-[120px] text-base" : "min-h-[100px]"}`}
                    autoFocus={!isMobile}
                    onFocus={(e) => {
                      // On mobile, ensure the textarea is properly focused and selection is visible
                      if (isMobile) {
                        e.target.setSelectionRange(e.target.value.length, e.target.value.length);
                      }
                    }}
                    onBlur={() => {
                      // On mobile, blur the input to dismiss keyboard when user taps outside
                      if (isMobile && document.activeElement?.tagName === 'TEXTAREA') {
                        (document.activeElement as HTMLElement).blur();
                      }
                    }}
                    onKeyDown={(e) => {
                      // Escape key dismisses keyboard on mobile
                      if (e.key === 'Escape' && isMobile) {
                        (e.target as HTMLElement).blur();
                      }
                    }}
                  />
                </div>

                <DialogFooter className={`gap-2 ${isMobile ? "flex-col space-y-2" : ""}`}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      // Dismiss keyboard on mobile
                      if (isMobile) {
                        const activeElement = document.activeElement as HTMLElement;
                        if (activeElement?.tagName === 'TEXTAREA') {
                          activeElement.blur();
                        }
                      }
                      setIsDialogOpen(false);
                      setFeedback('');
                    }}
                    className={isMobile ? "w-full" : ""}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!feedback.trim() || isSubmitting}
                    className={isMobile ? "w-full" : ""}
                  >
                    {isSubmitting ? 'Saving...' : feedbackType === 'note' ? 'Save note' : 'Submit feedback'}
                  </Button>
                </DialogFooter>
              </form>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* AI Chat Panel */}
      <AIChat
        isOpen={showAIChat}
        onClose={() => {
          setShowAIChat(false);
          // Clear both state and ref after chat closes
          setExplanation('');
          setExplanationError('');
          chatInitialMessageRef.current = undefined;
        }}
        initialMessage={chatInitialMessageRef.current}
        selectedText={selection?.text}
        pageUrl={typeof window !== 'undefined' ? window.location.href : ''}
        pageTitle={typeof window !== 'undefined' ? document.title : ''}
        pageContent={pageContent}
      />
    </TooltipProvider>
  );
}
