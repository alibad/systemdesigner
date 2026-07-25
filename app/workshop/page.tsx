import Link from 'next/link';

export default function WorkshopPage() {
  const workshops = [
    {
      title: 'Architecture Decision Workshop',
      description: 'Interactive decision tree to guide architectural choices based on your requirements',
      type: 'Architecture',
      difficulty: 'Intermediate',
      duration: '20-30 min',
      slug: 'architecture-decisions',
      features: [
        'Requirements-driven recommendations',
        'Database and caching strategy',
        'Deployment and scaling advice',
        'Export to whiteboard'
      ],
      icon: '🏗️'
    },
    {
      title: 'System Design Workshop',
      description: 'Step-by-step guided design process for common system design patterns',
      type: 'Design Process',
      difficulty: 'Beginner',
      duration: '45-60 min',
      slug: 'system-design',
      features: [
        'Guided design methodology',
        'Requirements gathering',
        'Component identification',
        'Trade-off analysis'
      ],
      icon: '📐'
    },
    {
      title: 'Scalability Planning Workshop',
      description: 'Plan your scaling strategy from startup to enterprise scale',
      type: 'Scaling',
      difficulty: 'Advanced',
      duration: '30-45 min',
      slug: 'scalability-planning',
      features: [
        'Growth trajectory modeling',
        'Bottleneck identification',
        'Scaling decision points',
        'Cost optimization'
      ],
      icon: '📈'
    },
    {
      title: 'Database Design Workshop',
      description: 'Choose the right database strategy for your data patterns and scale',
      type: 'Data Design',
      difficulty: 'Intermediate',
      duration: '25-35 min',
      slug: 'database-design',
      features: [
        'Data pattern analysis',
        'Database technology selection',
        'Schema design guidance',
        'Partitioning strategies'
      ],
      icon: '🗄️'
    },
    {
      title: 'Microservices Design Workshop',
      description: 'Design microservices boundaries and communication patterns',
      type: 'Architecture',
      difficulty: 'Advanced',
      duration: '40-50 min',
      slug: 'microservices-design',
      features: [
        'Service boundary identification',
        'Communication patterns',
        'Data consistency strategies',
        'Deployment orchestration'
      ],
      icon: '🔗'
    },
    {
      title: 'Performance Optimization Workshop',
      description: 'Systematic approach to identifying and fixing performance bottlenecks',
      type: 'Performance',
      difficulty: 'Advanced',
      duration: '35-45 min',
      slug: 'performance-optimization',
      features: [
        'Bottleneck analysis framework',
        'Caching strategy design',
        'Query optimization',
        'Infrastructure tuning'
      ],
      icon: '⚡'
    }
  ];

  const categories = [
    { name: 'All', count: workshops.length },
    { name: 'Architecture', count: workshops.filter(w => w.type === 'Architecture').length },
    { name: 'Design Process', count: workshops.filter(w => w.type === 'Design Process').length },
    { name: 'Scaling', count: workshops.filter(w => w.type === 'Scaling').length },
    { name: 'Data Design', count: workshops.filter(w => w.type === 'Data Design').length },
    { name: 'Performance', count: workshops.filter(w => w.type === 'Performance').length }
  ];

  return (
    <main className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
          Design Workshop 🔧
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-6">
          Interactive workshops to guide you through system design decisions with hands-on exercises, 
          decision trees, and practical frameworks.
        </p>
        
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{workshops.length}</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">Interactive Workshops</div>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">6</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">Categories</div>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">Guided</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">Step-by-step</div>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">Export</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">To Whiteboard</div>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <button
              key={category.name}
              className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              {category.name} ({category.count})
            </button>
          ))}
        </div>
      </div>

      {/* Workshops Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {workshops.map(workshop => (
          <Link
            key={workshop.slug}
            href={`/workshop/${workshop.slug}` as any}
            className="group block"
          >
            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-lg transition-all duration-200 p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="text-3xl">{workshop.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {workshop.title}
                    </h2>
                  </div>
                  <p className="text-neutral-600 dark:text-neutral-400 mb-3">
                    {workshop.description}
                  </p>
                  
                  <div className="flex items-center gap-3 mb-4">
                    <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded text-xs font-medium">
                      {workshop.type}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      workshop.difficulty === 'Beginner' ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' :
                      workshop.difficulty === 'Intermediate' ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300' :
                      'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    }`}>
                      {workshop.difficulty}
                    </span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {workshop.duration}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">What you'll learn:</div>
                <div className="grid grid-cols-2 gap-2">
                  {workshop.features.map(feature => (
                    <div key={feature} className="flex items-start gap-2">
                      <span className="text-indigo-500 mt-1 text-xs">•</span>
                      <span className="text-sm text-neutral-600 dark:text-neutral-400">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                  Start Workshop →
                </div>
                <div className="text-neutral-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* How It Works Section */}
      <div className="mt-12 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-8">
        <h3 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
          How Design Workshops Work
        </h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">1️⃣</span>
            </div>
            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Input Requirements</h4>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Start by defining your system requirements, constraints, and goals through guided questions.
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">2️⃣</span>
            </div>
            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Get Recommendations</h4>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Receive personalized architecture recommendations based on proven patterns and your specific needs.
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">3️⃣</span>
            </div>
            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Build & Export</h4>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Export your design to the whiteboard for visualization or continue refining with additional tools.
            </p>
          </div>
        </div>
        
        <div className="mt-8 flex justify-center">
          <Link 
            href="/workshop/architecture-decisions"
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            Start Your First Workshop
          </Link>
        </div>
      </div>

      {/* Related Tools */}
      <div className="mt-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
          Related Tools & Resources
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          <Link 
            href="/tools"
            className="p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
          >
            <div className="font-medium text-neutral-900 dark:text-neutral-100 mb-1">Interactive Calculators</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">Capacity planning and performance modeling tools</div>
          </Link>
          
          <Link 
            href="/whiteboard"
            className="p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
          >
            <div className="font-medium text-neutral-900 dark:text-neutral-100 mb-1">Architecture Whiteboard</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">Visual architecture design and collaboration</div>
          </Link>
          
          <Link 
            href="/reference"
            className="p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
          >
            <div className="font-medium text-neutral-900 dark:text-neutral-100 mb-1">Back of the Envelope</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">Essential numbers and quick calculations</div>
          </Link>
        </div>
      </div>
    </main>
  );
}