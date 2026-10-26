'use client';

import Link from 'next/link';
import { useState } from 'react';
import { getContentBySection } from '@/lib/content-registry';
import { useProgressTracking } from '@/hooks/useProgressTracking';
import { PRACTICE_CATEGORY_ORDER } from '@/lib/nav-generators';

export default function PracticePage() {
  const { isCompleted: isPracticeCompleted } = useProgressTracking('practice');
  const practiceContent = getContentBySection('practice');
  
  // Filter state
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([]);
  
  // Filter out the problems page itself and map to problem format
  const problems = practiceContent
    .filter(item => item.id !== 'practice-problems')
    .map(item => {
      // Use category directly from content registry
      const getCategory = () => {
        return item.category || 'System Design Practice';
      };

      // Map difficulty levels from registry
      const getDifficulty = () => {
        if (item.level === 'beginner') return 'Easy';
        if (item.level === 'intermediate') return 'Medium';
        if (item.level === 'advanced') return 'Hard';
        return 'Medium'; // Default fallback
      };
      
      // Extract companies from keywords with fallbacks
      const getCompanies = () => {
        const title = item.title.toLowerCase();
        if (title.includes('recommendation')) return ['Netflix', 'Amazon', 'Spotify'];
        if (title.includes('fraud')) return ['PayPal', 'Stripe', 'Amazon'];
        if (title.includes('ad')) return ['Google', 'Meta', 'Amazon'];
        if (title.includes('search')) return ['Google', 'Microsoft', 'Amazon'];
        if (title.includes('vision')) return ['Meta', 'Google', 'Tesla'];
        if (title.includes('feature')) return ['Uber', 'Airbnb', 'LinkedIn'];
        if (title.includes('rag')) return ['OpenAI', 'Anthropic', 'Perplexity'];
        if (title.includes('code')) return ['GitHub', 'Google', 'JetBrains'];
        if (title.includes('conversation')) return ['OpenAI', 'Anthropic', 'Microsoft'];
        if (title.includes('moderation')) return ['Meta', 'YouTube', 'TikTok'];
        if (title.includes('url')) return ['Google', 'Amazon', 'Microsoft'];
        if (title.includes('chat')) return ['Meta', 'Uber', 'LinkedIn'];
        if (title.includes('video')) return ['Google', 'Netflix', 'Amazon'];
        if (title.includes('ride')) return ['Uber', 'Lyft', 'DoorDash'];
        if (title.includes('payment')) return ['PayPal', 'Stripe', 'Square'];
        if (title.includes('notification')) return ['Amazon', 'Twilio', 'SendGrid'];
        if (title.includes('cache')) return ['Redis', 'Amazon', 'Google'];
        return ['Google', 'Amazon', 'Microsoft'];
      };
      
      // Extract key topics from content
      const getKeyTopics = () => {
        const title = item.title.toLowerCase();
        if (title.includes('recommendation')) return ['Collaborative filtering', 'Real-time inference', 'Cold start problem', 'Feature engineering'];
        if (title.includes('fraud')) return ['Stream processing', 'Model serving', 'Feature stores', 'Model monitoring'];
        if (title.includes('ad')) return ['CTR prediction', 'Real-time bidding', 'A/B testing', 'Model deployment'];
        if (title.includes('search')) return ['Learning to rank', 'Feature engineering', 'Online learning', 'Relevance scoring'];
        if (title.includes('vision')) return ['Image processing', 'Model serving', 'Batch inference', 'Data validation'];
        if (title.includes('feature')) return ['Feature computation', 'Offline/online store', 'Feature discovery', 'Data lineage'];
        if (title.includes('rag')) return ['Vector databases', 'Embedding models', 'Context ranking', 'LLM integration'];
        if (title.includes('code')) return ['Code completion', 'Context extraction', 'Model serving', 'Latency optimization'];
        if (title.includes('conversation')) return ['LLM orchestration', 'Multi-turn context', 'Function calling', 'Safety guardrails'];
        if (title.includes('moderation')) return ['Multi-modal AI', 'Safety classification', 'Human-in-the-loop', 'Policy enforcement'];
        if (title.includes('url')) return ['URL encoding', 'Database design', 'Caching', 'Rate limiting'];
        if (title.includes('chat')) return ['WebSockets', 'Message queues', 'Database sharding', 'Push notifications'];
        if (title.includes('video')) return ['Video encoding', 'CDN design', 'Global distribution', 'Metadata storage'];
        if (title.includes('ride')) return ['Geospatial indexing', 'Real-time matching', 'GPS tracking', 'Pricing algorithms'];
        if (title.includes('payment')) return ['Payment processing', 'Security', 'Fraud detection', 'Compliance'];
        if (title.includes('notification')) return ['Message queues', 'Rate limiting', 'Template management', 'Delivery tracking'];
        if (title.includes('cache')) return ['Consistent hashing', 'Replication', 'Cache eviction', 'Fault tolerance'];
        return item.tags.slice(0, 4);
      };

      const slug = item.path.split('/').pop() || '';
      
      return {
        title: item.title,
        difficulty: getDifficulty(),
        category: getCategory(),
        description: item.seo.metaDescription,
        keyTopics: getKeyTopics(),
        estimatedTime: item.duration,
        companies: getCompanies(),
        slug: slug,
        completed: isPracticeCompleted(slug)
      };
    });

  const difficultyColors = {
    'Easy': 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
    'Medium': 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
    'Hard': 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
  };

  // Use predefined category order like other sections
  const allCategories = [...new Set(problems.map(p => p.category))];

  // Order categories according to PRACTICE_CATEGORY_ORDER, then add any remaining
  const orderedCategories: string[] = [];

  // Add categories in the predefined order
  PRACTICE_CATEGORY_ORDER.forEach(category => {
    if (allCategories.includes(category)) {
      orderedCategories.push(category);
    }
  });

  // Add any remaining categories not in the predefined order
  allCategories.forEach(category => {
    if (!orderedCategories.includes(category)) {
      orderedCategories.push(category);
    }
  });

  const categories = orderedCategories;
  const difficulties = ['Easy', 'Medium', 'Hard'];

  // Filter problems based on selected filters
  const filteredProblems = problems.filter(problem => {
    const categoryMatch = selectedCategories.length === 0 || selectedCategories.includes(problem.category);
    const difficultyMatch = selectedDifficulties.length === 0 || selectedDifficulties.includes(problem.difficulty);
    return categoryMatch && difficultyMatch;
  });

  // Filter handlers
  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const toggleDifficulty = (difficulty: string) => {
    setSelectedDifficulties(prev => 
      prev.includes(difficulty)
        ? prev.filter(d => d !== difficulty) 
        : [...prev, difficulty]
    );
  };

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-6 py-6">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-neutral-900 dark:text-neutral-100 font-medium">🎯 Practice Hub</span>
        </div>
        
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
          System Design Practice Problems
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-6">
          Master system design interviews with enhanced practice problems that emphasize requirements 
          gathering, back-of-envelope calculations, and real-world trade-offs.
        </p>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{problems.length}</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">Practice Problems</div>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{categories.length}</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">Categories</div>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <div className="text-2xl font-bold text-violet-600 dark:text-violet-400">{problems.filter(p => p.category === 'ML Systems Practice' || p.category === 'GenAI Systems Practice').length}</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">AI/ML Problems</div>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{problems.filter(p => p.completed).length}</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">Completed</div>
          </div>
        </div>
      </div>

      {/* Filter by Category */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-3">Filter by Category</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {categories.map(category => {
            const count = problems.filter(p => p.category === category).length;
            const isSelected = selectedCategories.includes(category);
            const baseColors = {
              'System Design Practice': 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
              'ML Systems Practice': 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
              'GenAI Systems Practice': 'bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800'
            };
            const selectedColors = {
              'System Design Practice': 'bg-blue-600 dark:bg-blue-500 text-white border-blue-600 dark:border-blue-500',
              'ML Systems Practice': 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500',
              'GenAI Systems Practice': 'bg-violet-600 dark:bg-violet-500 text-white border-violet-600 dark:border-violet-500'
            };
            
            const colorClass = isSelected 
              ? selectedColors[category as keyof typeof selectedColors] 
              : baseColors[category as keyof typeof baseColors] || 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700';
            
            return (
              <button
                key={`category-filter-${category}`}
                onClick={() => toggleCategory(category)}
                className={`px-3 py-1 rounded-lg text-sm font-medium border transition-all hover:scale-105 cursor-pointer ${colorClass}`}
              >
                {category} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter by Difficulty */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-3">Filter by Difficulty</h3>
        <div className="flex gap-2">
          {difficulties.map(difficulty => {
            const count = problems.filter(p => p.difficulty === difficulty).length;
            const isSelected = selectedDifficulties.includes(difficulty);
            const baseColors = {
              'Easy': 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
              'Medium': 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
              'Hard': 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
            };
            const selectedColors = {
              'Easy': 'bg-emerald-600 dark:bg-emerald-500 text-white border-emerald-600 dark:border-emerald-500',
              'Medium': 'bg-amber-600 dark:bg-amber-500 text-white border-amber-600 dark:border-amber-500',
              'Hard': 'bg-red-600 dark:bg-red-500 text-white border-red-600 dark:border-red-500'
            };
            
            const colorClass = isSelected 
              ? selectedColors[difficulty as keyof typeof selectedColors]
              : baseColors[difficulty as keyof typeof baseColors];
            
            return (
              <button
                key={`difficulty-filter-${difficulty}`}
                onClick={() => toggleDifficulty(difficulty)}
                className={`px-3 py-1 rounded-lg text-sm font-medium border transition-all hover:scale-105 cursor-pointer ${colorClass}`}
              >
                {difficulty} ({count})
              </button>
            );
          })}
        </div>
        
        {/* Clear Filters */}
        {(selectedCategories.length > 0 || selectedDifficulties.length > 0) && (
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => {
                setSelectedCategories([]);
                setSelectedDifficulties([]);
              }}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
            >
              Clear all filters
            </button>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              Showing {filteredProblems.length} of {problems.length} problems
            </span>
          </div>
        )}
      </div>

      {/* Problems Grid */}
      <div className="grid gap-6">
        {filteredProblems.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-neutral-400 dark:text-neutral-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0118 12a7.962 7.962 0 01-2.127 5.291c-.894.894-2.066 1.427-3.373 1.427s-2.479-.533-3.373-1.427C8.239 16.403 8.239 16.403 8.127 15.291A7.962 7.962 0 016 12a7.962 7.962 0 012.127-5.291c.894-.894 2.066-1.427 3.373-1.427s2.479.533 3.373 1.427z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
              No problems match your filters
            </h3>
            <p className="text-neutral-500 dark:text-neutral-400 mb-4">
              Try adjusting your category or difficulty filters to find more problems.
            </p>
            <button
              onClick={() => {
                setSelectedCategories([]);
                setSelectedDifficulties([]);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          filteredProblems.map((problem) => (
          <Link
            key={`practice-page-${problem.slug}`}
            href={`/practice/${problem.slug}` as any}
            className="group block"
          >
            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card hover:shadow-lg transition-shadow p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {problem.completed && (
                      <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                        <svg className="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {problem.title}
                    </h2>
                    <span className={`text-xs px-2 py-1 rounded font-medium ${difficultyColors[problem.difficulty as keyof typeof difficultyColors]}`}>
                      {problem.difficulty}
                    </span>
                    <span className="text-xs px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded font-medium">
                      {problem.category}
                    </span>
                  </div>
                  <p className="text-neutral-600 dark:text-neutral-400 mb-4">
                    {problem.description}
                  </p>
                </div>
                <div className="text-neutral-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors ml-4">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
              
              <div className="mb-4">
                <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Key Topics:</div>
                <div className="flex flex-wrap gap-2">
                  {problem.keyTopics.map(topic => (
                    <span
                      key={`${problem.slug}-topic-${topic}`}
                      className="text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
                  <span>⏱ {problem.estimatedTime}</span>
                  <span>🏢 {problem.companies.join(', ')}</span>
                </div>
                <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                  {problem.completed ? 'Review →' : 'Start practicing →'}
                </div>
              </div>
            </div>
          </Link>
          ))
        )}
      </div>

      {/* Study Guide */}
      <div className="mt-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-6">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
          Enhanced Interview Approach
        </h3>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">
          Our practice problems follow a systematic 5-step interview approach that mirrors real technical interviews:
        </p>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <strong className="text-neutral-900 dark:text-neutral-100">1. Clarifying Questions:</strong>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              Realistic interviewer-candidate dialogue to gather requirements and constraints.
            </p>
          </div>
          <div>
            <strong className="text-neutral-900 dark:text-neutral-100">2. Back-of-Envelope:</strong>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              Explicit calculations for scale, storage, bandwidth, and infrastructure sizing.
            </p>
          </div>
          <div>
            <strong className="text-neutral-900 dark:text-neutral-100">3. System Design:</strong>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              High-level architecture, API design, data modeling, and component interactions.
            </p>
          </div>
          <div>
            <strong className="text-neutral-900 dark:text-neutral-100">4. Deep Dive:</strong>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              Critical component analysis, scaling strategies, and failure handling.
            </p>
          </div>
          <div>
            <strong className="text-neutral-900 dark:text-neutral-100">5. Trade-offs:</strong>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              Explicit discussion of design decisions, alternatives, and their implications.
            </p>
          </div>
          <div>
            <strong className="text-neutral-900 dark:text-neutral-100">ML/GenAI Focus:</strong>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              Additional sections for model selection, feature engineering, and AI-specific concerns.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}