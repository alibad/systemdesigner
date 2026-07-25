"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Context = {
  dau: number; // daily active users
  peakRps: number; // peak requests per second
  readRatio: number; // 0..1 (reads / (reads+writes))
  latencyTargetMs: number; // p95 target
  strictConsistency: boolean;
  schemaFlexibility: number; // 0..1
  globalUsers: boolean;
  writeHeavy: boolean;
  budgetConstraint: number; // 1-5 scale
  teamSize: number; // developers
  mainUseCase: string;
};

function Slider({ label, value, setValue, min, max, step = 1, format }: { 
  label: string; 
  value: number; 
  setValue: (n: number) => void; 
  min: number; 
  max: number; 
  step?: number; 
  format?: (n: number) => string 
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{label}</label>
        <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
          {format ? format(value) : value}
        </span>
      </div>
      <input 
        type="range" 
        min={min} 
        max={max} 
        step={step} 
        value={value} 
        onChange={(e) => setValue(Number(e.target.value))} 
        className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer slider"
      />
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #4f46e5;
          cursor: pointer;
        }
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #4f46e5;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
}

function ToggleOption({ label, value, setValue, description }: {
  label: string;
  value: boolean;
  setValue: (b: boolean) => void;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => setValue(e.target.checked)}
        className="mt-1 w-4 h-4 text-indigo-600 border-neutral-300 rounded focus:ring-indigo-500"
      />
      <div>
        <div className="font-medium text-neutral-900 dark:text-neutral-100">{label}</div>
        <div className="text-sm text-neutral-600 dark:text-neutral-400">{description}</div>
      </div>
    </div>
  );
}

