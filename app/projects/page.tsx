'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebaseProjects } from '@/hooks/useFirebaseProjects';
import { Project as FlexibleProject, ProjectTemplate } from '@/lib/project-data-model';
import { projectUtils } from '@/lib/firebase-projects';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function ProjectsPage() {
  const router = useRouter();
  const { projects, loading, error, user, deleteProject } = useFirebaseProjects();
  const [filterStatus, setFilterStatus] = useState('All Projects');
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    projectId: string | null;
    projectName: string | null;
  }>({ isOpen: false, projectId: null, projectName: null });

  const handleDeleteClick = (project: FlexibleProject) => {
    setDeleteDialog({
      isOpen: true,
      projectId: project.id,
      projectName: project.title
    });
  };

  const handleDeleteConfirm = async () => {
    if (deleteDialog.projectId) {
      await deleteProject(deleteDialog.projectId);
      setDeleteDialog({ isOpen: false, projectId: null, projectName: null });
    }
  };

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-neutral-200 dark:bg-neutral-800 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-neutral-200 dark:bg-neutral-800 rounded-xl"></div>
            ))}
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-neutral-200 dark:bg-neutral-800 rounded-xl"></div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // Show friendly message if no user logged in
  if (!user) {
    return (
      <main className="max-w-6xl mx-auto p-6">
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-6 bg-indigo-100 dark:bg-indigo-900/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-3">
            Sign in to access projects
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-8 max-w-md mx-auto">
            Create and manage system design projects with templates for distributed systems, ML systems, and GenAI applications.
          </p>
          <Link
            href="/projects/create"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Sign In & Create Project
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
            Error loading projects
          </h3>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            {error}
          </p>
        </div>
      </main>
    );
  }

  const statusCounts = {
    active: projects.filter(p => p.metadata.status === 'active').length,
    completed: projects.filter(p => p.metadata.status === 'completed').length,
    on_hold: projects.filter(p => p.metadata.status === 'on_hold').length,
    cancelled: projects.filter(p => p.metadata.status === 'cancelled').length
  };

  const filteredProjects = filterStatus === 'All Projects'
    ? projects
    : projects.filter(p => p.metadata.status === filterStatus.toLowerCase().replace(' ', '_'));

  const formatLastModified = (updatedAt: string) => {
    const date = new Date(updatedAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const getTemplateDisplayName = (templateType: ProjectTemplate) => {
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

  const getStatusDisplayName = (status: string) => {
    switch (status) {
      case 'active': return 'Active';
      case 'completed': return 'Completed';
      case 'on_hold': return 'On Hold';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  return (
    <main className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-neutral-100">
            My Projects
          </h1>
          <Link 
            href="/projects/create" 
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </Link>
        </div>
        <p className="text-lg text-neutral-600 dark:text-neutral-400">
          Design your own systems from scratch. Input your ideas, work through requirements, 
          architect solutions, and build a portfolio of system designs.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{statusCounts.completed}</div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">Completed</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{statusCounts.active}</div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">Active</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{statusCounts.on_hold}</div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">On Hold</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-900/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{statusCounts.cancelled}</div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">Cancelled</div>
            </div>
          </div>
        </div>
      </div>

      {/* Project List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            Your Projects
          </h2>
          <div className="flex items-center gap-4">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Projects">All Projects</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="On Hold">On Hold</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <button className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
              <button className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          {filteredProjects.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-neutral-500 dark:text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                No projects found
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                {filterStatus === 'All Projects' 
                  ? 'Start your system design journey by creating your first project.'
                  : `No projects with status "${filterStatus}".`}
              </p>
              {filterStatus === 'All Projects' && (
                <Link 
                  href="/projects/create" 
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  Create Your First Project
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              )}
            </div>
          ) : (
            filteredProjects.map((project) => {
              const overallCompletion = projectUtils.calculateProjectCompletion(project);

              return (
                <div
                  key={project.id}
                  onClick={() => router.push(`/projects/${project.id}`)}
                  className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                          {project.title}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          project.metadata.status === 'completed'
                            ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                            : project.metadata.status === 'active'
                            ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                            : project.metadata.status === 'on_hold'
                            ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400'
                            : 'bg-gray-100 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400'
                        }`}>
                          {getStatusDisplayName(project.metadata.status)}
                        </span>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400">
                          {getTemplateDisplayName(project.templateType)}
                        </span>
                      </div>
                      <p className="text-neutral-600 dark:text-neutral-400 mb-3">
                        {project.description}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-500">
                        <div>Complexity: {project.metadata.complexity}</div>
                        <div>Phase: {project.metadata.phase}</div>
                        <div>{overallCompletion}% Complete</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/projects/${project.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm font-medium"
                      >
                        Open
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </Link>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                        Pages ({Object.keys(project.pageMetadata || {}).length})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Object.values(project.pageMetadata || {}).slice(0, 4).map((page) => (
                          <span
                            key={page.id}
                            className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded text-xs"
                          >
                            {page.title}
                          </span>
                        ))}
                        {Object.keys(project.pageMetadata || {}).length > 4 && (
                          <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded text-xs">
                            +{Object.keys(project.pageMetadata || {}).length - 4} more
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm text-neutral-500 dark:text-neutral-500">
                      <div>Last modified {formatLastModified(project.updatedAt)}</div>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-neutral-700 dark:hover:text-neutral-300"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-neutral-700 dark:hover:text-neutral-300"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(project);
                          }}
                          className="hover:text-red-600 dark:hover:text-red-400"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, isOpen: open }))}
        onConfirm={handleDeleteConfirm}
        title="Delete Project"
        itemName={deleteDialog.projectName || undefined}
        itemType="project"
        description={`Are you sure you want to delete "${deleteDialog.projectName}"? All pages, content, and progress will be permanently lost. This action cannot be undone.`}
      />
    </main>
  );
}