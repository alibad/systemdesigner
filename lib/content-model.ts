import {
  CONTENT_REGISTRY,
  SECTION_CATEGORIES,
  getContentById,
  getContentByPath,
  type CategoryConfig,
  type ContentNode,
} from './content-registry';

export type ContentSection = ContentNode['section'];
export type ContentShellKind = 'lesson' | 'technology' | 'case-study' | 'practice' | 'reference' | 'tool';

export interface SectionRouteConfig {
  section: ContentSection;
  title: string;
  landingPath: `/${ContentSection}`;
  backLabel: string;
  shell: ContentShellKind;
}

export interface ContentAssetRoutes {
  codeBase: string;
  quizBase: string;
}

export interface RenderableContent {
  id: string;
  title: string;
  section: ContentSection;
  slug: string;
  path: string;
  renderPath: string;
  shell: ContentShellKind;
  level: ContentNode['level'];
  duration: string;
  category?: string;
  hasQuiz: boolean;
  hasScenarios: boolean;
  hasCalculator: boolean;
  hasChallenge: boolean;
  tags: string[];
  seo: ContentNode['seo'];
  node: ContentNode;
  assets: ContentAssetRoutes;
  navigation: {
    previous?: Pick<RenderableContent, 'id' | 'title' | 'slug' | 'path' | 'renderPath'>;
    next?: Pick<RenderableContent, 'id' | 'title' | 'slug' | 'path' | 'renderPath'>;
    prerequisites: ContentNode[];
    related: ContentNode[];
  };
}

export const CONTENT_SECTIONS: ContentSection[] = [
  'fundamentals',
  'genai',
  'ml-systems',
  'technology',
  'case-studies',
  'practice',
  'reference',
  'tools',
];

export const SECTION_ROUTE_CONFIG: Record<ContentSection, SectionRouteConfig> = {
  fundamentals: {
    section: 'fundamentals',
    title: 'Fundamentals',
    landingPath: '/fundamentals',
    backLabel: 'Back to Fundamentals',
    shell: 'lesson',
  },
  genai: {
    section: 'genai',
    title: 'GenAI Systems',
    landingPath: '/genai',
    backLabel: 'Back to GenAI Systems',
    shell: 'lesson',
  },
  'ml-systems': {
    section: 'ml-systems',
    title: 'ML Systems',
    landingPath: '/ml-systems',
    backLabel: 'Back to ML Systems',
    shell: 'lesson',
  },
  technology: {
    section: 'technology',
    title: 'Technology',
    landingPath: '/technology',
    backLabel: 'Back to Technology',
    shell: 'technology',
  },
  'case-studies': {
    section: 'case-studies',
    title: 'Case Studies',
    landingPath: '/case-studies',
    backLabel: 'Back to Case Studies',
    shell: 'case-study',
  },
  practice: {
    section: 'practice',
    title: 'Practice',
    landingPath: '/practice',
    backLabel: 'Back to Practice Hub',
    shell: 'practice',
  },
  reference: {
    section: 'reference',
    title: 'Reference',
    landingPath: '/reference',
    backLabel: 'Back to Reference',
    shell: 'reference',
  },
  tools: {
    section: 'tools',
    title: 'Tools',
    landingPath: '/tools',
    backLabel: 'Back to Tools',
    shell: 'tool',
  },
};

export function getContentSlug(node: Pick<ContentNode, 'id' | 'path'>): string {
  return node.path.split('/').filter(Boolean).pop() || node.id;
}

export function getContentAssetRoutes(node: ContentNode): ContentAssetRoutes {
  return {
    codeBase: `/api/content${node.path}/code`,
    quizBase: `/api/content${node.path}/quiz`,
  };
}

export function getContentRenderPath(node: ContentNode): string {
  return node.path;
}

export function getSectionRouteConfig(section: ContentSection): SectionRouteConfig {
  return SECTION_ROUTE_CONFIG[section];
}

export function getSectionCategories(section: ContentSection): CategoryConfig[] {
  return [...SECTION_CATEGORIES[section]].sort((a, b) => a.order - b.order);
}

