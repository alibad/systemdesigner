'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CONTENT_REGISTRY, ContentNode } from '@/lib/content-registry';

interface SearchResult extends ContentNode {
  matchScore: number;
  matchedFields: string[];
}

interface GlobalSearchProps {
  variant?: 'default' | 'compact' | 'sidebar';
}

export default function GlobalSearch({ variant = 'default' }: GlobalSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isAtTop, setIsAtTop] = useState(true);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track scroll position to show/hide search
  useEffect(() => {
    const handleScroll = () => {
      setIsAtTop(window.scrollY < 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Search functionality
  const searchContent = (searchQuery: string): SearchResult[] => {
    if (!searchQuery.trim()) return [];
    
    const normalizedQuery = searchQuery.toLowerCase().trim();
    const words = normalizedQuery.split(/\s+/);
    
    const searchResults = CONTENT_REGISTRY
      .filter(item => item.status === 'active')
      .map(item => {
        let score = 0;
        const matchedFields: string[] = [];
        
        // Title match (highest priority)
        const titleMatch = item.title.toLowerCase().includes(normalizedQuery);
        if (titleMatch) {
          score += 100;
          matchedFields.push('title');
        }
        
        // Exact word matches in title
        words.forEach(word => {
          if (item.title.toLowerCase().includes(word)) {
            score += 50;
          }
        });
        
        // Tags match (high priority)
        const tagMatches = item.tags.filter(tag => 
          tag.toLowerCase().includes(normalizedQuery) ||
          words.some(word => tag.toLowerCase().includes(word))
        );
        if (tagMatches.length > 0) {
          score += tagMatches.length * 30;
          matchedFields.push('tags');
        }
        
        // Section match
        if (item.section.includes(normalizedQuery) || 
            words.some(word => item.section.includes(word))) {
          score += 20;
          matchedFields.push('section');
        }
        
        // Category match
        if (item.category?.toLowerCase().includes(normalizedQuery) ||
            words.some(word => item.category?.toLowerCase().includes(word))) {
          score += 15;
          matchedFields.push('category');
        }
        
        // SEO keywords match
        const keywordMatches = item.seo.keywords.filter(keyword =>
          keyword.toLowerCase().includes(normalizedQuery) ||
          words.some(word => keyword.toLowerCase().includes(word))
        );
        if (keywordMatches.length > 0) {
          score += keywordMatches.length * 10;
          matchedFields.push('keywords');
        }
        
        return score > 0 ? {
          ...item,
          matchScore: score,
          matchedFields
        } : null;
      })
      .filter((item): item is SearchResult => item !== null)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 8); // Limit to 8 results
    
    return searchResults;
  };

  // Update search results when query changes
  useEffect(() => {
    const searchResults = searchContent(query);
    setResults(searchResults);
    setSelectedIndex(0);
  }, [query]);

  const handleResultClick = useCallback((result: SearchResult) => {
    router.push(result.path as any);
    setIsOpen(false);
    setQuery('');
  }, [router]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to open search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      
      // Escape to close
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
      }
      
      if (!isOpen || results.length === 0) return;
      
      // Arrow navigation
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          handleResultClick(results[selectedIndex]);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleResultClick, isOpen, results, selectedIndex]);

  const getSectionColor = (section: string) => {
    const colors = {
      'fundamentals': 'text-blue-600 dark:text-blue-400',
      'genai': 'text-purple-600 dark:text-purple-400',
      'ml-systems': 'text-green-600 dark:text-green-400',
      'technology': 'text-orange-600 dark:text-orange-400',
      'case-studies': 'text-pink-600 dark:text-pink-400',
      'practice': 'text-indigo-600 dark:text-indigo-400',
      'reference': 'text-teal-600 dark:text-teal-400',
      'tools': 'text-red-600 dark:text-red-400',
    };
    return colors[section as keyof typeof colors] || 'text-neutral-600 dark:text-neutral-400';
  };

  return (
    <>
      {/* Search Trigger Button - hide when scrolled down */}
      <button
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 100);
        }}
        className={`flex items-center gap-3 rounded-xl border text-sm transition-all duration-300 ${
          isAtTop ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        } ${
          variant === 'compact' 
            ? 'px-3 py-2 border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:border-indigo-300 dark:hover:border-indigo-600'
            : variant === 'sidebar'
            ? 'w-full px-4 py-2.5 border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm'
            : 'px-4 py-2.5 border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md min-w-[200px] lg:min-w-[280px]'
        }`}
      >
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className={`text-left flex-1 ${variant === 'compact' ? 'hidden' : ''}`}>
          {variant === 'sidebar' ? 'Search lessons...' : 'Search 400+ lessons...'}
        </span>
        {variant !== 'compact' && (
          <kbd className="hidden sm:inline-block px-2 py-1 text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 rounded border border-neutral-300 dark:border-neutral-600 font-mono">⌘K</kbd>
        )}
      </button>

      {/* Search Modal */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Search Panel */}
          <div className="fixed top-20 sm:top-24 left-1/2 -translate-x-1/2 w-full max-w-2xl mx-4 sm:mx-8 z-50">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden max-h-[80vh] flex flex-col" ref={containerRef}>
              {/* Search Input */}
              <div className="flex items-center gap-3 p-4 sm:p-6 border-b border-neutral-200 dark:border-neutral-800">
                <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search lessons, technologies, case studies..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 bg-transparent text-lg sm:text-xl placeholder-neutral-500 focus:outline-none text-neutral-900 dark:text-neutral-100 pl-2"
                />
                <kbd className="hidden sm:inline-block px-2 py-1 text-xs bg-neutral-200 dark:bg-neutral-700 rounded border">ESC</kbd>
              </div>

              {/* Search Results */}
              {query && (
                <div className="flex-1 overflow-y-auto">
                  {results.length > 0 ? (
                    <div className="p-3 sm:p-4">
                      {results.map((result, index) => (
                        <button
                          key={result.id}
                          onClick={() => handleResultClick(result)}
                          className={`w-full text-left p-4 sm:p-5 rounded-xl mb-2 transition-colors ${
                            index === selectedIndex 
                              ? 'bg-neutral-100 dark:bg-neutral-800' 
                              : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                                {result.title}
                              </h3>
                              <div className="flex items-center gap-2 mt-2">
                                <span className={`text-sm font-medium capitalize ${getSectionColor(result.section)}`}>
                                  {result.section.replace('-', ' ')}
                                </span>
                                {result.level && (
                                  <>
                                    <span className="text-neutral-400">•</span>
                                    <span className="text-sm text-neutral-500 capitalize">{result.level}</span>
                                  </>
                                )}
                                {result.duration && (
                                  <>
                                    <span className="text-neutral-400">•</span>
                                    <span className="text-sm text-neutral-500">{result.duration}</span>
                                  </>
                                )}
                              </div>
                              <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 mt-2 line-clamp-2">
                                {result.seo.metaDescription}
                              </p>
                            </div>
                            {result.hasQuiz && (
                              <div className="flex-shrink-0">
                                <span className="inline-flex items-center px-3 py-2 rounded-lg text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                                  📝 Quiz
                                </span>
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 sm:p-12 text-center text-neutral-500 dark:text-neutral-400">
                      <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <p className="text-lg font-medium mb-2">No results found for "{query}"</p>
                      <p className="text-sm">Try searching for topics like "kafka", "machine learning", or "microservices"</p>
                    </div>
                  )}
                </div>
              )}

              {/* Help Text */}
              {!query && (
                <div className="p-8 sm:p-12 text-center text-neutral-500 dark:text-neutral-400 flex-1 flex flex-col justify-center">
                  <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p className="text-lg font-medium mb-2">Search across 400+ lessons</p>
                  <p className="text-sm">Find topics, technologies, case studies, and more</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
