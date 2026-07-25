/**
 * Dynamic Keyword Linking System
 * 
 * This system automatically identifies keywords in content and creates
 * intelligent links to related pages using the content registry.
 */

import { CONTENT_REGISTRY, ContentNode } from './content-registry';

// Types
export interface KeywordMatch {
  keyword: string;
  variants: string[];
  contentId: string;
  path: string;
  title: string;
  relevanceScore: number;
  section: string;
  level: string;
}

export interface LinkableKeyword {
  text: string;
  href: string;
  title: string;
  relevance: number;
  section: string;
  allMatches?: KeywordMatch[]; // All possible matches for this keyword
  hasMultipleMatches?: boolean; // Flag for UI behavior
}

export interface KeywordConfig {
  maxLinksPerPage?: number;
  minRelevanceScore?: number;
  excludeSameSection?: boolean;
  prioritizeSections?: string[];
  excludeSections?: string[];
  caseSensitive?: boolean;
}

// Hard-coded high-priority technology names to ensure they're always found
const PRIORITY_TECHNOLOGIES = [
  'mongodb', 'cassandra', 'dynamodb', 'postgresql', 'mysql', 'redis',
  'elasticsearch', 'kafka', 'rabbitmq', 'kubernetes', 'docker',
  'nginx', 'apache', 'aws', 'gcp', 'azure', 'terraform'
];

// Default configuration
const DEFAULT_CONFIG: KeywordConfig = {
  maxLinksPerPage: 10,
  minRelevanceScore: 0.5,
  excludeSameSection: false,
  prioritizeSections: [],
  excludeSections: [],
  caseSensitive: false,
};

// Global keyword index - built once and cached
let KEYWORD_INDEX: Map<string, KeywordMatch[]> | null = null;

/**
 * Build a keyword index from the content registry (cached)
 */
export function buildKeywordIndex(): Map<string, KeywordMatch[]> {
  // Return cached index if available
  if (KEYWORD_INDEX) {
    return KEYWORD_INDEX;
  }

  const index = new Map<string, KeywordMatch[]>();

  // Only index high-value keywords to avoid performance issues
  const highValueSections = ['technology', 'fundamentals', 'reference'];

  CONTENT_REGISTRY.forEach(content => {
    if (content.status !== 'active') return;

    // Only process high-value sections and explicit tags
    if (!highValueSections.includes(content.section)) {
      // For other sections, only include if explicitly tagged
      if (content.tags.length === 0) return;
    }

    // Extract only the most relevant keywords
    const keywords = extractHighValueKeywords(content);

    keywords.forEach(keyword => {
      const normalizedKeyword = keyword.toLowerCase();
      const matches = index.get(normalizedKeyword) || [];

      matches.push({
        keyword: keyword,
        variants: generateVariants(keyword),
        contentId: content.id,
        path: content.path,
        title: content.title,
        relevanceScore: calculateRelevance(keyword, content),
        section: content.section,
        level: content.level,
      });

      index.set(normalizedKeyword, matches);
    });
  });

  // Cache the index
  KEYWORD_INDEX = index;
  return index;
}

/**
 * Extract only high-value keywords to avoid performance issues
 */
function extractHighValueKeywords(content: ContentNode): string[] {
  const keywords = new Set<string>();

  // For technology pages, focus on the main technology name
  if (content.section === 'technology') {
    // Add the main technology name (without prefixes)
    const withoutPrefixes = content.title
      .replace(/^(Apache|Amazon|Google|Microsoft|Facebook|Meta)\s+/i, '');
    keywords.add(withoutPrefixes.toLowerCase());

    // Add first tag (usually the main technology name)
    if (content.tags[0]) {
      keywords.add(content.tags[0].toLowerCase());
    }
  }

  // For fundamentals, add key concept names
  if (content.section === 'fundamentals') {
    content.tags.slice(0, 3).forEach(tag => { // Only first 3 tags
      if (tag.length > 3) keywords.add(tag.toLowerCase());
    });
  }

  // Always add explicit SEO keywords (these are curated)
  content.seo.keywords.slice(0, 3).forEach(keyword => { // Only first 3
    keywords.add(keyword.toLowerCase());
  });

  return Array.from(keywords);
}

