import { CodeBlock } from './CodeBlock';
import { loadCodeContent } from '@/lib/code-loader';

interface SSRCodeBlockProps {
  language?: string;
  className?: string;
  title?: string;
  file: string; // Required for SSR loading
}

/**
 * Server-side rendered CodeBlock that loads content at build time
 * This component runs on the server and embeds code directly in HTML
 */
export function SSRCodeBlock({
  language,
  className = '',
  title,
  file
}: SSRCodeBlockProps) {
  // Load content server-side
  const { content, error } = loadCodeContent(file);

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

  // Pass pre-loaded content to the regular CodeBlock
  return (
    <CodeBlock
      language={language}
      className={className}
      title={title}
      file={file}
      ssrContent={content}
    />
  );
}

/**
 * Simple server-only version without client interactivity
 * Renders pure HTML for maximum highlighting persistence
 */
export function StaticCodeBlock({
  language,
  className = '',
  title,
  file
}: SSRCodeBlockProps) {
  // Load content server-side
  const { content, error } = loadCodeContent(file);

  // Generate stable ID for highlighting persistence
  const codeBlockId = `code-block-${file.replace(/[^a-zA-Z0-9]/g, '-')}-${language || 'text'}`;

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
            data-code-source={file}
            data-ssr="true"
            data-highlighting-persistent="true"
          >
            {content}
          </code>
        </pre>
      </div>
    </div>
  );
}