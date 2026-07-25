'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  PageSection,
  SectionContent,
  TextEditorContent,
  RichDocumentContent,
  WhiteboardContent,
  CodeEditorContent,
  RequirementsContent,
  CalculationsContent,
  ArchitectureContent,
  ChecklistContent,
  TableContent,
  TimelineContent,
  MetricsContent,
  FilesContent,
  LinksContent,
  QAPairsContent,
  BulletListContent,
  CustomContent,
  ConfigurableQAPair,
  BulletListItem,
  QAPairsSettings,
  BulletListSettings,
  BulletListTypeOption
} from '@/lib/project-data-model';

// Helper component to show elapsed time during AI generation
function AIGenerationTimer({ startedAt }: { startedAt: string }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startTime = new Date(startedAt).getTime();

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setElapsedSeconds(elapsed);
    }, 100); // Update every 100ms for smooth counting

    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <span className="font-mono text-xs ml-1">
      ({elapsedSeconds.toFixed(1)}s)
    </span>
  );
}

// UI Components
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { LexicalEditor } from '@/components/ui/lexical-editor';
import { Checkbox } from '@/components/ui/checkbox';
import { InterviewQAInterface } from './InterviewQAInterface';
import { SectionSettingsDialog } from './SectionSettingsDialog';
import { TLDrawEmbed } from './TLDrawEmbed';
import { WhiteboardPageSelector } from './WhiteboardPageSelector';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Icons
import {
  Edit3,
  Save,
  X,
  CheckCircle,
  Circle,
  Plus,
  Trash2,
  FileText,
  Code,
  Image,
  Table as TableIcon,
  History,
  Calculator,
  Building2,
  Link2,
  Paperclip,
  BarChart3,
  Presentation,
  Eye,
  EyeOff,
  MessageSquare,
  List,
  Settings,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Calendar,
  Maximize2,
  Minimize2,
  BarChart,
  Link,
  Layers,
  Settings as SettingsIcon,
  Star,
  Heart,
  Zap,
  Target,
  Lightbulb,
  Flag,
  Sparkles,
  Loader2
} from 'lucide-react';

// Icon mapping for custom icons
const ICON_MAP = {
  MessageSquare,
  List,
  FileText,
  Code,
  CheckSquare,
  Calendar,
  BarChart,
  Link,
  Layers,
  SettingsIcon,
  Star,
  Heart,
  Zap,
  Target,
  Lightbulb,
  Flag
};

interface DynamicSectionRendererProps {
  section: PageSection;
  onUpdate: (updates: Partial<PageSection>) => void;
  onReorder?: (direction: 'up' | 'down') => void;
  onDelete?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  isEditable?: boolean;
  projectWhiteboardId?: string;
  projectTitle?: string;
  projectDescription?: string;
  pageTitle?: string;
  pageDescription?: string;
  otherPagesContent?: Array<{
    title: string;
    description?: string;
    sections: Array<{
      title: string;
      type: string;
      content: any;
      hasRealContent: boolean;
    }>;
  }>;
  otherSectionsInPage?: Array<{
    title: string;
    type: string;
    content: any;
    hasRealContent: boolean;
  }>;
}