/**
 * Extract keywords from a content node (legacy - keeping for compatibility)
 */
function extractKeywordsFromContent(content: ContentNode): string[] {
  const keywords = new Set<string>();
  
  // Add title-based keywords (both individual words and full title)
  const titleWords = content.title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3);
  titleWords.forEach(word => keywords.add(word));

  // Add full title as a keyword (for multi-word technology names)
  if (content.section === 'technology') {
    keywords.add(content.title.toLowerCase());
    // Also add without common prefixes
    const withoutPrefixes = content.title.toLowerCase()
      .replace(/^(apache|amazon|google|microsoft|facebook|meta)\s+/i, '');
    if (withoutPrefixes !== content.title.toLowerCase()) {
      keywords.add(withoutPrefixes);
    }
  }
  
  // Add explicit tags (both as-is and lowercase)
  content.tags.forEach(tag => {
    keywords.add(tag.toLowerCase());
    keywords.add(tag); // Keep original case too
  });
  
  // Add SEO keywords
  content.seo.keywords.forEach(keyword => keywords.add(keyword));
  
  // Add technology/concept names from the ID
  const idParts = content.id.split('-');
  idParts.forEach(part => {
    if (part.length > 2) keywords.add(part);
  });
  
  // Add common variations and abbreviations
  const variations = generateCommonVariations(content.title);
  variations.forEach(v => keywords.add(v));
  
  return Array.from(keywords);
}

/**
 * Generate keyword variants (plurals, abbreviations, etc.)
 */
function generateVariants(keyword: string): string[] {
  const variants = [keyword];
  
  // Plural/singular forms
  if (keyword.endsWith('s')) {
    variants.push(keyword.slice(0, -1));
  } else if (!keyword.endsWith('ss')) {
    variants.push(keyword + 's');
  }
  
  // Common tech abbreviations
  const abbreviations: Record<string, string[]> = {
    'database': ['db', 'dbs'],
    'kubernetes': ['k8s'],
    'javascript': ['js'],
    'typescript': ['ts'],
    'machine learning': ['ml'],
    'artificial intelligence': ['ai'],
    'large language model': ['llm'],
    'generative ai': ['genai', 'gen ai'],
    'continuous integration': ['ci'],
    'continuous deployment': ['cd'],
    'application programming interface': ['api'],
    'representational state transfer': ['rest'],
    'graphql': ['gql'],
    'content delivery network': ['cdn'],
    'domain name system': ['dns'],
    'secure sockets layer': ['ssl'],
    'transport layer security': ['tls'],
  };
  
  const lowerKeyword = keyword.toLowerCase();
  Object.entries(abbreviations).forEach(([full, abbrevs]) => {
    if (lowerKeyword === full) {
      variants.push(...abbrevs);
    } else if (abbrevs.includes(lowerKeyword)) {
      variants.push(full);
    }
  });
  
  return variants;
}

/**
 * Generate common variations of a title
 */
function generateCommonVariations(title: string): string[] {
  const variations: string[] = [];
  const lower = title.toLowerCase();
  
  // Handle compound words
  if (lower.includes(' ')) {
    // "Load Balancing" -> "loadbalancing", "load-balancing"
    variations.push(lower.replace(/\s+/g, ''));
    variations.push(lower.replace(/\s+/g, '-'));
  }
  
  // Handle hyphenated words
  if (lower.includes('-')) {
    // "load-balancing" -> "load balancing", "loadbalancing"
    variations.push(lower.replace(/-/g, ' '));
    variations.push(lower.replace(/-/g, ''));
  }
  
  return variations;
}

/**
 * Calculate relevance score for a keyword-content pair
 */