export default function ArchitectureDecisionsWorkshop() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [ctx, setCtx] = useState<Context>({
    dau: 1_000_000,
    peakRps: 5_000,
    readRatio: 0.9,
    latencyTargetMs: 150,
    strictConsistency: false,
    schemaFlexibility: 0.6,
    globalUsers: true,
    writeHeavy: false,
    budgetConstraint: 3,
    teamSize: 5,
    mainUseCase: 'social-app'
  });

  const set = <K extends keyof Context>(key: K, value: Context[K]) => setCtx((prev) => ({ ...prev, [key]: value }));

  const steps = [
    {
      title: "Define Your System",
      description: "Start with basic requirements and scale",
      icon: "📋"
    },
    {
      title: "Performance Requirements", 
      description: "Set latency and consistency expectations",
      icon: "⚡"
    },
    {
      title: "Team & Budget",
      description: "Consider operational constraints", 
      icon: "👥"
    },
    {
      title: "Architecture Recommendations",
      description: "Get personalized technology choices",
      icon: "🏗️"
    }
  ];

  // Enhanced recommendation logic
  const dbChoice = useMemo(() => {
    const score = {
      sql: 0,
      nosql: 0,
      document: 0,
      graph: 0
    };

    // Consistency requirements
    if (ctx.strictConsistency) score.sql += 3;
    else score.nosql += 2;

    // Schema flexibility
    if (ctx.schemaFlexibility > 0.7) score.document += 3;
    if (ctx.schemaFlexibility < 0.3) score.sql += 2;

    // Write patterns
    if (ctx.writeHeavy) score.nosql += 2;
    if (ctx.readRatio > 0.8) score.sql += 1;

    // Scale
    if (ctx.peakRps > 10000) score.nosql += 2;
    if (ctx.dau > 10_000_000) score.nosql += 1;

    // Use case specific
    if (ctx.mainUseCase === 'social-app') score.graph += 1;
    if (ctx.mainUseCase === 'analytics') score.nosql += 2;
    if (ctx.mainUseCase === 'ecommerce') score.sql += 2;

    const maxScore = Math.max(...Object.values(score));
    const winner = Object.entries(score).find(([_, s]) => s === maxScore)?.[0];

    const recommendations = {
      sql: 'PostgreSQL with read replicas',
      nosql: 'Cassandra or DynamoDB', 
      document: 'MongoDB or DocumentDB',
      graph: 'Neo4j or Amazon Neptune'
    };

    return recommendations[winner as keyof typeof recommendations] || 'PostgreSQL (start simple)';
  }, [ctx]);

  const caching = useMemo(() => {
    const strategies: string[] = [];
    
    if (ctx.readRatio > 0.7) strategies.push('Redis for application cache');
    if (ctx.globalUsers || ctx.latencyTargetMs < 100) strategies.push('CDN for static content');
    if (ctx.peakRps > 8000) strategies.push('Write-through cache for hot data');
    if (ctx.latencyTargetMs < 50) strategies.push('Edge caching with geographic distribution');
    
    return strategies.length ? strategies : ['Consider caching as you scale'];
  }, [ctx.readRatio, ctx.globalUsers, ctx.latencyTargetMs, ctx.peakRps]);

  const architecture = useMemo(() => {
    if (ctx.teamSize < 3 || ctx.dau < 100_000) return 'Monolithic architecture';
    if (ctx.teamSize < 8 && ctx.dau < 1_000_000) return 'Modular monolith';
    if (ctx.peakRps > 5000 || ctx.teamSize > 10) return 'Microservices architecture';
    return 'Service-oriented architecture';
  }, [ctx.teamSize, ctx.dau, ctx.peakRps]);

  const deployment = useMemo(() => {
    const recommendations: string[] = [];
    
    if (ctx.globalUsers) recommendations.push('Multi-region deployment');
    if (ctx.budgetConstraint <= 2) recommendations.push('Single cloud provider with reserved instances');
    if (ctx.budgetConstraint >= 4) recommendations.push('Multi-cloud for redundancy');
    if (ctx.teamSize < 5) recommendations.push('Managed services to reduce ops overhead');
    if (ctx.latencyTargetMs < 100) recommendations.push('Edge locations and CDN');
    
    return recommendations;
  }, [ctx.globalUsers, ctx.budgetConstraint, ctx.teamSize, ctx.latencyTargetMs]);

  const monitoring = useMemo(() => {
    const stack: string[] = [];
    
    stack.push('Application metrics: Prometheus + Grafana');
    if (ctx.peakRps > 1000) stack.push('Distributed tracing: Jaeger or DataDog');
    if (ctx.strictConsistency) stack.push('Database monitoring: slow query analysis');
    if (ctx.globalUsers) stack.push('Real user monitoring: Core Web Vitals');
    stack.push('Alerting: PagerDuty or OpsGenie');
    
    return stack;
  }, [ctx.peakRps, ctx.strictConsistency, ctx.globalUsers]);

  const componentsForWhiteboard = useMemo(() => {
    const comps = ['user', 'api', 'balancer'];
    
    if (architecture.includes('Microservices')) {
      comps.push('auth-service', 'user-service', 'content-service');
    } else {
      comps.push('server');
    }
    
    if (caching.length > 1) comps.push('cache');
    comps.push('database');
    
    if (ctx.peakRps > 5000) comps.push('queue');
    if (ctx.globalUsers) comps.push('cdn');
    comps.push('monitor');
    
    return comps;
  }, [architecture, caching.length, ctx.peakRps, ctx.globalUsers]);

  const openInWhiteboard = () => {
    try {
      const payload = { 
        components: componentsForWhiteboard, 
        note: `Architecture for ${ctx.mainUseCase} - ${ctx.dau.toLocaleString()} DAU, ${ctx.peakRps.toLocaleString()} peak RPS` 
      };
      localStorage.setItem('architecture-guide-components', JSON.stringify(payload));
      router.push('/whiteboard');
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                What type of system are you building?
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'social-app', label: 'Social App', desc: 'User feeds, interactions, messaging' },
                  { id: 'ecommerce', label: 'E-commerce', desc: 'Product catalog, orders, payments' },
                  { id: 'analytics', label: 'Analytics Platform', desc: 'Data processing, reporting, dashboards' },
                  { id: 'content', label: 'Content Platform', desc: 'Media sharing, streaming, distribution' }
                ].map(option => (
                  <button
                    key={option.id}
                    onClick={() => set('mainUseCase', option.id)}
                    className={`p-4 text-left border rounded-lg transition-colors ${
                      ctx.mainUseCase === option.id
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                    }`}
                  >
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">{option.label}</div>
                    <div className="text-sm text-neutral-600 dark:text-neutral-400">{option.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <Slider
              label="Daily Active Users"
              value={ctx.dau}
              setValue={(v) => set('dau', v)}
              min={1000}
              max={100_000_000}
              step={1000}
              format={(n) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${(n / 1000).toFixed(0)}K`}
            />

            <Slider
              label="Peak Requests per Second"
              value={ctx.peakRps}
              setValue={(v) => set('peakRps', v)}
              min={100}
              max={50_000}
              step={100}
              format={(n) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toString()}
            />

            <Slider
              label="Read vs Write Ratio"
              value={ctx.readRatio}
              setValue={(v) => set('readRatio', v)}
              min={0.1}
              max={0.99}
              step={0.1}
              format={(n) => `${Math.round(n * 100)}% reads`}
            />
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <Slider
              label="Target Response Time (95th percentile)"
              value={ctx.latencyTargetMs}
              setValue={(v) => set('latencyTargetMs', v)}
              min={10}
              max={1000}
              step={10}
              format={(n) => `${n}ms`}
            />

            <Slider
              label="Schema Flexibility Needed"
              value={ctx.schemaFlexibility}
              setValue={(v) => set('schemaFlexibility', v)}
              min={0}
              max={1}
              step={0.1}
              format={(n) => n < 0.3 ? 'Rigid' : n < 0.7 ? 'Moderate' : 'High'}
            />

            <div className="space-y-4">
              <ToggleOption
                label="Strict Consistency Required"
                value={ctx.strictConsistency}
                setValue={(v) => set('strictConsistency', v)}
                description="ACID transactions, immediate consistency across all operations"
              />

              <ToggleOption
                label="Global User Base"
                value={ctx.globalUsers}
                setValue={(v) => set('globalUsers', v)}
                description="Users distributed across multiple continents and time zones"
              />

              <ToggleOption
                label="Write-Heavy Workload"
                value={ctx.writeHeavy}
                setValue={(v) => set('writeHeavy', v)}
                description="High volume of writes relative to reads (logging, IoT, real-time events)"
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <Slider
              label="Development Team Size"
              value={ctx.teamSize}
              setValue={(v) => set('teamSize', v)}
              min={1}
              max={50}
              step={1}
              format={(n) => `${n} developers`}
            />

            <Slider
              label="Budget Constraint"
              value={ctx.budgetConstraint}
              setValue={(v) => set('budgetConstraint', v)}
              min={1}
              max={5}
              step={1}
              format={(n) => {
                const labels = ['Very tight', 'Limited', 'Moderate', 'Flexible', 'High budget'];
                return labels[n - 1];
              }}
            />

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Budget Guidance</h4>
              <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <div><strong>Very tight:</strong> Focus on managed services, single region</div>
                <div><strong>Limited:</strong> Strategic use of premium services</div>
                <div><strong>Moderate:</strong> Balance between cost and performance</div>
                <div><strong>Flexible:</strong> Optimize for performance and reliability</div>
                <div><strong>High budget:</strong> Multi-cloud, premium services, global deployment</div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                🎯 Your Personalized Architecture
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400">
                Based on your requirements, here are our recommendations
              </p>
            </div>

            <div className="grid gap-6">
              {/* Database Choice */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">🗄️</span>
                  <h4 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Database Strategy</h4>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
                  <div className="font-medium text-emerald-800 dark:text-emerald-200">{dbChoice}</div>
                </div>
                <div className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
                  {ctx.strictConsistency && "Strong consistency requirements favor SQL databases."}
                  {ctx.writeHeavy && " High write volume suggests NoSQL for better horizontal scaling."}
                  {ctx.schemaFlexibility > 0.7 && " Schema flexibility needs point toward document databases."}
                </div>
              </div>

              {/* Architecture Pattern */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">🏗️</span>
                  <h4 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Architecture Pattern</h4>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="font-medium text-blue-800 dark:text-blue-200">{architecture}</div>
                </div>
                <div className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
                  Team size ({ctx.teamSize}) and scale ({ctx.dau.toLocaleString()} DAU) determine architectural complexity.
                </div>
              </div>

              {/* Caching Strategy */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">⚡</span>
                  <h4 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Caching Strategy</h4>
                </div>
                <div className="space-y-2">
                  {caching.map((strategy, index) => (
                    <div key={index} className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                      <div className="text-amber-800 dark:text-amber-200 text-sm">{strategy}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Deployment Strategy */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">☁️</span>
                  <h4 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Deployment Strategy</h4>
                </div>
                <div className="space-y-2">
                  {deployment.map((strategy, index) => (
                    <div key={index} className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                      <div className="text-purple-800 dark:text-purple-200 text-sm">{strategy}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Monitoring & Observability */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">📊</span>
                  <h4 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Monitoring Stack</h4>
                </div>
                <div className="space-y-2">
                  {monitoring.map((tool, index) => (
                    <div key={index} className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-3">
                      <div className="text-neutral-700 dark:text-neutral-300 text-sm">{tool}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 justify-center pt-6">
              <button
                onClick={openInWhiteboard}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                Open in Whiteboard →
              </button>
              <Link
                href="/tools"
                className="px-6 py-3 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors font-medium"
              >
                Explore Tools
              </Link>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <main className="max-w-[1200px] mx-auto px-4 md:px-6 py-6">
      <div className="mb-6">
        <Link href="/workshop" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
          ← Back to Design Workshop
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
          Architecture Decision Workshop
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400">
          Get personalized architecture recommendations based on your specific requirements and constraints.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`flex items-center ${index < steps.length - 1 ? 'flex-1' : ''}`}
            >
              <div className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-medium ${
                index <= currentStep
                  ? 'bg-indigo-600 text-white'
                  : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400'
              }`}>
                {index < currentStep ? '✓' : index + 1}
              </div>
              
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-4 ${
                  index < currentStep
                    ? 'bg-indigo-600'
                    : 'bg-neutral-200 dark:bg-neutral-700'
                }`} />
              )}
            </div>
          ))}
        </div>
        
        <div className="text-center">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
            {steps[currentStep]?.icon} {steps[currentStep]?.title}
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400">
            {steps[currentStep]?.description}
          </p>
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-8 mb-8">
        {renderStep()}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className="px-6 py-2 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        
        <button
          onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
          disabled={currentStep === steps.length - 1}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {currentStep === steps.length - 1 ? 'Complete' : 'Next'}
        </button>
      </div>
    </main>
  );
}