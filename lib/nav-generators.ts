/**
 * Navigation Config Generators
 *
 * These functions automatically generate navigation configurations from the content registry,
 * replacing hardcoded configs in layout files.
 */

import { getContentBySection, type ContentNode, SECTION_CATEGORIES } from './content-registry';
import { getContentSlug, getNextContentNode, getSectionOrderedContent } from './content-model';

// =============================================================================
// TYPES
// =============================================================================

export interface LessonConfig {
  slug: string;
  title: string;
  next: string | null;
}

export interface TechnologyNavItem {
  label: string;
  href: string;
}

export interface TechnologyNavGroup {
  title: string;
  items: TechnologyNavItem[];
}

function appendNavGroup(
  groups: TechnologyNavGroup[],
  title: string,
  items: TechnologyNavItem[]
) {
  const existing = groups.find((group) => group.title === title);
  if (!existing) {
    groups.push({ title, items });
    return;
  }

  const existingPaths = new Set(existing.items.map((item) => item.href));
  existing.items.push(...items.filter((item) => !existingPaths.has(item.href)));
}

// =============================================================================
// GENERATOR FUNCTIONS
// =============================================================================

/**
 * Generate lessons config for fundamentals/genai/ml-systems layouts
 * These layouts expect: { slug, title, next }
 */
export function generateLessonsConfig(section: ContentNode['section']): LessonConfig[] {
  const content = getSectionOrderedContent(section);

  return content.map((node) => {
    const nextNode = getNextContentNode(node);
    return {
      slug: getContentSlug(node),
      title: node.title,
      next: nextNode ? getContentSlug(nextNode) : null
    };
  });
}

/**
 * Generate GenAI lessons config ordered by category to match visual navigation
 */
function generateGenAICategoryOrderedConfig(content: ContentNode[]): LessonConfig[] {
  // Define category order to match learning progression
  const categoryOrder = [
    'llm-fundamentals',
    'tokenization',
    'rag-knowledge-systems',
    'fine-tuning',
    'ai-applications',
    'vision-language',
    'document-ai',
    'evaluation',
    'safety',
    'security',
    'data-curation',
    'genai-systems',
    'genai-infrastructure',
    'genai-engineering',
    'advanced-genai'
  ];

  // Group content by category
  const grouped = content.reduce((acc, node) => {
    const category = node.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(node);
    return acc;
  }, {} as Record<string, ContentNode[]>);

  // Create ordered list following category progression
  const orderedContent: ContentNode[] = [];

  categoryOrder.forEach(category => {
    if (grouped[category]) {
      orderedContent.push(...grouped[category]);
    }
  });

  // Add any remaining categories not in our order
  Object.keys(grouped).forEach(category => {
    if (!categoryOrder.includes(category)) {
      orderedContent.push(...grouped[category]);
    }
  });

  // Generate config with category-based next navigation
  return orderedContent.map((node, index) => {
    let nextSlug: string | null = null;

    if (index + 1 < orderedContent.length) {
      const nextNode = orderedContent[index + 1];
      nextSlug = nextNode.path.split('/').pop() || nextNode.id;
    }

    return {
      slug: node.path.split('/').pop() || node.id,
      title: node.title,
      next: nextSlug
    };
  });
}

/**
 * Generate technology navigation config with grouped categories
 * Expects: { title: string, items: { label, href }[] }[]
 */
export function generateTechnologyNavConfig(): TechnologyNavGroup[] {
  const techContent = getContentBySection('technology');
  const categoryConfigs = SECTION_CATEGORIES.technology;

  // Group by category
  const grouped = techContent.reduce((acc, node) => {
    const category = node.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }

    acc[category].push({
      label: node.title,
      href: node.path
    });

    return acc;
  }, {} as Record<string, TechnologyNavItem[]>);

  // Convert to expected format using dynamic categories
  const result: TechnologyNavGroup[] = categoryConfigs
    .sort((a, b) => a.order - b.order)
    .map(config => {
      const items = grouped[config.key] || [];
      if (items.length > 0) {
        delete grouped[config.key]; // Remove from remaining
        return {
          title: config.title,
          items
        };
      }
      return null;
    })
    .filter(Boolean) as TechnologyNavGroup[];

  // Add any remaining categories not in SECTION_CATEGORIES
  Object.entries(grouped).forEach(([category, items]) => {
    if (items.length > 0) {
      appendNavGroup(result, getCategoryDisplayName(category), items);
    }
  });

  return result;
}

