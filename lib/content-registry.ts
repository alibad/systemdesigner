import registryData from '../content/registry.json';

/**
 * SINGLE SOURCE OF TRUTH FOR ALL CONTENT
 * 
 * This registry contains ALL content pages across the application.
 * All navigation configs, layouts, sitemaps, and content relationships
 * should be generated from this central registry.
 * 
 * Total entries: 425 across 8 sections
 */

export interface ContentNode {
  id: string;                    // Unique identifier: 'scalability-basics'
  title: string;                 // Display title: 'Scalability Basics'
  path: string;                  // Full URL path like /fundamentals/scalability-basics
  section: 'fundamentals' | 'genai' | 'ml-systems' | 'technology' | 'case-studies' | 'practice' | 'reference' | 'tools';

  // Learning metadata
  level: 'beginner' | 'intermediate' | 'advanced';
  duration: string;              // '15 min', '30 min'
  hasQuiz: boolean;
  hasScenarios: boolean;
  hasCalculator: boolean;
  hasChallenge?: boolean;        // has a graded interactive challenge block (design/capacity/trade-off)
  renderMode: 'mdoc';             // Body: content/entries/<section>/<slug>/index.mdoc

  // Content relationships
  prerequisites: string[];       // Required knowledge: ['database-fundamentals']
  related: string[];            // Related topics: ['performance-metrics', 'bottleneck-analysis']
  nextInSequence?: string;       // Optional explicit next lesson id; falls back to section order

  // Content categorization
  tags: string[];               // Searchable keywords
  category?: string;            // Sub-category within section

  // SEO optimization
  seo: {
    metaDescription: string;     // 150-160 char description
    keywords: string[];          // Target SEO keywords
    priority: number;            // Sitemap priority (0.0-1.0)
    changeFreq: 'weekly' | 'monthly' | 'yearly';
    lastModified: Date;
  };

  // Content status
  status: 'active' | 'draft' | 'deprecated';

  // Deduplication handling
  canonicalId?: string;         // Points to canonical version if duplicate
  aliases?: string[];           // Alternative URLs that redirect here
}

export interface CategoryConfig {
  key: string;                   // Category identifier
  title: string;                 // Display title
  description: string;           // Category description
  order: number;                 // Display order
}

export interface SectionCategories {
  fundamentals: CategoryConfig[];
  genai: CategoryConfig[];
  'ml-systems': CategoryConfig[];
  technology: CategoryConfig[];
  'case-studies': CategoryConfig[];
  practice: CategoryConfig[];
  reference: CategoryConfig[];
  tools: CategoryConfig[];
}

/**
 * SECTION CATEGORIES - Single source of truth for learning path organization
 * Defines category structure and display order for each section
 */
