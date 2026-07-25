'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Project as FlexibleProject,
  ProjectPage,
  PageSection,
  ProjectTemplate,
  ProgressStatus
} from '@/lib/project-data-model';
import { FirebaseProjectService, projectUtils } from '@/lib/firebase-projects';
import { auth } from '@/lib/firebase';
import { User } from 'firebase/auth';

export function useFirebaseProjects() {
  const [projects, setProjects] = useState<FlexibleProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        loadProjects();
      } else {
        setProjects([]);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const userProjects = await FirebaseProjectService.getUserProjects();
      setProjects(userProjects);
    } catch (error) {
      console.error('Error loading projects:', error);
      setError(error instanceof Error ? error.message : 'Failed to load projects');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (
    title: string,
    description: string,
    templateType: ProjectTemplate,
    customizations?: Partial<FlexibleProject>
  ) => {
    try {
      setError(null);
      const project = await FirebaseProjectService.createProject(
        title,
        description,
        templateType,
        customizations
      );
      await loadProjects(); // Refresh the list
      return project;
    } catch (error) {
      console.error('Error creating project:', error);
      setError(error instanceof Error ? error.message : 'Failed to create project');
      throw error;
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      setError(null);
      await FirebaseProjectService.deleteProject(projectId);
      await loadProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete project');
      throw error;
    }
  };

  const updateProject = async (projectId: string, updates: Partial<FlexibleProject>) => {
    try {
      setError(null);
      await FirebaseProjectService.updateProject(projectId, updates);
      await loadProjects();
    } catch (error) {
      console.error('Error updating project:', error);
      setError(error instanceof Error ? error.message : 'Failed to update project');
      throw error;
    }
  };

  const getProjectStats = () => {
    const stats = {
      total: projects.length,
      draft: projects.filter(p => p.metadata.status === 'draft').length,
      active: projects.filter(p => p.metadata.status === 'active').length,
      completed: projects.filter(p => p.metadata.status === 'completed').length,
      archived: projects.filter(p => p.metadata.status === 'archived').length,
      averageCompletion: 0,
    };

    // Calculate average completion
    const totalCompletion = projects.reduce((sum, project) => {
      return sum + projectUtils.calculateProjectCompletion(project);
    }, 0);
    stats.averageCompletion = projects.length > 0 ? Math.round(totalCompletion / projects.length) : 0;

    return stats;
  };

  const getProjectsByStatus = (status: string) => {
    if (status === 'all') return projects;
    return projects.filter(p => p.metadata.status === status);
  };

  const getProjectSummaries = () => {
    return projects.map(project => projectUtils.generateProjectSummary(project));
  };

  return {
    projects,
    loading,
    error,
    user,
    createProject,
    deleteProject,
    updateProject,
    getProjectStats,
    getProjectsByStatus,
    getProjectSummaries,
    refreshProjects: loadProjects,
    clearError: () => setError(null)
  };
}