// Legacy exports - these are now available in SECTION_CATEGORIES from content-registry
export const TECHNOLOGY_CATEGORY_ORDER = SECTION_CATEGORIES.technology.map(c => c.key);
export const PRACTICE_CATEGORY_ORDER = SECTION_CATEGORIES.practice.map(c => c.key);

/**
 * Generate flat technology config for simple layouts (legacy)
 * Returns: { slug, title, next }[]
 */
export function generateTechnologyLessonsConfig(): LessonConfig[] {
  const techContent = getSectionOrderedContent('technology');
  
  return techContent.map((node) => {
    const nextNode = getNextContentNode(node);
    return {
      slug: getContentSlug(node),
      title: node.title,
      next: nextNode ? getContentSlug(nextNode) : null
    };
  });
}

/**
 * Generate reference section navigation
 */
export function generateReferenceNavConfig(): TechnologyNavGroup[] {
  const refContent = getContentBySection('reference');
  const categoryConfigs = SECTION_CATEGORIES.reference;

  // Group by category
  const grouped = refContent.reduce((acc, node) => {
    const category = node.category || 'Reference';
    if (!acc[category]) {
      acc[category] = [];
    }

    acc[category].push({
      label: node.title,
      href: node.path
    });

    return acc;
  }, {} as Record<string, TechnologyNavItem[]>);

  // Convert to expected format using dynamic categories
  const result: TechnologyNavGroup[] = categoryConfigs
    .sort((a, b) => a.order - b.order)
    .map(config => {
      const items = grouped[config.key] || [];
      if (items.length > 0) {
        delete grouped[config.key]; // Remove from remaining
        return {
          title: config.title,
          items
        };
      }
      return null;
    })
    .filter(Boolean) as TechnologyNavGroup[];

  // Add any remaining categories not in SECTION_CATEGORIES
  Object.entries(grouped).forEach(([category, items]) => {
    if (items.length > 0) {
      appendNavGroup(result, getCategoryDisplayName(category), items);
    }
  });

  return result;
}

/**
 * Legacy format for REFERENCE_NAVIGATION compatibility
 */
export function generateReferenceNavigation() {
  const refContent = getContentBySection('reference');
  
  return refContent.map(node => ({
    slug: node.path.split('/').pop() || node.id,
    title: node.title,
    category: node.category || 'Reference',
    hasQuiz: node.hasQuiz
  }));
}

/**
 * Legacy format for REFERENCE_TOPICS compatibility
 */
export function generateReferenceTopics() {
  const navigation = generateReferenceNavigation();
  
  return navigation.map((item, index) => ({
    ...item,
    next: index < navigation.length - 1 ? navigation[index + 1].slug : null
  }));
}

/**
 * Legacy format for REFERENCE_CATEGORIES compatibility
 */
export function generateReferenceCategories() {
  const navigation = generateReferenceNavigation();
  
  // Get unique categories
  const categoryNames = [...new Set(navigation.map(item => item.category))];
  
  return categoryNames.map(categoryName => ({
    name: categoryName,
    description: getCategoryDescription(categoryName),
    icon: getCategoryIcon(categoryName),
    items: navigation
      .filter(item => item.category === categoryName)
      .map(item => ({
        title: item.title,
        href: `/reference/${item.slug}`,
        desc: getReferenceDescription(item.slug),
        isNew: false
      }))
  }));
}

/**
 * Generate tools section navigation
 */
export function generateToolsNavConfig(): TechnologyNavGroup[] {
  const toolsContent = getContentBySection('tools');
  const categoryConfigs = SECTION_CATEGORIES.tools;

  // Group by category
  const grouped = toolsContent.reduce((acc, node) => {
    const category = node.category || 'Tools';
    if (!acc[category]) {
      acc[category] = [];
    }

    acc[category].push({
      label: node.title,
      href: node.path
    });

    return acc;
  }, {} as Record<string, TechnologyNavItem[]>);

  // Convert to expected format using dynamic categories
  const result: TechnologyNavGroup[] = categoryConfigs
    .sort((a, b) => a.order - b.order)
    .map(config => {
      const items = grouped[config.key] || [];
      if (items.length > 0) {
        delete grouped[config.key]; // Remove from remaining
        return {
          title: config.title,
          items
        };
      }
      return null;
    })
    .filter(Boolean) as TechnologyNavGroup[];

  // Add any remaining categories not in SECTION_CATEGORIES
  Object.entries(grouped).forEach(([category, items]) => {
    if (items.length > 0) {
      result.push({
        title: getCategoryDisplayName(category),
        items
      });
    }
  });

  return result;
}