interface SectionSettingsDialogProps {
  section: PageSection;
  onUpdate: (updates: Partial<PageSection>) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DynamicSectionRenderer({
  section,
  onUpdate,
  onReorder,
  onDelete,
  canMoveUp = true,
  canMoveDown = true,
  isEditable = true,
  projectWhiteboardId,
  projectTitle,
  projectDescription,
  pageTitle,
  pageDescription,
  otherPagesContent,
  otherSectionsInPage
}: DynamicSectionRendererProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const handleContentUpdate = (newContent: SectionContent) => {
    onUpdate({
      content: newContent,
      progress: {
        ...section.progress,
        status: 'in_progress',
        lastUpdated: new Date().toISOString()
      }
    });
  };

  const handleToggleVisibility = () => {
    onUpdate({
      settings: {
        ...section.settings,
        isVisible: !section.settings.isVisible
      }
    });
  };

  const handleToggleCollapse = () => {
    onUpdate({
      settings: {
        ...section.settings,
        isCollapsed: !section.settings.isCollapsed
      }
    });
  };

  const handleGenerateContent = async () => {
    if (!projectTitle || !pageTitle) {
      setGenerateError('Project and page context required for AI generation');
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);

    const startTime = Date.now();
    const startedAt = new Date().toISOString();

    // Update status to generating
    onUpdate({
      progress: {
        ...section.progress,
        aiGeneration: {
          status: 'generating',
          queuedAt: new Date().toISOString(),
          startedAt
        }
      }
    });

    try {
      const response = await fetch('/api/generate-section', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectTitle,
          projectDescription: projectDescription || '',
          pageTitle,
          pageDescription: pageDescription || '',
          sectionTitle: section.title,
          sectionType: section.type,
          existingContent: section.content,
          otherPagesContent: otherPagesContent || [],
          otherSectionsInPage: otherSectionsInPage || []
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate content');
      }

      const data = await response.json();

      if (data.success && data.content) {
        const completedAt = new Date().toISOString();
        const generationTimeMs = Date.now() - startTime;

        // Create a readable prompt summary showing what was sent
        let promptSummary = `Project: ${projectTitle}\n`;
        if (projectDescription) {
          promptSummary += `Description: ${projectDescription}\n`;
        }
        promptSummary += `\nPage: ${pageTitle}\n`;
        if (pageDescription) {
          promptSummary += `Page Description: ${pageDescription}\n`;
        }
        promptSummary += `\nSection: ${section.title} (${section.type})\n`;

        if (otherSectionsInPage && otherSectionsInPage.length > 0) {
          promptSummary += `\nOther Sections in Page:\n`;
          promptSummary += otherSectionsInPage.map(s => `- ${s.title} (${s.type})${s.hasRealContent ? ' ✓ has content' : ''}`).join('\n');
        }

        if (otherPagesContent && otherPagesContent.length > 0) {
          promptSummary += `\n\nContext from Other Pages:\n`;
          promptSummary += otherPagesContent.map(p => `- ${p.title}: ${p.sections.filter(s => s.hasRealContent).length} sections with content`).join('\n');
        }

        // Update section with generated content AND AI completion status
        onUpdate({
          content: data.content,
          progress: {
            ...section.progress,
            status: 'in_progress',
            aiGeneration: {
              status: 'completed',
              queuedAt: startedAt,
              startedAt,
              completedAt,
              prompt: promptSummary,
              generationTimeMs
            }
          }
        });

        // For whiteboard sections, also save the generated shapes to Firebase
        if (section.type === 'whiteboard' && data.content.snapshots && projectWhiteboardId) {
          try {
            const { updateDiagram } = await import('@/lib/firebase');
            await updateDiagram(projectWhiteboardId, { canvas: data.content.snapshots });
            console.log('Whiteboard shapes saved to Firebase');
          } catch (saveError) {
            console.error('Failed to save whiteboard shapes:', saveError);
            // Don't fail the generation, just log the error
          }
        }

        setIsEditing(true); // Switch to edit mode so user can review/modify
      } else {
        throw new Error(data.error || 'Generation failed');
      }
    } catch (error) {
      console.error('AI generation error:', error);
      setGenerateError(error instanceof Error ? error.message : 'Failed to generate content');

      // Update status to error
      onUpdate({
        progress: {
          ...section.progress,
          aiGeneration: {
            status: 'error',
            queuedAt: startedAt,
            startedAt,
            error: error instanceof Error ? error.message : 'Failed to generate content'
          }
        }
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getSectionIcon = (section: PageSection) => {
    // Check for custom icon first
    if (section.settings.customIcon && ICON_MAP[section.settings.customIcon as keyof typeof ICON_MAP]) {
      const IconComponent = ICON_MAP[section.settings.customIcon as keyof typeof ICON_MAP];
      return <IconComponent className="w-4 h-4" />;
    }

    // Fall back to default icons based on section type
    switch (section.type) {
      case 'text-editor': return <FileText className="w-4 h-4" />;
      case 'rich-document': return <FileText className="w-4 h-4" />;
      case 'code-editor': return <Code className="w-4 h-4" />;
      case 'whiteboard': return <Presentation className="w-4 h-4" />;
      case 'table': return <TableIcon className="w-4 h-4" />;
      case 'checklist': return <CheckCircle className="w-4 h-4" />;
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

  const getProgressColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-orange-500';
      case 'blocked': return 'bg-red-500';
      default: return 'bg-gray-300';
    }
  };

  if (!section.settings.isVisible) {
    return (
      <div className="opacity-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="p-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getSectionIcon(section)}
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{section.title} (Hidden)</h3>
              </div>
              {isEditable && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleVisibility}
                  className="h-6 w-6 p-0"
                >
                  <Eye className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Section Settings Dialog */}
      <SectionSettingsDialog
        section={section}
        onUpdate={onUpdate}
        open={showSettings}
        onOpenChange={setShowSettings}
      />

      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm ${section.settings.layout.borders ? 'border border-gray-200 dark:border-gray-700' : 'border-none'}`}>
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              {getSectionIcon(section)}
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{section.title}</h3>
            </div>
            <div className={`w-2 h-2 rounded-full ${getProgressColor(section.progress.status)}`} />
            <Badge variant="secondary" className="text-xs">
              {section.type.replace('-', ' ')}
            </Badge>

            {/* AI Generation Status Badge */}
            {section.progress.aiGeneration && (
              <>
                {/* Show progress badges for non-completed states */}
                {section.progress.aiGeneration.status !== 'completed' && (
                  <Badge
                    variant={section.progress.aiGeneration.status === 'error' ? 'destructive' : 'default'}
                    className={`text-xs ${
                      section.progress.aiGeneration.status === 'queued' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                      section.progress.aiGeneration.status === 'generating' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 animate-pulse' :
                      section.progress.aiGeneration.status === 'cancelled' ? 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300' :
                      ''
                    }`}
                  >
                    {section.progress.aiGeneration.status === 'queued' && '⏳ Queued for AI'}
                    {section.progress.aiGeneration.status === 'generating' && (
                      <>
                        ✨ Generating...
                        {section.progress.aiGeneration.startedAt && (
                          <AIGenerationTimer startedAt={section.progress.aiGeneration.startedAt} />
                        )}
                      </>
                    )}
                    {section.progress.aiGeneration.status === 'cancelled' && '🚫 Cancelled'}
                    {section.progress.aiGeneration.status === 'error' && '⚠️ Generation Failed'}
                  </Badge>
                )}

                {/* Show "AI Generated" badge with tooltip for completed */}
                {section.progress.aiGeneration.status === 'completed' && (
                  <div className="group relative">
                    <Badge
                      variant="default"
                      className="text-xs bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700 dark:from-purple-900/30 dark:to-blue-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800 cursor-help"
                    >
                      🤖 AI Generated
                      {section.progress.aiGeneration.generationTimeMs && (
                        <span className="font-mono ml-1">
                          ({(section.progress.aiGeneration.generationTimeMs / 1000).toFixed(1)}s)
                        </span>
                      )}
                    </Badge>

                    {/* Tooltip on hover */}
                    <div className="absolute left-0 top-full mt-2 w-80 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                      <div className="text-sm space-y-2">
                        <div className="font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                          AI Generation Details
                        </div>

                        {section.progress.aiGeneration.generationTimeMs && (
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Generation Time:</span>{' '}
                            <span className="font-medium text-gray-900 dark:text-white">
                              {(section.progress.aiGeneration.generationTimeMs / 1000).toFixed(2)}s
                            </span>
                          </div>
                        )}

                        {section.progress.aiGeneration.completedAt && (
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Completed:</span>{' '}
                            <span className="font-medium text-gray-900 dark:text-white">
                              {new Date(section.progress.aiGeneration.completedAt).toLocaleString()}
                            </span>
                          </div>
                        )}

                        {section.progress.aiGeneration.prompt && (
                          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-1">
                              <div className="text-gray-600 dark:text-gray-400">Prompt Context:</div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(section.progress.aiGeneration?.prompt || '');
                                  // Visual feedback
                                  const btn = e.currentTarget;
                                  const originalText = btn.innerHTML;
                                  btn.innerHTML = '<span class="text-green-600">✓ Copied!</span>';
                                  setTimeout(() => {
                                    btn.innerHTML = originalText;
                                  }, 1500);
                                }}
                                className="h-6 px-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                                title="Copy prompt to clipboard"
                              >
                                📋 Copy
                              </Button>
                            </div>
                            <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 overflow-auto max-h-40 whitespace-pre-wrap font-mono">
{section.progress.aiGeneration.prompt}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Status Dropdown */}
            {isEditable && (
              <Select
                key={`${section.id}-${section.progress?.status}`}
                value={section.progress?.status || 'not_started'}
                onValueChange={(value: 'not_started' | 'in_progress' | 'completed' | 'blocked') => {
                  onUpdate({
                    progress: {
                      ...section.progress,
                      status: value,
                      lastUpdated: new Date().toISOString(),
                    },
                  });
                }}
              >
                <SelectTrigger className="h-7 w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">
                    <div className="flex items-center gap-2">
                      <Circle className="w-3 h-3 text-gray-400" />
                      <span>Not Started</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="in_progress">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-500" />
                      <span>In Progress</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="completed">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      <span>Completed</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="blocked">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span>Blocked</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {isEditable && (
            <div className="flex items-center gap-1">
              {/* Movement Controls - only visible when editing */}
              {isEditing && onReorder && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onReorder('up')}
                    disabled={!canMoveUp}
                    className="h-6 w-6 p-0"
                    title="Move up"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onReorder('down')}
                    disabled={!canMoveDown}
                    className="h-6 w-6 p-0"
                    title="Move down"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </Button>
                </>
              )}

              {/* Delete Button - only visible when editing */}
              {isEditing && onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDelete}
                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  title="Delete section"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}

              {/* AI Generate / Cancel Button */}
              {section.progress.aiGeneration && (section.progress.aiGeneration.status === 'queued' || section.progress.aiGeneration.status === 'generating') ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // Cancel AI generation
                    onUpdate({
                      progress: {
                        ...section.progress,
                        aiGeneration: {
                          ...section.progress.aiGeneration,
                          status: 'cancelled',
                          cancelledAt: new Date().toISOString()
                        }
                      }
                    });
                  }}
                  className="h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  title="Cancel AI generation"
                >
                  <X className="w-3 h-3" />
                  <span className="ml-1 text-xs">Cancel</span>
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerateContent}
                  disabled={isGenerating || !projectTitle || !pageTitle}
                  className="h-6 px-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20"
                  title="Generate with AI"
                >
                  {isGenerating ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  <span className="ml-1 text-xs">AI</span>
                </Button>
              )}

              {/* Section Settings Button for configurable types */}
              {(section.type === 'qa-pairs' || section.type === 'bullet-list') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSettings(true)}
                  className="h-6 w-6 p-0"
                  title="Section settings"
                >
                  <Settings className="w-3 h-3" />
                </Button>
              )}

              {/* Edit Toggle Button */}
              <Button
                variant={isEditing ? "default" : "ghost"}
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                className="h-6 w-6 p-0"
                title={isEditing ? "Finish editing" : "Edit section"}
              >
                <Edit3 className="w-3 h-3" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleVisibility}
                className="h-6 w-6 p-0"
                title="Hide section"
              >
                <EyeOff className="w-3 h-3" />
              </Button>

              {section.settings.isCollapsible && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleCollapse}
                  className="h-6 w-6 p-0"
                  title={section.settings.isCollapsed ? "Expand" : "Collapse"}
                >
                  {section.settings.isCollapsed ? "+" : "-"}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {!section.settings.isCollapsed && (
        <div className={`${isEditing ? 'p-4' : 'p-6'} ${section.settings.layout.padding}`}>
          {/* AI Generation Error Display */}
          {generateError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-2">
                <X className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">AI Generation Failed</p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">{generateError}</p>
                </div>
                <button
                  onClick={() => setGenerateError(null)}
                  className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <SectionContentRenderer
            content={section.content}
            sectionType={section.type}
            onUpdate={handleContentUpdate}
            isEditable={isEditable && isEditing}
            projectWhiteboardId={projectWhiteboardId}
          />
        </div>
      )}
    </div>
    </>
  );
}

interface SectionContentRendererProps {
  content: SectionContent;
  sectionType: string; // Fallback type from section if content.type is missing
  onUpdate: (content: SectionContent) => void;
  isEditable?: boolean;
  projectWhiteboardId?: string;
}

function SectionContentRenderer({
  content,
  sectionType,
  onUpdate,
  isEditable = true,
  projectWhiteboardId
}: SectionContentRendererProps) {
  // Use content.type if present, otherwise fallback to section.type
  const actualType = content.type || sectionType;

  switch (actualType) {
    case 'text-editor':
      return (
        <TextEditorRenderer
          content={content as TextEditorContent}
          onUpdate={onUpdate}
          isEditable={isEditable}
        />
      );

    case 'rich-document':
      return (
        <RichDocumentRenderer
          content={content as RichDocumentContent}
          onUpdate={onUpdate}
          isEditable={isEditable}
          projectWhiteboardId={projectWhiteboardId}
        />
      );

    case 'code-editor':
      return (
        <CodeEditorRenderer
          content={content as CodeEditorContent}
          onUpdate={onUpdate}
          isEditable={isEditable}
        />
      );

    case 'checklist':
      return (
        <ChecklistRenderer
          content={content as ChecklistContent}
          onUpdate={onUpdate}
          isEditable={isEditable}
        />
      );

    case 'requirements':
      return (
        <RequirementsRenderer
          content={content as RequirementsContent}
          onUpdate={onUpdate}
          isEditable={isEditable}
        />
      );

    case 'calculations':
      return (
        <CalculationsRenderer
          content={content as CalculationsContent}
          onUpdate={onUpdate}
          isEditable={isEditable}
        />
      );

    case 'table':
      return (
        <TableRenderer
          content={content as TableContent}
          onUpdate={onUpdate}
          isEditable={isEditable}
        />
      );

    case 'whiteboard':
      return (
        <WhiteboardRenderer
          content={content as WhiteboardContent}
          onUpdate={onUpdate}
          isEditable={isEditable}
        />
      );

    case 'qa-pairs':
      return (
        <QAPairsRenderer
          content={content as QAPairsContent}
          onUpdate={onUpdate}
          isEditable={isEditable}
        />
      );

    case 'bullet-list':
      return (
        <BulletListRenderer
          content={content as BulletListContent}
          onUpdate={onUpdate}
          isEditable={isEditable}
        />
      );

    default:
      return (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-gray-600 dark:text-gray-400 mb-3">
            Section type "<span className="font-mono text-indigo-600 dark:text-indigo-400">{actualType || 'unknown'}</span>" is not supported.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Please edit this section or regenerate it with AI.
          </p>
        </div>
      );
  }
}

// Individual content renderers
function TextEditorRenderer({
  content,
  onUpdate,
  isEditable
}: {
  content: TextEditorContent;
  onUpdate: (content: SectionContent) => void;
  isEditable: boolean;
}) {
  const handleMarkdownUpdate = (markdown: string) => {
    onUpdate({
      ...content,
      markdown
    });
  };

  return (
    <div className="space-y-4">
      {isEditable ? (
        <RichTextEditor
          content={content.markdown}
          onChange={handleMarkdownUpdate}
          placeholder="Start typing..."
        />
      ) : (
        <MarkdownViewer content={content.markdown} />
      )}
    </div>
  );
}

function RichDocumentRenderer({
  content,
  onUpdate,
  isEditable,
  projectWhiteboardId
}: {
  content: RichDocumentContent;
  onUpdate: (content: SectionContent) => void;
  isEditable: boolean;
  projectWhiteboardId?: string;
}) {
  const handleEditorUpdate = (editorState: string) => {
    onUpdate({
      ...content,
      editorState
    });
  };

  return (
    <div className="space-y-4">
      <LexicalEditor
        content={content.editorState || ''}
        onChange={handleEditorUpdate}
        placeholder="Start writing your rich document with embedded diagrams..."
        isEditable={isEditable}
        projectWhiteboardId={projectWhiteboardId}
      />
    </div>
  );
}

function CodeEditorRenderer({
  content,
  onUpdate,
  isEditable
}: {
  content: CodeEditorContent;
  onUpdate: (content: SectionContent) => void;
  isEditable: boolean;
}) {
  const [code, setCode] = useState(content.code);
  const updateTimeoutRef = useRef<NodeJS.Timeout>();

  // Autosave with debounce (like other sections)
  const handleCodeChange = (newCode: string) => {
    setCode(newCode);

    // Clear existing timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Debounce the update to Firebase (1 second after typing stops)
    updateTimeoutRef.current = setTimeout(() => {
      onUpdate({
        ...content,
        code: newCode
      });
    }, 1000);
  };

  // When switching from edit to view mode, flush any pending changes immediately
  React.useEffect(() => {
    if (!isEditable && code !== content.code) {
      // Flush pending changes when exiting edit mode
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      onUpdate({
        ...content,
        code
      });
    }
  }, [code, content, isEditable, onUpdate]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Badge variant="outline">{content.language}</Badge>
        <span className="text-xs text-gray-500 dark:text-gray-400">Auto-saves as you type</span>
      </div>
      {isEditable ? (
        <textarea
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          className="w-full h-64 p-3 font-mono text-sm border rounded-lg resize-y dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700"
          placeholder="Enter your code here..."
        />
      ) : (
        <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto">
          <code className={`language-${content.language} text-sm`}>
            {content.code}
          </code>
        </pre>
      )}
    </div>
  );
}

function ChecklistRenderer({
  content,
  onUpdate,
  isEditable
}: {
  content: ChecklistContent;
  onUpdate: (content: SectionContent) => void;
  isEditable: boolean;
}) {
  const handleToggleItem = (itemId: string) => {
    const updatedItems = content.items.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );

    onUpdate({
      ...content,
      items: updatedItems
    });
  };

  const handleAddItem = () => {
    const newItem = {
      id: Date.now().toString(),
      title: 'New task',
      completed: false
    };

    onUpdate({
      ...content,
      items: [...content.items, newItem]
    });
  };

  return (
    <div className="space-y-3">
      {(content.items.length > 0 || isEditable) && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {content.items.filter(item => item.completed).length} of {content.items.length} completed
          </div>
          {isEditable && (
            <Button size="sm" variant="outline" onClick={handleAddItem}>
              <Plus className="w-3 h-3 mr-1" />
              Add Item
            </Button>
          )}
        </div>
      )}

      <div className="space-y-3">
        {content.items.map((item: any) => (
          <div key={item.id} className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors">
            <Checkbox
              checked={item.completed}
              onCheckedChange={() => handleToggleItem(item.id)}
              disabled={!isEditable}
              className="mt-1"
            />
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className={`font-medium ${item.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                  {item.title}
                </span>
                {item.category && (
                  <Badge variant="outline" className="text-xs">
                    {item.category}
                  </Badge>
                )}
              </div>
              {item.description && (
                <p className={`text-sm ${item.completed ? 'line-through text-gray-400' : 'text-gray-600'}`}>
                  {item.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RequirementsRenderer({
  content,
  onUpdate,
  isEditable
}: {
  content: RequirementsContent;
  onUpdate: (content: SectionContent) => void;
  isEditable: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-semibold mb-3">Functional Requirements</h4>
        <div className="space-y-2">
          {content.functional.map((req) => (
            <div key={req.id} className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h5 className="font-medium text-gray-900 dark:text-white">{req.title}</h5>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{req.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={req.priority === 'high' ? 'destructive' : req.priority === 'medium' ? 'default' : 'secondary'}>
                      {req.priority}
                    </Badge>
                    <Badge variant="outline">{req.status}</Badge>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-semibold mb-3">Non-Functional Requirements</h4>
        <div className="space-y-2">
          {content.nonFunctional.map((req) => (
            <div key={req.id} className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h5 className="font-medium text-gray-900 dark:text-white">{req.title}</h5>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{req.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={req.priority === 'high' ? 'destructive' : req.priority === 'medium' ? 'default' : 'secondary'}>
                      {req.priority}
                    </Badge>
                    <Badge variant="outline">{req.status}</Badge>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CalculationsRenderer({
  content,
  onUpdate,
  isEditable
}: {
  content: CalculationsContent;
  onUpdate: (content: SectionContent) => void;
  isEditable: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});

  const handleEdit = (calc: any) => {
    setEditingId(calc.id);
    setEditValues({
      title: calc.title,
      formula: calc.formula,
      variables: { ...calc.variables },
      result: calc.result,
      unit: calc.unit,
      notes: calc.notes || ''
    });
  };

  const handleSave = (calcId: string) => {
    const calculations = content.calculations || [];
    const updatedCalculations = calculations.map(c =>
      c.id === calcId ? { id: c.id, ...editValues } : c
    );
    onUpdate({
      ...content,
      calculations: updatedCalculations
    });
    setEditingId(null);
    setEditValues({});
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValues({});
  };

  const handleAddNew = () => {
    const calculations = content.calculations || [];
    const newCalc = {
      id: `calc_${Date.now()}`,
      title: 'New Calculation',
      formula: '',
      variables: {},
      result: 0,
      unit: '',
      notes: ''
    };
    onUpdate({
      ...content,
      calculations: [...calculations, newCalc]
    });
    setEditingId(newCalc.id);
    setEditValues(newCalc);
  };

  const handleDelete = (calcId: string) => {
    const calculations = content.calculations || [];
    onUpdate({
      ...content,
      calculations: calculations.filter(c => c.id !== calcId)
    });
  };

  // Ensure calculations array exists
  const calculations = content.calculations || [];

  return (
    <div className="space-y-4">
      {calculations.length === 0 && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-2">No calculations yet</p>
          {isEditable && (
            <Button onClick={handleAddNew} size="sm">
              Add Calculation
            </Button>
          )}
        </div>
      )}
      {calculations.map((calc) => (
        <div key={calc.id} className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          {editingId === calc.id ? (
            <div className="space-y-3">
              <Input
                value={editValues.title}
                onChange={(e) => setEditValues({ ...editValues, title: e.target.value })}
                placeholder="Calculation title"
                className="font-semibold"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={editValues.result}
                  onChange={(e) => setEditValues({ ...editValues, result: parseFloat(e.target.value) || 0 })}
                  placeholder="Result"
                  type="number"
                />
                <Input
                  value={editValues.unit}
                  onChange={(e) => setEditValues({ ...editValues, unit: e.target.value })}
                  placeholder="Unit (e.g., DAU, QPS)"
                />
              </div>
              <Input
                value={editValues.formula}
                onChange={(e) => setEditValues({ ...editValues, formula: e.target.value })}
                placeholder="Formula"
              />

              {/* Variables Section */}
              <div className="border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-sm text-gray-900 dark:text-white">Variables:</div>
                  <span className="text-xs text-gray-500">Used in formula calculation</span>
                </div>
                <div className="space-y-2">
                  {Object.entries(editValues.variables).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <Input
                        value={key}
                        onChange={(e) => {
                          const newVars = { ...editValues.variables };
                          delete newVars[key];
                          newVars[e.target.value] = value;
                          setEditValues({ ...editValues, variables: newVars });
                        }}
                        placeholder="Variable name"
                        className="text-sm flex-1"
                      />
                      <Input
                        value={String(value)}
                        onChange={(e) => {
                          const newVars = { ...editValues.variables };
                          newVars[key] = parseFloat(e.target.value) || e.target.value;
                          setEditValues({ ...editValues, variables: newVars });
                        }}
                        placeholder="Value"
                        className="text-sm font-mono flex-1"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const newVars = { ...editValues.variables };
                          delete newVars[key];
                          setEditValues({ ...editValues, variables: newVars });
                        }}
                        className="px-2"
                      >
                        <X className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const newVars = { ...editValues.variables, [`var${Object.keys(editValues.variables).length + 1}`]: 0 };
                      setEditValues({ ...editValues, variables: newVars });
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Variable
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs text-gray-500 mb-1">Notes (show your work):</Label>
                <Textarea
                  value={editValues.notes}
                  onChange={(e) => setEditValues({ ...editValues, notes: e.target.value })}
                  placeholder="Explain the calculation step-by-step (e.g., '1M users × 10 requests/day = 10M requests/day ÷ 86400 seconds = ~115 QPS')"
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleSave(calc.id)}>Save</Button>
                <Button size="sm" variant="outline" onClick={handleCancel}>Cancel</Button>
                <Button size="sm" variant="destructive" onClick={() => handleDelete(calc.id)}>Delete</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-900 dark:text-white">{calc.title}</h4>
                <div className="flex items-center gap-2">
                  <div className="text-lg font-mono text-gray-900 dark:text-white">
                    {calc.result} {calc.unit}
                  </div>
                  {isEditable && (
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(calc)}>
                      <Edit3 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="text-sm">
                <div className="font-medium mb-1 text-gray-900 dark:text-white">Formula:</div>
                <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm text-gray-900 dark:text-white">{calc.formula}</code>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-medium mb-1 text-gray-900 dark:text-white">Variables:</div>
                  <div className="space-y-1">
                    {Object.entries(calc.variables).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-gray-700 dark:text-gray-300">
                        <span>{key}:</span>
                        <span className="font-mono">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {calc.notes && (
                  <div>
                    <div className="font-medium mb-1 text-gray-900 dark:text-white">Notes:</div>
                    <p className="text-gray-600 dark:text-gray-400">{calc.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {isEditable && (
        <Button onClick={handleAddNew} variant="outline" className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Add Calculation
        </Button>
      )}
    </div>
  );
}

function TableRenderer({
  content,
  onUpdate,
  isEditable
}: {
  content: TableContent;
  onUpdate: (content: SectionContent) => void;
  isEditable: boolean;
}) {
  const [editingCell, setEditingCell] = useState<{ rowId: string; header: string } | null>(null);
  const [editingHeader, setEditingHeader] = useState<string | null>(null);
  const [headerValue, setHeaderValue] = useState('');

  const handleAddColumn = () => {
    const newHeader = `Column ${content.headers.length + 1}`;
    onUpdate({
      ...content,
      headers: [...content.headers, newHeader],
      rows: content.rows.map(row => ({
        ...row,
        cells: { ...row.cells, [newHeader]: '' }
      }))
    });
  };

  const handleRemoveColumn = (header: string) => {
    onUpdate({
      ...content,
      headers: content.headers.filter(h => h !== header),
      rows: content.rows.map(row => {
        const { [header]: removed, ...cells } = row.cells;
        return { ...row, cells };
      })
    });
  };

  const handleRenameColumn = (oldHeader: string, newHeader: string) => {
    if (!newHeader || newHeader === oldHeader) return;

    onUpdate({
      ...content,
      headers: content.headers.map(h => h === oldHeader ? newHeader : h),
      rows: content.rows.map(row => {
        const { [oldHeader]: value, ...cells } = row.cells;
        return { ...row, cells: { ...cells, [newHeader]: value } };
      })
    });
    setEditingHeader(null);
  };

  const handleAddRow = () => {
    const newRow = {
      id: `row_${Date.now()}`,
      cells: Object.fromEntries(content.headers.map(h => [h, '']))
    };
    onUpdate({
      ...content,
      rows: [...content.rows, newRow]
    });
  };

  const handleRemoveRow = (rowId: string) => {
    onUpdate({
      ...content,
      rows: content.rows.filter(r => r.id !== rowId)
    });
  };

  const handleCellUpdate = (rowId: string, header: string, value: string) => {
    onUpdate({
      ...content,
      rows: content.rows.map(row =>
        row.id === rowId
          ? { ...row, cells: { ...row.cells, [header]: value } }
          : row
      )
    });
  };

  return (
    <div className="space-y-2">
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto">
        <table className="w-full bg-white dark:bg-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {content.headers.map((header, index) => (
                <th key={index} className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600 min-w-[150px]">
                  {isEditable && editingHeader === header ? (
                    <div className="flex gap-2">
                      <Input
                        value={headerValue}
                        onChange={(e) => setHeaderValue(e.target.value)}
                        onBlur={() => handleRenameColumn(header, headerValue)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameColumn(header, headerValue);
                          if (e.key === 'Escape') setEditingHeader(null);
                        }}
                        className="h-7 text-sm"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between group">
                      <span
                        className={isEditable ? 'cursor-pointer hover:text-indigo-600' : ''}
                        onClick={() => {
                          if (isEditable) {
                            setHeaderValue(header);
                            setEditingHeader(header);
                          }
                        }}
                      >
                        {header}
                      </span>
                      {isEditable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveColumn(header)}
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3 text-red-500" />
                        </Button>
                      )}
                    </div>
                  )}
                </th>
              ))}
              {isEditable && (
                <th className="px-2 py-3 w-10 border-b border-gray-200 dark:border-gray-600"></th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
            {content.rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 group">
                {content.headers.map((header) => (
                  <td key={header} className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                    {isEditable && editingCell?.rowId === row.id && editingCell?.header === header ? (
                      <Input
                        value={row.cells[header] || ''}
                        onChange={(e) => handleCellUpdate(row.id, header, e.target.value)}
                        onBlur={() => setEditingCell(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Escape') setEditingCell(null);
                        }}
                        className="h-8 text-sm"
                        autoFocus
                      />
                    ) : (
                      <div
                        className={isEditable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 rounded px-2 py-1 -mx-2 -my-1' : ''}
                        onClick={() => {
                          if (isEditable) {
                            setEditingCell({ rowId: row.id, header });
                          }
                        }}
                      >
                        {row.cells[header] || <span className="text-gray-400 italic">Empty</span>}
                      </div>
                    )}
                  </td>
                ))}
                {isEditable && (
                  <td className="px-2 py-2 w-10">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveRow(row.id)}
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3 text-red-500" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isEditable && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddRow}
            className="text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Row
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddColumn}
            className="text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Column
          </Button>
        </div>
      )}
    </div>
  );
}

function WhiteboardRenderer({
  content,
  onUpdate,
  isEditable
}: {
  content: WhiteboardContent;
  onUpdate: (content: SectionContent) => void;
  isEditable: boolean;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Handle page selection
  const handleSelectPage = (newPageId: string) => {
    onUpdate({
      ...content,
      pageId: newPageId
    });
  };

  return (
    <>
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex items-center justify-between">
          {/* Page Selector */}
          <WhiteboardPageSelector
            whiteboardId={content.whiteboardId}
            currentPageId={content.pageId}
            onSelectPage={handleSelectPage}
          />

          {/* Expand Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsModalOpen(true)}
          >
            <Maximize2 className="w-4 h-4 mr-2" />
            Expand
          </Button>
        </div>

        {/* TLDraw Embed - Inline Preview */}
        <TLDrawEmbed
          whiteboardId={content.whiteboardId}
          pageId={content.pageId}
          isEditable={false}
          height="400px"
        />
      </div>

      {/* Expanded Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="relative w-[95vw] h-[95vh] bg-white dark:bg-neutral-900 rounded-lg shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                  Whiteboard Editor
                </h3>
                <WhiteboardPageSelector
                  whiteboardId={content.whiteboardId}
                  currentPageId={content.pageId}
                  onSelectPage={handleSelectPage}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-hidden">
              <TLDrawEmbed
                whiteboardId={content.whiteboardId}
                pageId={content.pageId}
                isEditable={true}
                height="100%"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function QAPairsRenderer({
  content,
  onUpdate,
  isEditable
}: {
  content: QAPairsContent;
  onUpdate: (content: SectionContent) => void;
  isEditable: boolean;
}) {
  const [localPairs, setLocalPairs] = useState(content.pairs);
  const updateTimeoutRef = React.useRef<NodeJS.Timeout>();

  // Update local state when content changes from parent
  React.useEffect(() => {
    setLocalPairs(content.pairs);
  }, [content.pairs]);

  const handleAddPair = () => {
    const newPair: ConfigurableQAPair = {
      id: Date.now().toString(),
      question: '',
      answer: '',
      order: content.pairs.length
    };

    // Only update local state - don't save to Firebase yet
    const updatedPairs = [...localPairs, newPair];
    setLocalPairs(updatedPairs);

    // Focus the new question field after a brief delay
    setTimeout(() => {
      const newElements = document.querySelectorAll('[contenteditable="true"]');
      const lastQuestionField = newElements[newElements.length - 2]; // Second to last (question field)
      if (lastQuestionField) {
        (lastQuestionField as HTMLElement).focus();
      }
    }, 100);
  };

  const handleDeletePair = (pairId: string) => {
    const updatedPairs = content.pairs.filter(pair => pair.id !== pairId);
    setLocalPairs(updatedPairs);
    onUpdate({
      ...content,
      pairs: updatedPairs
    });
  };

  const handleUpdatePairLocal = (pairId: string, updates: Partial<ConfigurableQAPair>) => {
    // Only update local state - no saving to Firebase while editing
    const updatedPairs = localPairs.map(pair =>
      pair.id === pairId ? { ...pair, ...updates } : pair
    );
    setLocalPairs(updatedPairs);
  };

  const handleSavePair = (pairId: string) => {
    // Save to Firebase when done editing (on blur)
    const pairToSave = localPairs.find(p => p.id === pairId);
    if (!pairToSave) return;

    // Only save if there's actual content
    if (pairToSave.question.trim() || pairToSave.answer.trim()) {
      onUpdate({
        ...content,
        pairs: localPairs
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Section Description (title is handled by main section header) */}
      {content.settings.sectionDescription && (
        <div>
          <p className="text-gray-600 dark:text-gray-400">
            {content.settings.sectionDescription}
          </p>
        </div>
      )}

      {/* Existing Q&A Pairs - Beautiful Interview Dialogue Style */}
      <div className="space-y-6">
        {localPairs.map((pair) => (
          <div
            key={pair.id}
            className="space-y-3 group/pair relative"
            onBlur={(e) => {
              // Only save when focus leaves the entire pair
              const currentTarget = e.currentTarget;
              setTimeout(() => {
                if (!currentTarget.contains(document.activeElement)) {
                  handleSavePair(pair.id);
                }
              }, 0);
            }}
          >
            {/* Delete button positioned at top right of entire pair */}
            {isEditable && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDeletePair(pair.id);
                }}
                className="absolute -top-2 -right-2 h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover/pair:opacity-100 transition-opacity z-10 rounded-full shadow-sm"
                title="Delete this Q&A pair"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}

            {/* Question - Inline editing style */}
            <div className="pl-4 border-l-4 border-blue-500 dark:border-blue-400">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2 uppercase tracking-wide">
                {content.settings.questionLabel}
              </p>
              {isEditable ? (
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => {
                    const newValue = e.currentTarget.textContent || '';
                    handleUpdatePairLocal(pair.id, { question: newValue });
                  }}
                  className="w-full text-gray-900 dark:text-gray-100 whitespace-pre-wrap outline-none focus:bg-blue-50/50 dark:focus:bg-blue-900/10 rounded px-2 py-1 -mx-2 -my-1 min-h-[2.5rem] cursor-text"
                >
                  {pair.question}
                </div>
              ) : (
                <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{pair.question}</p>
              )}
            </div>

            {/* Answer - Inline editing style */}
            <div className="pl-4 border-l-4 border-green-500 dark:border-green-400">
              <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-2 uppercase tracking-wide">
                {content.settings.answerLabel}
              </p>
              {isEditable ? (
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => {
                    const newValue = e.currentTarget.textContent || '';
                    handleUpdatePairLocal(pair.id, { answer: newValue });
                  }}
                  className="w-full text-gray-900 dark:text-gray-100 whitespace-pre-wrap outline-none focus:bg-green-50/50 dark:focus:bg-green-900/10 rounded px-2 py-1 -mx-2 -my-1 min-h-[4rem] cursor-text"
                >
                  {pair.answer}
                </div>
              ) : (
                <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{pair.answer}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add New Q&A Button at Bottom */}
      {isEditable && (
        <Button
          onClick={handleAddPair}
          variant="outline"
          className="w-full border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Q&A Pair
        </Button>
      )}
    </div>
  );
}

function BulletListRenderer({
  content,
  onUpdate,
  isEditable
}: {
  content: BulletListContent;
  onUpdate: (content: SectionContent) => void;
  isEditable: boolean;
}) {
  const [newItem, setNewItem] = useState({
    title: '',
    description: '',
    type: content.settings.typeOptions[0]?.key || ''
  });
  const [editingItem, setEditingItem] = useState<string | null>(null);

  const handleAddItem = () => {
    if (!newItem.title.trim() || !newItem.type) return;

    const item: BulletListItem = {
      id: Date.now().toString(),
      title: newItem.title.trim(),
      description: newItem.description.trim() || undefined,
      type: newItem.type,
      order: Object.values(content.items).flat().length
    };

    const updatedItems = { ...content.items };
    if (!updatedItems[newItem.type]) {
      updatedItems[newItem.type] = [];
    }
    updatedItems[newItem.type].push(item);

    onUpdate({
      ...content,
      items: updatedItems
    });

    setNewItem({ title: '', description: '', type: content.settings.typeOptions[0]?.key || '' });
  };

  const handleDeleteItem = (itemId: string, type: string) => {
    const updatedItems = { ...content.items };
    updatedItems[type] = updatedItems[type].filter(item => item.id !== itemId);

    onUpdate({
      ...content,
      items: updatedItems
    });
  };

  const handleUpdateItem = (itemId: string, type: string, updates: Partial<BulletListItem>) => {
    const updatedItems = { ...content.items };
    updatedItems[type] = updatedItems[type].map(item =>
      item.id === itemId ? { ...item, ...updates } : item
    );

    onUpdate({
      ...content,
      items: updatedItems
    });
  };

  const getTypeColor = (typeKey: string) => {
    const typeOption = content.settings.typeOptions.find(opt => opt.key === typeKey);
    return typeOption?.color || 'gray';
  };

  const getTypeLabel = (typeKey: string) => {
    const typeOption = content.settings.typeOptions.find(opt => opt.key === typeKey);
    return typeOption?.label || typeKey;
  };

  // Get checkmark color based on type color
  const getCheckmarkColor = (color: string) => {
    const colorMap: Record<string, string> = {
      green: 'text-green-500',
      blue: 'text-blue-500',
      red: 'text-red-500',
      orange: 'text-orange-500',
      purple: 'text-purple-500',
      gray: 'text-gray-400'
    };
    return colorMap[color] || 'text-gray-400';
  };

  // Get header color based on type color
  const getHeaderColor = (color: string) => {
    const colorMap: Record<string, string> = {
      green: 'text-green-600 dark:text-green-400',
      blue: 'text-blue-600 dark:text-blue-400',
      red: 'text-red-600 dark:text-red-400',
      orange: 'text-orange-600 dark:text-orange-400',
      purple: 'text-purple-600 dark:text-purple-400',
      gray: 'text-gray-700 dark:text-gray-300'
    };
    return colorMap[color] || 'text-gray-700 dark:text-gray-300';
  };

  // Separate out-of-scope items from regular types
  const regularTypes = content.settings.typeOptions.filter(opt => opt.key !== 'out-of-scope');
  const outOfScopeType = content.settings.typeOptions.find(opt => opt.key === 'out-of-scope');
  const outOfScopeItems = outOfScopeType ? (content.items[outOfScopeType.key] || []) : [];

  return (
    <div className="space-y-6">
      {/* Section Description */}
      {content.settings.sectionDescription && (
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          {content.settings.sectionDescription}
        </p>
      )}

      {/* Main Requirements Grid - Beautiful two-column layout */}
      <div className="grid md:grid-cols-2 gap-6">
        {regularTypes.map((typeOption) => {
          const items = content.items[typeOption.key] || [];
          const checkmarkColor = getCheckmarkColor(typeOption.color);
          const headerColor = getHeaderColor(typeOption.color);

          return (
            <div key={typeOption.key}>
              <h4 className={`font-medium mb-3 ${headerColor}`}>
                {typeOption.label}
              </h4>
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="group relative">
                    {editingItem === item.id ? (
                      <div className="space-y-2 p-3 border border-gray-200 dark:border-gray-700 rounded">
                        <Input
                          value={item.title}
                          onChange={(e) => handleUpdateItem(item.id, typeOption.key, { title: e.target.value })}
                          placeholder="Item title..."
                        />
                        {content.settings.showDescriptions && (
                          <Textarea
                            value={item.description || ''}
                            onChange={(e) => handleUpdateItem(item.id, typeOption.key, { description: e.target.value })}
                            placeholder="Item description..."
                            rows={2}
                          />
                        )}
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => setEditingItem(null)}>Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingItem(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <span className={`${checkmarkColor} mr-2 mt-0.5`}>✓</span>
                        <div className="flex-1">
                          <div className="font-medium text-sm text-gray-900 dark:text-white">{item.title}</div>
                          {content.settings.showDescriptions && item.description && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{item.description}</div>
                          )}
                        </div>
                        {isEditable && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingItem(item.id)}
                              className="h-6 w-6 p-0"
                            >
                              <Edit3 className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteItem(item.id, typeOption.key)}
                              className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="text-gray-500 text-sm italic p-2">
                    No {typeOption.label.toLowerCase()} items yet
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Out of Scope Section - Separate styling */}
      {outOfScopeType && outOfScopeItems.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
          <h4 className="font-medium mb-2 text-gray-700 dark:text-gray-300">
            {outOfScopeType.label}
          </h4>
          <div className="space-y-1">
            {outOfScopeItems.map((item) => (
              <div key={item.id} className="group relative flex items-start">
                <span className="text-gray-400 mr-2">•</span>
                <div className="flex-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{item.title}</span>
                  {content.settings.showDescriptions && item.description && (
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">{item.description}</div>
                  )}
                </div>
                {isEditable && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingItem(item.id)}
                      className="h-6 w-6 p-0"
                    >
                      <Edit3 className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteItem(item.id, outOfScopeType.key)}
                      className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add New Item - Beautiful form */}
      {isEditable && content.settings.allowQuickAdd && (
        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <h4 className="font-medium text-gray-900 dark:text-white">Add New Item</h4>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type:
              </label>
              <Select
                value={newItem.type}
                onValueChange={(value) => setNewItem({ ...newItem, type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {content.settings.typeOptions.map((option) => {
                    // Map color names to actual color values
                    const colorMap: Record<string, string> = {
                      green: '#10b981',
                      blue: '#3b82f6',
                      red: '#ef4444',
                      orange: '#f97316',
                      purple: '#a855f7',
                      gray: '#6b7280'
                    };
                    const bgColor = colorMap[option.color] || colorMap.gray;

                    return (
                      <SelectItem key={option.key} value={option.key}>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: bgColor }}
                          />
                          {option.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title:
              </label>
              <Input
                value={newItem.title}
                onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                placeholder="Item title..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description:
              </label>
              <Input
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                placeholder="Optional details..."
              />
            </div>
          </div>
          <Button
            onClick={handleAddItem}
            disabled={!newItem.title.trim() || !newItem.type}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        </div>
      )}
    </div>
  );
}

// Proper Markdown Viewer - render as plain formatted text like example preview
function MarkdownViewer({ content }: { content: string }) {
  if (!content) {
    return <div className="text-gray-500 italic">No content</div>;
  }

  // Split content into lines and render with proper formatting
  const lines = content.split('\n');
  const elements: JSX.Element[] = [];

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();

    // H1 (# )
    if (trimmedLine.startsWith('# ')) {
      elements.push(
        <h1 key={index} className="text-3xl font-bold text-gray-900 dark:text-white mb-6 mt-8">
          {trimmedLine.substring(2)}
        </h1>
      );
    }
    // H2 (## )
    else if (trimmedLine.startsWith('## ')) {
      elements.push(
        <h2 key={index} className="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-8">
          {trimmedLine.substring(3)}
        </h2>
      );
    }
    // H3 (### )
    else if (trimmedLine.startsWith('### ')) {
      elements.push(
        <h3 key={index} className="text-xl font-bold text-gray-900 dark:text-white mb-3 mt-6">
          {trimmedLine.substring(4)}
        </h3>
      );
    }
    // H4 (#### )
    else if (trimmedLine.startsWith('#### ')) {
      elements.push(
        <h4 key={index} className="text-lg font-semibold text-gray-900 dark:text-white mb-2 mt-4">
          {trimmedLine.substring(5)}
        </h4>
      );
    }
    // Bullet list item
    else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
      const text = trimmedLine.substring(2);
      // Parse bold text (**text**)
      const parts = text.split(/(\*\*.*?\*\*)/g);
      elements.push(
        <div key={index} className="flex items-start gap-3 mb-2">
          <span className="text-indigo-500 font-bold text-lg mt-0.5">•</span>
          <span className="text-gray-700 dark:text-gray-300 leading-relaxed flex-1">
            {parts.map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="font-bold text-gray-900 dark:text-white">{part.slice(2, -2)}</strong>;
              }
              return <span key={i}>{part}</span>;
            })}
          </span>
        </div>
      );
    }
    // Numbered list item
    else if (/^\d+\.\s/.test(trimmedLine)) {
      const text = trimmedLine.replace(/^\d+\.\s/, '');
      const parts = text.split(/(\*\*.*?\*\*)/g);
      elements.push(
        <div key={index} className="flex items-start gap-3 mb-2 ml-6">
          <span className="text-gray-700 dark:text-gray-300 leading-relaxed">
            {parts.map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="font-bold text-gray-900 dark:text-white">{part.slice(2, -2)}</strong>;
              }
              return <span key={i}>{part}</span>;
            })}
          </span>
        </div>
      );
    }
    // Empty line
    else if (trimmedLine === '') {
      elements.push(<div key={index} className="h-2" />);
    }
    // Regular paragraph
    else if (trimmedLine) {
      const parts = trimmedLine.split(/(\*\*.*?\*\*)/g);
      elements.push(
        <p key={index} className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
          {parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={i} className="font-bold text-gray-900 dark:text-white">{part.slice(2, -2)}</strong>;
            }
            return <span key={i}>{part}</span>;
          })}
        </p>
      );
    }
  });

  return <div className="space-y-1">{elements}</div>;
}
