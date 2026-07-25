import Link from 'next/link';
import { CONTENT_REGISTRY } from '@/lib/content-registry';

interface ToolCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  tools: Array<{
    id: string;
    title: string;
    path: string;
    description?: string;
    level: string;
    duration: string;
    tags: string[];
  }>;
}

export default function ToolsPage() {
  // Get all tools from content registry
  const allTools = CONTENT_REGISTRY.filter(item => item.section === 'tools');

  // Categorize tools based on their functionality
  const categories: ToolCategory[] = [
    {
      id: 'planning',
      name: 'Planning & Analysis',
      description: 'Tools for capacity planning, cost estimation, and system analysis',
      icon: '📊',
      tools: allTools.filter(tool => 
        tool.path.includes('capacity') || 
        tool.path.includes('cost') || 
        tool.path.includes('scalability') ||
        tool.path.includes('reliability')
      )
    },
    {
      id: 'architecture',
      name: 'Architecture & Design',
      description: 'Tools for designing and visualizing system architectures',
      icon: '🏗️',
      tools: allTools.filter(tool => 
        tool.path.includes('architecture') || 
        tool.path.includes('microservices') || 
        tool.path.includes('api-design')
      )
    },
    {
      id: 'performance',
      name: 'Performance & Optimization',
      description: 'Tools for performance analysis, caching, and optimization',
      icon: '⚡',
      tools: allTools.filter(tool => 
        tool.path.includes('cache') || 
        tool.path.includes('load-balancer') || 
        tool.path.includes('latency') ||
        tool.path.includes('bandwidth')
      )
    },
    {
      id: 'data',
      name: 'Data & Storage',
      description: 'Tools for database design, sharding, and data management',
      icon: '🗄️',
      tools: allTools.filter(tool => 
        tool.path.includes('database') || 
        tool.path.includes('sharding') || 
        tool.path.includes('consistency')
      )
    },
    {
      id: 'reliability',
      name: 'Reliability & Resilience',
      description: 'Tools for building resilient and fault-tolerant systems',
      icon: '🛡️',
      tools: allTools.filter(tool => 
        tool.path.includes('circuit-breaker') || 
        tool.path.includes('rate-limit') ||
        tool.path.includes('message-queue')
      )
    },
    {
      id: 'other',
      name: 'Other Tools',
      description: 'Additional specialized tools and utilities',
      icon: '🔧',
      tools: allTools.filter(tool => {
        // Tools that don't fit in other categories
        const otherCategories = ['capacity', 'cost', 'scalability', 'reliability', 'architecture', 'microservices', 'api-design', 'cache', 'load-balancer', 'latency', 'bandwidth', 'database', 'sharding', 'consistency', 'circuit-breaker', 'rate-limit', 'message-queue'];
        return !otherCategories.some(cat => tool.path.includes(cat));
      })
    }
  ].filter(category => category.tools.length > 0); // Only show categories with tools

  const totalTools = allTools.length;

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'beginner': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'advanced': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <main className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
          🔧 System Design Studio
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-3xl mb-6">
          Your complete design toolkit: interactive tools, collaborative whiteboard, and guided workshops. 
          Design, simulate, and validate your architectures with professional-grade tools.
        </p>

        {/* Design Activity Options */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="group cursor-default">
            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-8 h-full">
              <div className="flex flex-col items-center text-center">
                <div className="text-4xl mb-4">🛠️</div>
                <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
                  Interactive Tools
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4 flex-1">
                  Professional-grade tools for system design, capacity planning, and performance optimization.
                </p>
                <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-1">{totalTools}</div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">Interactive tools</div>
              </div>
            </div>
          </div>

          <Link href="/whiteboard" className="group">
            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card hover:shadow-lg transition-all p-8 h-full">
              <div className="flex flex-col items-center text-center">
                <div className="text-4xl mb-4">🎨</div>
                <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors mb-3">
                  Whiteboard
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4 flex-1">
                  Draw system architectures, collaborate in real-time, and share your designs with others.
                </p>
                <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">∞</div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">Unlimited canvases</div>
              </div>
            </div>
          </Link>

          <Link href="/workshop" className="group">
            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card hover:shadow-lg transition-all p-8 h-full">
              <div className="flex flex-col items-center text-center">
                <div className="text-4xl mb-4">🏗️</div>
                <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors mb-3">
                  Workshops
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4 flex-1">
                  Guided workshops for architecture decisions, performance optimization, and system analysis.
                </p>
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-1">5</div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">Interactive workshops</div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Interactive Tools Section */}
      <div className="mb-12">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            🛠️ Interactive Tools
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400">
            Professional-grade tools for system design, capacity planning, and performance optimization.
          </p>
        </div>

        {categories.map(category => (
          <div key={category.id} className="mb-8">
            <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 mb-4 flex items-center">
              <span className="text-2xl mr-3">{category.icon}</span>
              <div>
                <div>{category.name}</div>
                <div className="text-sm font-normal text-neutral-600 dark:text-neutral-400">
                  {category.description}
                </div>
              </div>
            </h3>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {category.tools.map((tool) => (
                <Link key={tool.id} href={tool.path as any} className="group">
                  <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card hover:shadow-lg transition-all p-6 h-full">
                    <div className="flex flex-col h-full">
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-2 flex-1 pr-2">
                          {tool.title}
                        </h4>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getLevelColor(tool.level)}`}>
                          {tool.level}
                        </span>
                      </div>
                      
                      {tool.description && (
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4 flex-1">
                          {tool.description}
                        </p>
                      )}
                      
                      <div className="mt-auto">
                        <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                          <span>{tool.duration}</span>
                          <div className="flex flex-wrap gap-1">
                            {tool.tags?.slice(0, 2).map((tag, index) => (
                              <span key={index} className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-full">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Access Grid */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-8 mb-8">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
          🚀 Popular Tools
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">
          Start with these essential tools for system design and capacity planning.
        </p>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: 'System Design Calculator', path: '/tools/system-design-calculator', icon: '🧮' },
            { title: 'Architecture Diagram Builder', path: '/tools/architecture-diagram-builder', icon: '🏗️' },
            { title: 'Database Selector', path: '/tools/database-selector', icon: '🗄️' },
            { title: 'Load Balancer Visualizer', path: '/tools/load-balancer-visualizer', icon: '⚖️' }
          ].map((tool) => (
            <Link key={tool.path} href={tool.path as any} className="group">
              <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700 hover:border-indigo-500 dark:hover:border-indigo-400 transition-all">
                <div className="text-2xl mb-2">{tool.icon}</div>
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors text-sm">
                  {tool.title}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}