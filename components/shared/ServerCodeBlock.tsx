import { ReactNode } from 'react';
import { loadCodeContent } from '@/lib/code-loader';

interface ServerCodeBlockProps {
  children?: ReactNode;
  language?: string;
  className?: string;
  title?: string;
  file?: string; // Path to external code file - will be loaded server-side
}

/**
 * Server-side rendered CodeBlock component
 * Loads code content at build time instead of client-side
 * This ensures the code is part of the static HTML and can be highlighted persistently
 */
export function ServerCodeBlock({
  children,
  language,
  className = '',
  title,
  file
}: ServerCodeBlockProps) {
  // Load code content server-side if file is provided
  let displayContent = children;
  let error = '';

  if (file) {
    const { content, error: loadError } = loadCodeContent(file);
    displayContent = content;
    error = loadError || '';
  }

  // Generate stable ID for highlighting persistence
  const codeBlockId = `code-block-${file?.replace(/[^a-zA-Z0-9]/g, '-') || 'inline'}-${language || 'text'}`;

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
    <div className={`bg-neutral-900 rounded-lg overflow-hidden ${className}`}>
      {title && (
        <div className="bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300 border-b border-neutral-700">
          {title}
        </div>
      )}
      <div className="p-4 max-h-96 overflow-auto">
        <pre className="text-sm whitespace-pre-wrap break-words min-w-0 leading-relaxed !bg-transparent !m-0">
          <code
            id={codeBlockId}
            className={language ? `language-${language}` : 'language-text'}
            data-code-source={file || 'inline'}
            data-ssr="true"
          >
            {displayContent}
          </code>
        </pre>
      </div>
    </div>
  );
}

/**
 * Enhanced version with client-side interactivity
 * Combines SSR content loading with client-side features
 */
export function InteractiveServerCodeBlock({
  children,
  language,
  className = '',
  title,
  file
}: ServerCodeBlockProps) {
  // Load content server-side
  let displayContent = children;
  let error = '';

  if (file) {
    const { content, error: loadError } = loadCodeContent(file);
    displayContent = content;
    error = loadError || '';
  }

  const codeBlockId = `code-block-${file?.replace(/[^a-zA-Z0-9]/g, '-') || 'inline'}-${language || 'text'}`;

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

  // For now, render the basic version
  // The client-side CodeBlock can be hydrated on top of this
  return (
    <div
      className={`bg-neutral-900 rounded-lg overflow-hidden ${className}`}
      data-hydrate="codeblock"
      data-language={language}
      data-title={title}
      data-file={file}
    >
      {title && (
        <div className="bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300 border-b border-neutral-700">
          {title}
        </div>
      )}
      <div className="p-4 max-h-96 overflow-auto">
        <pre className="text-sm whitespace-pre-wrap break-words min-w-0 leading-relaxed !bg-transparent !m-0">
          <code
            id={codeBlockId}
            className={language ? `language-${language}` : 'language-text'}
            data-code-source={file || 'inline'}
            data-ssr="true"
          >
            {displayContent}
          </code>
        </pre>
      </div>
    </div>
  );
}