/**
 * Generate Fundamentals learning paths organized by categories
 */
export function generateFundamentalsLearningPaths() {
  const fundamentalsContent = getContentBySection('fundamentals');
  const categoryConfigs = SECTION_CATEGORIES.fundamentals;

  // Group content by category
  const grouped = fundamentalsContent.reduce((acc, node) => {
    const category = node.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(node);
    return acc;
  }, {} as Record<string, typeof fundamentalsContent>);

  // Convert to learning paths format using dynamic categories
  const learningPaths = categoryConfigs
    .sort((a, b) => a.order - b.order) // Sort by order
    .map(config => {
      const categoryContent = grouped[config.key] || [];

      return {
        title: config.title,
        description: config.description,
        lessons: categoryContent.map(node => ({
          title: node.title,
          slug: node.path.split('/').pop() || node.id,
          duration: node.duration,
          level: node.level.charAt(0).toUpperCase() + node.level.slice(1)
        }))
      };
    })
    .filter(path => path.lessons.length > 0); // Only include paths with lessons

  // Handle any uncategorized content
  const allCategoryKeys = categoryConfigs.map(c => c.key);
  const uncategorizedKeys = Object.keys(grouped).filter(key => !allCategoryKeys.includes(key) && key !== 'other');

  if (uncategorizedKeys.length > 0) {
    uncategorizedKeys.forEach(categoryKey => {
      const categoryContent = grouped[categoryKey] || [];
      if (categoryContent.length > 0) {
        learningPaths.push({
          title: categoryKey.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
          description: `Additional ${categoryKey} topics`,
          lessons: categoryContent.map(node => ({
            title: node.title,
            slug: node.path.split('/').pop() || node.id,
            duration: node.duration,
            level: node.level.charAt(0).toUpperCase() + node.level.slice(1)
          }))
        });
      }
    });
  }

  return learningPaths;
}

/**
 * Generate ML-Systems learning paths organized by categories
 */
export function generateMLSystemsLearningPaths() {
  const mlSystemsContent = getContentBySection('ml-systems');
  const categoryConfigs = SECTION_CATEGORIES['ml-systems'];

  // Group content by category
  const grouped = mlSystemsContent.reduce((acc, node) => {
    const category = node.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(node);
    return acc;
  }, {} as Record<string, typeof mlSystemsContent>);

  // Convert to learning paths format using dynamic categories
  const learningPaths = categoryConfigs
    .sort((a, b) => a.order - b.order) // Sort by order
    .map(config => {
      const categoryContent = grouped[config.key] || [];

      return {
        title: config.title,
        description: config.description,
        lessons: categoryContent.map(node => ({
          title: node.title,
          slug: node.path.split('/').pop() || node.id,
          duration: node.duration,
          level: node.level.charAt(0).toUpperCase() + node.level.slice(1)
        }))
      };
    })
    .filter(path => path.lessons.length > 0); // Only include paths with lessons

  // Handle any uncategorized content
  const allCategoryKeys = categoryConfigs.map(c => c.key);
  const uncategorizedKeys = Object.keys(grouped).filter(key => !allCategoryKeys.includes(key) && key !== 'other');

  if (uncategorizedKeys.length > 0) {
    uncategorizedKeys.forEach(categoryKey => {
      const categoryContent = grouped[categoryKey] || [];
      if (categoryContent.length > 0) {
        learningPaths.push({
          title: categoryKey.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
          description: `Additional ${categoryKey} topics`,
          lessons: categoryContent.map(node => ({
            title: node.title,
            slug: node.path.split('/').pop() || node.id,
            duration: node.duration,
            level: node.level.charAt(0).toUpperCase() + node.level.slice(1)
          }))
        });
      }
    });
  }

  return learningPaths;
}

/**
 * Generate GenAI learning paths organized by categories
 */
