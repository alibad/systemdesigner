import { SectionContent, SectionType } from './project-data-model';

/**
 * Determines if a section has real user-created content or just default template content
 */
export function hasRealContent(content: SectionContent, type: SectionType): boolean {
  try {
    switch (type) {
      case 'text-editor':
        if (content.type === 'text-editor') {
          const markdown = content.markdown || '';
          // Check if it's not empty and not just the default template
          return markdown.length > 0 &&
            markdown !== '# Section Title\n\nStart writing your content here...' &&
            markdown !== '# New Section\n\nContent goes here...';
        }
        break;

      case 'rich-document':
        if (content.type === 'rich-document') {
          // Empty Lexical editor state or no whiteboard
          return content.editorState !== '' && content.editorState !== '{}';
        }
        break;

      case 'qa-pairs':
        if (content.type === 'qa-pairs') {
          const pairs = content.pairs || [];
          // Must have at least one real Q&A pair (not the sample)
          return pairs.length > 0 &&
            pairs.some(p =>
              p.question !== 'Sample question?' &&
              p.answer !== 'Sample answer explaining the concept or providing information.'
            );
        }
        break;

      case 'checklist':
        if (content.type === 'checklist') {
          const items = content.items || [];
          // Must have items that aren't the default sample
          return items.length > 0 &&
            items.some(item => item.title !== 'Sample task');
        }
        break;

      case 'bullet-list':
        if (content.type === 'bullet-list') {
          const items = content.items || {};
          const allItems = Object.values(items).flat();
          // Must have items that aren't the default sample
          return allItems.length > 0 &&
            allItems.some((item: any) => item.title !== 'Sample item');
        }
        break;

      case 'requirements':
        if (content.type === 'requirements') {
          const functional = content.functional || [];
          const nonFunctional = content.nonFunctional || [];
          // Must have at least one real requirement
          return functional.length > 0 || nonFunctional.length > 0;
        }
        break;

      case 'calculations':
        if (content.type === 'calculations') {
          const calculations = content.calculations || [];
          // Must have at least one calculation that's not the sample
          return calculations.length > 0 &&
            calculations.some(calc => calc.title !== 'Sample Calculation');
        }
        break;

      case 'code-editor':
        if (content.type === 'code-editor') {
          const code = content.code || '';
          // Must have code that's not the default template
          return code.length > 0 &&
            code !== '// Add your code here\nconsole.log("Hello, world!");';
        }
        break;

      case 'architecture':
        if (content.type === 'architecture') {
          const components = content.components || [];
          const connections = content.connections || [];
          // Must have at least one component or connection
          return components.length > 0 || connections.length > 0;
        }
        break;

      case 'table':
        if (content.type === 'table') {
          const rows = content.rows || [];
          // Must have rows with actual data (not just sample data)
          return rows.length > 0 &&
            rows.some(row => {
              const cells = Object.values(row.cells || {});
              return cells.some(cell => cell !== 'Sample data');
            });
        }
        break;

      case 'whiteboard':
        if (content.type === 'whiteboard') {
          // Check if there's actual diagram data
          return content.whiteboardId !== '' && content.pageId !== '';
        }
        break;

      case 'timeline':
        if (content.type === 'timeline') {
          const events = content.events || [];
          const milestones = content.milestones || [];
          return events.length > 0 || milestones.length > 0;
        }
        break;

      case 'metrics':
        if (content.type === 'metrics') {
          const metrics = content.metrics || [];
          return metrics.length > 0;
        }
        break;

      case 'files':
        if (content.type === 'files') {
          const files = content.files || [];
          return files.length > 0;
        }
        break;

      case 'links':
        if (content.type === 'links') {
          const links = content.links || [];
          return links.length > 0;
        }
        break;

      default:
        // For unknown types, assume it has content if it exists
        return true;
    }
  } catch (error) {
    console.error('Error checking for real content:', error);
    return false;
  }

  return false;
}

/**
 * Collects contextual content from a project for AI generation
 */
export interface ContextualContent {
  otherPagesContent: Array<{
    title: string;
    description?: string;
    sections: Array<{
      title: string;
      type: string;
      content: any;
      hasRealContent: boolean;
    }>;
  }>;
  otherSectionsInPage: Array<{
    title: string;
    type: string;
    content: any;
    hasRealContent: boolean;
  }>;
}

export function collectContextualContent(
  project: any,
  currentPageId: string,
  currentSectionId: string
): ContextualContent {
  const otherPagesContent: ContextualContent['otherPagesContent'] = [];
  const otherSectionsInPage: ContextualContent['otherSectionsInPage'] = [];

  // Collect from other pages
  if (project.pageMetadata) {
    Object.entries(project.pageMetadata).forEach(([pageId, metadata]: [string, any]) => {
      if (pageId !== currentPageId) {
        // We need to fetch the actual page data to get sections
        // For now, we'll mark this as a placeholder
        // This will be populated by the component that has access to all pages
      }
    });
  }

  return {
    otherPagesContent,
    otherSectionsInPage
  };
}