export const SECTION_CATEGORIES: SectionCategories = {
  fundamentals: [
    { key: 'getting-started', title: 'Getting Started', description: 'Core concepts and terminology for system design', order: 1 },
    { key: 'performance-fundamentals', title: 'Performance Fundamentals', description: 'Understanding latency, throughput, and optimization', order: 2 },
    { key: 'data-storage', title: 'Data & Storage', description: 'Database concepts and data modeling basics', order: 3 },
    { key: 'system-architecture', title: 'System Architecture', description: 'Building blocks and architectural patterns', order: 4 },
    { key: 'architecture-patterns', title: 'Architecture Patterns', description: 'Advanced architectural patterns and designs', order: 5 },
    { key: 'distributed-systems', title: 'Distributed Systems', description: 'Distributed computing and coordination', order: 6 },
    { key: 'advanced-topics', title: 'Advanced Topics', description: 'Complex system design concepts', order: 7 },
    { key: 'interview-preparation', title: 'Interview Preparation', description: 'Systematic approach to system design interviews', order: 8 }
  ],
  genai: [
    { key: 'llm-fundamentals', title: 'LLM Fundamentals', description: 'Master Large Language Models, prompting, and AI applications', order: 1 },
    { key: 'tokenization', title: 'Tokenization & Text Processing', description: 'Understanding text-to-token conversion, vocabulary management', order: 2 },
    { key: 'rag-knowledge-systems', title: 'RAG & Knowledge Systems', description: 'Build intelligent systems with Retrieval-Augmented Generation', order: 3 },
    { key: 'fine-tuning', title: 'Model Fine-Tuning', description: 'Advanced techniques for customizing language models', order: 4 },
    { key: 'ai-applications', title: 'AI Applications', description: 'Production-ready AI systems with agents and safety', order: 5 },
    { key: 'vision-language', title: 'Vision-Language Models', description: 'Multimodal AI systems combining vision and language', order: 6 },
    { key: 'document-ai', title: 'Document AI & Parsing', description: 'Document parsing, table extraction, structured data', order: 7 },
    { key: 'evaluation', title: 'Evaluation & Benchmarks', description: 'Comprehensive evaluation frameworks and benchmarks', order: 8 },
    { key: 'safety', title: 'AI Safety & Evaluation', description: 'Safety evaluation, bias detection, responsible AI', order: 9 },
    { key: 'security', title: 'AI Security', description: 'Adversarial testing, robustness, security considerations', order: 10 },
    { key: 'data-curation', title: 'Data Curation & Quality', description: 'Dataset construction, quality filtering, data management', order: 11 },
    { key: 'genai-systems', title: 'GenAI Systems Design', description: 'Architecture patterns for generative AI applications', order: 12 },
    { key: 'genai-infrastructure', title: 'GenAI Infrastructure', description: 'Deploy and scale AI applications in production', order: 13 },
    { key: 'genai-engineering', title: 'GenAI Engineering', description: 'Production engineering practices for GenAI systems', order: 14 },
    { key: 'advanced-genai', title: 'Advanced GenAI', description: 'Cutting-edge techniques and emerging patterns', order: 15 }
  ],
  'ml-systems': [
    { key: 'foundations', title: 'Foundations', description: 'Core concepts and design principles for ML systems', order: 1 },
    { key: 'ml-fundamentals', title: 'ML Fundamentals', description: 'Machine learning basics and algorithms', order: 2 },
    { key: 'data-features', title: 'Data & Features', description: 'Build robust data pipelines and engineer features', order: 3 },
    { key: 'data-processing', title: 'Data Processing', description: 'Large-scale data processing and ETL', order: 4 },
    { key: 'model-development', title: 'Model Development', description: 'Advanced training strategies and serving architectures', order: 5 },
    { key: 'model-optimization', title: 'Model Optimization', description: 'Performance tuning and efficiency improvements', order: 6 },
    { key: 'production-ml', title: 'Production ML', description: 'MLOps, monitoring, and experimentation', order: 7 },
    { key: 'industry-applications', title: 'Industry Applications', description: 'Real-world ML applications across industries', order: 8 },
    { key: 'advanced-topics', title: 'Advanced Topics', description: 'Cutting-edge research and emerging ML paradigms', order: 9 }
  ],
  technology: [
    { key: 'ai-ml-frameworks', title: 'AI & ML Frameworks', description: 'Machine learning and AI frameworks', order: 1 },
    { key: 'databases', title: 'Databases', description: 'SQL and NoSQL database systems', order: 2 },
    { key: 'cache-storage', title: 'Cache & Storage', description: 'Caching systems and storage solutions', order: 3 },
    { key: 'message-streaming', title: 'Message Streaming', description: 'Event streaming and messaging platforms', order: 4 },
    { key: 'search-analytics', title: 'Search & Analytics', description: 'Search engines and analytics tools', order: 5 },
    { key: 'cloud-platforms', title: 'Cloud Platforms', description: 'Cloud service providers and platforms', order: 6 },
    { key: 'api-communication', title: 'API & Communication', description: 'API protocols and communication patterns', order: 7 },
    { key: 'web-networking', title: 'Web & Networking', description: 'Web technologies and networking', order: 8 },
    { key: 'containerization', title: 'Containerization', description: 'Container technologies and orchestration', order: 9 },
    { key: 'orchestration', title: 'Orchestration', description: 'Container and workflow orchestration', order: 10 },
    { key: 'service-mesh', title: 'Service Mesh', description: 'Service mesh technologies', order: 11 },
    { key: 'infrastructure', title: 'Infrastructure', description: 'Infrastructure as code and management', order: 12 },
    { key: 'devops-cicd', title: 'DevOps & CI/CD', description: 'Continuous integration and deployment', order: 13 },
    { key: 'security-auth', title: 'Security & Auth', description: 'Security and authentication systems', order: 14 },
    { key: 'monitoring-observability', title: 'Monitoring & Observability', description: 'System monitoring and observability', order: 15 },
    { key: 'data-processing', title: 'Data Processing', description: 'Big data processing frameworks', order: 16 },
    { key: 'database-patterns', title: 'Database Patterns', description: 'Database design patterns', order: 17 },
    { key: 'systems-concepts', title: 'Systems Concepts', description: 'System design concepts', order: 18 },
    { key: 'resilience-patterns', title: 'Resilience Patterns', description: 'Fault tolerance and resilience', order: 19 },
    { key: 'emerging-tech', title: 'Emerging Technologies', description: 'New and emerging technologies', order: 20 }
  ],
  'case-studies': [
    { key: 'GenAI Applications', title: 'GenAI Applications', description: 'Real-world generative AI implementations', order: 1 },
    { key: 'AI Safety', title: 'AI Safety', description: 'Safety and alignment in AI systems', order: 2 },
    { key: 'Autonomous Systems', title: 'Autonomous Systems', description: 'Self-driving and autonomous technologies', order: 3 },
    { key: 'ML Recommendations', title: 'ML Recommendations', description: 'Recommendation engine architectures', order: 4 },
    { key: 'Social Networks', title: 'Social Networks', description: 'Social platform architectures', order: 5 },
    { key: 'Search & Discovery', title: 'Search & Discovery', description: 'Search and discovery systems', order: 6 },
    { key: 'Conversational AI', title: 'Conversational AI', description: 'Chat and conversational systems', order: 7 }
  ],
  practice: [
    { key: 'System Design Practice', title: 'System Design Practice', description: 'Traditional distributed systems problems', order: 1 },
    { key: 'ML Systems Practice', title: 'ML Systems Practice', description: 'Machine learning system design problems', order: 2 },
    { key: 'GenAI Systems Practice', title: 'GenAI Systems Practice', description: 'Generative AI system design problems', order: 3 }
  ],
  reference: [
    { key: 'Templates', title: 'Templates', description: 'System design templates and frameworks', order: 1 },
    { key: 'Planning', title: 'Planning', description: 'Capacity planning and estimation guides', order: 2 },
    { key: 'Databases', title: 'Databases', description: 'Database selection and comparison guides', order: 3 },
    { key: 'API Design', title: 'API Design', description: 'API design principles and best practices', order: 4 },
    { key: 'Security', title: 'Security', description: 'Security checklists and best practices', order: 5 },
    { key: 'Architecture Patterns', title: 'Architecture Patterns', description: 'Microservices and architectural patterns', order: 6 },
    { key: 'Performance', title: 'Performance', description: 'Performance optimization techniques', order: 7 },
    { key: 'Operations', title: 'Operations', description: 'Troubleshooting and operational guides', order: 8 },
    { key: 'Principles', title: 'Principles', description: 'Design principles and software laws', order: 9 },
    { key: 'Data Structures', title: 'Data Structures', description: 'System-relevant data structures', order: 10 },
    { key: 'Networking', title: 'Networking', description: 'Network protocols and communication', order: 11 },
    { key: 'Deployment', title: 'Deployment', description: 'Deployment strategies and CI/CD', order: 12 }
  ],
  tools: [
    { key: 'Calculators', title: 'Calculators', description: 'Performance and capacity calculators', order: 1 },
    { key: 'Simulators', title: 'Simulators', description: 'System behavior simulators', order: 2 },
    { key: 'Visualizers', title: 'Visualizers', description: 'Data and architecture visualizers', order: 3 },
    { key: 'Decision Tools', title: 'Decision Tools', description: 'Technology selection tools', order: 4 },
    { key: 'Planning Tools', title: 'Planning Tools', description: 'Capacity and resource planning', order: 5 },
    { key: 'Design Tools', title: 'Design Tools', description: 'Architecture design tools', order: 6 },
    { key: 'Learning Tools', title: 'Learning Tools', description: 'Interactive learning tools', order: 7 },
    { key: 'Testing Tools', title: 'Testing Tools', description: 'System testing and validation', order: 8 }
  ]
};

