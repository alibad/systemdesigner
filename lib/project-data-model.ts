// Flexible Project Data Model for Firestore
// Supports: Project → Pages → Sections with templates and full customization

import { Timestamp } from 'firebase/firestore';

export interface Project {
  // Core project metadata
  id: string;
  title: string;
  description: string;
  templateType: ProjectTemplate;
  createdAt: string;
  updatedAt: string;
  ownerId: string;

  // Page metadata only (pages stored in subcollection)
  pageMetadata: Record<string, PageMetadata>;

  // Whiteboard integration
  whiteboardId: string;  // Every project has one shared whiteboard (auto-created)

  // AI Generation
  generateWithAI?: boolean;  // Whether to auto-generate content with AI

  // Template and customization
  settings: ProjectSettings;
  metadata: ProjectMetadata;
}

export interface PageMetadata {
  id: string;
  title: string;
  description?: string;
  order: number;
  sectionCount: number;
  completedSections: number;
  status: 'not_started' | 'in_progress' | 'completed';
  lastUpdated: string;
}

export interface ProjectPage {
  id: string;
  title: string;
  description?: string;
  order: number;

  // Dynamic sections
  sections: Record<string, PageSection>;

  // Page-level settings
  settings: PageSettings;
  progress: PageProgress;
}

export interface PageSection {
  id: string;
  title: string;
  type: SectionType;
  order: number;

  // Flexible content based on section type
  content: SectionContent;
  settings: SectionSettings;
  progress: SectionProgress;
}

// Section Types - Extensible
export type SectionType =
  | 'text-editor'      // Rich text/markdown content (TipTap)
  | 'rich-document'    // Advanced rich document (Lexical with embedded whiteboards)
  | 'whiteboard'       // Diagramming/drawing
  | 'code-editor'      // Code examples
  | 'requirements'     // Structured requirements
  | 'calculations'     // Back-of-envelope calculations
  | 'architecture'     // System architecture
  | 'checklist'        // Todo/checklist items
  | 'table'           // Structured data tables
  | 'timeline'        // Project timelines
  | 'metrics'         // KPIs and metrics
  | 'files'           // File attachments
  | 'links'           // External links/references
  | 'qa-pairs'        // Configurable Q&A pairs
  | 'bullet-list'     // Configurable bullet list by type
  | 'custom';         // Custom section type

// Flexible content union based on section type
export type SectionContent =
  | TextEditorContent
  | RichDocumentContent
  | WhiteboardContent
  | CodeEditorContent
  | RequirementsContent
  | CalculationsContent
  | ArchitectureContent
  | ChecklistContent
  | TableContent
  | TimelineContent
  | MetricsContent
  | FilesContent
  | LinksContent
  | QAPairsContent
  | BulletListContent
  | CustomContent;

// Content type definitions
export interface QAPair {
  id: string;
  question: string;
  answer: string;
  order: number;
}

export interface Requirement {
  id: string;
  title: string;
  type: 'functional' | 'non-functional' | 'out-of-scope';
  description: string;
}

export interface TextEditorContent {
  type: 'text-editor';
  markdown: string;
  format: 'markdown' | 'html' | 'plain';
  // Interview Q&A Interface data
  qaPairs?: QAPair[];
  requirements?: Requirement[];
  interfaceMode?: 'markdown' | 'interview-qa'; // Default to interview-qa for new sections
}

export interface RichDocumentContent {
  type: 'rich-document';
  // Lexical editor state stored as JSON string
  editorState: string;
  // Optional metadata for embedded content
  embeddedWhiteboards?: {
    nodeKey: string;      // Lexical node key
    whiteboardId: string; // Reference to whiteboard
    pageId: string;       // Specific page within whiteboard
  }[];
}

export interface WhiteboardContent {
  type: 'whiteboard';
  whiteboardId: string;  // Reference to project's shared whiteboard
  pageId: string;        // Specific page within the whiteboard
}

export interface CodeEditorContent {
  type: 'code-editor';
  code: string;
  language: string;
  theme: string;
  examples: CodeExample[];
}

export interface CodeExample {
  id: string;
  title: string;
  code: string;
  language: string;
  description?: string;
}

export interface RequirementsContent {
  type: 'requirements';
  functional: Requirement[];
  nonFunctional: Requirement[];
  assumptions: string[];
  constraints: string[];
}

export interface Requirement {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed';
  acceptanceCriteria: string[];
}

export interface CalculationsContent {
  type: 'calculations';
  calculations: Calculation[];
  assumptions: string[];
  references: string[];
}

export interface Calculation {
  id: string;
  title: string;
  formula: string;
  variables: Record<string, number | string>;
  result: number | string;
  unit?: string;
  notes?: string;
  breakdown?: string;
}

