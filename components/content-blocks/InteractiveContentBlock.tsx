'use client';

import { contentBlockRegistry, type ContentBlockId } from './registry.generated';

export interface InteractiveContentBlockProps {
  id: ContentBlockId | string;
  dataFile?: string;
}

export default function InteractiveContentBlock({
  id,
  dataFile,
}: InteractiveContentBlockProps) {
  const Block = contentBlockRegistry[id as ContentBlockId];

  if (!Block) {
    return (
      <div className="not-prose my-6 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
        Interactive content block &quot;{id}&quot; is not registered.
      </div>
    );
  }

  return (
    <div className="not-prose my-8" data-content-block={id}>
      <Block dataFile={dataFile} />
    </div>
  );
}