export function getSectionOrderedContent(section: ContentSection): ContentNode[] {
  const content = CONTENT_REGISTRY.filter(
    (node) => node.section === section && node.status === 'active'
  );
  const categories = getSectionCategories(section);
  if (categories.length === 0) return content;

  const categoryOrder = new Map(categories.map((category, index) => [category.key, index]));

  return [...content].sort((a, b) => {
    const aOrder = categoryOrder.get(a.category || '') ?? Number.MAX_SAFE_INTEGER;
    const bOrder = categoryOrder.get(b.category || '') ?? Number.MAX_SAFE_INTEGER;

    if (aOrder !== bOrder) return aOrder - bOrder;
    return content.indexOf(a) - content.indexOf(b);
  });
}

function toNavigationSummary(node: ContentNode) {
  return {
    id: node.id,
    title: node.title,
    slug: getContentSlug(node),
    path: node.path,
    renderPath: getContentRenderPath(node),
  };
}

export function getPreviousContentNode(node: ContentNode): ContentNode | undefined {
  const explicitPrevious = CONTENT_REGISTRY.find(
    (candidate) => candidate.status === 'active' && candidate.nextInSequence === node.id
  );
  if (explicitPrevious) return explicitPrevious;

  const ordered = getSectionOrderedContent(node.section);
  const index = ordered.findIndex((candidate) => candidate.id === node.id);
  return index > 0 ? ordered[index - 1] : undefined;
}

export function getNextContentNode(node: ContentNode): ContentNode | undefined {
  if (node.nextInSequence) {
    const explicitNext = getContentById(node.nextInSequence);
    if (explicitNext?.status === 'active') return explicitNext;
  }

  const ordered = getSectionOrderedContent(node.section);
  const index = ordered.findIndex((candidate) => candidate.id === node.id);
  return index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : undefined;
}

export function toRenderableContent(node: ContentNode): RenderableContent {
  const previous = getPreviousContentNode(node);
  const next = getNextContentNode(node);

  return {
    id: node.id,
    title: node.title,
    section: node.section,
    slug: getContentSlug(node),
    path: node.path,
    renderPath: getContentRenderPath(node),
    shell: getSectionRouteConfig(node.section).shell,
    level: node.level,
    duration: node.duration,
    category: node.category,
    hasQuiz: node.hasQuiz,
    hasScenarios: node.hasScenarios,
    hasCalculator: node.hasCalculator,
    hasChallenge: node.hasChallenge ?? false,
    tags: node.tags,
    seo: node.seo,
    node,
    assets: getContentAssetRoutes(node),
    navigation: {
      previous: previous ? toNavigationSummary(previous) : undefined,
      next: next ? toNavigationSummary(next) : undefined,
      prerequisites: node.prerequisites.map(getContentById).filter(Boolean) as ContentNode[],
      related: node.related.map(getContentById).filter(Boolean) as ContentNode[],
    },
  };
}

export function getRenderableContentByPath(path: string): RenderableContent | undefined {
  const cleanPath = path.split('?')[0].replace(/\/$/, '') || '/';
  const node = getContentByPath(cleanPath);
  return node ? toRenderableContent(node) : undefined;
}

export function getRenderableContentById(id: string): RenderableContent | undefined {
  const node = getContentById(id);
  return node ? toRenderableContent(node) : undefined;
}

export function getRenderableContentBySlug(
  section: ContentSection,
  slug: string
): RenderableContent | undefined {
  const node = CONTENT_REGISTRY.find(
    (candidate) =>
      candidate.status === 'active' &&
      candidate.section === section &&
      getContentSlug(candidate) === slug
  );

  return node ? toRenderableContent(node) : undefined;
}

export function getRenderableContentBySection(section: ContentSection): RenderableContent[] {
  return getSectionOrderedContent(section).map(toRenderableContent);
}

export function toTitleCaseLevel(level: ContentNode['level']): 'Beginner' | 'Intermediate' | 'Advanced' {
  if (level === 'beginner') return 'Beginner';
  if (level === 'advanced') return 'Advanced';
  return 'Intermediate';
}