export function generateGenAILearningPaths() {
  const genaiContent = getContentBySection('genai');
  const categoryConfigs = SECTION_CATEGORIES.genai;

  // Group content by category
  const grouped = genaiContent.reduce((acc, node) => {
    const category = node.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(node);
    return acc;
  }, {} as Record<string, typeof genaiContent>);

  // Convert to learning paths format using dynamic categories
  const learningPaths = categoryConfigs
    .sort((a, b) => a.order - b.order) // Sort by order
    .map(config => {
      const categoryContent = grouped[config.key] || [];

      const path = {
        title: config.title,
        description: config.description,
        lessons: categoryContent.map(node => ({
          title: node.title,
          slug: node.path.split('/').pop() || node.id,
          duration: node.duration,
          level: node.level.charAt(0).toUpperCase() + node.level.slice(1)
        }))
      };

      // Add external links for RAG section (specific case)
      if (config.key === 'rag-knowledge-systems') {
        return {
          ...path,
          externalLinks: [
            { title: 'Vector Databases & Embeddings', path: '/technology/vector-databases', duration: '40 min', level: 'Intermediate' }
          ]
        };
      }

      return path;
    })
    .filter(path => path.lessons.length > 0); // Only include paths with lessons

  // Handle any uncategorized content
  const allCategoryKeys = categoryConfigs.map(c => c.key);
  const uncategorizedKeys = Object.keys(grouped).filter(key => !allCategoryKeys.includes(key) && key !== 'other');

  if (uncategorizedKeys.length > 0) {
    uncategorizedKeys.forEach(categoryKey => {
      const categoryContent = grouped[categoryKey] || [];
      if (categoryContent.length > 0) {
        learningPaths.push({
          title: categoryKey.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
          description: `Additional ${categoryKey} topics`,
          lessons: categoryContent.map(node => ({
            title: node.title,
            slug: node.path.split('/').pop() || node.id,
            duration: node.duration,
            level: node.level.charAt(0).toUpperCase() + node.level.slice(1)
          }))
        });
      }
    });
  }

  return learningPaths;
}

/**
 * Generate case studies navigation
 */
export function generateCaseStudiesNavConfig(): TechnologyNavItem[] {
  const caseStudiesContent = getContentBySection('case-studies');
  
  return caseStudiesContent.map(node => ({
    label: node.title,
    href: node.path
  }));
}

/**
 * Generate case studies data for main case studies page
 */
export function generateCaseStudiesData() {
  const caseStudiesContent = getContentBySection('case-studies');
  
  return caseStudiesContent.map(node => {
    // Extract company name from title (format: "Company System Name")
    const titleParts = node.title.split(' ');
    let company = titleParts[0];
    let title = node.title;
    
    // Handle special cases
    if (node.title.includes('Gmail')) {
      company = 'Google';
      title = 'Gmail Smart Compose GenAI System';
    } else if (node.title.includes('Tesla')) {
      company = 'Tesla';
      title = 'Autopilot Vision System';
    } else if (node.title.includes('Meta')) {
      company = 'Meta';
      title = 'Feed Ranking Algorithm';
    } else if (node.title.includes('Spotify')) {
      company = 'Spotify';
      title = 'ML Recommendation Engine';
    } else if (node.title.includes('Airbnb')) {
      company = 'Airbnb';
      title = 'Search & Pricing Engine';
    } else if (node.title.includes('OpenAI')) {
      company = 'OpenAI';
      title = 'ChatGPT Architecture';
    } else if (node.title.includes('Anthropic')) {
      company = 'Anthropic';
      title = 'Constitutional AI';
    }

    // Map categories to descriptions and key technologies
    const categoryData = {
      'GenAI Applications': {
        description: 'Real-time AI system with transformer architecture and privacy-preserving ML',
        keyTech: ['Transformer Architecture', 'Real-time Inference', 'Privacy-preserving ML', 'Federated Learning'],
        challenge: 'Sub-100ms latency, privacy, content quality, personalization'
      },
      'AI Safety': {
        description: 'Scalable oversight and harmlessness training for large language models',
        keyTech: ['Constitutional AI', 'RLHF', 'Scalable Oversight', 'Safety Training'],
        challenge: 'AI alignment, safety at scale, human preference learning'
      },
      'Autonomous Systems': {
        description: 'Computer vision and neural networks for real-time autonomous driving',
        keyTech: ['Computer Vision', 'Neural Networks', 'Edge Computing', 'Real-time Processing'],
        challenge: 'Real-time processing, safety-critical systems, sensor fusion'
      },
      'ML Recommendations': {
        description: 'Machine learning recommendation systems for personalized content discovery',
        keyTech: ['Collaborative Filtering', 'Deep Learning', 'Real-time ML', 'A/B Testing'],
        challenge: 'Cold start problem, real-time recommendations, music discovery'
      },
      'Social Networks': {
        description: 'Feed ranking and content recommendation algorithms at massive scale',
        keyTech: ['Machine Learning', 'Graph Neural Networks', 'Real-time Ranking', 'Content Understanding'],
        challenge: 'Engagement optimization, content quality, real-time ranking'
      },
      'Search & Discovery': {
        description: 'Search ranking and dynamic pricing systems for marketplace platforms',
        keyTech: ['Search Ranking', 'Machine Learning', 'Dynamic Pricing', 'Personalization'],
        challenge: 'Multi-objective optimization, real-time pricing, search relevance'
      },
      'Conversational AI': {
        description: 'Large-scale conversational AI systems with safety and alignment',
        keyTech: ['Large Language Models', 'RLHF', 'Distributed Training', 'Safety Systems'],
        challenge: 'Model alignment, safety, scalable training, conversation quality'
      }
    };

    const category = node.category || 'System Design';
    const data = categoryData[category as keyof typeof categoryData] || {
      description: node.seo?.metaDescription || 'System design case study',
      keyTech: node.tags.slice(0, 4) || [],
      challenge: 'Scalability, reliability, performance'
    };

    return {
      company,
      title,
      description: data.description,
      challenge: data.challenge,
      keyTech: data.keyTech,
      scale: getScaleFromContent(node),
      traffic: getTrafficFromContent(node), 
      infrastructure: getInfraFromContent(node),
      readTime: node.duration,
      level: node.level.charAt(0).toUpperCase() + node.level.slice(1),
      slug: node.path.split('/').pop() || node.id.replace('case-study-', '')
    };
  });
}

