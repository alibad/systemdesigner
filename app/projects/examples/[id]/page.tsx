'use client';

import { useCallback, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Copy, Lock, BookOpen, Clock, BarChart3, Tag, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { db, createWhiteboardMetadata, updateDiagram } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, setDoc, Timestamp, getDoc, arrayUnion } from 'firebase/firestore';
import { Project, ProjectPage, WhiteboardContent } from '@/lib/project-data-model';
import dynamic from 'next/dynamic';

// Dynamically import Tldraw to avoid SSR issues
const Tldraw = dynamic(() => import('@tldraw/tldraw').then((mod) => mod.Tldraw), {
  ssr: false,
  loading: () => (
    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-8 text-center border border-gray-300 dark:border-gray-600">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
      <p className="text-gray-600 dark:text-gray-400">Loading whiteboard...</p>
    </div>
  ),
});

// CSS imported in layout or _app

interface ExampleData {
  metadata: {
    id: string;
    title: string;
    description: string;
    templateType: 'system_design' | 'ml_design' | 'genai_design';
    category: string;
    complexity: 'simple' | 'medium' | 'complex';
    estimatedDuration: string;
    tags: string[];
    author: string;
    version: string;
  };
  project: Partial<Project>;
  pages: Partial<ProjectPage>[];
}

