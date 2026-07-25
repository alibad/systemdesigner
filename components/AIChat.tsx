'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, X, Loader2, Sparkles, ChevronDown, Minimize2, Maximize2, RotateCcw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import ReactMarkdown from 'react-markdown';
import {
  saveConversation,
  updateConversation,
  getPageConversation,
  resetConversation,
  isFirebaseConfigured,
} from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatProps {
  isOpen: boolean;
  onClose: () => void;
  onMinimize?: () => void;
  initialMessage?: string;
  selectedText?: string;
  pageUrl: string;
  pageTitle: string;
  pageContent?: string;
}

export default function AIChat({
  isOpen,
  onClose,
  onMinimize,
  initialMessage,
  selectedText,
  pageUrl,
  pageTitle,
  pageContent,
}: AIChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasNotifiedSession, setHasNotifiedSession] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
      const isMobileUA = mobileRegex.test(navigator.userAgent);
      const isIPad = (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
                     navigator.userAgent.includes('iPad');
      const isMobileDevice =
        isMobileUA ||
        isIPad ||
        window.innerWidth < 640 ||
        (hasTouch && window.innerWidth < 1024);
      setIsMobile(isMobileDevice);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load or create conversation when chat opens
  useEffect(() => {
    if (isOpen && !hasInitialized) {
      const initializeConversation = async () => {
        setIsInitializing(true);
        if (!isFirebaseConfigured) {
          setConversationId(null);
          setMessages(
            initialMessage
              ? [{ role: 'assistant', content: initialMessage }]
              : []
          );
          setInput('');
          setIsLoading(false);
          setHasInitialized(true);
          setIsInitializing(false);
          return;
        }
        try {
          console.log('🔄 Initializing chat with initialMessage:', initialMessage?.substring(0, 50));

          // Try to load existing active conversation for this page
          const existingConversation = await getPageConversation(pageUrl);

          if (existingConversation) {
            // Load the active conversation
            setConversationId(existingConversation.id || null);
            const loadedMessages = existingConversation.messages.map(msg => ({
              role: msg.role,
              content: msg.content,
            }));

            // If there's a new initialMessage (from explain), append it
            if (initialMessage && !loadedMessages.some(m => m.content === initialMessage)) {
              console.log('➕ Appending new explanation to existing conversation');
              loadedMessages.push({ role: 'assistant', content: initialMessage });
            }

            setMessages(loadedMessages);
            console.log('📖 Loaded existing conversation with', loadedMessages.length, 'messages');
          } else {
            // Start fresh conversation
            setConversationId(null);

            // Add initial message if provided
            if (initialMessage) {
              console.log('🆕 Starting new conversation with explanation');
              setMessages([{ role: 'assistant', content: initialMessage }]);
            } else {
              console.log('🆕 Starting empty conversation');
              setMessages([]);
            }
          }

          setInput('');
          setIsLoading(false);
          setHasInitialized(true);
          setIsInitializing(false);
        } catch (error) {
          console.error('❌ Error loading conversation:', error);
          // Fallback to fresh start
          setMessages(initialMessage ? [{ role: 'assistant', content: initialMessage }] : []);
          setHasInitialized(true);
          setIsInitializing(false);
        }
      };

      initializeConversation();
    } else if (!isOpen) {
      // Reset initialization flag when closing so it re-runs on next open
      setHasInitialized(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, hasInitialized, pageUrl, initialMessage]);

  // Save conversation when messages change (but NOT immediately after loading)
  const previousMessagesRef = useRef<Message[]>([]);

  useEffect(() => {
    // Don't save during initialization or if messages haven't actually changed
    const messagesChanged = previousMessagesRef.current.length !== messages.length ||
                          previousMessagesRef.current.some((msg, i) => msg.content !== messages[i]?.content);

    if (
      isFirebaseConfigured &&
      messages.length > 0 &&
      hasInitialized &&
      !isInitializing &&
      messagesChanged
    ) {
      const saveConversationAsync = async () => {
        try {
          // Build conversation data, filtering out undefined values (Firestore doesn't allow them)
          const conversationData: any = {
            pageUrl,
            pageTitle,
            messages: messages.map(msg => ({
              role: msg.role,
              content: msg.content,
              timestamp: new Date(),
            })),
            isActive: true,
            userId: '', // Will be set by saveConversation
          };

          // Only include selectedText if it's defined
          if (selectedText !== undefined) {
            conversationData.selectedText = selectedText;
          }

          if (conversationId) {
            // Update existing conversation
            await updateConversation(conversationId, conversationData);
            console.log('💾 Saved conversation update');
          } else {
            // Create new conversation
            const newId = await saveConversation(conversationData);
            setConversationId(newId);
            console.log('💾 Created new conversation:', newId);
          }

          // Update ref to prevent re-saving the same messages
          previousMessagesRef.current = messages;
        } catch (error) {
          console.error('❌ Error saving conversation:', error);
          // If permission error, might be auth issue - the save functions will handle re-auth
        }
      };

      // Debounce saves (wait 1 second after last message)
      const timeoutId = setTimeout(saveConversationAsync, 1000);
      return () => clearTimeout(timeoutId);
    } else if (hasInitialized && !isInitializing) {
      // Update ref when initialization completes to prevent first save
      previousMessagesRef.current = messages;
    }
  }, [messages, conversationId, pageUrl, pageTitle, selectedText, hasInitialized, isInitializing]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-focus textarea when chat opens (desktop only)
  useEffect(() => {
    if (isOpen && !isMobile) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen, isMobile]);

  const sendMessage = async (prompt?: string) => {
    const nextInput = prompt ?? input;
    if (!nextInput.trim() || isLoading) return;

    const userMessage = nextInput.trim();
    setInput('');

    // Add user message to chat
    const newMessages: Message[] = [
      ...messages,
      { role: 'user', content: userMessage }
    ];

    // Immediately show the user message and typing indicator
    const streamingMessageIndex = newMessages.length;
    setMessages([...newMessages, { role: 'assistant', content: '' }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/openai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newMessages,
          pageUrl,
          pageTitle,
          pageContent,
          selectedText,
        }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(
          response.status === 503
            ? 'AI assistance is not configured in this environment.'
            : result?.error || 'The AI assistant could not respond. Please try again.'
        );
      }

      // Read the stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode the chunk and add to accumulated content
        const chunk = decoder.decode(value, { stream: true });
        accumulatedContent += chunk;

        // Update the streaming message
        setMessages(prev => {
          const updated = [...prev];
          updated[streamingMessageIndex] = {
            role: 'assistant',
            content: accumulatedContent
          };
          return updated;
        });
      }

      setIsLoading(false);

      // Trigger AI chat notification on first message (async, don't block)
      if (!hasNotifiedSession && user && !user.isAnonymous) {
        setHasNotifiedSession(true);
        import('@/lib/notification-service').then(({ NotificationService }) => {
          NotificationService.notifyAIInteraction({
            userId: user.uid,
            userEmail: user.email || undefined,
            userName: user.displayName || undefined,
            interactionType: 'chat',
            pageUrl: pageUrl,
            queryText: userMessage,
          }).catch((err: any) => console.error('Error sending AI chat notification:', err));
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => {
        const updated = [...prev];
        updated[streamingMessageIndex] = {
          role: 'assistant',
          content:
            error instanceof Error
              ? error.message
              : 'The AI assistant could not respond. Please try again.'
        };
        return updated;
      });
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleClose = () => {
    // Just close the dialog - keep conversation active for next time
    onClose();
  };

  const handleReset = async () => {
    // Clear UI immediately first
    setMessages([]);
    setInput('');
    setConversationId(null);
    setHasInitialized(false);
    console.log('🔄 Chat cleared');

    // Archive in background (don't block UI)
    if (isFirebaseConfigured && messages.length > 0) {
      resetConversation(pageUrl)
        .then(() => console.log('✅ Archived to history'))
        .catch((e) => console.error('⚠️ Archive failed (non-critical):', e));
    }
  };

  const handleMinimize = () => {
    if (onMinimize) {
      onMinimize();
    }
  };

  const handleExportPDF = () => {
    if (messages.length === 0) {
      alert('No conversation to export');
      return;
    }

    // Create a simple text representation
    let content = `Conversation: ${pageTitle}\n`;
    content += `Date: ${new Date().toLocaleString()}\n`;
    content += `URL: ${pageUrl}\n\n`;
    content += '='.repeat(60) + '\n\n';

    messages.forEach((msg, idx) => {
      const role = msg.role === 'user' ? 'You' : 'AI Assistant';
      content += `${role}:\n${msg.content}\n\n`;
      if (idx < messages.length - 1) {
        content += '-'.repeat(60) + '\n\n';
      }
    });

    // Create blob and download
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const starterPrompts = selectedText
    ? [
        'Explain this selection in plain language.',
        'Give me a concrete example of this idea.',
        'What trade-off should I notice here?',
      ]
    : [
        'Explain the core idea in plain language.',
        'Show me a concrete system design example.',
        'Quiz me on the important decisions from this page.',
      ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[9998] animate-in fade-in duration-200"
        onClick={handleClose}
      />

      {/* Chat Panel - Full screen on mobile, expandable on desktop */}
      <div
        className={`
          fixed z-[9999] bg-white dark:bg-neutral-900 shadow-2xl
          flex flex-col
          ${isMobile
            ? 'inset-0 rounded-none'
            : isExpanded
              ? 'inset-4 rounded-2xl'
              : 'top-0 right-0 bottom-0 w-full max-w-md rounded-l-2xl'
          }
          animate-in slide-in-from-right duration-300 transition-all
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full flex-shrink-0">
              <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-neutral-900 dark:text-white">Learn with AI</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{pageTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <>
                <button
                  onClick={handleExportPDF}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
                  title="Export conversation"
                  aria-label="Export conversation"
                >
                  <Download className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                </button>
                <button
                  onClick={handleReset}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
                  title="Start new conversation"
                  aria-label="Start new conversation"
                >
                  <RotateCcw className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                </button>
              </>
            )}
            {!isMobile && onMinimize && (
              <button
                onClick={handleMinimize}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
                title="Minimize"
                aria-label="Minimize AI chat"
              >
                <Minimize2 className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
              </button>
            )}
            {!isMobile && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
                title={isExpanded ? "Collapse" : "Expand"}
                aria-label={isExpanded ? 'Collapse AI chat' : 'Expand AI chat'}
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                ) : (
                  <Maximize2 className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                )}
              </button>
            )}
            <button
              onClick={handleClose}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
              title="Close"
              aria-label="Close AI chat"
            >
              <X className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <div className="p-4 bg-purple-100 dark:bg-purple-900/30 rounded-full mb-4">
                <Sparkles className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h4 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
                {selectedText ? 'Ask about your selection' : 'Ask about this page'}
              </h4>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm">
                I use the current lesson as context, so you can ask for an explanation, example, or practice question.
              </p>
              {selectedText && (
                <blockquote className="mt-4 max-w-sm border-l-2 border-indigo-400 pl-3 text-left text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                  {selectedText.length > 240
                    ? `${selectedText.slice(0, 240)}...`
                    : selectedText}
                </blockquote>
              )}
              <div className="mt-5 grid w-full max-w-sm gap-2">
                {starterPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendMessage(prompt)}
                    className="min-h-11 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-left text-sm text-neutral-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/30"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`
                  max-w-[85%] rounded-2xl px-4 py-3
                  ${message.role === 'user'
                    ? 'bg-purple-600 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white'
                  }
                `}
              >
                {message.role === 'assistant' && message.content === '' && isLoading && index === messages.length - 1 ? (
                  // Show thinking animation while waiting for first token
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                ) : (
                  <div className="text-sm leading-relaxed">
                    {message.role === 'assistant' ? (
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
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                    {/* Show cursor animation if this is the latest message and we're loading */}
                    {message.role === 'assistant' && isLoading && index === messages.length - 1 && message.content !== '' && (
                      <span className="inline-block w-2 h-4 ml-1 bg-purple-600 dark:bg-purple-400 animate-pulse" />
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a follow-up question..."
              className={`flex-1 min-h-[44px] max-h-32 resize-none ${isMobile ? 'text-base' : ''}`}
              disabled={isLoading}
            />
            <Button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="h-11 w-11 bg-purple-600 hover:bg-purple-700 text-white rounded-xl"
              aria-label="Send message"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>

        {/* Safe area for iOS */}
        {isMobile && <div className="h-safe pb-2" />}
      </div>
    </>
  );
}
