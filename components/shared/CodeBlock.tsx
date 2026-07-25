'use client';

import { ReactNode, useEffect, useRef, useState, useMemo } from 'react';

// Import Prism.js and languages
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-lua';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-docker';
import 'prismjs/components/prism-nginx';
import 'prismjs/components/prism-csharp';

interface CodeBlockProps {
  readonly children?: ReactNode;
  readonly language?: string;
  readonly className?: string;
  readonly title?: string;
  readonly file?: string; // Path to external code file relative to the page's code directory
  readonly static?: boolean; // Whether to treat content as static HTML (for better highlighting persistence)
  readonly ssrContent?: string; // Pre-loaded content from server-side rendering
}

export function CodeBlock({ children, language, className = '', title, file, static: isStatic, ssrContent }: CodeBlockProps) {
  const codeRef = useRef<HTMLElement>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  // Determine what content to display (prioritize SSR content)
  const displayContent = ssrContent || (file ? fileContent : children);

  // Generate deterministic ID based on file path or content hash
  const codeBlockId = useMemo(() => {
    if (file) {
      // Use file path for deterministic ID
      return `code-block-${file.replace(/[^a-zA-Z0-9]/g, '-')}`;
    } else if (displayContent) {
      // Use simple hash of actual display content for inline code blocks
      const content = String(displayContent);
      const hash = content.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      return `code-block-content-${Math.abs(hash)}`;
    }
    // Fallback to random (should rarely happen)
    return `code-block-${Math.random().toString(36).substr(2, 9)}`;
  }, [file, displayContent]);

  // Load external file content (only if not provided via SSR)
  useEffect(() => {
    if (file && !ssrContent) {
      setLoading(true);
      setError('');

      // Fallback to client-side fetch if SSR content not available
      fetch(file)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to load file: ${response.statusText}`);
          }
          return response.text();
        })
        .then(content => {
          setFileContent(content);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [file, ssrContent]);

       // Apply syntax highlighting when content changes
       useEffect(() => {
         // Only run on client-side to avoid hydration mismatch
         if (typeof window !== 'undefined' && codeRef.current) {
           // Save current selection before highlighting
           const selection = window.getSelection();
           const hasSelection = selection && selection.rangeCount > 0;
           let savedRange: Range | null = null;

           if (hasSelection) {
             const range = selection.getRangeAt(0);
             // Check if selection is within this code block
             if (codeRef.current.contains(range.commonAncestorContainer)) {
               savedRange = range.cloneRange();
             }
           }

           // Apply Prism.js syntax highlighting
           Prism.highlightElement(codeRef.current);

           // Restore selection if it was within this code block
           if (savedRange && selection) {
             try {
               selection.removeAllRanges();
               selection.addRange(savedRange);
             } catch (e) {
               // Selection restoration failed, ignore
             }
           }

         }

         // Also highlight the expanded modal code if it exists
         if (typeof window !== 'undefined' && isExpanded) {
           const expandedCode = document.getElementById(`${codeBlockId}-expanded`);
           if (expandedCode) {
             Prism.highlightElement(expandedCode);
           }
         }
       }, [children, fileContent, language, isExpanded, codeBlockId]);

  // Copy to clipboard function
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(String(displayContent));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  // Handle expand modal
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // Apply syntax highlighting to modal code when expanded
  useEffect(() => {
    if (isExpanded) {
      // Use a small timeout to ensure the modal DOM is ready
      const timer = setTimeout(() => {
        const expandedCode = document.getElementById(`${codeBlockId}-expanded`);
        if (expandedCode) {
          Prism.highlightElement(expandedCode);
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isExpanded, codeBlockId]);

  if (loading && !ssrContent) {
    return (
      <div className={`bg-neutral-900 rounded-lg overflow-hidden ${className}`}>
        {title && (
          <div className="bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300 border-b border-neutral-700">
            {title}
          </div>
        )}
        <div className="p-4 flex items-center justify-center">
          <div className="text-neutral-400">Loading code...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-neutral-900 rounded-lg overflow-hidden ${className}`}>
        {title && (
          <div className="bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300 border-b border-neutral-700">
            {title}
          </div>
        )}
        <div className="p-4">
          <div className="text-red-400 text-sm">Error loading code: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`relative bg-neutral-900 rounded-lg overflow-hidden ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
      {title && (
        <div className="bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300 border-b border-neutral-700 flex items-center justify-between">
          <span>{title}</span>
          {isHovered && (
            <div className="flex items-center space-x-2">
              <button
                onClick={copyToClipboard}
                className="p-1 rounded hover:bg-neutral-700 transition-colors duration-200"
                title={copied ? "Copied!" : "Copy code"}
              >
                {copied ? (
                  <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
              <button
                onClick={toggleExpanded}
                className="p-1 rounded hover:bg-neutral-700 transition-colors duration-200"
                title="Expand code"
              >
                <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
      <div className="relative">
        {!title && isHovered && (
          <div className="absolute top-2 right-2 flex items-center space-x-2 z-10">
            <button
              onClick={copyToClipboard}
              className="p-2 rounded-md bg-neutral-800 hover:bg-neutral-700 transition-colors duration-200"
              title={copied ? "Copied!" : "Copy code"}
            >
              {copied ? (
                <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
            <button
              onClick={toggleExpanded}
              className="p-2 rounded-md bg-neutral-800 hover:bg-neutral-700 transition-colors duration-200"
              title="Expand code"
            >
              <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          </div>
        )}
        <div className="p-4 max-h-96 overflow-auto">
          <pre
            className="text-sm whitespace-pre-wrap break-words min-w-0 leading-relaxed !bg-transparent !m-0"
            suppressHydrationWarning
          >
            <code
              ref={codeRef}
              id={codeBlockId}
              className={language ? `language-${language}` : 'language-text'}
              data-code-source={file || 'inline'}
              style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
              suppressHydrationWarning
            >
              {displayContent}
            </code>
          </pre>
        </div>
      </div>
      </div>

      {/* Expanded Modal */}
      {isExpanded && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={toggleExpanded}
        ></div>
        <div className="relative bg-neutral-900 rounded-lg max-w-6xl max-h-[90vh] w-full flex flex-col overflow-hidden">
          <div className="bg-neutral-800 px-4 py-3 text-sm font-medium text-neutral-300 border-b border-neutral-700 flex items-center justify-between">
            <span>{title || 'Code View'}</span>
            <div className="flex items-center space-x-2">
              <button
                onClick={copyToClipboard}
                className="p-2 rounded hover:bg-neutral-700 transition-colors duration-200"
                title={copied ? "Copied!" : "Copy code"}
              >
                {copied ? (
                  <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
              <button
                onClick={toggleExpanded}
                className="p-2 rounded hover:bg-neutral-700 transition-colors duration-200"
                title="Close"
              >
                <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <pre
              className="text-sm whitespace-pre-wrap break-words min-w-0 leading-relaxed !bg-transparent !m-0"
              suppressHydrationWarning
            >
              <code
                id={`${codeBlockId}-expanded`}
                className={language ? `language-${language}` : 'language-text'}
                data-code-source={file || 'inline'}
                style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
                suppressHydrationWarning
              >
                {displayContent}
              </code>
            </pre>
          </div>
        </div>
      </div>
      )}
    </>
  );
}

interface InlineCodeProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export function InlineCode({ children, className = '' }: InlineCodeProps) {
  return (
    <code className={`bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded text-sm font-mono ${className}`}>
      {children}
    </code>
  );
}

interface JSONCodeBlockProps {
  readonly data: any;
  readonly title?: string;
  readonly className?: string;
}

export function JSONCodeBlock({ data, title, className }: JSONCodeBlockProps) {
  return (
    <CodeBlock title={title} language="json" className={className}>
      {JSON.stringify(data, null, 2)}
    </CodeBlock>
  );
}