export interface ArchitectureContent {
  type: 'architecture';
  components: ArchitectureComponent[];
  connections: ArchitectureConnection[];
  layers: ArchitectureLayer[];
  technologies: TechnologyStack;
}

export interface ArchitectureComponent {
  id: string;
  name: string;
  type: string;
  description: string;
  technologies: string[];
  position?: { x: number; y: number };
}

export interface ArchitectureConnection {
  id: string;
  from: string;
  to: string;
  type: string;
  description?: string;
}

export interface ArchitectureLayer {
  id: string;
  name: string;
  components: string[];
  order: number;
}

export interface TechnologyStack {
  frontend: string[];
  backend: string[];
  database: string[];
  cache: string[];
  messaging: string[];
  infrastructure: string[];
  external: string[];
}

export interface ChecklistContent {
  type: 'checklist';
  items: ChecklistItem[];
  categories: string[];
}

export interface ChecklistItem {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  category?: string;
  dueDate?: string;
  assignee?: string;
}

export interface TableContent {
  type: 'table';
  headers: string[];
  rows: TableRow[];
  schema: TableSchema;
}

export interface TableRow {
  id: string;
  cells: Record<string, any>;
}

export interface TableSchema {
  columns: TableColumn[];
}

export interface TableColumn {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  options?: string[]; // For select type
  required?: boolean;
}

export interface TimelineContent {
  type: 'timeline';
  events: TimelineEvent[];
  milestones: Milestone[];
}

export interface TimelineEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  duration?: number;
  type: 'event' | 'milestone' | 'phase';
  dependencies?: string[];
}

export interface Milestone {
  id: string;
  title: string;
  description?: string;
  date: string;
  criteria: string[];
  status: 'pending' | 'in_progress' | 'completed';
}

export interface MetricsContent {
  type: 'metrics';
  metrics: Metric[];
  dashboards: MetricDashboard[];
}

export interface Metric {
  id: string;
  name: string;
  description?: string;
  value: number | string;
  unit?: string;
  target?: number | string;
  status: 'above_target' | 'on_target' | 'below_target';
  history: MetricHistory[];
}

export interface MetricHistory {
  timestamp: string;
  value: number | string;
}

export interface MetricDashboard {
  id: string;
  name: string;
  metrics: string[];
  layout: DashboardLayout;
}

export interface DashboardLayout {
  columns: number;
  rows: DashboardRow[];
}

export interface DashboardRow {
  widgets: DashboardWidget[];
}

export interface DashboardWidget {
  metricId: string;
  type: 'gauge' | 'chart' | 'number' | 'progress';
  size: 'small' | 'medium' | 'large';
}

export interface FilesContent {
  type: 'files';
  files: ProjectFile[];
  folders: FileFolder[];
}

export interface ProjectFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
  description?: string;
  tags: string[];
}

export interface FileFolder {
  id: string;
  name: string;
  parentId?: string;
  files: string[];
  subfolders: string[];
}

export interface LinksContent {
  type: 'links';
  links: ExternalLink[];
  categories: string[];
}

export interface ExternalLink {
  id: string;
  title: string;
  url: string;
  description?: string;
  category?: string;
  tags: string[];
  addedAt: string;
  lastChecked?: string;
  status: 'active' | 'broken' | 'unknown';
}

export interface QAPairsContent {
  type: 'qa-pairs';
  pairs: ConfigurableQAPair[];
  settings: QAPairsSettings;
}

export interface ConfigurableQAPair {
  id: string;
  question: string;
  answer: string;
  order: number;
}

export interface QAPairsSettings {
  questionLabel: string;  // e.g., "Candidate Question", "User Question"
  answerLabel: string;    // e.g., "Interviewer Answer", "System Response"
  sectionTitle: string;   // e.g., "Interview Q&A", "FAQ"
  sectionDescription?: string;
  allowReordering: boolean;
  maxPairs?: number;
}

export interface BulletListContent {
  type: 'bullet-list';
  items: Record<string, BulletListItem[]>; // Grouped by type
  settings: BulletListSettings;
}

export interface BulletListItem {
  id: string;
  title: string;
  description?: string;
  type: string; // Will match one of the configured types
  order: number;
}

export interface BulletListSettings {
  sectionTitle: string;
  sectionDescription?: string;
  typeOptions: BulletListTypeOption[];
  allowQuickAdd: boolean;
  showDescriptions: boolean;
}

export interface BulletListTypeOption {
  key: string;           // e.g., "functional", "non-functional"
  label: string;         // e.g., "Functional", "Non-Functional"
  color: string;         // e.g., "green", "blue", "red"
  icon?: string;         // Optional icon
  description?: string;
}

export interface CustomContent {
  type: 'custom';
  customType: string;
  data: Record<string, any>;
  schema?: Record<string, any>;
}

