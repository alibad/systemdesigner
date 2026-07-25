// Firebase integration for flexible project management
// Supports the new hierarchical Project -> Pages -> Sections data model

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  writeBatch,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { assertFirebaseConfigured, db, auth, createWhiteboardMetadata } from './firebase';
import {
  Project,
  ProjectPage,
  PageSection,
  PageMetadata,
  FirestoreProject,
  ProjectTemplate,
  ProjectTemplateDefinition,
  WhiteboardContent
} from './project-data-model';
import { getProjectTemplate } from './project-templates';

const PROJECTS_COLLECTION = 'projects';
const PROJECT_PAGES_SUBCOLLECTION = 'pages';
const USERS_COLLECTION = 'users';

// Type guards and converters
function convertFirestoreProject(firestoreProject: FirestoreProject): Project {
  return {
    ...firestoreProject,
    createdAt: firestoreProject.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    updatedAt: firestoreProject.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
  };
}

function convertToFirestoreProject(project: Project): Omit<FirestoreProject, 'id'> {
  const result = {
    ...project,
    createdAt: project.createdAt ? Timestamp.fromDate(new Date(project.createdAt)) : serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };
  return result;
}

// Project CRUD Operations
export class FirebaseProjectService {

  /**
   * Get current user ID - required for all operations
   */
  private static getCurrentUserId(): string {
    assertFirebaseConfigured('Cloud projects');
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be authenticated to access projects');
    }
    return user.uid;
  }

  /**
   * Create a new project from template
   */
  static async createProject(
    title: string,
    description: string,
    templateType: ProjectTemplate,
    customizations?: Partial<Project>
  ): Promise<Project> {
    const userId = this.getCurrentUserId();

    const template = getProjectTemplate(templateType);

    if (!template) {
      throw new Error(`Template '${templateType}' not found`);
    }

    // Generate project ID
    const projectRef = doc(collection(db, PROJECTS_COLLECTION));
    const projectId = projectRef.id;

    const now = new Date().toISOString();
    const nowTimestamp = Timestamp.fromDate(new Date());

    // Create base project structure from template
    const project: Project = {
      id: projectId,
      title,
      description,
      templateType,
      createdAt: now,
      updatedAt: now,
      ownerId: userId,
      pageMetadata: {},
      whiteboardId: '', // Will be set after whiteboard creation
      settings: {
        isPublic: false,
        allowComments: false,
        allowCollaboration: false,
        collaborators: [],
        template: {
          templateId: template.id,
          templateVersion: template.version,
          customizations: []
        },
        customizations: {
          theme: 'default',
          colorScheme: 'light'
        }
      },
      metadata: {
        tags: [],
        category: 'system-design',
        complexity: 'medium',
        status: 'draft',
        phase: 'planning'
      },
      ...customizations
    };

    // Create dedicated whiteboard for this project (BEFORE batch)
    const whiteboardId = await createWhiteboardMetadata(
      `${title} - Diagrams`,
      `Whiteboard for project: ${title}`,
      projectId  // Link to project for deletion protection
    );

    // Add whiteboardId to project
    project.whiteboardId = whiteboardId;

    // Use batch to create project, pages, and user tracking atomically
    const batch = writeBatch(db);

    // 1. Create pages and sections in subcollections first, building pageMetadata
    for (const pageTemplate of template.pages) {
      const pageId = pageTemplate.id;

      // Create page metadata
      project.pageMetadata[pageId] = {
        id: pageId,
        title: pageTemplate.title,
        description: pageTemplate.description,
        order: pageTemplate.order,
        sectionCount: pageTemplate.sections.length,
        completedSections: 0,
        status: 'not_started',
        lastUpdated: now
      };

      // Build sections object for this page
      const sections: Record<string, PageSection> = {};
      for (const sectionTemplate of pageTemplate.sections) {
        // Handle whiteboard sections - set the whiteboardId
        let content = sectionTemplate.defaultContent;
        if (sectionTemplate.type === 'whiteboard' && whiteboardId) {
          content = {
            ...content,
            whiteboardId: whiteboardId,
            pageId: 'page:page' // Default TLDraw page ID
          } as WhiteboardContent;
        }

        const section: PageSection = {
          id: sectionTemplate.id,
          title: sectionTemplate.title,
          type: sectionTemplate.type,
          order: sectionTemplate.order,
          content: content,
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
            lastUpdated: now,
            // Mark sections for AI generation if enabled
            ...(customizations?.generateWithAI && {
              aiGeneration: {
                status: 'queued',
                queuedAt: now
              }
            })
          }
        };
        sections[section.id] = section;
      }

      // Create page document with all sections embedded
      const page: ProjectPage = {
        id: pageId,
        title: pageTemplate.title,
        description: pageTemplate.description,
        order: pageTemplate.order,
        sections: sections,
        settings: pageTemplate.settings,
        progress: {
          status: 'not_started',
          completedSections: [],
          totalSections: pageTemplate.sections.length,
          completionPercentage: 0,
          lastUpdated: now
        }
      };

      const pageRef = doc(collection(projectRef, PROJECT_PAGES_SUBCOLLECTION), pageId);
      batch.set(pageRef, page);
    }

    // 2. Create project document with all pageMetadata
    const firestoreProject = convertToFirestoreProject(project);
    batch.set(projectRef, firestoreProject);

    // 3. Commit the batch for project creation first
    try {
      await batch.commit();
    } catch (batchError) {
      console.error('Batch write failed:', batchError);
      throw batchError as unknown as Error;
    }

    // 4. Update user document separately (after project is created)
    // This handles cases where user document might not exist or have the projects field
    try {
      const userRef = doc(db, USERS_COLLECTION, userId);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        // Update existing user document
        await updateDoc(userRef, {
          'projects.owned': arrayUnion({
            id: projectId,
            title,
            templateType,
            status: 'draft',
            lastUpdated: nowTimestamp,
            pageCount: template.pages.length,
            completion: 0,
            createdAt: nowTimestamp
          }),
          'projects.recent': arrayUnion(projectId)
        });
      } else {
        // Create user document if it doesn't exist
        await setDoc(userRef, {
          uid: userId,
          projects: {
            owned: [{
              id: projectId,
              title,
              templateType,
              status: 'draft',
              lastUpdated: nowTimestamp,
              pageCount: template.pages.length,
              completion: 0,
              createdAt: nowTimestamp
            }],
            shared: [],
            recent: [projectId]
          }
        }, { merge: true });
      }
    } catch (userUpdateError) {
      // Project was still created successfully even if user doc update fails
    }

    return project;
  }

  /**
   * Get all projects for current user (from user document)
   */
  static async getUserProjects(): Promise<Project[]> {
    const userId = this.getCurrentUserId();

    // Get user document first
    const userRef = doc(db, USERS_COLLECTION, userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return [];
    }

    const userData = userDoc.data();
    const ownedProjects = userData?.projects?.owned || [];

    // If no projects in user doc, return empty array
    if (ownedProjects.length === 0) {
      return [];
    }

    // Fetch full project documents for the projects in user doc
    const projectPromises = ownedProjects.map(async (projectSummary: any) => {
      try {
        const projectRef = doc(db, PROJECTS_COLLECTION, projectSummary.id);
        const projectDoc = await getDoc(projectRef);

        if (projectDoc.exists()) {
          const firestoreProject = { id: projectDoc.id, ...projectDoc.data() } as FirestoreProject;
          return convertFirestoreProject(firestoreProject);
        }
        return null;
      } catch (error) {
        console.error(`Error fetching project ${projectSummary.id}:`, error);
        return null;
      }
    });

    const projects = await Promise.all(projectPromises);

    // Filter out null results and sort by last updated
    return projects
      .filter((project): project is Project => project !== null)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  /**
   * Get a specific project by ID with pages loaded from subcollection
   */
  static async getProject(projectId: string): Promise<Project | null> {
    const userId = this.getCurrentUserId();
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    const projectSnap = await getDoc(projectRef);

    if (!projectSnap.exists()) {
      return null;
    }

    const firestoreProject = { id: projectSnap.id, ...projectSnap.data() } as FirestoreProject;
    const project = convertFirestoreProject(firestoreProject);

    // Verify ownership or public access
    if (project.ownerId !== userId && !project.settings.isPublic) {
      throw new Error('Project not found or access denied');
    }

    return project;
  }

  /**
   * Get a specific project page from subcollection
   */
  static async getProjectPage(projectId: string, pageId: string): Promise<ProjectPage | null> {
    const userId = this.getCurrentUserId();

    // Verify project access first
    const project = await this.getProject(projectId);
    if (!project) {
      return null;
    }

    const pageRef = doc(db, PROJECTS_COLLECTION, projectId, PROJECT_PAGES_SUBCOLLECTION, pageId);
    const pageSnap = await getDoc(pageRef);

    if (!pageSnap.exists()) {
      return null;
    }

    const page = pageSnap.data() as ProjectPage;

    // Sections are now embedded in the page document
    return page;
  }

  /**
   * Update project metadata
   */
  static async updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
    const userId = this.getCurrentUserId();
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);

    // Verify ownership
    const project = await this.getProject(projectId);
    if (!project || project.ownerId !== userId) {
      throw new Error('Project not found or access denied');
    }

    const updateData = {
      ...updates,
      updatedAt: serverTimestamp()
    };

    await updateDoc(projectRef, updateData);
  }

  /**
   * Update a specific page in a project (subcollection)
   */
  static async updateProjectPage(
    projectId: string,
    pageId: string,
    pageUpdates: Partial<ProjectPage>
  ): Promise<void> {
    const userId = this.getCurrentUserId();

    // Verify ownership
    const project = await this.getProject(projectId);
    if (!project || project.ownerId !== userId) {
      throw new Error('Project not found or access denied');
    }

    if (!project.pageMetadata[pageId]) {
      throw new Error('Page not found in project');
    }

    const batch = writeBatch(db);

    // Update page in subcollection
    const pageRef = doc(db, PROJECTS_COLLECTION, projectId, PROJECT_PAGES_SUBCOLLECTION, pageId);
    batch.update(pageRef, pageUpdates);

    // Update page metadata and project timestamp
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    batch.update(projectRef, {
      [`pageMetadata.${pageId}.lastUpdated`]: new Date().toISOString(),
      updatedAt: serverTimestamp()
    });

    await batch.commit();
  }

  /**
   * Update a specific section within a page (embedded in page document)
   */
  static async updatePageSection(
    projectId: string,
    pageId: string,
    sectionId: string,
    sectionUpdates: Partial<PageSection>
  ): Promise<void> {
    const userId = this.getCurrentUserId();

    // Verify ownership and structure
    const project = await this.getProject(projectId);
    if (!project || project.ownerId !== userId) {
      throw new Error('Project not found or access denied');
    }

    if (!project.pageMetadata[pageId]) {
      throw new Error('Page not found in project');
    }

    // Get the current page to access its sections
    const page = await this.getProjectPage(projectId, pageId);
    if (!page || !page.sections[sectionId]) {
      throw new Error('Section not found');
    }

    const updatedSection = {
      ...page.sections[sectionId],
      ...sectionUpdates,
      progress: {
        ...page.sections[sectionId].progress,
        ...sectionUpdates.progress,
        lastUpdated: new Date().toISOString()
      }
    };

    // Recalculate page completion stats after updating section
    const updatedSections = {
      ...page.sections,
      [sectionId]: updatedSection
    };
    const totalSections = Object.keys(updatedSections).length;
    const completedSections = Object.values(updatedSections).filter(
      (s: any) => s.progress?.status === 'completed'
    ).length;

    // Use batch to update page with new section data, pageMetadata, and project timestamp
    const batch = writeBatch(db);

    const pageRef = doc(db, PROJECTS_COLLECTION, projectId, PROJECT_PAGES_SUBCOLLECTION, pageId);
    batch.update(pageRef, {
      [`sections.${sectionId}`]: updatedSection
    });

    // Update pageMetadata with new completion stats
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    batch.update(projectRef, {
      [`pageMetadata.${pageId}.completedSections`]: completedSections,
      [`pageMetadata.${pageId}.sectionCount`]: totalSections,
      [`pageMetadata.${pageId}.lastModified`]: new Date().toISOString(),
      updatedAt: serverTimestamp()
    });

    await batch.commit();
  }

  /**
   * Add a new page to a project (subcollection)
   */
  static async addProjectPage(projectId: string, page: ProjectPage): Promise<void> {
    const userId = this.getCurrentUserId();

    const project = await this.getProject(projectId);
    if (!project || project.ownerId !== userId) {
      throw new Error('Project not found or access denied');
    }

    const batch = writeBatch(db);

    // Add page to subcollection
    const pageRef = doc(db, PROJECTS_COLLECTION, projectId, PROJECT_PAGES_SUBCOLLECTION, page.id);
    batch.set(pageRef, page);

    // Add page metadata to project
    const pageMetadata: PageMetadata = {
      id: page.id,
      title: page.title,
      description: page.description,
      order: page.order,
      sectionCount: Object.keys(page.sections).length,
      completedSections: 0,
      status: 'not_started',
      lastUpdated: new Date().toISOString()
    };

    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    batch.update(projectRef, {
      [`pageMetadata.${page.id}`]: pageMetadata,
      updatedAt: serverTimestamp()
    });

    await batch.commit();
  }

  /**
   * Delete a page from a project (subcollection)
   */
  static async deleteProjectPage(projectId: string, pageId: string): Promise<void> {
    const userId = this.getCurrentUserId();

    const project = await this.getProject(projectId);
    if (!project || project.ownerId !== userId) {
      throw new Error('Project not found or access denied');
    }

    const batch = writeBatch(db);

    // Delete page from subcollection
    const pageRef = doc(db, PROJECTS_COLLECTION, projectId, PROJECT_PAGES_SUBCOLLECTION, pageId);
    batch.delete(pageRef);

    // Remove page metadata from project
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    batch.update(projectRef, {
      [`pageMetadata.${pageId}`]: deleteField(),
      updatedAt: serverTimestamp()
    });

    await batch.commit();
  }

  /**
   * Delete a section from a page
   */
  static async deletePageSection(projectId: string, pageId: string, sectionId: string): Promise<void> {
    const userId = this.getCurrentUserId();
    const project = await this.getProject(projectId);
    if (!project || project.ownerId !== userId) {
      throw new Error('Project not found or access denied');
    }
    if (!project.pageMetadata[pageId]) {
      throw new Error('Page not found');
    }

    // Get page to verify section exists
    const page = await this.getProjectPage(projectId, pageId);
    if (!page || !page.sections[sectionId]) {
      throw new Error('Section not found');
    }

    const batch = writeBatch(db);

    // Delete section from page subcollection
    const pageRef = doc(db, PROJECTS_COLLECTION, projectId, PROJECT_PAGES_SUBCOLLECTION, pageId);
    batch.update(pageRef, {
      [`sections.${sectionId}`]: deleteField()
    });

    // Update page metadata
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    batch.update(projectRef, {
      [`pageMetadata.${pageId}.sectionCount`]: project.pageMetadata[pageId].sectionCount - 1,
      [`pageMetadata.${pageId}.lastUpdated`]: new Date().toISOString(),
      updatedAt: serverTimestamp()
    });

    await batch.commit();
  }

  /**
   * Add a new section to a page
   */
  static async addPageSection(
    projectId: string,
    pageId: string,
    section: PageSection
  ): Promise<void> {
    const userId = this.getCurrentUserId();

    const project = await this.getProject(projectId);
    if (!project || project.ownerId !== userId) {
      throw new Error('Project not found or access denied');
    }

    if (!project.pageMetadata[pageId]) {
      throw new Error('Page not found in project');
    }

    const batch = writeBatch(db);

    // Add section to page subcollection
    const pageRef = doc(db, PROJECTS_COLLECTION, projectId, PROJECT_PAGES_SUBCOLLECTION, pageId);
    batch.update(pageRef, {
      [`sections.${section.id}`]: section
    });

    // Update page metadata
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    batch.update(projectRef, {
      [`pageMetadata.${pageId}.sectionCount`]: project.pageMetadata[pageId].sectionCount + 1,
      [`pageMetadata.${pageId}.lastUpdated`]: new Date().toISOString(),
      updatedAt: serverTimestamp()
    });

    await batch.commit();
  }

  /**
   * Delete a project
   */
  static async deleteProject(projectId: string): Promise<void> {
    const userId = this.getCurrentUserId();

    const project = await this.getProject(projectId);
    if (!project || project.ownerId !== userId) {
      throw new Error('Project not found or access denied');
    }

    // Clean up user's projects property
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      // Remove from owned projects array (need to match the full object)
      'projects.owned': arrayRemove({
        id: projectId,
        title: project.title,
        description: project.description,
        templateType: project.templateType,
        pageCount: Object.keys(project.pageMetadata || {}).length,
        completion: projectUtils.calculateProjectCompletion(project),
        createdAt: Timestamp.fromDate(new Date(project.createdAt))
      }),
      // Remove from recent projects array (just the ID)
      'projects.recent': arrayRemove(projectId)
    });

    // Delete the project document
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    await deleteDoc(projectRef);
  }

  /**
   * Update section content (most common operation)
   */
  static async updateSectionContent(
    projectId: string,
    pageId: string,
    sectionId: string,
    content: any
  ): Promise<void> {
    await this.updatePageSection(projectId, pageId, sectionId, {
      content,
      progress: {
        status: 'in_progress',
        completionPercentage: content ? 50 : 0,
        lastUpdated: new Date().toISOString()
      }
    });
  }

  /**
   * Mark section as completed
   */
  static async markSectionCompleted(
    projectId: string,
    pageId: string,
    sectionId: string
  ): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) throw new Error('Project not found');

    if (!project.pageMetadata[pageId]) throw new Error('Page not found');

    // Get page to count completed sections
    const page = await this.getProjectPage(projectId, pageId);
    if (!page) throw new Error('Page not found');

    // Update section status
    await this.updatePageSection(projectId, pageId, sectionId, {
      progress: {
        status: 'completed',
        completionPercentage: 100,
        lastUpdated: new Date().toISOString()
      }
    });

    // Count completed sections (including this one)
    const completedCount = Object.values(page.sections).filter(s =>
      s.id === sectionId || s.progress.status === 'completed'
    ).length;

    const totalSections = Object.keys(page.sections).length;
    const isPageCompleted = completedCount === totalSections;

    // Update page metadata
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    await updateDoc(projectRef, {
      [`pageMetadata.${pageId}.completedSections`]: completedCount,
      [`pageMetadata.${pageId}.status`]: isPageCompleted ? 'completed' : 'in_progress',
      [`pageMetadata.${pageId}.lastUpdated`]: new Date().toISOString(),
      updatedAt: serverTimestamp()
    });
  }

  /**
   * Get public projects (for sharing/discovery)
   */
  static async getPublicProjects(limitCount: number = 20): Promise<Project[]> {
    const q = query(
      collection(db, PROJECTS_COLLECTION),
      where('settings.isPublic', '==', true),
      orderBy('updatedAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    const projects: Project[] = [];

    snapshot.forEach((doc) => {
      const firestoreProject = { id: doc.id, ...doc.data() } as FirestoreProject;
      projects.push(convertFirestoreProject(firestoreProject));
    });

    return projects;
  }
}

// Utility functions for common operations
export const projectUtils = {
  /**
   * Calculate overall project completion percentage
   */
  calculateProjectCompletion(project: Project): number {
    const pages = Object.values(project.pageMetadata || {});
    if (pages.length === 0) return 0;

    // Calculate completion based on completed sections vs total sections
    const totalSections = pages.reduce((sum, page) => sum + (page.sectionCount || 0), 0);
    const completedSections = pages.reduce((sum, page) => sum + (page.completedSections || 0), 0);

    if (totalSections === 0) return 0;
    return Math.round((completedSections / totalSections) * 100);
  },

  /**
   * Get next incomplete page based on metadata
   */
  getNextIncompletePage(project: Project): string | null {
    const pages = Object.entries(project.pageMetadata || {})
      .sort(([, a], [, b]) => a.order - b.order);

    for (const [pageId, page] of pages) {
      if (page.status === 'not_started' || page.status === 'in_progress') {
        return pageId;
      }
    }
    return null;
  },

  /**
   * Generate project summary for listings
   */
  generateProjectSummary(project: Project) {
    const totalPages = Object.keys(project.pageMetadata || {}).length;
    const completedPages = Object.values(project.pageMetadata || {}).filter(p => p.status === 'completed').length;
    const overallCompletion = this.calculateProjectCompletion(project);

    return {
      id: project.id,
      title: project.title,
      description: project.description,
      templateType: project.templateType,
      totalPages,
      completedPages,
      overallCompletion,
      lastUpdated: project.updatedAt,
      status: project.metadata.status,
      phase: project.metadata.phase
    };
  },

  /**
   * Update page metadata fields (e.g., order for reordering)
   */
  async updatePageMetadata(projectId: string, pageId: string, updates: Partial<PageMetadata>): Promise<void> {
    const projectRef = doc(db, 'projects', projectId);
    const updateKey = `pageMetadata.${pageId}`;

    const updateData: { [key: string]: any } = {};
    Object.entries(updates).forEach(([key, value]) => {
      updateData[`${updateKey}.${key}`] = value;
    });

    await updateDoc(projectRef, updateData);
  }
};