// Helper functions to extract scale/traffic info from content
function getScaleFromContent(node: any): string {
  const title = node.title.toLowerCase();
  if (title.includes('gmail')) return '300M+ users';
  if (title.includes('tesla')) return '5M+ vehicles';
  if (title.includes('meta')) return '3B+ users';
  if (title.includes('spotify')) return '574M+ users';
  if (title.includes('airbnb')) return '7M+ listings';
  if (title.includes('netflix')) return '230M+ subscribers';
  if (title.includes('uber')) return '118M+ users';
  if (title.includes('instagram')) return '2B+ users';
  return 'Massive scale';
}

function getTrafficFromContent(node: any): string {
  const title = node.title.toLowerCase();
  if (title.includes('gmail')) return '120B+ emails/day';
  if (title.includes('tesla')) return '1TB+ per vehicle/day';
  if (title.includes('meta')) return '100B+ posts/day';
  if (title.includes('spotify')) return '2B+ streams/day';
  if (title.includes('airbnb')) return '100M+ searches/day';
  return 'High throughput';
}

function getInfraFromContent(node: any): string {
  const title = node.title.toLowerCase();
  if (title.includes('genai') || title.includes('ai')) return 'AI/ML infrastructure';
  if (title.includes('tesla')) return 'Edge computing';
  if (title.includes('streaming')) return 'Global CDN';
  if (title.includes('search')) return 'Distributed search';
  return 'Distributed systems';
}

/**
 * Generate practice problems navigation
 */
export function generatePracticeNavConfig(): TechnologyNavItem[] {
  const practiceContent = getContentBySection('practice');
  
  return practiceContent.map(node => ({
    label: node.title,
    href: node.path
  }));
}

/**
 * Generate ML Systems sidebar navigation config
 * Groups content by category for organized sidebar display
 */
export function generateMLSystemsSidebarNav(): TechnologyNavGroup[] {
  const mlSystemsContent = getSectionOrderedContent('ml-systems');
  
  // Group by category
  const grouped = mlSystemsContent.reduce((acc, node) => {
    const category = node.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    
    acc[category].push({
      label: node.title,
      href: node.path
    });
    
    return acc;
  }, {} as Record<string, TechnologyNavItem[]>);
  
  // Create ordered groups
  const orderedGroups: TechnologyNavGroup[] = [];
  
  [...SECTION_CATEGORIES['ml-systems']]
    .sort((a, b) => a.order - b.order)
    .forEach(category => {
    if (grouped[category.key]) {
      orderedGroups.push({
        title: category.title,
        items: grouped[category.key]
      });
    }
  });
  
  // Add any remaining categories not in our config
  Object.keys(grouped).forEach(category => {
    if (!SECTION_CATEGORIES['ml-systems'].some(config => config.key === category)) {
      orderedGroups.push({
        title: category.split('-').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' '),
        items: grouped[category]
      });
    }
  });
  
  return orderedGroups;
}