type SerializedContentNode = Omit<ContentNode, 'seo'> & {
  seo: Omit<ContentNode['seo'], 'lastModified'> & { lastModified: string };
};

/**
 * Admin-managed registry data. Dates are revived here so existing consumers keep
 * the same typed ContentNode contract.
 */
export const CONTENT_REGISTRY: ContentNode[] = (
  registryData as unknown as SerializedContentNode[]
).map((node) => ({
  ...node,
  seo: {
    ...node.seo,
    lastModified: new Date(node.seo.lastModified),
  },
}));

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get content by ID
 */
export function getContentById(id: string): ContentNode | undefined {
  return CONTENT_REGISTRY.find(node => node.id === id);
}

/**
 * Get content by path
 */
export function getContentByPath(path: string): ContentNode | undefined {
  return CONTENT_REGISTRY.find(node => node.path === path);
}

/**
 * Get all content for a section
 */
export function getContentBySection(section: ContentNode['section']): ContentNode[] {
  return CONTENT_REGISTRY.filter(node => node.section === section && node.status === 'active');
}

/**
 * Get learning path (prerequisite chain) for a content node
 */
export function getLearningPath(targetId: string): ContentNode[] {
  const visited = new Set<string>();
  const path: ContentNode[] = [];
  
  function buildPath(nodeId: string) {
    if (visited.has(nodeId)) return;
    
    const node = getContentById(nodeId);
    if (!node) return;
    
    visited.add(nodeId);
    
    // Add prerequisites first
    node.prerequisites.forEach(prereqId => buildPath(prereqId));
    
    path.push(node);
  }
  
  buildPath(targetId);
  return path;
}