function calculateRelevance(keyword: string, content: ContentNode): number {
  let score = 0.5; // Base score
  
  // Boost if keyword is in title
  if (content.title.toLowerCase().includes(keyword.toLowerCase())) {
    score += 0.3;
  }
  
  // Boost if keyword is primary tag
  if (content.tags[0] === keyword) {
    score += 0.2;
  } else if (content.tags.includes(keyword)) {
    score += 0.1;
  }
  
  // Boost if keyword is in SEO keywords
  if (content.seo.keywords.some(k => k.toLowerCase() === keyword.toLowerCase())) {
    score += 0.1;
  }
  
  // Adjust based on content level
  if (content.level === 'beginner') {
    score += 0.1; // Prefer linking to beginner content
  }

  // Boost technology pages since they're often the target for keyword links
  if (content.section === 'technology') {
    score += 0.15;
  }
  
  return Math.min(score, 1.0);
}

/**
 * Find linkable keywords in text content
 */
export function findLinkableKeywords(
  text: string,
  currentPath: string,
  config: KeywordConfig = {}
): LinkableKeyword[] {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const index = buildKeywordIndex();
  const foundKeywords: LinkableKeyword[] = [];
  const usedPaths = new Set<string>();
  
  // Sort keywords by length (longest first) to handle overlapping matches
  const sortedKeywords = Array.from(index.keys())
    .sort((a, b) => b.length - a.length);
  
  // Track positions that have been matched to avoid overlaps
  const matchedPositions = new Set<number>();
  
  sortedKeywords.forEach(keyword => {
    const matches = index.get(keyword) || [];
    
    // Find all positions of this keyword in the text
    const positions = findKeywordPositions(text, keyword, mergedConfig.caseSensitive);
    
    positions.forEach(pos => {
      // Check if this position overlaps with an already matched keyword
      let overlaps = false;
      for (let i = pos; i < pos + keyword.length; i++) {
        if (matchedPositions.has(i)) {
          overlaps = true;
          break;
        }
      }
      
      if (!overlaps) {
        // Find the best match for this keyword
        const bestMatch = selectBestMatch(
          matches,
          currentPath,
          usedPaths,
          mergedConfig
        );
        
        if (bestMatch && !usedPaths.has(bestMatch.path)) {
          // Get all valid matches for this keyword (for multi-result popover)
          const allValidMatches = matches.filter(m =>
            m.path !== currentPath &&
            !usedPaths.has(m.path) &&
            m.relevanceScore >= (mergedConfig.minRelevanceScore || 0.5)
          );

          foundKeywords.push({
            text: keyword,
            href: bestMatch.path,
            title: bestMatch.title,
            relevance: bestMatch.relevanceScore,
            section: bestMatch.section,
            allMatches: allValidMatches,
            hasMultipleMatches: allValidMatches.length > 1,
          });
          
          // Mark this path as used
          usedPaths.add(bestMatch.path);
          
          // Mark these positions as matched
          for (let i = pos; i < pos + keyword.length; i++) {
            matchedPositions.add(i);
          }
          
          // Stop if we've reached the max links
          if (foundKeywords.length >= (mergedConfig.maxLinksPerPage || 10)) {
            return;
          }
        }
      }
    });
    
    if (foundKeywords.length >= (mergedConfig.maxLinksPerPage || 10)) {
      return;
    }
  });
  
  return foundKeywords.sort((a, b) => b.relevance - a.relevance);
}

/**
 * Find all positions of a keyword in text
 */