export function useFirebaseProject(projectId: string) {
  const [project, setProject] = useState<FlexibleProject | null>(null);
  const [currentPage, setCurrentPage] = useState<ProjectPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  // Debouncing for section updates
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadProject = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const foundProject = await FirebaseProjectService.getProject(projectId);
      setProject(foundProject);
    } catch (error) {
      console.error('Error loading project:', error);
      setError(error instanceof Error ? error.message : 'Failed to load project');
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadPage = useCallback(async (pageId: string) => {
    try {
      setPageLoading(true);
      setError(null);
      const page = await FirebaseProjectService.getProjectPage(projectId, pageId);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error loading page:', error);
      setError(error instanceof Error ? error.message : 'Failed to load page');
      setCurrentPage(null);
    } finally {
      setPageLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      if (currentUser && projectId) {
        loadProject();
      } else {
        setProject(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      // Cleanup debounce timeout on unmount
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [projectId]); // Removed loadProject from deps - it's memoized and only changes with projectId

  const updateProject = async (updates: Partial<FlexibleProject>) => {
    try {
      setError(null);

      // Optimistic update
      if (project) {
        setProject({ ...project, ...updates });
      }

      await FirebaseProjectService.updateProject(projectId, updates);
    } catch (error) {
      console.error('Error updating project:', error);
      setError(error instanceof Error ? error.message : 'Failed to update project');
      // Revert optimistic update by reloading
      await loadProject();
      throw error;
    }
  };

  const updatePage = async (pageId: string, pageUpdates: Partial<ProjectPage>) => {
    try {
      setError(null);

      // Optimistically update the current page state immediately
      if (currentPage && currentPage.id === pageId) {
        setCurrentPage({
          ...currentPage,
          ...pageUpdates
        });
      }

      // Debounce Firebase update (same pattern as updateSection)
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(async () => {
        try {
          await FirebaseProjectService.updateProjectPage(projectId, pageId, pageUpdates);
        } catch (error) {
          console.error('Error updating page in Firebase:', error);
          // Reload to revert optimistic update on error
          await loadProject();
        }
      }, 2000); // 2 second debounce like updateSection
    } catch (error) {
      console.error('Error updating page:', error);
      setError(error instanceof Error ? error.message : 'Failed to update page');
      throw error;
    }
  };

  const updateSection = async (pageId: string, sectionId: string, sectionUpdates: Partial<PageSection>) => {
    try {
      setError(null);

      // Optimistically update the current page state immediately
      if (currentPage && currentPage.id === pageId) {
        const updatedSections = {
          ...currentPage.sections,
          [sectionId]: {
            ...currentPage.sections[sectionId],
            ...sectionUpdates
          }
        };

        setCurrentPage({
          ...currentPage,
          sections: updatedSections
        });

        // Note: We don't update project.pageMetadata here to avoid triggering
        // a re-render that would reload the project with stale data.
        // The completion stats are calculated dynamically from currentPage.sections,
        // and the pageMetadata in Firestore will be updated by the debounced call below.
      }

      // Check if this is a critical update (AI generation completion/error)
      const isCriticalUpdate =
        sectionUpdates.progress?.aiGeneration?.status === 'completed' ||
        sectionUpdates.progress?.aiGeneration?.status === 'error';

      if (isCriticalUpdate) {
        // Immediate update for critical AI status changes (no debounce)
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }
        try {
          await FirebaseProjectService.updatePageSection(projectId, pageId, sectionId, sectionUpdates);
        } catch (error) {
          console.error('Error saving critical update to Firestore:', error);
          // Revert optimistic update by reloading
          await loadPage(pageId);
          await loadProject();
        }
      } else {
        // Clear any existing timeout
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }

        // Debounce Firestore update (2 seconds) for non-critical updates
        updateTimeoutRef.current = setTimeout(async () => {
          try {
            await FirebaseProjectService.updatePageSection(projectId, pageId, sectionId, sectionUpdates);
            // No need to reload - optimistic update already applied
          } catch (error) {
            console.error('Error saving section to Firestore:', error);
            // Revert optimistic update by reloading
            await loadPage(pageId);
            await loadProject();
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Error updating section:', error);
      setError(error instanceof Error ? error.message : 'Failed to update section');
      throw error;
    }
  };

  const updateSectionContent = async (pageId: string, sectionId: string, content: any) => {
    try {
      setError(null);
      await FirebaseProjectService.updateSectionContent(projectId, pageId, sectionId, content);
      await loadProject();
    } catch (error) {
      console.error('Error updating section content:', error);
      setError(error instanceof Error ? error.message : 'Failed to update content');
      throw error;
    }
  };

  const markSectionCompleted = async (pageId: string, sectionId: string) => {
    try {
      setError(null);
      await FirebaseProjectService.markSectionCompleted(projectId, pageId, sectionId);
      await loadProject();
    } catch (error) {
      console.error('Error marking section completed:', error);
      setError(error instanceof Error ? error.message : 'Failed to mark section completed');
      throw error;
    }
  };

  const updateSectionProgress = async (pageId: string, sectionId: string, status: ProgressStatus) => {
    try {
      setError(null);
      await FirebaseProjectService.updatePageSection(projectId, pageId, sectionId, {
        progress: {
          status,
          completionPercentage: status === 'completed' ? 100 : status === 'in_progress' ? 50 : 0,
          lastUpdated: new Date().toISOString()
        }
      });
      await loadProject();
    } catch (error) {
      console.error('Error updating section progress:', error);
      setError(error instanceof Error ? error.message : 'Failed to update progress');
      throw error;
    }
  };

  const addPage = async (page: ProjectPage) => {
    try {
      setError(null);
      await FirebaseProjectService.addProjectPage(projectId, page);
      await loadProject();
    } catch (error) {
      console.error('Error adding page:', error);
      setError(error instanceof Error ? error.message : 'Failed to add page');
      throw error;
    }
  };

  const addSection = async (pageId: string, section: PageSection) => {
    try {
      setError(null);
      await FirebaseProjectService.addPageSection(projectId, pageId, section);
      await loadProject();
    } catch (error) {
      console.error('Error adding section:', error);
      setError(error instanceof Error ? error.message : 'Failed to add section');
      throw error;
    }
  };

  const deletePage = async (pageId: string) => {
    try {
      setError(null);
      await FirebaseProjectService.deleteProjectPage(projectId, pageId);
      await loadProject(); // Reload to update page metadata
    } catch (error) {
      console.error('Error deleting page:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete page');
      throw error;
    }
  };

  const deleteSection = async (pageId: string, sectionId: string) => {
    try {
      setError(null);
      await FirebaseProjectService.deletePageSection(projectId, pageId, sectionId);
      await loadProject(); // Reload to update page metadata
    } catch (error) {
      console.error('Error deleting section:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete section');
      throw error;
    }
  };

  const getCompletionPercentage = () => {
    return project ? projectUtils.calculateProjectCompletion(project) : 0;
  };

  const getNextIncompletePage = () => {
    return project ? projectUtils.getNextIncompletePage(project) : null;
  };

  const getProjectSummary = () => {
    return project ? projectUtils.generateProjectSummary(project) : null;
  };

  return {
    project,
    currentPage,
    loading,
    pageLoading,
    error,
    user,
    loadPage,
    updateProject,
    updatePage,
    updateSection,
    updateSectionContent,
    updateSectionProgress,
    markSectionCompleted,
    addPage,
    addSection,
    deletePage,
    deleteSection,
    getCompletionPercentage,
    getNextIncompletePage,
    getProjectSummary,
    refreshProject: loadProject,
    clearError: () => setError(null)
  };
}