/**
 * Get related content
 */
export function getRelatedContent(nodeId: string): ContentNode[] {
  const node = getContentById(nodeId);
  if (!node) return [];
  
  return node.related
    .map(relatedId => getContentById(relatedId))
    .filter(Boolean) as ContentNode[];
}

/**
 * Search content by tags or title
 */
export function searchContent(query: string): ContentNode[] {
  const lowerQuery = query.toLowerCase();
  
  return CONTENT_REGISTRY.filter(node => 
    node.status === 'active' && (
      node.title.toLowerCase().includes(lowerQuery) ||
      node.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      node.seo.keywords.some(keyword => keyword.toLowerCase().includes(lowerQuery))
    )
  );
}

/**
 * Generate sitemap data
 */
export function generateSitemapData() {
  return CONTENT_REGISTRY
    .filter(node => node.status === 'active')
    .map(node => ({
      loc: `https://systemdesigner.com${node.path}`,
      lastmod: node.seo.lastModified.toISOString(),
      changefreq: node.seo.changeFreq,
      priority: node.seo.priority,
    }));
}

/**
 * Get content statistics
 */
export function getContentStats() {
  const stats = {
    total: CONTENT_REGISTRY.length,
    active: 0,
    draft: 0,
    deprecated: 0,
    sections: {} as Record<string, number>,
    levels: {} as Record<string, number>,
    hasQuiz: 0,
    hasScenarios: 0,
    hasCalculator: 0,
  };
  
  CONTENT_REGISTRY.forEach(node => {
    stats[node.status]++;
    stats.sections[node.section] = (stats.sections[node.section] || 0) + 1;
    stats.levels[node.level] = (stats.levels[node.level] || 0) + 1;
    
    if (node.hasQuiz) stats.hasQuiz++;
    if (node.hasScenarios) stats.hasScenarios++;
    if (node.hasCalculator) stats.hasCalculator++;
  });
  
  return stats;
}

/**
 * Validate content registry for issues
 */
export function validateContentRegistry() {
  const issues: string[] = [];
  const ids = new Set<string>();
  const paths = new Set<string>();
  
  CONTENT_REGISTRY.forEach((node, index) => {
    const prefix = `[${index}] ${node.id}:`;
    
    // Check for duplicate IDs
    if (ids.has(node.id)) {
      issues.push(`${prefix} Duplicate ID`);
    }
    ids.add(node.id);
    
    // Check for duplicate paths
    if (paths.has(node.path)) {
      issues.push(`${prefix} Duplicate path: ${node.path}`);
    }
    paths.add(node.path);
    
    // Validate prerequisites exist
    node.prerequisites.forEach(prereqId => {
      if (!getContentById(prereqId)) {
        issues.push(`${prefix} Invalid prerequisite: ${prereqId}`);
      }
    });
    
    // Validate related content exists
    node.related.forEach(relatedId => {
      if (!getContentById(relatedId)) {
        issues.push(`${prefix} Invalid related content: ${relatedId}`);
      }
    });
    
    
    // Validate canonical references
    if (node.canonicalId && !getContentById(node.canonicalId)) {
      issues.push(`${prefix} Invalid canonicalId: ${node.canonicalId}`);
    }
    
    // Check SEO description length
    if (node.seo.metaDescription.length > 160) {
      issues.push(`${prefix} Meta description too long (${node.seo.metaDescription.length} chars)`);
    }
    
    // Check for missing tags
    if (node.tags.length === 0) {
      issues.push(`${prefix} No tags specified`);
    }
  });
  
  return {
    isValid: issues.length === 0,
    issues,
    stats: getContentStats(),
  };
}