// Progress tracking
export interface PageProgress {
  status: ProgressStatus;
  completedSections: string[];
  totalSections: number;
  completionPercentage: number;
  lastUpdated: string;
}

export interface SectionProgress {
  status: ProgressStatus;
  completionPercentage: number;
  lastUpdated: string;
  estimatedTimeLeft?: number;

  // AI Generation tracking
  aiGeneration?: {
    status: AIGenerationStatus;
    queuedAt?: string;
    startedAt?: string;
    completedAt?: string;
    cancelledAt?: string;
    error?: string;
    prompt?: string; // The prompt used for generation
    generationTimeMs?: number; // Time taken in milliseconds
  };
}

export type ProgressStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked' | 'skipped';
export type AIGenerationStatus = 'queued' | 'generating' | 'completed' | 'cancelled' | 'error';

// Settings
export interface ProjectSettings {
  isPublic: boolean;
  allowComments: boolean;
  allowCollaboration: boolean;
  collaborators: Collaborator[];
  template: ProjectTemplateSettings;
  customizations: ProjectCustomizations;
}

export interface Collaborator {
  userId: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
  addedAt: string;
}

export interface ProjectTemplateSettings {
  templateId: string;
  templateVersion: string;
  customizations: TemplateCustomization[];
}

export interface TemplateCustomization {
  type: 'page_added' | 'page_removed' | 'section_added' | 'section_removed' | 'section_modified';
  targetId: string;
  change: Record<string, any>;
  timestamp: string;
}

export interface ProjectCustomizations {
  theme: string;
  colorScheme: string;
  customCSS?: string;
  branding?: ProjectBranding;
}

export interface ProjectBranding {
  logo?: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
}

export interface PageSettings {
  isVisible: boolean;
  allowComments: boolean;
  customTitle?: string;
  customIcon?: string;
  layout: PageLayout;
}

export interface PageLayout {
  type: 'single_column' | 'two_column' | 'grid' | 'custom';
  gridColumns?: number;
  sectionSpacing: 'compact' | 'normal' | 'spacious';
}

export interface SectionSettings {
  isVisible: boolean;
  isCollapsible: boolean;
  isCollapsed: boolean;
  customTitle?: string;
  customIcon?: string;
  layout: SectionLayout;
}

export interface SectionLayout {
  width: 'full' | 'half' | 'third' | 'quarter' | 'custom';
  height?: 'auto' | 'fixed';
  padding: 'none' | 'small' | 'medium' | 'large';
  borders: boolean;
  background?: string;
  minHeight?: number; // Minimum height in lines (for text-editor)
  maxHeight?: number; // Maximum height in lines (for text-editor)
}

// Project metadata
export interface ProjectMetadata {
  tags: string[];
  category: string;
  industry?: string;
  complexity: 'simple' | 'medium' | 'complex';
  estimatedDuration?: string;
  actualDuration?: string;
  budget?: number;
  currency?: string;
  status: ProjectStatus;
  phase: ProjectPhase;
}

export type ProjectStatus = 'draft' | 'active' | 'on_hold' | 'completed' | 'cancelled' | 'archived';
export type ProjectPhase = 'planning' | 'design' | 'development' | 'testing' | 'deployment' | 'maintenance';

// Project Templates
export type ProjectTemplate = 'system_design' | 'ml_design' | 'genai_design' | 'product_design' | 'research' | 'custom';

// Template definitions
export interface ProjectTemplateDefinition {
  id: ProjectTemplate;
  name: string;
  description: string;
  version: string;
  pages: PageTemplateDefinition[];
  settings: TemplateSettings;
}

export interface PageTemplateDefinition {
  id: string;
  title: string;
  description: string;
  order: number;
  sections: SectionTemplateDefinition[];
  settings: PageSettings;
}

export interface SectionTemplateDefinition {
  id: string;
  title: string;
  type: SectionType;
  order: number;
  defaultContent: SectionContent;
  settings: SectionSettings;
  required: boolean;
  // Optional rich fallback content for viewers that don't support the primary type
  fallbackContent?: SectionContent;
}

export interface TemplateSettings {
  allowPageAddition: boolean;
  allowPageRemoval: boolean;
  allowSectionAddition: boolean;
  allowSectionRemoval: boolean;
  allowSectionReordering: boolean;
  customizableThemes: boolean;
}

// Utility types for Firestore
export interface FirestoreProject extends Omit<Project, 'createdAt' | 'updatedAt'> {
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirestorePageProgress extends Omit<PageProgress, 'lastUpdated'> {
  lastUpdated: Timestamp;
}

export interface FirestoreSectionProgress extends Omit<SectionProgress, 'lastUpdated'> {
  lastUpdated: Timestamp;
}