function findKeywordPositions(
  text: string,
  keyword: string,
  caseSensitive: boolean = false
): number[] {
  const positions: number[] = [];
  const searchText = caseSensitive ? text : text.toLowerCase();
  const searchKeyword = caseSensitive ? keyword : keyword.toLowerCase();
  
  // Use flexible boundary matching to handle bullet points and other separators
  const regex = new RegExp(`(^|[\\s•·▪▫-])${escapeRegex(searchKeyword)}(?=[\\s•·▪▫-]|$)`, 'gi');
  let match;

  while ((match = regex.exec(searchText)) !== null) {
    // Adjust position to account for the capture group
    const keywordStart = match.index + match[1].length;
    positions.push(keywordStart);
  }
  
  return positions;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Select the best match from multiple options
 */
function selectBestMatch(
  matches: KeywordMatch[],
  currentPath: string,
  usedPaths: Set<string>,
  config: KeywordConfig
): KeywordMatch | null {
  // Filter out already used paths and the current page
  let validMatches = matches.filter(m => 
    m.path !== currentPath && 
    !usedPaths.has(m.path) &&
    m.relevanceScore >= (config.minRelevanceScore || 0.5)
  );
  
  // Apply section filters
  if (config.excludeSections && config.excludeSections.length > 0) {
    validMatches = validMatches.filter(m => 
      !config.excludeSections!.includes(m.section)
    );
  }
  
  if (config.excludeSameSection) {
    const currentSection = CONTENT_REGISTRY.find(c => c.path === currentPath)?.section;
    if (currentSection) {
      validMatches = validMatches.filter(m => m.section !== currentSection);
    }
  }
  
  // Sort by priority and relevance
  validMatches.sort((a, b) => {
    // Check section priority
    const aPriority = config.prioritizeSections?.indexOf(a.section) ?? -1;
    const bPriority = config.prioritizeSections?.indexOf(b.section) ?? -1;
    
    if (aPriority >= 0 && bPriority >= 0) {
      if (aPriority !== bPriority) return aPriority - bPriority;
    } else if (aPriority >= 0) {
      return -1;
    } else if (bPriority >= 0) {
      return 1;
    }
    
    // Fall back to relevance score
    return b.relevanceScore - a.relevanceScore;
  });
  
  return validMatches[0] || null;
}

/**
 * Get related content suggestions based on current page
 */
export function getRelatedContent(
  currentPath: string,
  limit: number = 5
): ContentNode[] {
  const currentContent = CONTENT_REGISTRY.find(c => c.path === currentPath);
  if (!currentContent) return [];
  
  const related: ContentNode[] = [];
  const addedIds = new Set<string>();
  
  // Add explicitly related content
  currentContent.related.forEach(id => {
    const content = CONTENT_REGISTRY.find(c => c.id === id);
    if (content && content.status === 'active' && !addedIds.has(id)) {
      related.push(content);
      addedIds.add(id);
    }
  });
  
  // Add content with similar tags
  if (related.length < limit) {
    const similarContent = CONTENT_REGISTRY.filter(c => 
      c.id !== currentContent.id &&
      c.status === 'active' &&
      !addedIds.has(c.id) &&
      c.tags.some(tag => currentContent.tags.includes(tag))
    );
    
    // Sort by number of matching tags
    similarContent.sort((a, b) => {
      const aMatches = a.tags.filter(tag => currentContent.tags.includes(tag)).length;
      const bMatches = b.tags.filter(tag => currentContent.tags.includes(tag)).length;
      return bMatches - aMatches;
    });
    
    similarContent.slice(0, limit - related.length).forEach(content => {
      related.push(content);
      addedIds.add(content.id);
    });
  }
  
  return related.slice(0, limit);
}

/**
 * Build a glossary of all available keywords
 */
export function buildGlossary(): Map<string, LinkableKeyword[]> {
  const glossary = new Map<string, LinkableKeyword[]>();
  const index = buildKeywordIndex();
  
  index.forEach((matches, keyword) => {
    const links = matches
      .filter(m => m.relevanceScore >= 0.5)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 3) // Top 3 matches per keyword
      .map(m => ({
        text: keyword,
        href: m.path,
        title: m.title,
        relevance: m.relevanceScore,
        section: m.section,
      }));
    
    if (links.length > 0) {
      glossary.set(keyword, links);
    }
  });
  
  return glossary;
}