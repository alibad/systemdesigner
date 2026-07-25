'use client';

import Link from 'next/link';
import { getContentBySection } from '@/lib/content-registry';
import { getCategoryDisplayName, TECHNOLOGY_CATEGORY_ORDER } from '@/lib/nav-generators';
import { useProgressTracking } from '@/hooks/useProgressTracking';

interface Technology {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  useCase: string;
  features: string[];
  href: string;
  hasSimulator: boolean;
  status: 'active' | 'draft' | 'deprecated';
}

// Get all technology content from registry
const technologyContent = getContentBySection('technology');

// Icon mapping for categories
const categoryIcons: { [key: string]: string } = {
  'big-data': '🗂️',
  'aws-services': '☁️', 
  'data-orchestration': '🔄',
  'data-platforms': '🏢',
  'observability': '👁️',
  'cloud-native': '🌐',
  'cache-storage': '💾',
  'message-streaming': '📡',
  'search-analytics': '🔍',
  'bigdata': '📊',
  'database': '🗄️',
  'infrastructure': '🏗️',
  'monitoring': '📈',
  'web-networking': '🌐',
  'default': '⚙️'
};

// Friendly display names for categories (does not affect grouping)
const categoryLabels: { [key: string]: string } = {
  'big-data': 'Hadoop & Big Data',
  'aws-services': 'AWS Services',
  'data-orchestration': 'Data Orchestration',
  'data-platforms': 'Data Platforms',
  'observability': 'Observability & Monitoring',
  'cloud-native': 'Cloud-Native',
  'cache-storage': 'Cache & Storage',
  'message-streaming': 'Messaging & Streaming',
  'search-analytics': 'Search & Analytics',
  'bigdata': 'Big Data',
  'database': 'Databases',
  'database patterns': 'Database Patterns',
  'database patterns ': 'Database Patterns',
  'database patterns  ': 'Database Patterns',
  'database patterns   ': 'Database Patterns',
  'database patterns    ': 'Database Patterns',
  'database patterns     ': 'Database Patterns',
  'database patterns      ': 'Database Patterns',
  'database patterns       ': 'Database Patterns',
  'database patterns        ': 'Database Patterns',
  'database patterns         ': 'Database Patterns',
  'database patterns          ': 'Database Patterns',
  'database patterns           ': 'Database Patterns',
  'infrastructure': 'Infrastructure',
  'monitoring': 'Monitoring',
  'web-networking': 'Networking & Web',
  'orchestration': 'Orchestration',
  'api': 'API',
  'api & communication': 'API & Communication',
  'service mesh': 'Service Mesh',
  'cloud platforms': 'Cloud Platforms',
  'devops & ci/cd': 'DevOps & CI/CD',
  'security & auth': 'Security & Auth',
  'security & secrets': 'Security & Secrets',
  'data processing': 'Data Processing',
  'systems concepts': 'Systems Concepts',
  'resilience patterns': 'Resilience Patterns',
  'service discovery': 'Service Discovery',
  'distributed coordination': 'Distributed Coordination',
  'workflow orchestration': 'Workflow Orchestration',
  'default': 'Other'
};

