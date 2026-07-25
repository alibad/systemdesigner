'use client';

import React, { useMemo, useState } from 'react';
import {
  ProjectPage,
  PageSection,
  SectionType,
  Project as FlexibleProject
} from '@/lib/project-data-model';
import { DynamicSectionRenderer } from './DynamicSectionRenderer';

// UI Components
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// Icons
import {
  Plus,
  Settings,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Trash2,
  Edit3,
  CheckCircle,
  Clock,
  PlayCircle,
  FileText,
  Code,
  Presentation,
  Table,
  Calculator,
  Building2,
  CheckSquare,
  History,
  BarChart3,
  Paperclip,
  Link2,
  MessageSquare,
  List
} from 'lucide-react';

interface DynamicPageRendererProps {
  page: ProjectPage;
  project: FlexibleProject;
  onUpdatePage: (updates: Partial<ProjectPage>) => void;
  onUpdateSection: (sectionId: string, updates: Partial<PageSection>) => void;
  onAddSection?: (section: PageSection) => void;
  onDeleteSection?: (sectionId: string) => void;
  onPageSettings?: () => void;
  isEditable?: boolean;
}

export function DynamicPageRenderer({
  page,
  project,
  onUpdatePage,
  onUpdateSection,
  onAddSection,
  onDeleteSection,
  onPageSettings,
  isEditable = true
}: DynamicPageRendererProps) {
  const [showAddSection, setShowAddSection] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    open: boolean;
    sectionId: string;
    sectionTitle: string;
  }>({ open: false, sectionId: '', sectionTitle: '' });
  const [newSectionData, setNewSectionData] = useState({
    title: '',
    type: 'text-editor' as SectionType,
    description: ''
  });

  // Get sections sorted by order
  const sortedSections = useMemo(
    () => Object.values(page.sections).sort((a, b) => a.order - b.order),
    [page.sections]
  );

  // CRITICAL FIX: Ensure all sections have unique, sequential order values on mount
  // This fixes the bug where multiple sections might have the same order value
  React.useEffect(() => {
    let needsReindex = false;
    const orderValues = sortedSections.map(s => s.order);

    // Check if orders are not sequential (1, 2, 3, ...) or have duplicates
    for (let i = 0; i < sortedSections.length; i++) {
      if (sortedSections[i].order !== i + 1) {
        needsReindex = true;
        break;
      }
    }

    // Check for duplicate orders
    if (!needsReindex && new Set(orderValues).size !== orderValues.length) {
      needsReindex = true;
    }

    if (needsReindex) {
      console.log('🔧 REINDEXING SECTIONS - Found non-sequential or duplicate orders');
      sortedSections.forEach((section, index) => {
        const newOrder = index + 1;
        if (section.order !== newOrder) {
          console.log(`  ✏️ Fixing ${section.id}: order ${section.order} → ${newOrder}`);
          onUpdateSection(section.id, { order: newOrder });
        }
      });
    }
  }, [onUpdateSection, page.id, sortedSections]);

  // Build context for AI generation - content from other pages
  const buildOtherPagesContext = () => {
    if (!project.pageMetadata) return [];

    return Object.keys(project.pageMetadata)
      .filter(pageId => pageId !== page.id) // Exclude current page
      .map(pageId => {
        const pageMeta = project.pageMetadata[pageId];
        // Note: In a real implementation, we'd load the actual page data
        // For now, we just provide metadata
        return {
          title: pageMeta.title,
          description: pageMeta.description,
          sections: [] // Would be populated with actual section data
        };
      });
  };

  // Build context for AI generation - other sections in current page
  const buildOtherSectionsContext = (currentSectionId: string) => {
    return sortedSections
      .filter(s => s.id !== currentSectionId)
      .map(s => ({
        title: s.title,
        type: s.type,
        content: s.content,
        hasRealContent: hasRealContent(s.content, s.type)
      }));
  };

  // Check if section has real user content (not default/empty)
  const hasRealContent = (content: any, type: string): boolean => {
    if (!content) return false;

    switch (type) {
      case 'text-editor':
      case 'rich-document':
        return !!(content.markdown && content.markdown.trim().length > 0);
      case 'qa-pairs':
        return !!(content.pairs && content.pairs.length > 0);
      case 'checklist':
        return !!(content.items && content.items.length > 0);
      case 'bullet-list':
        return !!(content.items && Object.keys(content.items).length > 0);
      case 'requirements':
        return !!(content.functional && content.functional.length > 0) ||
               !!(content.nonFunctional && content.nonFunctional.length > 0);
      case 'code-editor':
        return !!(content.code && content.code.trim().length > 0);
      case 'whiteboard':
        return !!(content.snapshots && Object.keys(content.snapshots).length > 0);
      default:
        return true; // Assume has content for unknown types
    }
  };

  const handleAddSection = () => {
    if (!onAddSection || !newSectionData.title) return;

    const newSection: PageSection = {
      id: `section_${Date.now()}`,
      title: newSectionData.title,
      type: newSectionData.type,
      order: sortedSections.length + 1,
      content: getDefaultContentForType(newSectionData.type),
      settings: {
        isVisible: true,
        isCollapsible: true,
        isCollapsed: false,
        layout: {
          width: 'full',
          padding: 'medium',
          borders: true
        }
      },
      progress: {
        status: 'not_started',
        completionPercentage: 0,
        lastUpdated: new Date().toISOString()
      }
    };

    onAddSection(newSection);
    setShowAddSection(false);
    setNewSectionData({ title: '', type: 'text-editor', description: '' });
  };

  const handleSectionUpdate = (sectionId: string) => (updates: Partial<PageSection>) => {
    onUpdateSection(sectionId, updates);
  };

  const handleReorderSection = (sectionId: string, direction: 'up' | 'down') => {
    console.log('🔄 REORDER TRIGGERED:', { sectionId, direction });
    console.log('📋 Current sortedSections:', sortedSections.map(s => ({ id: s.id, title: s.title, order: s.order })));

    const currentIndex = sortedSections.findIndex(s => s.id === sectionId);
    if (currentIndex === -1) {
      console.log('❌ Section not found in sorted array');
      return;
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    console.log('📍 Indices:', { currentIndex, targetIndex });

    if (targetIndex < 0 || targetIndex >= sortedSections.length) {
      console.log('❌ Target index out of bounds');
      return;
    }

    // Create a new array with swapped positions
    const newSortedSections = [...sortedSections];
    [newSortedSections[currentIndex], newSortedSections[targetIndex]] =
      [newSortedSections[targetIndex], newSortedSections[currentIndex]];

    console.log('🔀 After swap:', newSortedSections.map(s => ({ id: s.id, title: s.title, order: s.order })));

    // Build updated sections object with new order values
    const updatedSections: Record<string, PageSection> = {};
    newSortedSections.forEach((section, index) => {
      const newOrder = index + 1;
      console.log(`✏️ Updating ${section.id} (${section.title}): order ${section.order} → ${newOrder}`);
      updatedSections[section.id] = {
        ...section,
        order: newOrder
      };
    });

    // Update the entire page in ONE call to ensure single state update
    console.log('🎯 Calling onUpdatePage with all updated sections');
    onUpdatePage({ sections: updatedSections });
  };

  const handleDeleteClick = (sectionId: string, sectionTitle: string) => {
    setDeleteConfirmation({
      open: true,
      sectionId,
      sectionTitle
    });
  };

  const handleConfirmDelete = () => {
    if (onDeleteSection && deleteConfirmation.sectionId) {
      onDeleteSection(deleteConfirmation.sectionId);
    }
    setDeleteConfirmation({ open: false, sectionId: '', sectionTitle: '' });
  };

  const calculatePageCompletion = () => {
    const sections = Object.values(page.sections);
    if (sections.length === 0) return 0;

    const completedSections = sections.filter(s => s.progress?.status === 'completed').length;
    return Math.round((completedSections / sections.length) * 100);
  };

  const getProgressIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'in_progress': return <PlayCircle className="w-4 h-4 text-orange-600" />;
      case 'blocked': return <Clock className="w-4 h-4 text-red-600" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getSectionTypeIcon = (type: SectionType) => {
    switch (type) {
      case 'text-editor': return <FileText className="w-4 h-4" />;
      case 'code-editor': return <Code className="w-4 h-4" />;
      case 'whiteboard': return <Presentation className="w-4 h-4" />;
      case 'table': return <Table className="w-4 h-4" />;
      case 'checklist': return <CheckSquare className="w-4 h-4" />;
      case 'calculations': return <Calculator className="w-4 h-4" />;
      case 'architecture': return <Building2 className="w-4 h-4" />;
      case 'timeline': return <History className="w-4 h-4" />;
      case 'metrics': return <BarChart3 className="w-4 h-4" />;
      case 'files': return <Paperclip className="w-4 h-4" />;
      case 'links': return <Link2 className="w-4 h-4" />;
      case 'qa-pairs': return <MessageSquare className="w-4 h-4" />;
      case 'bullet-list': return <List className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{page.title}</h1>
            {page.description && (
              <p className="text-gray-600 mt-1">{page.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {getProgressIcon(page.progress?.status || 'not_started')}
              <span className="text-sm font-medium">
                {calculatePageCompletion()}% Complete
              </span>
            </div>
            {isEditable && onPageSettings && (
              <Button
                variant="outline"
                size="sm"
                onClick={onPageSettings}
              >
                <Settings className="w-4 h-4 mr-2" />
                Page Settings
              </Button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${calculatePageCompletion()}%` }}
          />
        </div>

        {/* Section Overview */}
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>{Object.keys(page.sections).length} sections</span>
          <span>•</span>
          <span>{Object.values(page.sections).filter(s => s.progress?.status === 'completed').length} completed</span>
          <span>•</span>
          <span>Last updated {page.progress?.lastUpdated ? new Date(page.progress.lastUpdated).toLocaleDateString() : 'Never'}</span>
        </div>
      </div>

      {/* Page Layout Based on Settings */}
      <div className={getLayoutClasses(page.settings.layout.type, page.settings.layout.gridColumns)}>
        {sortedSections.map((section, index) => (
          <div
            key={section.id}
            className={getSectionWidthClass(section.settings?.layout?.width || 'full')}
          >
            <DynamicSectionRenderer
              section={section}
              onUpdate={handleSectionUpdate(section.id)}
              onReorder={(direction) => handleReorderSection(section.id, direction)}
              onDelete={() => handleDeleteClick(section.id, section.title)}
              canMoveUp={index > 0}
              canMoveDown={index < sortedSections.length - 1}
              isEditable={isEditable}
              projectWhiteboardId={project.whiteboardId}
              projectTitle={project.title}
              projectDescription={project.description}
              pageTitle={page.title}
              pageDescription={page.description}
              otherPagesContent={buildOtherPagesContext()}
              otherSectionsInPage={buildOtherSectionsContext(section.id)}
            />
          </div>
        ))}

        {/* Add Section Button */}
        {isEditable && onAddSection && (
          <div className="col-span-full">
            <Dialog open={showAddSection} onOpenChange={setShowAddSection}>
              <DialogTrigger asChild>
                <div className="border-2 border-dashed border-gray-300 hover:border-gray-400 cursor-pointer transition-colors rounded-lg bg-white dark:bg-gray-800">
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <Plus className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600 dark:text-gray-300 font-medium">Add New Section</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Click to add a new content section</p>
                    </div>
                  </div>
                </div>
              </DialogTrigger>

              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Section</DialogTitle>
                  <DialogDescription>
                    Create a new section for this page. Choose the type that best fits your content.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="section-title">Section Title</Label>
                    <Input
                      id="section-title"
                      value={newSectionData.title}
                      onChange={(e) => setNewSectionData({ ...newSectionData, title: e.target.value })}
                      placeholder="Enter section title..."
                    />
                  </div>

                  <div>
                    <Label htmlFor="section-type">Section Type</Label>
                    <Select
                      value={newSectionData.type}
                      onValueChange={(value: SectionType) => setNewSectionData({ ...newSectionData, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text-editor">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Text Editor
                          </div>
                        </SelectItem>
                        <SelectItem value="rich-document">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Rich Document (Lexical)
                          </div>
                        </SelectItem>
                        <SelectItem value="code-editor">
                          <div className="flex items-center gap-2">
                            <Code className="w-4 h-4" />
                            Code Editor
                          </div>
                        </SelectItem>
                        <SelectItem value="checklist">
                          <div className="flex items-center gap-2">
                            <CheckSquare className="w-4 h-4" />
                            Checklist
                          </div>
                        </SelectItem>
                        <SelectItem value="table">
                          <div className="flex items-center gap-2">
                            <Table className="w-4 h-4" />
                            Table
                          </div>
                        </SelectItem>
                        <SelectItem value="calculations">
                          <div className="flex items-center gap-2">
                            <Calculator className="w-4 h-4" />
                            Calculations
                          </div>
                        </SelectItem>
                        <SelectItem value="whiteboard">
                          <div className="flex items-center gap-2">
                            <Presentation className="w-4 h-4" />
                            Whiteboard
                          </div>
                        </SelectItem>
                        <SelectItem value="architecture">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            Architecture
                          </div>
                        </SelectItem>
                        <SelectItem value="qa-pairs">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            Q&A Pairs
                          </div>
                        </SelectItem>
                        <SelectItem value="bullet-list">
                          <div className="flex items-center gap-2">
                            <List className="w-4 h-4" />
                            Bullet List
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="section-description">Description (Optional)</Label>
                    <Textarea
                      id="section-description"
                      value={newSectionData.description}
                      onChange={(e) => setNewSectionData({ ...newSectionData, description: e.target.value })}
                      placeholder="Describe what this section is for..."
                      rows={2}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddSection(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddSection} disabled={!newSectionData.title}>
                    Add Section
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={deleteConfirmation.open}
        onOpenChange={(open) => setDeleteConfirmation({ ...deleteConfirmation, open })}
        onConfirm={handleConfirmDelete}
        itemName={deleteConfirmation.sectionTitle}
        itemType="section"
        description="This action cannot be undone and all content in this section will be lost."
      />
    </div>
  );
}

// Helper functions
function getLayoutClasses(layoutType: string, gridColumns?: number): string {
  switch (layoutType) {
    case 'two_column':
      return 'grid grid-cols-1 lg:grid-cols-2 gap-6';
    case 'grid':
      return `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${gridColumns || 3} gap-6`;
    case 'custom':
      return 'space-y-6'; // Fallback to single column
    default:
      return 'space-y-6'; // single_column
  }
}

function getSectionWidthClass(width: string): string {
  switch (width) {
    case 'half':
      return 'col-span-1';
    case 'third':
      return 'col-span-1';
    case 'quarter':
      return 'col-span-1';
    case 'custom':
      return 'col-span-1';
    default:
      return 'col-span-full'; // full width
  }
}

function getDefaultContentForType(type: SectionType): any {
  switch (type) {
    case 'text-editor':
      return {
        type: 'text-editor',
        markdown: '# Section Title\n\nStart writing your content here...',
        format: 'markdown'
      };

    case 'rich-document':
      return {
        type: 'rich-document',
        editorState: '',
        whiteboardId: '',
        version: 1
      };

    case 'code-editor':
      return {
        type: 'code-editor',
        code: '// Add your code here\nconsole.log("Hello, world!");',
        language: 'javascript',
        theme: 'default',
        examples: []
      };

    case 'checklist':
      return {
        type: 'checklist',
        items: [
          { id: '1', title: 'Sample task', completed: false }
        ],
        categories: ['Tasks']
      };

    case 'table':
      return {
        type: 'table',
        headers: ['Column 1', 'Column 2', 'Column 3'],
        rows: [
          {
            id: '1',
            cells: {
              'Column 1': 'Sample data',
              'Column 2': 'Sample data',
              'Column 3': 'Sample data'
            }
          }
        ],
        schema: {
          columns: [
            { id: 'col1', name: 'Column 1', type: 'text', required: true },
            { id: 'col2', name: 'Column 2', type: 'text' },
            { id: 'col3', name: 'Column 3', type: 'text' }
          ]
        }
      };

    case 'calculations':
      return {
        type: 'calculations',
        calculations: [
          {
            id: '1',
            title: 'Sample Calculation',
            formula: 'A * B',
            variables: { A: 10, B: 20 },
            result: 200,
            unit: 'units'
          }
        ],
        assumptions: [],
        references: []
      };

    case 'whiteboard':
      return {
        type: 'whiteboard',
        diagramData: '',
        diagramType: 'tldraw',
        snapshots: []
      };

    case 'qa-pairs':
      return {
        type: 'qa-pairs',
        pairs: [
          {
            id: '1',
            question: 'Sample question?',
            answer: 'Sample answer explaining the concept or providing information.',
            order: 0
          }
        ],
        settings: {
          sectionTitle: 'Q&A Section',
          sectionDescription: 'Questions and answers for this topic',
          questionLabel: 'Question',
          answerLabel: 'Answer',
          allowReordering: true,
          maxPairs: 20
        }
      };

    case 'bullet-list':
      return {
        type: 'bullet-list',
        items: {
          'category1': [
            {
              id: '1',
              title: 'Sample item',
              type: 'category1',
              order: 0
            }
          ]
        },
        settings: {
          sectionTitle: 'Organized List',
          sectionDescription: 'Items organized by category',
          typeOptions: [
            {
              key: 'category1',
              label: 'Category 1',
              color: 'blue',
              description: 'First category'
            },
            {
              key: 'category2',
              label: 'Category 2',
              color: 'green',
              description: 'Second category'
            }
          ],
          allowQuickAdd: true,
          showDescriptions: false
        }
      };

    default:
      return {
        type: 'text-editor',
        markdown: '# New Section\n\nContent goes here...',
        format: 'markdown'
      };
  }
}
