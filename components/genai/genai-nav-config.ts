/**
 * GenAI Navigation Configuration
 * 
 * This config is now generated from the content registry.
 * Kept for backward compatibility.
 */

import { generateGenAILearningPaths } from '@/lib/nav-generators';

export type GenAINavItem = {
  label: string;
  href: string;
};

export type GenAINavGroup = {
  title: string;
  items: GenAINavItem[];
};

// Generate navigation from content registry (single source of truth)
function generateGenAINav(): ReadonlyArray<GenAINavGroup> {
  const learningPaths = generateGenAILearningPaths();
  
  return learningPaths.map(path => ({
    title: path.title,
    items: [
      ...path.lessons.map(lesson => ({
        label: lesson.title,
        href: `/genai/${lesson.slug}`
      })),
      ...('externalLinks' in path && path.externalLinks ? path.externalLinks.map((link: any) => ({
        label: link.title,
        href: link.path
      })) : [])
    ]
  }));
}

export const GENAI_NAV: ReadonlyArray<GenAINavGroup> = generateGenAINav();