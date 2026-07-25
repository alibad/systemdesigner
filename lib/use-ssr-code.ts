import React from 'react';
import { loadCodeContent, loadMultipleCodeFiles } from './code-loader';

/**
 * Hook to preload code content for SSR
 * This should be used in getStaticProps or similar server-side functions
 */
export function useSSRCode(filePath: string) {
  return loadCodeContent(filePath);
}

/**
 * Preload multiple code files for SSR
 */
export function useSSRCodeMultiple(filePaths: string[]) {
  return loadMultipleCodeFiles(filePaths);
}

/**
 * Helper to extract code content from SSR data
 */
export function getCodeContent(ssrData: Record<string, any>, filePath: string): string {
  return ssrData[filePath]?.content || '';
}

/**
 * Type for page props that include SSR code content
 */
export interface WithSSRCodeProps {
  codeContent?: Record<string, { content: string; error?: string }>;
}

/**
 * Higher-order component to inject SSR code content
 */
export function withSSRCode<P extends object>(
  Component: React.ComponentType<P>,
  codeFiles: string[]
) {
  const WrappedComponent = (props: P & WithSSRCodeProps) => {
    return React.createElement(Component, props);
  };

  // Add getStaticProps to the wrapped component
  WrappedComponent.getStaticProps = async () => {
    const codeContent = loadMultipleCodeFiles(codeFiles);

    return {
      props: {
        codeContent,
      },
    };
  };

  return WrappedComponent;
}