'use client';

import Link from 'next/link';
import type { Route } from 'next';
import React, { useState, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFirebaseProject } from '@/hooks/useFirebaseProjects';
import { useAIGenerationQueue } from '@/hooks/useAIGenerationQueue';
import { ProjectPage, PageSection, PageMetadata } from '@/lib/project-data-model';
import { DynamicPageRenderer } from '@/components/project/DynamicPageRenderer';
import { projectUtils } from '@/lib/firebase-projects';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { AddPageDialog } from '@/components/ui/add-page-dialog';
import { PageSettingsDialog } from '@/components/ui/page-settings-dialog';
import { ExportDialog } from '@/components/ui/export-dialog';

// UI Components
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Icons
import {
  ArrowLeft,
  Settings,
  Share,
  Download,
  MoreVertical,
  Users,
  Lock,
  Globe,
  CheckCircle,
  Clock,
  PlayCircle,
  AlertCircle,
  FileText,
  Layers,
  BarChart3,
  Plus,
  Trash2
} from 'lucide-react';

export default function ProjectWorkspacePage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageIdFromUrl = searchParams.get('page');

  const {
    project,
    currentPage,
    loading,
    pageLoading,
    error,
    user,
    loadPage,
    updatePage,
    updateSection,
    addSection,
    addPage,
    deletePage,
    deleteSection,
    refreshProject
  } = useFirebaseProject(params.id);

  const [activePageId, setActivePageId] = useState<string>(pageIdFromUrl || '');
  const [addPageDialog, setAddPageDialog] = useState(false);
  const [pageSettingsDialog, setPageSettingsDialog] = useState<{
    isOpen: boolean;
    page: ProjectPage | null;
  }>({ isOpen: false, page: null });
  const [deletePageDialog, setDeletePageDialog] = useState<{
    isOpen: boolean;
    pageId: string | null;
    pageName: string | null;
  }>({ isOpen: false, pageId: null, pageName: null });
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null);
  const [dragOverPageId, setDragOverPageId] = useState<string | null>(null);
  const [exportDialog, setExportDialog] = useState(false);

  // Sync activePageId with URL parameter
  React.useEffect(() => {
    if (!project || Object.keys(project.pageMetadata).length === 0) return;

    // If URL has a page param and it exists in project, sync to it
    if (pageIdFromUrl && project.pageMetadata[pageIdFromUrl]) {
      setActivePageId(pageIdFromUrl);
    }
    // If no URL param and no active page, default to first page
    else if (!pageIdFromUrl && !activePageId) {
      const firstPageMetadata = Object.values(project.pageMetadata).sort((a, b) => a.order - b.order)[0];
      setActivePageId(firstPageMetadata.id);
      router.replace(`/projects/${params.id}?page=${firstPageMetadata.id}` as any, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, pageIdFromUrl, params.id, router]); // activePageId intentionally excluded

  // Initialize AI generation queue
  const { queueSections } = useAIGenerationQueue({
    onSectionUpdate: updateSection,
  });

  // Load page when activePageId changes
  React.useEffect(() => {
    if (activePageId && project) {
      loadPage(activePageId);
    }
  }, [activePageId, project, loadPage]);

  // Auto-start AI generation queue when current page loads with queued sections
  React.useEffect(() => {
    if (currentPage && project && project.generateWithAI) {
      const queuedSections: any[] = [];
      const now = Date.now();
      const STUCK_TIMEOUT = 5 * 60 * 1000; // 5 minutes

      Object.values(currentPage.sections).forEach((section: PageSection) => {
        const aiStatus = section.progress.aiGeneration?.status;

        // NEVER re-queue completed or error sections - they're done
        if (aiStatus === 'completed' || aiStatus === 'error') {
          return;
        }

        // Check for stuck "generating" status (over 5 minutes)
        if (aiStatus === 'generating' && section.progress.aiGeneration?.startedAt) {
          const startedAt = new Date(section.progress.aiGeneration.startedAt).getTime();
          const elapsed = now - startedAt;

          if (elapsed > STUCK_TIMEOUT) {
            // Reset to queued state so it can be retried
            updateSection(currentPage.id, section.id, {
              progress: {
                ...section.progress,
                aiGeneration: {
                  status: 'queued',
                  queuedAt: new Date().toISOString()
                }
              }
            });
            return;
          }
        }

        if (aiStatus === 'queued') {
          queuedSections.push({
            pageId: currentPage.id,
            sectionId: section.id,
            section: section,
            projectTitle: project.title,
            projectDescription: project.description,
            pageTitle: currentPage.title,
            pageDescription: currentPage.description
          });
        }
      });

      if (queuedSections.length > 0) {
        queueSections(queuedSections);
      }
    }
  }, [currentPage, project, queueSections, updateSection]);

  // Update URL when active page changes
  const handlePageChange = (pageId: string) => {
    setActivePageId(pageId);
    // Eagerly load the page instead of waiting for useEffect
    if (project) {
      loadPage(pageId);
    }
    router.push(`/projects/${params.id}?page=${pageId}` as any, { scroll: false });
  };

  const handleAddPage = async (page: ProjectPage) => {
    await addPage(page);
    handlePageChange(page.id); // Switch to newly created page
  };

  const handlePageSettingsClick = (page: ProjectPage) => {
    setPageSettingsDialog({
      isOpen: true,
      page: page
    });
  };

  const handleDeletePageClick = (page: PageMetadata) => {
    setDeletePageDialog({
      isOpen: true,
      pageId: page.id,
      pageName: page.title
    });
  };

  const handleDeletePageConfirm = async () => {
    if (deletePageDialog.pageId) {
      // If we're deleting the currently active page, switch to another page
      if (activePageId === deletePageDialog.pageId) {
        const remainingPages = Object.values(project?.pageMetadata || {}).filter(p => p.id !== deletePageDialog.pageId);
        if (remainingPages.length > 0) {
          const sortedRemaining = remainingPages.sort((a, b) => a.order - b.order);
          handlePageChange(sortedRemaining[0].id);
        } else {
          setActivePageId('');
          router.push(`/projects/${params.id}` as any, { scroll: false });
        }
      }

      await deletePage(deletePageDialog.pageId);
      setDeletePageDialog({ isOpen: false, pageId: null, pageName: null });
    }
  };

  // Drag and drop handlers for page reordering
  const handleDragStart = (e: React.DragEvent, pageId: string) => {
    setDraggedPageId(pageId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', pageId);
  };

  const handleDragOver = (e: React.DragEvent, pageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedPageId && draggedPageId !== pageId) {
      setDragOverPageId(pageId);
    }
  };

  const handleDragLeave = () => {
    setDragOverPageId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetPageId: string) => {
    e.preventDefault();
    setDragOverPageId(null);

    if (!draggedPageId || draggedPageId === targetPageId) {
      setDraggedPageId(null);
      return;
    }

    // Reorder pages
    const pages = sortedPages.slice();
    const draggedIndex = pages.findIndex(p => p.id === draggedPageId);
    const targetIndex = pages.findIndex(p => p.id === targetPageId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedPageId(null);
      return;
    }

    // Remove dragged page and insert at target position
    const [draggedPage] = pages.splice(draggedIndex, 1);
    pages.splice(targetIndex, 0, draggedPage);

    // Update order for all affected pages
    const updates: { [pageId: string]: number } = {};
    pages.forEach((page, index) => {
      if (page.order !== index + 1) {
        updates[page.id] = index + 1;
      }
    });

    // Batch update all page orders in Firestore
    try {
      await Promise.all(
        Object.entries(updates).map(([pageId, newOrder]) =>
          projectUtils.updatePageMetadata(params.id, pageId, { order: newOrder })
        )
      );
      await refreshProject();
    } catch (error) {
      console.error('Error reordering pages:', error);
    }

    setDraggedPageId(null);
  };

  const handleDragEnd = () => {
    setDraggedPageId(null);
    setDragOverPageId(null);
  };

  // Show loading while authentication and project data are being fetched
  if (loading) {
    return (
      <main className="max-w-7xl mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="h-96 bg-gray-200 rounded-xl"></div>
            <div className="lg:col-span-3 h-96 bg-gray-200 rounded-xl"></div>
          </div>
        </div>
      </main>
    );
  }

  // Show friendly message if not authenticated
  if (!loading && (!user || user.isAnonymous)) {
    return (
      <main className="max-w-7xl mx-auto p-6">
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-6 bg-indigo-100 dark:bg-indigo-900/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-3">
            Sign in to view this project
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-8 max-w-md mx-auto">
            This project requires authentication. Sign in to access your system design projects.
          </p>
          <Link
            href={"/projects" as any}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Go to Projects & Sign In
          </Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="h-96 bg-gray-200 rounded-xl"></div>
            <div className="lg:col-span-3 h-96 bg-gray-200 rounded-xl"></div>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-7xl mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <div className="text-red-700 dark:text-red-300">
              Error loading project: {error}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={refreshProject} variant="outline">
            Try Again
          </Button>
        </div>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="max-w-7xl mx-auto p-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Project Not Found
          </h1>
          <p className="text-gray-600 mb-6">
            The project you are looking for does not exist or has been deleted.
          </p>
          <Link
            href={'/projects' as Route}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Back to Projects
          </Link>
        </div>
      </main>
    );
  }

  const sortedPages = Object.values(project.pageMetadata).sort((a, b) => a.order - b.order);
  // currentPage is now loaded separately from the hook
  const overallCompletion = projectUtils.calculateProjectCompletion(project);

  const handlePageUpdate = (updates: Partial<ProjectPage>) => {
    if (currentPage) {
      updatePage(currentPage.id, updates);
    }
  };

  const handleSectionUpdate = (sectionId: string, updates: Partial<PageSection>) => {
    if (currentPage) {
      updateSection(currentPage.id, sectionId, updates);
    }
  };

  const handleAddSection = (section: PageSection) => {
    if (currentPage) {
      addSection(currentPage.id, section);
    }
  };

  const handleDeleteSection = (sectionId: string) => {
    if (currentPage) {
      deleteSection(currentPage.id, sectionId);
    }
  };

  const getTemplateDisplayName = (templateType: string) => {
    switch (templateType) {
      case 'system_design': return 'System Design';
      case 'ml_design': return 'ML System Design';
      case 'genai_design': return 'GenAI System Design';
      case 'product_design': return 'Product Design';
      case 'research': return 'Research Project';
      case 'custom': return 'Custom Project';
      default: return 'Unknown Template';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'active': return <PlayCircle className="w-4 h-4 text-blue-600" />;
      case 'on_hold': return <Clock className="w-4 h-4 text-orange-600" />;
      case 'cancelled': return <AlertCircle className="w-4 h-4 text-red-600" />;
      default: return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" asChild className="mb-6 p-0 h-auto text-base">
            <Link href={'/projects' as Route} className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Projects
            </Link>
          </Button>

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-3">
                {project.title}
              </h1>
              <div className="flex items-center gap-3 mb-3">
                <Badge variant="secondary" className="text-sm px-3 py-1">
                  {getTemplateDisplayName(project.templateType)}
                </Badge>
                <Badge variant="outline" className="text-sm px-3 py-1">
                  {project.metadata.complexity}
                </Badge>
                <Badge variant="outline" className="text-sm px-3 py-1">
                  {project.metadata.phase}
                </Badge>
                <div className="flex items-center gap-1">
                  {getStatusIcon(project.metadata.status)}
                  <span className="text-sm font-medium">{project.metadata.status}</span>
                </div>
              </div>
              <p className="text-muted-foreground">{project.description}</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-2xl font-bold text-foreground">{overallCompletion}%</div>
                <div className="text-sm text-muted-foreground">Complete</div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreVertical className="w-4 h-4 mr-2" />
                    Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Project Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Settings className="w-4 h-4 mr-2" />
                    Project Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    {project.settings.isPublic ? <Globe className="w-4 h-4 mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                    {project.settings.isPublic ? 'Make Private' : 'Make Public'}
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Users className="w-4 h-4 mr-2" />
                    Manage Collaborators
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Share className="w-4 h-4 mr-2" />
                    Share Project
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setExportDialog(true)}>
                    <Download className="w-4 h-4 mr-2" />
                    Export Project
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Overall Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${overallCompletion}%` }}
            />
          </div>

          {/* Project Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <Layers className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="text-lg font-semibold">{Object.keys(project.pageMetadata).length}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Pages</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-green-600" />
                  <div>
                    <div className="text-lg font-semibold">
                      {Object.values(project.pageMetadata).reduce((total, page) => total + (page.sectionCount || 0), 0)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Sections</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <div className="text-lg font-semibold">
                      {Object.values(project.pageMetadata).reduce((total, page) => total + (page.completedSections || 0), 0)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                  <div>
                    <div className="text-lg font-semibold">{project.settings.collaborators.length + 1}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Contributors</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Page Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Project Pages</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Navigate between different project sections</p>
                </div>
              </div>
              <div className="p-0">
                <nav className="space-y-1">
                  {sortedPages.map((page) => (
                    <div
                      key={page.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, page.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, page.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, page.id)}
                      onClick={() => handlePageChange(page.id)}
                      className={`group relative cursor-pointer transition-all ${
                        draggedPageId === page.id ? 'opacity-50' : ''
                      } ${
                        dragOverPageId === page.id ? 'border-t-2 border-indigo-500 pt-2' : ''
                      } ${
                        activePageId === page.id
                          ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-indigo-600'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="p-3 pr-10">
                        <div className="font-medium text-sm leading-tight break-words whitespace-normal">
                          {page.title}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1.5">
                          {page.sectionCount ? Math.round(((page.completedSections || 0) / page.sectionCount) * 100) : 0}% complete
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mt-2">
                          <div
                            className={`h-1 rounded-full transition-all ${
                              activePageId === page.id ? 'bg-indigo-600' : 'bg-gray-400 dark:bg-gray-500'
                            }`}
                            style={{ width: `${page.sectionCount ? Math.round(((page.completedSections || 0) / page.sectionCount) * 100) : 0}%` }}
                          />
                        </div>
                      </div>

                      {/* Delete button - only show if more than 1 page */}
                      {sortedPages.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePageClick(page);
                          }}
                          className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity p-1.5 rounded hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Add New Page Button */}
                  <div className="p-3">
                    <Button
                      variant="outline"
                      onClick={() => setAddPageDialog(true)}
                      className="w-full justify-start border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 bg-gray-50 dark:bg-gray-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add New Page
                    </Button>
                  </div>
                </nav>
              </div>
            </div>
          </div>

          {/* Page Content */}
          <div className="lg:col-span-4">
            {pageLoading ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="animate-pulse space-y-4 p-6">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/5"></div>
                  </div>
                </div>
              </div>
            ) : currentPage ? (
              <DynamicPageRenderer
                page={currentPage}
                project={project}
                onUpdatePage={handlePageUpdate}
                onUpdateSection={handleSectionUpdate}
                onAddSection={handleAddSection}
                onDeleteSection={handleDeleteSection}
                onPageSettings={() => {
                  console.log('Page Settings clicked');
                  console.log('currentPage:', currentPage);
                  console.log('project.pageMetadata:', project.pageMetadata);

                  // Need to convert currentPage back to full page for settings
                  const pageMetadata = project.pageMetadata[currentPage.id];
                  console.log('Found pageMetadata:', pageMetadata);

                  if (pageMetadata) {
                    handlePageSettingsClick({ ...currentPage, ...pageMetadata });
                  } else {
                    console.warn('No pageMetadata found for page:', currentPage.id);
                    // Try to open dialog anyway with just currentPage
                    handlePageSettingsClick(currentPage);
                  }
                }}
                isEditable={true}
              />
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="py-12 px-6 text-center">
                  <FileText className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Pages Found</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    This project doesn't have any pages yet. You can add pages using the project template.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Add Page Dialog */}
        <AddPageDialog
          isOpen={addPageDialog}
          onOpenChange={setAddPageDialog}
          onAddPage={handleAddPage}
          existingPageCount={Object.keys(project?.pageMetadata || {}).length}
        />

        {/* Delete Page Confirmation Dialog */}
        <DeleteConfirmationDialog
          isOpen={deletePageDialog.isOpen}
          onOpenChange={(open) => setDeletePageDialog(prev => ({ ...prev, isOpen: open }))}
          onConfirm={handleDeletePageConfirm}
          title="Delete Page"
          itemName={deletePageDialog.pageName || undefined}
          itemType="page"
          description={`Are you sure you want to delete the page "${deletePageDialog.pageName}"? All sections and content within this page will be permanently lost. This action cannot be undone.`}
        />

        {/* Page Settings Dialog */}
        <PageSettingsDialog
          isOpen={pageSettingsDialog.isOpen}
          onOpenChange={(open) => setPageSettingsDialog(prev => ({ ...prev, isOpen: open }))}
          page={pageSettingsDialog.page}
          onUpdatePage={updatePage}
        />

        {/* Export Dialog */}
        <ExportDialog
          isOpen={exportDialog}
          onOpenChange={setExportDialog}
          projectId={project.id}
          projectTitle={project.title}
          project={project}
          pages={[]} // Pages will be loaded in the dialog
        />
      </div>
    </main>
  );
}