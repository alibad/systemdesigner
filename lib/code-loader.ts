import { readFileSync } from 'fs';
import { join } from 'path';
import React from 'react';

interface CodeContent {
  content: string;
  error?: string;
}

/**
 * Load code content server-side for SSR
 * This replaces client-side fetch calls with build-time file reading
 */
export function loadCodeContent(filePath: string): CodeContent {
  try {
    // Remove leading slash if present
    const normalizedPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;

    // Construct full path relative to app directory (co-located files)
    const fullPath = join(process.cwd(), 'app', normalizedPath);

    // Read file synchronously (safe during SSR/build time)
    const content = readFileSync(fullPath, 'utf-8');

    return {
      content: content.trim(),
    };
  } catch (error) {
    console.error(`Failed to load code file: ${filePath}`, error);
    return {
      content: '',
      error: `Failed to load file: ${filePath}`,
    };
  }
}

/**
 * Async version for use in getStaticProps or similar
 */
export async function loadCodeContentAsync(filePath: string): Promise<CodeContent> {
  // For now, just wrap the sync version
  // Could be enhanced to use fs.promises.readFile if needed
  return loadCodeContent(filePath);
}

/**
 * Load multiple code files at once
 */
export function loadMultipleCodeFiles(filePaths: string[]): Record<string, CodeContent> {
  const results: Record<string, CodeContent> = {};

  for (const filePath of filePaths) {
    results[filePath] = loadCodeContent(filePath);
  }

  return results;
}

/**
 * Higher-order component helper to preload code content
 */
export function withCodeContent<T extends Record<string, any>>(
  component: React.ComponentType<T & { codeContent: Record<string, CodeContent> }>,
  codeFiles: string[]
) {
  const WrappedComponent = (props: T) => {
    const codeContent = loadMultipleCodeFiles(codeFiles);
    return React.createElement(component, { ...props, codeContent });
  };

  return WrappedComponent;
}