/**
 * Generate Fundamentals sidebar navigation config
 * Groups content based on topic areas
 */
export function generateFundamentalsSidebarNav(): TechnologyNavGroup[] {
  const fundamentalsContent = getSectionOrderedContent('fundamentals');
  const grouped = fundamentalsContent.reduce((acc, node) => {
    const category = node.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push({
      label: node.title,
      href: node.path
    });
    return acc;
  }, {} as Record<string, TechnologyNavItem[]>);

  const groups = [...SECTION_CATEGORIES.fundamentals]
    .sort((a, b) => a.order - b.order)
    .map(category => ({
      title: category.title,
      items: grouped[category.key] || []
    }))
    .filter(group => group.items.length > 0);

  Object.entries(grouped).forEach(([category, items]) => {
    if (!SECTION_CATEGORIES.fundamentals.some(config => config.key === category)) {
      groups.push({
        title: getCategoryDisplayName(category),
        items
      });
    }
  });

  return groups;
}

/**
 * Generate GenAI sidebar navigation config
 */
export function generateGenAISidebarNav(): TechnologyNavItem[] {
  const genaiContent = getContentBySection('genai');
  
  return genaiContent.map(node => ({
    label: node.title,
    href: node.path
  }));
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Map internal category names to user-friendly display names
 */
export function getCategoryDisplayName(category: string): string {
  const categoryMap: Record<string, string> = {
    // Technology categories with human-readable names
    'ai-ml-frameworks': 'AI & ML Frameworks',
    'databases': 'Databases',
    'data-processing': 'Data Processing',
    'containerization': 'Containerization',
    'ml-infrastructure': 'ML Infrastructure',
    'service-mesh': 'Service Mesh',
    'devops-cicd': 'DevOps & CI/CD',
    'monitoring-observability': 'Monitoring & Observability',
    'cloud-platforms': 'Cloud Platforms',
    'api-communication': 'API & Communication',
    'security-auth': 'Security & Auth',
    'service-discovery': 'Service Discovery',
    'distributed-coordination': 'Distributed Coordination',
    'workflow-orchestration': 'Workflow Orchestration',
    'systems-concepts': 'Systems Concepts',
    'resilience-patterns': 'Resilience Patterns',
    'architecture-patterns': 'Architecture Patterns',
    'database-patterns': 'Database Patterns',
    'data-formats': 'Data Formats',
    'search-indexing': 'Search & Indexing',
    'ai-computer-vision': 'AI & Computer Vision',
    'ml-tools': 'ML Tools',
    'programming-languages': 'Programming Languages',
    'web-scraping': 'Web Scraping',
    'nlp': 'Natural Language Processing',
    'algorithms': 'Algorithms',

    // Legacy categories that are already properly formatted
    'AI/ML Frameworks': 'AI & ML Frameworks',
    'Cache & Storage': 'Cache & Storage',
    'Message Streaming': 'Message Streaming',
    'Search & Analytics': 'Search & Analytics',
    'Cloud Platforms': 'Cloud Platforms',
    'API & Communication': 'API & Communication',
    'Web & Networking': 'Web & Networking',
    'Containerization': 'Containerization',
    'Orchestration': 'Orchestration',
    'Service Mesh': 'Service Mesh',
    'Infrastructure': 'Infrastructure',
    'DevOps & CI/CD': 'DevOps & CI/CD',
    'Security & Auth': 'Security & Auth',
    'Monitoring & Observability': 'Monitoring & Observability',
    'Data Processing': 'Data Processing',
    'Database Patterns': 'Database Patterns',
    'Service Discovery': 'Service Discovery',
    'Workflow Orchestration': 'Workflow Orchestration',
    'Distributed Coordination': 'Distributed Coordination',

    // Reference and other section categories
    'Templates': 'Templates',
    'Planning': 'Planning',
    'Databases': 'Databases',
    'API Design': 'API Design',
    'Security': 'Security',
    'Architecture Patterns': 'Architecture Patterns',
    'Performance': 'Performance',
    'Interview Prep': 'Interview Prep',
    'Reference': 'Reference',
    'Principles': 'Principles',
    'Operations': 'Operations',
    'Data Structures': 'Data Structures',
    'Networking': 'Networking',
    'Deployment': 'Deployment',
    'Calculators': 'Calculators',
    'Simulators': 'Simulators',
    'Visualizers': 'Visualizers',
    'Decision Tools': 'Decision Tools',
    'Planning Tools': 'Planning Tools',
    'Design Tools': 'Design Tools',
    'Architecture Tools': 'Architecture Tools',
    'Learning Tools': 'Learning Tools',
    'Testing Tools': 'Testing Tools'
  };

  return categoryMap[category] || category;
}

/**
 * Get next lesson info for a given lesson slug in a section
 */
export function getNextLessonInfo(section: ContentNode['section'], currentSlug: string): {
  nextLessonUrl?: string;
  nextLessonTitle?: string;
} {
  const lessons = generateLessonsConfig(section);
  const currentLesson = lessons.find(lesson => lesson.slug === currentSlug);
  
  if (!currentLesson?.next) {
    return {};
  }
  
  const nextLesson = lessons.find(lesson => lesson.slug === currentLesson.next);
  if (!nextLesson) {
    return {};
  }
  
  return {
    nextLessonUrl: `/${section}/${nextLesson.slug}`,
    nextLessonTitle: nextLesson.title
  };
}

/**
 * Find current lesson config by slug in a section
 */
export function findLessonConfig(section: ContentNode['section'], slug: string): LessonConfig | undefined {
  const lessons = generateLessonsConfig(section);
  return lessons.find(lesson => lesson.slug === slug);
}

/**
 * Get category description for reference sections
 */
function getCategoryDescription(category: string): string {
  const descriptions: Record<string, string> = {
    'Templates': 'System design templates and frameworks for interviews',
    'Planning': 'Capacity planning and estimation guides',
    'Databases': 'Database selection and comparison guides',
    'API Design': 'API design principles and best practices',
    'Security': 'Security checklists and best practices',
    'Architecture Patterns': 'Microservices and architectural patterns',
    'Performance': 'Performance optimization techniques',
    'Interview Prep': 'System design interview preparation',
    'Reference': 'Quick reference guides and lookups',
    'Principles': 'Design principles and software laws',
    'Operations': 'Troubleshooting and operational guides',
    'Data Structures': 'System-relevant data structures',
    'Networking': 'Network protocols and communication',
    'Deployment': 'Deployment strategies and CI/CD',
    'Cloud Computing': 'Cloud service comparisons',
    'Monitoring': 'Key metrics and monitoring practices'
  };
  
  return descriptions[category] || 'Reference materials';
}

/**
 * Get category icon for reference sections
 */
function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    'Templates': '📋',
    'Planning': '📊',
    'Databases': '🗄️',
    'API Design': '🔌',
    'Security': '🔒',
    'Architecture Patterns': '🏗️',
    'Performance': '⚡',
    'Interview Prep': '💼',
    'Reference': '📖',
    'Principles': '⚖️',
    'Operations': '🔧',
    'Data Structures': '🌳',
    'Networking': '🌐',
    'Deployment': '🚀',
    'Cloud Computing': '☁️',
    'Monitoring': '📈'
  };
  
  return icons[category] || '📄';
}

/**
 * Get description for reference items (legacy compatibility)
 */
function getReferenceDescription(slug: string): string {
  const descriptions: Record<string, string> = {
    'system-design-template': 'Complete framework for system design interviews',
    'capacity-planning': 'Traffic estimation and bandwidth planning',
    'database-comparison': 'SQL vs NoSQL selection matrix',
    'api-design-checklist': 'REST API design best practices',
    'security-checklist': 'Security guidelines and OWASP compliance',
    'microservices-patterns': 'Service decomposition patterns',
    'cloud-services-comparison': 'AWS vs GCP vs Azure comparison',
    'monitoring-metrics': 'SLI/SLO/SLA and golden signals',
    'performance-optimization': 'Caching and performance tuning',
    'interview-prep': 'System design interview guide',
    'glossary': 'Technical terms and definitions',
    'design-principles': 'SOLID, DRY, KISS principles',
    'troubleshooting-guide': 'Production incident response',
    'data-structures': 'Bloom filters and system data structures',
    'networking-protocols': 'TCP/IP and protocol selection',
    'deployment-strategies': 'Blue-green and canary deployments'
  };
  
  return descriptions[slug] || 'Reference guide';
}
