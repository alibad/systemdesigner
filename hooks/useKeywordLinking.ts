'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { 
  findLinkableKeywords, 
  getRelatedContent, 
  buildGlossary,
  KeywordConfig,
  LinkableKeyword 
} from '@/lib/keyword-linking';
import { ContentNode } from '@/lib/content-registry';

/**
 * Hook for keyword linking functionality
 */
export function useKeywordLinking(config?: KeywordConfig) {
  const pathname = usePathname();
  
  return useMemo(() => ({
    /**
     * Find keywords in text content
     */
    findKeywords: (text: string) => 
      findLinkableKeywords(text, pathname, config),
    
    /**
     * Get related content for current page
     */
    getRelated: (limit?: number) => 
      getRelatedContent(pathname, limit),
    
    /**
     * Get current page path
     */
    getCurrentPath: () => pathname,
  }), [pathname, config]);
}

/**
 * Hook for content suggestions and recommendations
 */
export function useContentSuggestions(currentPath?: string) {
  const pathname = usePathname();
  const path = currentPath || pathname;
  
  return useMemo(() => {
    const related = getRelatedContent(path, 8);
    
    return {
      related,
      byLevel: groupByLevel(related),
      bySection: groupBySection(related),
    };
  }, [path]);
}

/**
 * Group content by difficulty level
 */
function groupByLevel(content: ContentNode[]): Record<string, ContentNode[]> {
  return content.reduce((acc, item) => {
    const level = item.level;
    if (!acc[level]) acc[level] = [];
    acc[level].push(item);
    return acc;
  }, {} as Record<string, ContentNode[]>);
}

/**
 * Group content by section
 */
function groupBySection(content: ContentNode[]): Record<string, ContentNode[]> {
  return content.reduce((acc, item) => {
    const section = item.section;
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {} as Record<string, ContentNode[]>);
}

/**
 * Hook for keyword glossary functionality
 */
export function useKeywordGlossary(section?: string) {
  return useMemo(() => {
    const glossary = buildGlossary();
    
    if (section) {
      const filtered = new Map<string, LinkableKeyword[]>();
      glossary.forEach((links, keyword) => {
        const sectionLinks = links.filter(link => link.section === section);
        if (sectionLinks.length > 0) {
          filtered.set(keyword, sectionLinks);
        }
      });
      return filtered;
    }
    
    return glossary;
  }, [section]);
}

/**
 * Hook for smart content analysis
 */
export function useContentAnalysis(text: string) {
  const pathname = usePathname();
  
  return useMemo(() => {
    const keywords = findLinkableKeywords(text, pathname, {
      maxLinksPerPage: 20,
      minRelevanceScore: 0.3
    });
    
    const stats = {
      totalWords: text.split(/\s+/).length,
      totalKeywords: keywords.length,
      linkDensity: keywords.length / Math.max(text.split(/\s+/).length, 1),
      sections: [...new Set(keywords.map(k => k.section))],
      avgRelevance: keywords.reduce((sum, k) => sum + k.relevance, 0) / keywords.length || 0
    };
    
    const suggestions = {
      // Suggest adding more links if density is low
      needsMoreLinks: stats.linkDensity < 0.02 && stats.totalWords > 100,
      // Suggest reducing links if density is too high  
      tooManyLinks: stats.linkDensity > 0.1,
      // Suggest diversifying sections
      needsDiversity: stats.sections.length < 2 && keywords.length > 3,
    };
    
    return {
      keywords,
      stats,
      suggestions,
      topKeywords: keywords.slice(0, 5),
      lowRelevanceKeywords: keywords.filter(k => k.relevance < 0.5),
    };
  }, [text, pathname]);
}

/**
 * Hook for content navigation enhancements
 */
export function useContentNavigation(currentPath?: string) {
  const pathname = usePathname();
  const path = currentPath || pathname;
  
  return useMemo(() => {
    const related = getRelatedContent(path, 6);
    
    // Create navigation suggestions
    const navigation = {
      next: related.find(r => r.level === 'beginner') || related[0],
      related: related.slice(1, 4),
      advanced: related.filter(r => r.level === 'advanced').slice(0, 2),
      sameSection: related.filter(r => r.path.startsWith(path.split('/').slice(0, 2).join('/'))),
    };
    
    return navigation;
  }, [path]);
}

/**
 * Hook for real-time keyword suggestions while typing
 */
export function useKeywordSuggestions(text: string, limit: number = 5) {
  const pathname = usePathname();
  
  return useMemo(() => {
    if (text.length < 10) return [];
    
    const keywords = findLinkableKeywords(text, pathname, {
      maxLinksPerPage: limit * 2,
      minRelevanceScore: 0.4
    });
    
    // Return the best suggestions
    return keywords
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }, [text, pathname, limit]);
}

/**
 * Hook for content enhancement recommendations
 */
export function useContentEnhancement(content: string) {
  const analysis = useContentAnalysis(content);
  const pathname = usePathname();
  
  return useMemo(() => {
    const enhancements = [];
    
    if (analysis.suggestions.needsMoreLinks) {
      enhancements.push({
        type: 'add-keywords',
        message: 'Consider adding more internal links to improve content connectivity',
        action: 'Add 2-3 relevant keyword links',
        priority: 'medium'
      });
    }
    
    if (analysis.suggestions.tooManyLinks) {
      enhancements.push({
        type: 'reduce-keywords',
        message: 'Too many links may distract readers',
        action: 'Reduce to the most relevant 5-7 links',
        priority: 'high'
      });
    }
    
    if (analysis.suggestions.needsDiversity) {
      enhancements.push({
        type: 'diversify-sections',
        message: 'Link to content from multiple sections for broader context',
        action: 'Add links to fundamentals and related sections',
        priority: 'low'
      });
    }
    
    // Check for low relevance keywords
    if (analysis.lowRelevanceKeywords.length > 2) {
      enhancements.push({
        type: 'improve-relevance',
        message: 'Some keyword links have low relevance scores',
        action: 'Review and improve keyword-content matching',
        priority: 'medium'
      });
    }
    
    return {
      enhancements,
      score: Math.max(0, 100 - (enhancements.length * 15)),
      recommendations: analysis.topKeywords,
    };
  }, [analysis, pathname]);
}