export default function ExamplePreviewPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const exampleId = params.id as string;

  const [example, setExample] = useState<ExampleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cloning, setCloning] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showFullContent, setShowFullContent] = useState<Record<string, boolean>>({});

  const selectedPage = example?.pages.find((p) => p.id === selectedPageId);

  // Expand first section when page changes
  useEffect(() => {
    if (selectedPage && selectedPage.sections) {
      const firstSectionId = Object.values(selectedPage.sections)[0]?.id;
      if (firstSectionId) {
        setExpandedSections(new Set([firstSectionId]));
      }
    }
  }, [selectedPageId, selectedPage]);

  const loadExample = useCallback(async () => {
    try {
      // Map example IDs to file paths
      const exampleFiles: Record<string, string> = {
        // System Design
        'instagram-photo-sharing': '/examples/system-design/instagram.json',
        'uber-ride-sharing': '/examples/system-design/uber.json',
        'url-shortener': '/examples/system-design/url-shortener.json',
        // ML Design
        'recommendation-engine': '/examples/ml-design/recommendation-engine.json',
        // GenAI Design
        'rag-chatbot': '/examples/genai-design/rag-chatbot.json',
        'code-assistant': '/examples/genai-design/code-assistant.json',
      };

      const filePath = exampleFiles[exampleId];
      if (!filePath) {
        throw new Error('Example not found');
      }

      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error('Failed to load example');
      }

      const data = await response.json();
      setExample(data);

      // Select first page by default
      if (data.pages && data.pages.length > 0) {
        setSelectedPageId(data.pages[0].id);
      }
    } catch (error) {
      console.error('Failed to load example:', error);
      alert('Failed to load example. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [exampleId]);

  useEffect(() => {
    loadExample();
  }, [loadExample]);

  const handleCloneExample = async () => {
    if (!user) {
      alert('Please sign in to clone this example');
      router.push('/signin' as any);
      return;
    }

    if (!example) {
      alert('No example data loaded');
      return;
    }

    setCloning(true);

    try {
      console.log('Starting clone process for:', example.metadata.title);
      console.log('Example data:', example);

      // Validate required fields
      if (!example.project?.title) {
        throw new Error('Example missing project title');
      }

      // Step 1: Create dedicated whiteboard for this project FIRST
      console.log('Creating project whiteboard...');
      const whiteboardId = await createWhiteboardMetadata(
        `${example.project.title} - Diagrams`,
        `Whiteboard for project: ${example.project.title}`
      );
      console.log(`Whiteboard created: ${whiteboardId}`);

      // Create project document
      const projectData: Omit<Project, 'id'> = {
        title: `${example.project.title} (Copy)`,
        description: example.project.description || '',
        templateType: example.metadata.templateType,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: user.uid,
        pageMetadata: {},
        whiteboardId: whiteboardId, // Link the whiteboard
        settings: {
          isPublic: false,
          allowComments: false,
          allowCollaboration: false,
          collaborators: [],
          template: {
            templateId: example.metadata.templateType,
            templateVersion: example.metadata.version,
            customizations: [],
          },
          customizations: {
            theme: 'default',
            colorScheme: 'light',
          },
        },
        metadata: {
          tags: example.metadata.tags,
          category: example.metadata.category,
          complexity: example.metadata.complexity,
          status: 'draft',
          phase: 'planning',
        },
      };

      console.log('Creating project with data:', projectData);

      // Create project in Firestore
      const projectRef = await addDoc(collection(db, 'projects'), projectData);
      const projectId = projectRef.id;
      console.log('Project created with ID:', projectId);

      // Create pages subcollection and build pageMetadata
      console.log(`Creating ${example.pages.length} pages...`);
      const pageMetadata: Record<string, any> = {};

      const pagesPromises = example.pages.map(async (pageData, index) => {
        // Add default settings and progress to each section
        const sectionsWithDefaults: Record<string, any> = {};
        Object.entries(pageData.sections || {}).forEach(([sectionId, section]: [string, any]) => {
          // Handle whiteboard sections - initialize with the project's whiteboardId
          let sectionContent = section.content;
          if (section.type === 'whiteboard') {
            sectionContent = {
              ...(section.content || {}),
              type: 'whiteboard',
              whiteboardId: whiteboardId,
              pageId: 'page:page', // Default TLDraw page ID
            } as WhiteboardContent;
          }

          sectionsWithDefaults[sectionId] = {
            ...section,
            content: sectionContent,
            settings: section.settings || {
              isVisible: true,
              allowComments: false,
              layout: {
                type: 'full',
                width: 'full',
                customWidth: 100,
              },
            },
            // Mark as completed since examples already have content
            progress: section.progress || {
              status: 'completed',
              lastUpdated: new Date().toISOString(),
            },
          };
        });

        const pageDoc = {
          ...pageData,
          sections: sectionsWithDefaults,
          order: index,
          settings: pageData.settings || {
            isVisible: true,
            allowComments: false,
            layout: {
              type: 'single_column',
              sectionSpacing: 'normal',
            },
          },
          progress: pageData.progress || {
            status: 'not_started',
            completedSections: [],
            totalSections: Object.keys(sectionsWithDefaults).length,
            completionPercentage: 0,
            lastUpdated: new Date().toISOString(),
          },
        };

        console.log(`Creating page: ${pageData.title} with ID: ${pageData.id}`);
        // Use the original page ID from the example instead of generating a new one
        const pageRef = doc(db, 'projects', projectId!, 'pages', pageData.id!);
        await setDoc(pageRef, pageDoc);
        console.log(`Page created with ID: ${pageData.id}`);

        // Add to pageMetadata using the original page ID
        const sectionCount = Object.keys(sectionsWithDefaults).length;
        const completedSections = Object.values(sectionsWithDefaults).filter(
          (s: any) => s.progress?.status === 'completed'
        ).length;

        pageMetadata[pageData.id!] = {
          id: pageData.id!,
          title: pageData.title,
          description: pageData.description || '',
          order: index,
          icon: (pageData as any).icon || 'FileText',
          lastModified: new Date().toISOString(),
          sectionCount: sectionCount,
          completedSections: completedSections,
        };

        return pageRef;
      });

      await Promise.all(pagesPromises);
      console.log('All pages created successfully');

      // Copy TLDraw canvas data from example whiteboard sections to the new whiteboard
      console.log('Copying canvas data to whiteboard...');
      let canvasData: any = null;

      // Find all whiteboard sections and collect their snapshots
      for (const page of example.pages) {
        for (const [sectionId, section] of Object.entries(page.sections || {})) {
          const sectionData = section as any;
          if (sectionData.type === 'whiteboard' && sectionData.content?.snapshots) {
            console.log(`Found whiteboard section: ${sectionId} with snapshots`);
            canvasData = sectionData.content.snapshots;
            break;
          }
        }
        if (canvasData) break;
      }

      if (canvasData) {
        try {
          await updateDiagram(whiteboardId, { canvas: canvasData });
          console.log('Canvas data copied to whiteboard successfully');
        } catch (error) {
          console.error('Failed to copy canvas data:', error);
          // Don't fail the entire clone if canvas copy fails
        }
      } else {
        console.log('No canvas data found in example');
      }

      // Update project with pageMetadata
      console.log('Updating project with pageMetadata:', pageMetadata);
      const projectDocRef = doc(db, 'projects', projectId);
      await updateDoc(projectDocRef, { pageMetadata });
      console.log('Project pageMetadata updated successfully');

      // Add project to user's owned projects list
      console.log('Adding project to user document...');
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);

        const projectSummary = {
          id: projectId,
          title: example.project.title || example.metadata.title,
          templateType: example.metadata.templateType,
          status: 'draft',
          lastUpdated: Timestamp.now(),
          pageCount: example.pages.length,
          completion: 0,
        };

        if (userDoc.exists()) {
          // Update existing user document
          await updateDoc(userRef, {
            'projects.owned': arrayUnion(projectSummary)
          });
          console.log('Project added to existing user document');
        } else {
          // Create new user document with project
          await setDoc(userRef, {
            projects: {
              owned: [projectSummary],
              shared: []
            }
          });
          console.log('Created new user document with project');
        }
      }

      // Navigate to the cloned project
      console.log('Navigating to project:', projectId);
      router.push(`/projects/${projectId}`);
    } catch (error: any) {
      console.error('Failed to clone example:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
      });
      alert(`Failed to clone example: ${error.message || 'Unknown error'}`);
      setCloning(false);
    }
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'simple':
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'complex':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800';
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const toggleFullContent = (sectionId: string) => {
    setShowFullContent((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const renderMarkdown = (markdown: string, sectionId: string, limit: number = 3000) => {
    const showFull = showFullContent[sectionId];
    const content = showFull ? markdown : markdown.slice(0, limit);
    const isTruncated = markdown.length > limit;

    return (
      <>
        <div
          className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
          dangerouslySetInnerHTML={{
            __html: content
              .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2 text-gray-900 dark:text-white">$1</h3>')
              .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mt-6 mb-3 text-gray-900 dark:text-white">$1</h2>')
              .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-6 mb-4 text-gray-900 dark:text-white">$1</h1>')
              .replace(/^\*\*(.*?)\*\*$/gm, '<strong class="font-semibold text-gray-900 dark:text-white">$1</strong>')
              .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900 dark:text-white">$1</strong>')
              .replace(/^- (.*$)/gm, '<li class="ml-6 list-disc marker:text-indigo-500">$1</li>')
              .replace(/^\d+\. (.*$)/gm, '<li class="ml-6 list-decimal marker:text-indigo-500">$1</li>')
              .replace(/`([^`]+)`/g, '<code class="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>')
              .replace(/\n\n/g, '</p><p class="mt-3">')
              .replace(/^(?!<[hlc]|<li)/gm, '<p class="leading-relaxed">')
              .replace(/<p class="leading-relaxed"><\/p>/g, '')
          }}
        />
        {isTruncated && !showFull && (
          <div className="mt-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              Content preview limited to {limit} characters...
            </p>
            <button
              onClick={() => toggleFullContent(sectionId)}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
            >
              Show more
            </button>
          </div>
        )}
        {showFull && isTruncated && (
          <button
            onClick={() => toggleFullContent(sectionId)}
            className="mt-4 text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
          >
            Show less
          </button>
        )}
      </>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading example...</p>
        </div>
      </div>
    );
  }

  if (!example) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Example not found
          </h2>
          <Link
            href="/projects/examples"
            className="text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Back to Examples
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/projects/examples"
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {example.metadata.title}
                  </h1>
                  <div className="flex items-center text-amber-600 dark:text-amber-400 text-sm">
                    <Lock className="w-4 h-4 mr-1" />
                    <span>Read-only</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {example.metadata.description}
                </p>
              </div>
            </div>
            <button
              onClick={handleCloneExample}
              disabled={cloning}
              className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-medium transition-colors"
            >
              {cloning ? (
                <>
                  <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Cloning...
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Clone This Example
                </>
              )}
            </button>
          </div>

          {/* Metadata */}
          <div className="flex items-center space-x-6 mt-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              {example.metadata.estimatedDuration}
            </div>
            <div className="flex items-center">
              <BarChart3 className="w-4 h-4 mr-1" />
              <span
                className={`px-2 py-1 rounded text-xs font-medium border ${getComplexityColor(
                  example.metadata.complexity
                )}`}
              >
                {example.metadata.complexity.charAt(0).toUpperCase() +
                  example.metadata.complexity.slice(1)}
              </span>
            </div>
            <div className="flex items-center">
              <Tag className="w-4 h-4 mr-1" />
              {example.metadata.category}
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mt-3">
            {example.metadata.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar - Page Navigation */}
          <div className="col-span-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sticky top-24">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 uppercase tracking-wider">
                Pages
              </h2>
              <div className="space-y-1">
                {example.pages.map((page) => (
                  <button
                    key={page.id}
                    onClick={() => setSelectedPageId(page.id!)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedPageId === page.id
                        ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {page.title}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content - Page Preview */}
          <div className="col-span-9">
            {selectedPage ? (
              <div className="space-y-4">
                {/* Quick Stats */}
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        {Object.keys(selectedPage.sections || {}).length}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">Sections</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {example.pages.length}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">Total Pages</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-pink-600 dark:text-pink-400">
                        {example.metadata.complexity}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">Complexity</p>
                    </div>
                  </div>
                </div>

                {/* Page Content */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {selectedPage.title}
                    </h2>
                    {selectedPage.description && (
                      <p className="text-gray-600 dark:text-gray-400 mt-2">
                        {selectedPage.description}
                      </p>
                    )}
                  </div>

                <div className="p-6">
                  {/* Expand/Collapse All Button */}
                  <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {Object.keys(selectedPage.sections || {}).length} section(s) in this page
                    </p>
                    <button
                      onClick={() => {
                        const allSectionIds = Object.values(selectedPage.sections || {}).map((s: any) => s.id);
                        if (expandedSections.size === allSectionIds.length) {
                          setExpandedSections(new Set());
                        } else {
                          setExpandedSections(new Set(allSectionIds));
                        }
                      }}
                      className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                    >
                      {expandedSections.size === Object.keys(selectedPage.sections || {}).length
                        ? 'Collapse All'
                        : 'Expand All'}
                    </button>
                  </div>

                  <div className="space-y-4">
                    {Object.values(selectedPage.sections || {}).map((section: any) => {
                      const isExpanded = expandedSections.has(section.id);
                      return (
                        <div
                          key={section.id}
                          className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden transition-all"
                        >
                          <button
                            onClick={() => toggleSection(section.id)}
                            className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                          >
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                              {section.title}
                            </h3>
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-gray-500" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-500" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="p-6 bg-white dark:bg-gray-800">
                              <div className="prose dark:prose-invert max-w-none">
                          {/* Render content based on section type */}
                          {section.type === 'requirements' && section.content?.functional && (
                            <div className="space-y-6">
                              {/* Functional Requirements */}
                              <div className="space-y-3">
                                {section.content.functional.map((req: any) => (
                                  <div key={req.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                                    <div className="flex items-start justify-between">
                                      <h5 className="font-medium text-gray-900 dark:text-white">{req.title}</h5>
                                      <span className={`px-2 py-1 text-xs rounded ${
                                        req.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                                        req.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                      }`}>
                                        {req.priority}
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{req.description}</p>
                                    {req.acceptanceCriteria && (
                                      <ul className="mt-2 space-y-1">
                                        {req.acceptanceCriteria.map((criteria: string, idx: number) => (
                                          <li key={idx} className="text-sm text-gray-600 dark:text-gray-400 flex items-start">
                                            <span className="mr-2">•</span>
                                            <span dangerouslySetInnerHTML={{ __html: criteria }} />
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {/* Non-Functional Requirements */}
                              {section.content.nonFunctional && section.content.nonFunctional.length > 0 && (
                                <>
                                  <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>
                                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Non-Functional Requirements</h4>
                                  <div className="space-y-3">
                                    {section.content.nonFunctional.map((req: any) => (
                                      <div key={req.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                                        <h5 className="font-medium text-gray-900 dark:text-white">{req.title}</h5>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{req.description}</p>
                                        {req.acceptanceCriteria && (
                                          <ul className="mt-2 space-y-1">
                                            {req.acceptanceCriteria.map((criteria: string, idx: number) => (
                                              <li key={idx} className="text-sm text-gray-600 dark:text-gray-400 flex items-start">
                                                <span className="mr-2">•</span>
                                                <span dangerouslySetInnerHTML={{ __html: criteria }} />
                                              </li>
                                            ))}
                                          </ul>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          {section.type === 'calculations' && section.content?.calculations && (
                            <div className="space-y-4">
                              {section.content.calculations.map((calc: any) => (
                                <div key={calc.id} className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                                  <h5 className="font-medium text-gray-900 dark:text-white">{calc.title}</h5>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                    <strong>Formula:</strong> {calc.formula}
                                  </p>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    <strong>Result:</strong> {calc.result} {calc.unit}
                                  </p>
                                  {calc.breakdown && (
                                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-2 italic">
                                      {calc.breakdown}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {section.type === 'text-editor' && section.content?.markdown && (
                            <div className="prose dark:prose-invert max-w-none">
                              {renderMarkdown(section.content.markdown, section.id)}
                            </div>
                          )}

                          {section.type === 'checklist' && section.content?.items && (
                            <div className="space-y-3">
                              {section.content.items.map((item: any) => {
                                // Check if this is a trade-off item (has category indicating trade-off nature)
                                const isTradeOff = item.category && (
                                  item.category.includes('vs') ||
                                  item.category.includes('Consistency') ||
                                  item.category.includes('Choice') ||
                                  item.description?.includes('Alternative:') ||
                                  item.description?.includes('Accept')
                                );

                                if (isTradeOff) {
                                  return (
                                    <div key={item.id} className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                                      <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                          <h5 className="font-semibold text-gray-900 dark:text-white text-sm">{item.title}</h5>
                                          {item.category && (
                                            <span className="inline-block mt-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs rounded">
                                              {item.category}
                                            </span>
                                          )}
                                        </div>
                                        <input type="checkbox" checked={item.completed} disabled className="mt-1 ml-3" />
                                      </div>
                                      <div className="text-xs text-gray-700 dark:text-gray-300 mt-2 space-y-1">
                                        {item.description.split('Alternative:').map((part: string, idx: number) => {
                                          if (idx === 0) {
                                            return (
                                              <p key={idx}>
                                                <span className="font-medium text-green-700 dark:text-green-400">✓ Chosen: </span>
                                                {part.trim()}
                                              </p>
                                            );
                                          } else {
                                            return (
                                              <p key={idx} className="pl-4 border-l-2 border-orange-300 dark:border-orange-700">
                                                <span className="font-medium text-orange-700 dark:text-orange-400">⚠ Alternative: </span>
                                                {part.trim()}
                                              </p>
                                            );
                                          }
                                        })}
                                      </div>
                                    </div>
                                  );
                                }

                                // Regular checklist item
                                return (
                                  <div key={item.id} className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                                    <input type="checkbox" checked={item.completed} disabled className="mt-1" />
                                    <div className="flex-1">
                                      <p className="font-medium text-gray-900 dark:text-white text-sm">{item.title}</p>
                                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{item.description}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {section.type === 'architecture' && section.content?.components && (
                            <div className="space-y-6">
                              {/* Components */}
                              <div>
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">System Components</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {section.content.components.slice(0, 8).map((component: any) => (
                                    <div key={component.id} className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3">
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <h5 className="font-medium text-gray-900 dark:text-white text-sm">{component.name}</h5>
                                          <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">{component.type}</p>
                                        </div>
                                      </div>
                                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">{component.description}</p>
                                      {component.technologies && component.technologies.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                          {component.technologies.slice(0, 3).map((tech: string, idx: number) => (
                                            <span key={idx} className="px-2 py-0.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs rounded border border-gray-200 dark:border-gray-700">
                                              {tech}
                                            </span>
                                          ))}
                                          {component.technologies.length > 3 && (
                                            <span className="text-xs text-gray-500">+{component.technologies.length - 3}</span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                {section.content.components.length > 8 && (
                                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                                    + {section.content.components.length - 8} more components
                                  </p>
                                )}
                              </div>

                              {/* Tech Stack */}
                              {section.content.technologies && (
                                <div>
                                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Technology Stack</h4>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {Object.entries(section.content.technologies).map(([category, techs]: [string, any]) => (
                                      <div key={category} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                                        <h6 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-2">
                                          {category.replace('_', ' ')}
                                        </h6>
                                        <div className="space-y-1">
                                          {techs.slice(0, 3).map((tech: string, idx: number) => (
                                            <div key={idx} className="text-xs text-gray-600 dark:text-gray-400">• {tech}</div>
                                          ))}
                                          {techs.length > 3 && (
                                            <div className="text-xs text-gray-500">+{techs.length - 3} more</div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-4">
                                Clone to see full architecture diagrams and data flow →
                              </p>
                            </div>
                          )}

                          {section.type === 'code-editor' && section.content?.examples && (
                            <div className="space-y-4">
                              {section.content.examples.slice(0, 2).map((example: any) => (
                                <div key={example.id} className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <h5 className="text-sm font-medium text-gray-200">{example.title}</h5>
                                    <span className="text-xs text-gray-400">{example.language}</span>
                                  </div>
                                  <pre className="text-xs text-gray-300 overflow-x-auto">
                                    <code>{example.code.slice(0, 200)}...</code>
                                  </pre>
                                  {example.description && (
                                    <p className="text-xs text-gray-400 mt-2">{example.description}</p>
                                  )}
                                </div>
                              ))}
                              {section.content.examples.length > 2 && (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  + {section.content.examples.length - 2} more code examples
                                </p>
                              )}
                            </div>
                          )}

                          {/* Fallback for other types */}
                          {!['requirements', 'calculations', 'text-editor', 'checklist', 'architecture', 'code-editor', 'whiteboard'].includes(section.type) && (
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                                Section type: {section.type}
                              </p>
                              <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-2">
                                Clone this example to see full content and make it editable →
                              </p>
                            </div>
                          )}

                          {/* Whiteboard sections */}
                          {section.type === 'whiteboard' && (
                            <div className="space-y-4">
                              {section.content?.snapshots && Object.keys(section.content.snapshots).length > 0 ? (
                                <>
                                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                                    <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                                      <Lock className="w-4 h-4" />
                                      <span>Read-only preview - Clone to edit</span>
                                    </div>
                                  </div>
                                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden" style={{ height: '500px' }}>
                                    <Tldraw
                                      snapshot={{ store: section.content.snapshots, schema: { schemaVersion: 2, sequences: {} } }}
                                      autoFocus={false}
                                      hideUi={true}
                                      inferDarkMode={true}
                                    />
                                  </div>
                                </>
                              ) : (
                                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-8 text-center border-2 border-dashed border-gray-300 dark:border-gray-600">
                                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  <p className="text-gray-600 dark:text-gray-400 font-medium">Empty Whiteboard</p>
                                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                                    Clone this example to start drawing diagrams
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                              </div>
                            )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
                <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Select a page to preview</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
