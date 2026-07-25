'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Cpu, Rocket, ServerCog, Database, Workflow, Activity, Target, GraduationCap } from 'lucide-react';
import type { Route } from 'next';
import { ML_TECHNOLOGY } from '@/components/ml-systems/ml-nav-config';

export default function MLTechnologyPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = ['all', ...new Set(ML_TECHNOLOGY.map(item => item.category))];
  
  const filteredItems = selectedCategory === 'all' 
    ? ML_TECHNOLOGY 
    : ML_TECHNOLOGY.filter(item => item.category === selectedCategory);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300';
      case 'intermediate': return 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300';
      case 'advanced': return 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300';
      default: return 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return '✅';
      case 'coming-soon': return '🔜';
      case 'in-progress': return '🚧';
      default: return '📚';
    }
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      'Orchestration': '🎼',
      'Feature Store': '🏪',
      'Model Serving': '🚀',
      'Storage': '💾',
      'Distributed Computing': '⚡',
      'Monitoring': '📊'
    };
    return icons[category] || '🔧';
  };

  const technologyCategories = {
    'Orchestration': {
      description: 'Workflow management and experiment tracking for ML pipelines',
      tools: ['Apache Airflow', 'Kubeflow', 'MLflow', 'Metaflow']
    },
    'Feature Store': {
      description: 'Centralized feature management for training/serving consistency',
      tools: ['Feast', 'Tecton', 'AWS SageMaker Feature Store', 'Databricks Feature Store']
    },
    'Model Serving': {
      description: 'High-performance model inference and deployment platforms',
      tools: ['TensorFlow Serving', 'Seldon Core', 'KServe', 'Ray Serve']
    },
    'Storage': {
      description: 'Specialized storage systems for ML data and embeddings',
      tools: ['Vector Databases', 'Data Lakes', 'Model Registries', 'Artifact Stores']
    },
    'Distributed Computing': {
      description: 'Frameworks for scaling ML training and inference',
      tools: ['Ray', 'Horovod', 'DeepSpeed', 'FairScale']
    },
    'Monitoring': {
      description: 'Observability and monitoring for production ML systems',
      tools: ['Evidently AI', 'WhyLabs', 'Arize', 'Fiddler']
    }
  };

  return (
    <main className="max-w-[1200px] mx-auto px-4 md:px-6 py-8">
      <article className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
            <ServerCog className="h-7 w-7 text-neutral-700 dark:text-neutral-300" />
            ML Technology Deep Dives
          </h1>
          <p className="text-lg text-neutral-600 dark:text-neutral-400">
            Implementation guides for ML infrastructure tools. Learn architecture, deployment patterns, and best practices.
          </p>
        </div>

        {/* Introduction */}
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-6">
          <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">
            <strong>ML Technology Deep Dives</strong> provide comprehensive implementation guides for the specialized 
            tools that power production ML systems. Each guide covers architecture, deployment patterns, performance 
            optimization, and real-world usage examples.
          </p>
          <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
            Unlike general software tools, ML infrastructure requires understanding of data pipelines, model 
            lifecycle management, and the unique operational challenges of probabilistic systems.
          </p>
        </div>

        {/* Category Overview */}
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-6">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-6">Technology Categories</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {Object.entries(technologyCategories).map(([category, info]) => (
              <div key={category} className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{getCategoryIcon(category)}</span>
                  <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">{category}</h3>
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">{info.description}</p>
                <div className="text-xs text-neutral-500 dark:text-neutral-500">
                  <strong>Key Tools:</strong> {info.tools.slice(0, 2).join(', ')}
                  {info.tools.length > 2 && ` +${info.tools.length - 2} more`}
                </div>
              </div>
            ))}
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 mb-6">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedCategory === category
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-2 border-indigo-200 dark:border-indigo-800'
                    : 'bg-neutral-50 dark:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300 border-2 border-transparent hover:border-neutral-200 dark:hover:border-neutral-700'
                }`}
              >
                {category === 'all' ? 'All Tools' : category}
              </button>
            ))}
          </div>

          {/* Technology Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map(item => (
              <div
                key={item.id}
                className={`rounded-xl border transition-all ${
                  item.status === 'coming-soon'
                    ? 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/30 opacity-75'
                    : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50 hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-md'
                }`}
              >
                {item.status === 'coming-soon' ? (
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="text-xl">{getStatusIcon(item.status)}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium text-neutral-500 dark:text-neutral-400">
                            {item.title}
                          </h3>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${getDifficultyColor(item.difficulty)}`}>
                            {item.difficulty}
                          </span>
                        </div>
                        <p className="text-sm text-neutral-400 dark:text-neutral-500 mb-2">
                          {item.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-neutral-400 dark:text-neutral-500">
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {item.estimatedTime}
                          </span>
                          <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs rounded">
                            Coming Soon
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Link
                    href={`/ml-systems/technology/${item.slug}` as Route<`/ml-systems/technology/${string}`>}
                    className="block p-4 group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-neutral-500 dark:text-neutral-400">
                        <Cpu className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium text-neutral-900 dark:text-neutral-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {item.title}
                          </h3>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${getDifficultyColor(item.difficulty)}`}>
                            {item.difficulty}
                          </span>
                        </div>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                          {item.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {item.estimatedTime}
                          </span>
                          <span className="text-neutral-400 dark:text-neutral-500">
                            {getCategoryIcon(item.category)} {item.category}
                          </span>
                        </div>
                      </div>
                      <div className="text-neutral-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tool Selection Guide */}
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-6">
          <h2 className="text-2xl font-semibold text-amber-900 dark:text-amber-100 mb-4">🎯 Tool Selection Framework</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-3">Consider First</h3>
              <div className="space-y-2 text-amber-700 dark:text-amber-300 text-sm">
                <div><strong>Team Size:</strong> Small teams need simpler, managed solutions</div>
                <div><strong>Scale Requirements:</strong> Current and projected data/model volumes</div>
                <div><strong>Latency Needs:</strong> Real-time vs batch inference requirements</div>
                <div><strong>Budget Constraints:</strong> Open-source vs managed service costs</div>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-3">Evaluation Criteria</h3>
              <div className="space-y-2 text-amber-700 dark:text-amber-300 text-sm">
                <div><strong>Learning Curve:</strong> Time to productive implementation</div>
                <div><strong>Integration:</strong> How well it fits your existing stack</div>
                <div><strong>Community:</strong> Documentation, support, ecosystem maturity</div>
                <div><strong>Vendor Lock-in:</strong> Migration difficulty and data portability</div>
              </div>
            </div>
          </div>
        </div>

        {/* Technology Comparison Matrix */}
        <div className="rounded-2xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/10 p-6">
          <h2 className="text-2xl font-semibold text-purple-900 dark:text-purple-100 mb-4">📊 Quick Comparison</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-purple-200 dark:border-purple-800">
                  <th className="text-left p-3 font-semibold text-purple-900 dark:text-purple-100">Category</th>
                  <th className="text-left p-3 font-semibold text-purple-900 dark:text-purple-100">Open Source</th>
                  <th className="text-left p-3 font-semibold text-purple-900 dark:text-purple-100">Managed Service</th>
                  <th className="text-left p-3 font-semibold text-purple-900 dark:text-purple-100">Best For</th>
                </tr>
              </thead>
              <tbody className="text-purple-700 dark:text-purple-300">
                <tr className="border-b border-purple-200/50 dark:border-purple-800/50">
                  <td className="p-3">Orchestration</td>
                  <td className="p-3">Airflow, Kubeflow</td>
                  <td className="p-3">SageMaker, Vertex AI</td>
                  <td className="p-3">Complex workflows</td>
                </tr>
                <tr className="border-b border-purple-200/50 dark:border-purple-800/50">
                  <td className="p-3">Feature Store</td>
                  <td className="p-3">Feast</td>
                  <td className="p-3">Tecton, SageMaker</td>
                  <td className="p-3">Real-time features</td>
                </tr>
                <tr className="border-b border-purple-200/50 dark:border-purple-800/50">
                  <td className="p-3">Model Serving</td>
                  <td className="p-3">TF Serving, Seldon</td>
                  <td className="p-3">SageMaker, Vertex</td>
                  <td className="p-3">High-throughput inference</td>
                </tr>
                <tr>
                  <td className="p-3">Monitoring</td>
                  <td className="p-3">Evidently</td>
                  <td className="p-3">WhyLabs, Arize</td>
                  <td className="p-3">Production ML observability</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Learning Path Integration */}
        <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 p-6">
          <h2 className="text-2xl font-semibold text-blue-900 dark:text-blue-100 mb-4">🎓 Continue Learning</h2>
          <p className="text-blue-700 dark:text-blue-300 mb-4">
            These technology guides build upon ML Systems fundamentals. For the complete learning experience:
          </p>
          <div className="flex flex-wrap gap-3">
            <Link 
              href={"/ml-systems" as Route<'/ml-systems'>}
              className="btn-soft"
            >
              <GraduationCap className="h-4 w-4" /> ML Fundamentals
            </Link>
            <Link 
              href={"/ml-systems/reference" as Route<'/ml-systems/reference'>}
              className="btn-soft"
            >
              <Database className="h-4 w-4" /> ML Reference Guides
            </Link>
            <Link 
              href={"/ml-systems/practice" as Route<'/ml-systems/practice'>}
              className="btn-soft"
            >
              <Target className="h-4 w-4" /> ML Practice Problems
            </Link>
          </div>
        </div>
      </article>
    </main>
  );
}