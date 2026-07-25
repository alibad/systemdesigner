'use client';

import { useState } from 'react';
import Link from 'next/link';

interface PatternTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  complexity: 'Beginner' | 'Intermediate' | 'Advanced';
  useCase: string;
  components: string[];
  estimatedTime: string;
  icon: string;
}

export default function PatternsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const patterns: PatternTemplate[] = [
    // Scalability Patterns
    {
      id: 'microservices-template',
      title: 'Microservices Architecture',
      description: 'Complete template for breaking down monoliths into microservices with API gateways, service discovery, and monitoring',
      category: 'Scalability',
      complexity: 'Advanced',
      useCase: 'Large scale applications requiring independent deployment and scaling',
      components: ['API Gateway', 'Service Registry', 'Load Balancer', 'Message Queue', 'Database per Service'],
      estimatedTime: '45 min',
      icon: '🏗️'
    },
    {
      id: 'cqrs-pattern',
      title: 'CQRS with Event Sourcing',
      description: 'Separate read and write operations with event-driven architecture for high-performance systems',
      category: 'Scalability',
      complexity: 'Advanced',
      useCase: 'High-throughput systems with complex business logic and audit requirements',
      components: ['Command Handler', 'Event Store', 'Read Models', 'Event Bus', 'Projections'],
      estimatedTime: '60 min',
      icon: '⚡'
    },
    {
      id: 'horizontal-scaling',
      title: 'Horizontal Scaling Template',
      description: 'Auto-scaling template with load balancers, health checks, and blue-green deployment patterns',
      category: 'Scalability',
      complexity: 'Intermediate',
      useCase: 'Applications expecting variable load requiring automatic scaling',
      components: ['Load Balancer', 'Auto Scaling Group', 'Health Checks', 'Session Store', 'Monitoring'],
      estimatedTime: '30 min',
      icon: '📈'
    },

    // Performance Patterns
    {
      id: 'caching-layers',
      title: 'Multi-Layer Caching Strategy',
      description: 'Comprehensive caching template with CDN, application cache, and database cache layers',
      category: 'Performance',
      complexity: 'Intermediate',
      useCase: 'Read-heavy applications requiring sub-second response times',
      components: ['CDN', 'Redis Cache', 'Application Cache', 'Database Cache', 'Cache Invalidation'],
      estimatedTime: '35 min',
      icon: '⚡'
    },
    {
      id: 'cdn-optimization',
      title: 'Global CDN Architecture',
      description: 'Template for setting up global content delivery with edge locations and cache optimization',
      category: 'Performance',
      complexity: 'Intermediate',
      useCase: 'Global applications serving static and dynamic content worldwide',
      components: ['Edge Locations', 'Origin Servers', 'Cache Rules', 'Geographic Routing', 'Analytics'],
      estimatedTime: '25 min',
      icon: '🌍'
    },
    {
      id: 'database-optimization',
      title: 'Database Performance Optimization',
      description: 'Template for database sharding, read replicas, and query optimization strategies',
      category: 'Performance',
      complexity: 'Advanced',
      useCase: 'Data-intensive applications with millions of records and complex queries',
      components: ['Master-Slave Setup', 'Read Replicas', 'Sharding Strategy', 'Connection Pooling', 'Query Optimization'],
      estimatedTime: '50 min',
      icon: '🗄️'
    },

    // Reliability Patterns
    {
      id: 'circuit-breaker',
      title: 'Circuit Breaker & Resilience',
      description: 'Fault tolerance template with circuit breakers, retries, and graceful degradation',
      category: 'Reliability',
      complexity: 'Intermediate',
      useCase: 'Distributed systems requiring resilience against service failures',
      components: ['Circuit Breaker', 'Retry Logic', 'Fallback Services', 'Health Monitoring', 'Alerting'],
      estimatedTime: '40 min',
      icon: '🛡️'
    },
    {
      id: 'disaster-recovery',
      title: 'Disaster Recovery Architecture',
      description: 'Complete DR template with backup strategies, failover mechanisms, and recovery procedures',
      category: 'Reliability',
      complexity: 'Advanced',
      useCase: 'Mission-critical systems requiring 99.99% uptime and data protection',
      components: ['Primary Region', 'DR Region', 'Data Replication', 'Failover Logic', 'Backup Strategy'],
      estimatedTime: '55 min',
      icon: '🔄'
    },
    {
      id: 'monitoring-observability',
      title: 'Full-Stack Observability',
      description: 'Comprehensive monitoring template with metrics, logging, and distributed tracing',
      category: 'Reliability',
      complexity: 'Intermediate',
      useCase: 'Complex systems requiring deep visibility into performance and behavior',
      components: ['Metrics Collection', 'Log Aggregation', 'Distributed Tracing', 'Alerting Rules', 'Dashboards'],
      estimatedTime: '45 min',
      icon: '📊'
    },

    // Security Patterns
    {
      id: 'zero-trust-architecture',
      title: 'Zero Trust Security Model',
      description: 'Security template with identity verification, network segmentation, and least privilege access',
      category: 'Security',
      complexity: 'Advanced',
      useCase: 'Enterprise applications requiring strict security controls and compliance',
      components: ['Identity Provider', 'Network Segmentation', 'Access Control', 'Audit Logging', 'Encryption'],
      estimatedTime: '50 min',
      icon: '🔒'
    },
    {
      id: 'api-security',
      title: 'API Security Gateway',
      description: 'Template for securing APIs with authentication, rate limiting, and threat protection',
      category: 'Security',
      complexity: 'Intermediate',
      useCase: 'API-first applications requiring comprehensive security controls',
      components: ['API Gateway', 'OAuth/JWT', 'Rate Limiting', 'WAF', 'API Analytics'],
      estimatedTime: '35 min',
      icon: '🔐'
    },

    // AI/ML Patterns
    {
      id: 'ml-pipeline',
      title: 'ML Training & Serving Pipeline',
      description: 'End-to-end ML template with data processing, model training, and inference serving',
      category: 'AI/ML',
      complexity: 'Advanced',
      useCase: 'Machine learning applications requiring automated training and deployment',
      components: ['Data Pipeline', 'Feature Store', 'Training Cluster', 'Model Registry', 'Serving Infrastructure'],
      estimatedTime: '60 min',
      icon: '🤖'
    },
    {
      id: 'realtime-ai',
      title: 'Real-time AI Inference',
      description: 'Template for serving ML models with low latency and high throughput requirements',
      category: 'AI/ML',
      complexity: 'Advanced',
      useCase: 'Applications requiring real-time predictions with sub-100ms latency',
      components: ['Model Serving', 'Feature Cache', 'Prediction API', 'A/B Testing', 'Model Monitoring'],
      estimatedTime: '45 min',
      icon: '⚡'
    },
    {
      id: 'genai-platform',
      title: 'GenAI Application Platform',
      description: 'Template for building generative AI applications with LLMs, vector databases, and RAG',
      category: 'AI/ML',
      complexity: 'Advanced',
      useCase: 'Conversational AI and content generation applications',
      components: ['LLM Gateway', 'Vector Database', 'RAG Pipeline', 'Safety Filters', 'Usage Analytics'],
      estimatedTime: '50 min',
      icon: '🧠'
    }
  ];

  const categories = ['All', ...new Set(patterns.map(pattern => pattern.category))];
  const filteredPatterns = selectedCategory === 'All' 
    ? patterns 
    : patterns.filter(pattern => pattern.category === selectedCategory);

  const complexityColors = {
    'Beginner': 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
    'Intermediate': 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
    'Advanced': 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
  };

  const categoryColors = {
    'Scalability': 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
    'Performance': 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300',
    'Reliability': 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
    'Security': 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300',
    'AI/ML': 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
  };

  return (
    <main className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
          🎯 System Design Patterns
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-6 max-w-3xl">
          Production-ready architectural templates and patterns. Copy, customize, and deploy proven solutions 
          for common system design challenges with detailed implementation guides.
        </p>
        
        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{patterns.length}</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">Design Patterns</div>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{categories.length - 1}</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">Categories</div>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">Ready</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">To Deploy</div>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">Proven</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">In Production</div>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === category
                  ? 'bg-indigo-600 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              {category}
              {category !== 'All' && (
                <span className="ml-2 text-xs opacity-75">
                  ({patterns.filter(p => p.category === category).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Patterns Grid */}
      <div className="grid gap-6">
        {filteredPatterns.map((pattern) => (
          <div
            key={pattern.id}
            className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card hover:shadow-lg transition-all p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{pattern.icon}</span>
                  <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                    {pattern.title}
                  </h2>
                  <span className={`text-xs px-2 py-1 rounded font-medium ${complexityColors[pattern.complexity]}`}>
                    {pattern.complexity}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded font-medium ${categoryColors[pattern.category as keyof typeof categoryColors]}`}>
                    {pattern.category}
                  </span>
                </div>
                <p className="text-neutral-600 dark:text-neutral-400 mb-3">
                  {pattern.description}
                </p>
                <div className="text-sm text-neutral-700 dark:text-neutral-300 mb-4">
                  <strong>Use Case:</strong> {pattern.useCase}
                </div>
              </div>
              <div className="text-sm text-neutral-500 dark:text-neutral-400 ml-6">
                {pattern.estimatedTime}
              </div>
            </div>
            
            <div className="mb-4">
              <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Key Components:</div>
              <div className="flex flex-wrap gap-2">
                {pattern.components.map(component => (
                  <span 
                    key={component}
                    className="text-xs px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded"
                  >
                    {component}
                  </span>
                ))}
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex gap-3">
                <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                  View Template
                </button>
                <button className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                  Copy to Whiteboard
                </button>
              </div>
              <Link 
                href="/whiteboard" 
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
              >
                Customize →
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Getting Started */}
      <div className="mt-12 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-8">
        <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
          How to Use Design Patterns
        </h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
              <h4 className="font-semibold text-neutral-900 dark:text-neutral-100">Choose Your Pattern</h4>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Browse patterns by category or use case. Each template includes detailed component descriptions and implementation guidance.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
              <h4 className="font-semibold text-neutral-900 dark:text-neutral-100">Customize & Adapt</h4>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Copy the template to our whiteboard, modify components for your specific requirements, and add custom business logic.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
              <h4 className="font-semibold text-neutral-900 dark:text-neutral-100">Validate & Deploy</h4>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Use our calculators to validate performance and costs, then follow the implementation guide for deployment.
            </p>
          </div>
        </div>
        
        <div className="mt-6 flex gap-4">
          <Link 
            href="/fundamentals" 
            className="px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
          >
            📚 Learn Fundamentals
          </Link>
          <Link 
            href="/tools" 
            className="px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
          >
            🧮 Use Calculators
          </Link>
          <Link 
            href="/whiteboard" 
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            🎨 Start Designing
          </Link>
        </div>
      </div>
    </main>
  );
}