export default function TechnologyPage() {
  const { progress, loading, isCompleted, getCompletionPercentage, getCompletedCount } = useProgressTracking('technology');

  // Convert registry content to Technology format
  const technologies: Technology[] = technologyContent.map(content => ({
    id: content.id,
    name: content.title,
    description: content.seo.metaDescription,
    icon: categoryIcons[content.category || 'default'] || categoryIcons['default'],
    category: content.category || 'Technology',
    difficulty: content.level === 'beginner' ? 'Beginner' : 
                content.level === 'intermediate' ? 'Intermediate' : 'Advanced',
    useCase: `${content.duration} • ${content.hasQuiz ? 'Quiz' : ''}${content.hasScenarios ? ' • Scenarios' : ''}${content.hasCalculator ? ' • Calculator' : ''}`,
    features: content.tags.slice(0, 5),
    href: content.path,
    hasSimulator: content.hasCalculator || content.hasScenarios,
    status: content.status
  }));

  // Group by category and separate active vs draft
  const activeTechnologies = technologies.filter(tech => tech.status === 'active');
  const draftTechnologies = technologies.filter(tech => tech.status === 'draft');

  const groupedActive = activeTechnologies.reduce((acc, tech) => {
    const category = tech.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(tech);
    return acc;
  }, {} as { [key: string]: Technology[] });

  const groupedDraft = draftTechnologies.reduce((acc, tech) => {
    const category = tech.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(tech);
    return acc;
  }, {} as { [key: string]: Technology[] });

  const allTechnologies = [...activeTechnologies, ...draftTechnologies];

  // Use the same category order as navigation
  const allCategories = [...new Set(allTechnologies.map(tech => tech.category))];

  // Order categories according to TECHNOLOGY_CATEGORY_ORDER, then add any remaining
  const orderedCategories: string[] = [];

  // Add categories in the predefined order
  TECHNOLOGY_CATEGORY_ORDER.forEach(category => {
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
  const totalTechnologies = allTechnologies.length;
  const withSimulators = allTechnologies.filter(tech => tech.hasSimulator).length;
  const activeCount = activeTechnologies.length;
  const draftCount = draftTechnologies.length;

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return 'text-green-600 dark:text-green-400';
      case 'Intermediate': return 'text-yellow-600 dark:text-yellow-400';
      case 'Advanced': return 'text-red-600 dark:text-red-400';
      default: return 'text-neutral-600 dark:text-neutral-400';
    }
  };

  const completedCount = getCompletedCount();
  const totalLessons = activeTechnologies.length;
  const progressPercentage = getCompletionPercentage(totalLessons);

  return (
    <main className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
          Technology Deep Dives
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-6">
          Interactive guides and simulators for core technologies used in modern system design.
          Learn how they work, when to use them, and practice with hands-on simulators.
        </p>

        {/* Progress Bar */}
        {!loading && completedCount > 0 && (
          <div className="mb-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Your Progress</h2>
              <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{progressPercentage}% Complete</span>
            </div>
            <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              {completedCount} of {totalLessons} technologies completed
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{totalTechnologies}</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">Technologies Covered</div>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{withSimulators}</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">Interactive Simulators</div>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{categories.length}</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">Categories</div>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">100%</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">Production-Ready</div>
          </div>
        </div>

        {/* New Content Summary */}
        {draftCount > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-6 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">🚀</span>
              <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                New Technologies Added
              </h2>
            </div>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">
              We've expanded our coverage with <strong>{draftCount} new technologies</strong> including 
              Big Data & Hadoop ecosystem, AWS advanced services, modern data platforms, and observability tools.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-white/50 dark:bg-neutral-800/50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {Object.keys(groupedDraft).filter(cat => ['big-data'].includes(cat)).reduce((sum, cat) => sum + groupedDraft[cat].length, 0)}
                </div>
                <div className="text-xs text-neutral-600 dark:text-neutral-400">Hadoop Ecosystem</div>
              </div>
              <div className="bg-white/50 dark:bg-neutral-800/50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                  {Object.keys(groupedDraft).filter(cat => ['aws-services'].includes(cat)).reduce((sum, cat) => sum + groupedDraft[cat].length, 0)}
                </div>
                <div className="text-xs text-neutral-600 dark:text-neutral-400">AWS Services</div>
              </div>
              <div className="bg-white/50 dark:bg-neutral-800/50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                  {Object.keys(groupedDraft).filter(cat => ['data-platforms', 'data-orchestration'].includes(cat)).reduce((sum, cat) => sum + groupedDraft[cat].length, 0)}
                </div>
                <div className="text-xs text-neutral-600 dark:text-neutral-400">Data Platforms</div>
              </div>
              <div className="bg-white/50 dark:bg-neutral-800/50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                  {Object.keys(groupedDraft).filter(cat => ['observability', 'cloud-native'].includes(cat)).reduce((sum, cat) => sum + groupedDraft[cat].length, 0)}
                </div>
                <div className="text-xs text-neutral-600 dark:text-neutral-400">Observability</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Featured Technology */}
      <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-xl border border-red-200 dark:border-red-800 p-8 mb-8">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">🔴</span>
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                Featured: Redis Deep Dive
              </h2>
              <span className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
                Interactive
              </span>
            </div>
            <p className="text-neutral-700 dark:text-neutral-300 mb-4 max-w-2xl">
              Master Redis with our comprehensive guide covering data structures, operations, clustering, 
              and real-world use cases. Includes an interactive simulator for hands-on learning.
            </p>
            <div className="flex flex-wrap gap-2 mb-6">
              {['Data Structures', 'Pub/Sub', 'Clustering', 'Performance Tuning', 'Use Cases'].map(feature => (
                <span key={feature} className="px-3 py-1 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-full text-sm">
                  {feature}
                </span>
              ))}
            </div>
            <Link 
              href="/technology/redis"
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Explore Redis
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      {/* Technologies by Category */}
      {categories.map(category => (
        <div key={category} className="mb-8">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
            <div className="w-1 h-6 bg-indigo-500 rounded-full"></div>
            {getCategoryDisplayName(category)}
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allTechnologies.filter(tech => tech.category === category).map(tech => {
              const completed = isCompleted(tech.id);
              return (
                <Link
                  key={tech.id}
                  href={tech.href as any}
                  className={`group bg-white dark:bg-neutral-900 rounded-xl border p-6 hover:shadow-lg transition-all duration-200 ${
                    completed
                      ? 'border-green-300 dark:border-green-700 bg-green-50/30 dark:bg-green-900/10'
                      : 'border-neutral-200 dark:border-neutral-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-lg flex items-center justify-center text-2xl group-hover:scale-110 transition-transform relative">
                        {tech.icon}
                        {completed && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {tech.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${getDifficultyColor(tech.difficulty)}`}>
                          {tech.difficulty}
                        </span>
                        {tech.hasSimulator && (
                          <span className="text-xs bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded">
                            Simulator
                          </span>
                        )}
                        {tech.status === 'draft' && (
                          <span className="text-xs bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 px-2 py-1 rounded">
                            Coming Soon
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-neutral-400 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
                
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                  {tech.description}
                </p>
                
                <div className="mb-4">
                  <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">Use Cases</div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">{tech.useCase}</p>
                </div>
                
                <div className="space-y-2">
                  <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300 uppercase tracking-wide">
                    Key Features
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {tech.features.slice(0, 3).map(feature => (
                      <span 
                        key={feature}
                        className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded text-xs"
                      >
                        {feature}
                      </span>
                    ))}
                    {tech.features.length > 3 && (
                      <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded text-xs">
                        +{tech.features.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              </Link>
              );
            })}
          </div>
        </div>
      ))}

      {/* Learning Path */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-8">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
          🎯 Recommended Learning Path
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">
          Master these technologies in the optimal order for system design proficiency.
        </p>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl text-green-600 dark:text-green-400 font-bold">1</span>
            </div>
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Foundation</h3>
            <div className="space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
              <div>Docker (Beginner)</div>
              <div>MongoDB (Beginner)</div>
              <div>Redis (Intermediate)</div>
            </div>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl text-yellow-600 dark:text-yellow-400 font-bold">2</span>
            </div>
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Intermediate</h3>
            <div className="space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
              <div>PostgreSQL (Intermediate)</div>
              <div>NGINX (Intermediate)</div>
            </div>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl text-red-600 dark:text-red-400 font-bold">3</span>
            </div>
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Advanced</h3>
            <div className="space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
              <div>Kafka (Advanced)</div>
              <div>Elasticsearch (Advanced)</div>
              <div>Kubernetes (Advanced)</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}