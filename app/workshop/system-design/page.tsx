"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface DesignSession {
  problem: string;
  functionalRequirements: string[];
  nonFunctionalRequirements: string[];
  capacity: {
    users: number;
    requestsPerSecond: number;
    dataPerDay: string;
    storage: string;
  };
  apiDesign: {
    endpoints: { method: string; path: string; description: string }[];
  };
  components: string[];
  tradeoffs: { decision: string; pros: string[]; cons: string[] }[];
}

export default function SystemDesignWorkshop() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedProblem, setSelectedProblem] = useState('');
  const [session, setSession] = useState<DesignSession>({
    problem: '',
    functionalRequirements: [],
    nonFunctionalRequirements: [],
    capacity: {
      users: 0,
      requestsPerSecond: 0,
      dataPerDay: '',
      storage: ''
    },
    apiDesign: {
      endpoints: []
    },
    components: [],
    tradeoffs: []
  });

  const problems = [
    {
      id: 'chat-system',
      title: 'Real-time Chat System',
      description: 'Design a messaging system like WhatsApp or Slack',
      complexity: 'Medium',
      estimatedTime: '45-60 min',
      keyFeatures: ['Real-time messaging', 'User presence', 'Group chats', 'Message history']
    },
    {
      id: 'url-shortener',
      title: 'URL Shortener Service',
      description: 'Design a service like bit.ly or TinyURL',
      complexity: 'Easy',
      estimatedTime: '30-45 min',
      keyFeatures: ['Short URL generation', 'Redirect service', 'Analytics', 'Custom aliases']
    },
    {
      id: 'social-feed',
      title: 'Social Media Feed',
      description: 'Design a news feed like Facebook or Twitter',
      complexity: 'Hard',
      estimatedTime: '60-90 min',
      keyFeatures: ['Timeline generation', 'Real-time updates', 'Content ranking', 'Scalable architecture']
    },
    {
      id: 'video-streaming',
      title: 'Video Streaming Platform',
      description: 'Design a platform like YouTube or Netflix',
      complexity: 'Hard',
      estimatedTime: '60-90 min',
      keyFeatures: ['Video upload/processing', 'Streaming delivery', 'Global CDN', 'Recommendation system']
    }
  ];

  const steps = [
    {
      title: "Problem Selection",
      description: "Choose a system design problem to work through",
      icon: "🎯"
    },
    {
      title: "Requirements Gathering",
      description: "Define functional and non-functional requirements",
      icon: "📋"
    },
    {
      title: "Capacity Estimation", 
      description: "Calculate scale, storage, and bandwidth needs",
      icon: "🔢"
    },
    {
      title: "API Design",
      description: "Define the core APIs and data models",
      icon: "🔧"
    },
    {
      title: "High-level Architecture",
      description: "Design the system components and data flow",
      icon: "🏗️"
    },
    {
      title: "Trade-offs & Deep Dive",
      description: "Analyze key decisions and potential improvements",
      icon: "⚖️"
    }
  ];

  const problemTemplates = {
    'chat-system': {
      functionalReqs: [
        'Send and receive messages in real-time',
        'Support 1-on-1 and group conversations', 
        'Show user online status and last seen',
        'Store message history',
        'Support message reactions and replies',
        'File and media sharing'
      ],
      nonFunctionalReqs: [
        'Support 100M daily active users',
        'Messages delivered within 100ms',
        '99.9% uptime',
        'End-to-end encryption for security',
        'Support mobile and web clients',
        'Global availability'
      ],
      capacity: {
        users: 100_000_000,
        requestsPerSecond: 50_000,
        dataPerDay: '50TB messages + metadata',
        storage: '10PB total (messages, media, metadata)'
      },
      components: ['user', 'api', 'websocket', 'chat-service', 'message-queue', 'database', 'cache', 'notification-service'],
      apiEndpoints: [
        { method: 'POST', path: '/auth/login', description: 'User authentication' },
        { method: 'GET', path: '/conversations', description: 'Get user conversations' },
        { method: 'POST', path: '/conversations', description: 'Create new conversation' },
        { method: 'GET', path: '/conversations/{id}/messages', description: 'Get conversation messages' },
        { method: 'POST', path: '/conversations/{id}/messages', description: 'Send message' },
        { method: 'WebSocket', path: '/ws/conversations/{id}', description: 'Real-time message stream' }
      ]
    },
    'url-shortener': {
      functionalReqs: [
        'Shorten long URLs to short aliases',
        'Redirect short URLs to original URLs',
        'Custom alias support',
        'URL expiration dates',
        'Click analytics and statistics',
        'Bulk URL shortening'
      ],
      nonFunctionalReqs: [
        'Handle 100M URLs shortened per day',
        'Redirect latency < 100ms',
        '99.9% availability',
        'Read-heavy: 100:1 read/write ratio',
        'URLs should not be guessable',
        'Analytics data retention for 2 years'
      ],
      capacity: {
        users: 10_000_000,
        requestsPerSecond: 10_000,
        dataPerDay: '100M new URLs, 10B redirects',
        storage: '1TB URLs + 5TB analytics data'
      },
      components: ['user', 'api', 'url-service', 'database', 'cache', 'analytics-service', 'balancer'],
      apiEndpoints: [
        { method: 'POST', path: '/shorten', description: 'Create short URL' },
        { method: 'GET', path: '/{shortCode}', description: 'Redirect to original URL' },
        { method: 'GET', path: '/analytics/{shortCode}', description: 'Get URL analytics' },
        { method: 'DELETE', path: '/{shortCode}', description: 'Delete short URL' },
        { method: 'POST', path: '/bulk/shorten', description: 'Bulk URL shortening' }
      ]
    }
  };

  const addRequirement = (type: 'functional' | 'nonFunctional', requirement: string) => {
    if (requirement.trim()) {
      setSession(prev => ({
        ...prev,
        [`${type}Requirements`]: [...prev[`${type}Requirements` as keyof DesignSession] as string[], requirement.trim()]
      }));
    }
  };

  const removeRequirement = (type: 'functional' | 'nonFunctional', index: number) => {
    setSession(prev => ({
      ...prev,
      [`${type}Requirements`]: (prev[`${type}Requirements` as keyof DesignSession] as string[]).filter((_, i) => i !== index)
    }));
  };

  const addEndpoint = (method: string, path: string, description: string) => {
    if (method && path && description) {
      setSession(prev => ({
        ...prev,
        apiDesign: {
          ...prev.apiDesign,
          endpoints: [...prev.apiDesign.endpoints, { method, path, description }]
        }
      }));
    }
  };

  const addTradeoff = (decision: string, pros: string[], cons: string[]) => {
    if (decision && pros.length && cons.length) {
      setSession(prev => ({
        ...prev,
        tradeoffs: [...prev.tradeoffs, { decision, pros, cons }]
      }));
    }
  };

  const exportToWhiteboard = () => {
    try {
      const payload = { 
        components: session.components,
        note: `System Design: ${session.problem}`
      };
      localStorage.setItem('architecture-guide-components', JSON.stringify(payload));
      router.push('/whiteboard');
    } catch (error) {
      console.error('Failed to export to whiteboard:', error);
    }
  };

  const loadTemplate = (problemId: string) => {
    const template = problemTemplates[problemId as keyof typeof problemTemplates];
    if (template) {
      setSession(prev => ({
        ...prev,
        problem: problems.find(p => p.id === problemId)?.title || '',
        functionalRequirements: template.functionalReqs,
        nonFunctionalRequirements: template.nonFunctionalReqs,
        capacity: template.capacity,
        components: template.components,
        apiDesign: {
          endpoints: template.apiEndpoints
        }
      }));
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                Choose Your System Design Challenge
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400">
                Select a problem to work through the complete design process
              </p>
            </div>

            <div className="grid gap-4">
              {problems.map(problem => (
                <button
                  key={problem.id}
                  onClick={() => {
                    setSelectedProblem(problem.id);
                    loadTemplate(problem.id);
                  }}
                  className={`p-6 text-left border rounded-xl transition-all ${
                    selectedProblem === problem.id
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-2 ring-indigo-200 dark:ring-indigo-800'
                      : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                      {problem.title}
                    </h4>
                    <div className="flex gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        problem.complexity === 'Easy' ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300' :
                        problem.complexity === 'Medium' ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' :
                        'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                      }`}>
                        {problem.complexity}
                      </span>
                      <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded text-xs">
                        {problem.estimatedTime}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-neutral-600 dark:text-neutral-400 mb-4">
                    {problem.description}
                  </p>
                  
                  <div className="flex flex-wrap gap-2">
                    {problem.keyFeatures.map(feature => (
                      <span key={feature} className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded text-xs">
                        {feature}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>

            {selectedProblem && (
              <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                  <span>✓</span>
                  <span className="font-medium">Problem selected! Template loaded with starter requirements and components.</span>
                </div>
              </div>
            )}
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                Define Requirements
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400">
                Clarify what the system should do and how well it should perform
              </p>
            </div>

            {/* Functional Requirements */}
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
                Functional Requirements
              </h4>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                What should the system do? (Features and capabilities)
              </p>
              
              <div className="space-y-2">
                {session.functionalRequirements.map((req, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <span className="flex-1 text-green-800 dark:text-green-200">{req}</span>
                    <button
                      onClick={() => removeRequirement('functional', index)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add functional requirement..."
                  className="flex-1 p-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addRequirement('functional', e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <button
                  onClick={(e) => {
                    const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                    addRequirement('functional', input.value);
                    input.value = '';
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Non-Functional Requirements */}
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
                Non-Functional Requirements
              </h4>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                How well should the system perform? (Scale, performance, reliability)
              </p>
              
              <div className="space-y-2">
                {session.nonFunctionalRequirements.map((req, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <span className="flex-1 text-blue-800 dark:text-blue-200">{req}</span>
                    <button
                      onClick={() => removeRequirement('nonFunctional', index)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add non-functional requirement..."
                  className="flex-1 p-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addRequirement('nonFunctional', e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <button
                  onClick={(e) => {
                    const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                    addRequirement('nonFunctional', input.value);
                    input.value = '';
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                Capacity Estimation
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400">
                Calculate the scale and resources needed for your system
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Daily Active Users
                  </label>
                  <input
                    type="number"
                    value={session.capacity.users}
                    onChange={(e) => setSession(prev => ({
                      ...prev,
                      capacity: { ...prev.capacity, users: Number(e.target.value) }
                    }))}
                    className="w-full p-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Peak Requests per Second
                  </label>
                  <input
                    type="number"
                    value={session.capacity.requestsPerSecond}
                    onChange={(e) => setSession(prev => ({
                      ...prev,
                      capacity: { ...prev.capacity, requestsPerSecond: Number(e.target.value) }
                    }))}
                    className="w-full p-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Data Volume per Day
                  </label>
                  <input
                    type="text"
                    value={session.capacity.dataPerDay}
                    onChange={(e) => setSession(prev => ({
                      ...prev,
                      capacity: { ...prev.capacity, dataPerDay: e.target.value }
                    }))}
                    className="w-full p-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Total Storage Needed
                  </label>
                  <input
                    type="text"
                    value={session.capacity.storage}
                    onChange={(e) => setSession(prev => ({
                      ...prev,
                      capacity: { ...prev.capacity, storage: e.target.value }
                    }))}
                    className="w-full p-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800"
                  />
                </div>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">Capacity Calculation Tips</h4>
              <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                <li>• Peak traffic is typically 3-5x average traffic</li>
                <li>• Plan for 2-3 years of growth (100% year-over-year is common)</li>
                <li>• Consider read/write ratios (social media: 100:1, chat: 1:1)</li>
                <li>• Factor in data replication and backups (3x storage multiplier)</li>
                <li>• Add 20-30% buffer for unexpected spikes</li>
              </ul>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                API Design
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400">
                Define the core APIs that will power your system
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">API Endpoints</h4>
              
              <div className="space-y-3">
                {session.apiDesign.endpoints.map((endpoint, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      endpoint.method === 'GET' ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300' :
                      endpoint.method === 'POST' ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' :
                      endpoint.method === 'PUT' ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' :
                      endpoint.method === 'DELETE' ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300' :
                      'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                    }`}>
                      {endpoint.method}
                    </span>
                    <code className="font-mono text-sm text-neutral-700 dark:text-neutral-300">
                      {endpoint.path}
                    </code>
                    <span className="flex-1 text-sm text-neutral-600 dark:text-neutral-400">
                      {endpoint.description}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
                <h5 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">Add New Endpoint</h5>
                <div className="grid grid-cols-4 gap-3">
                  <select
                    id="method"
                    className="p-2 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-sm"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                    <option value="WebSocket">WebSocket</option>
                  </select>
                  <input
                    id="path"
                    type="text"
                    placeholder="/api/path"
                    className="p-2 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-sm"
                  />
                  <input
                    id="description"
                    type="text"
                    placeholder="Description"
                    className="col-span-2 p-2 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-sm"
                  />
                </div>
                <button
                  onClick={() => {
                    const method = (document.getElementById('method') as HTMLSelectElement).value;
                    const path = (document.getElementById('path') as HTMLInputElement).value;
                    const description = (document.getElementById('description') as HTMLInputElement).value;
                    if (method && path && description) {
                      addEndpoint(method, path, description);
                      (document.getElementById('path') as HTMLInputElement).value = '';
                      (document.getElementById('description') as HTMLInputElement).value = '';
                    }
                  }}
                  className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                >
                  Add Endpoint
                </button>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                System Components
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400">
                Identify and organize the key components of your system
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">Current Components</h4>
              
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {session.components.map((component, index) => (
                  <div key={index} className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg text-center">
                    <span className="text-sm font-medium text-indigo-800 dark:text-indigo-200">
                      {component}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg">
                <h5 className="font-medium text-neutral-900 dark:text-neutral-100 mb-3">Component Categories</h5>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong className="text-neutral-900 dark:text-neutral-100">Frontend & API:</strong>
                    <p className="text-neutral-600 dark:text-neutral-400">user, api, balancer, cdn</p>
                  </div>
                  <div>
                    <strong className="text-neutral-900 dark:text-neutral-100">Services:</strong>
                    <p className="text-neutral-600 dark:text-neutral-400">auth-service, user-service, chat-service</p>
                  </div>
                  <div>
                    <strong className="text-neutral-900 dark:text-neutral-100">Data Layer:</strong>
                    <p className="text-neutral-600 dark:text-neutral-400">database, cache, search</p>
                  </div>
                  <div>
                    <strong className="text-neutral-900 dark:text-neutral-100">Infrastructure:</strong>
                    <p className="text-neutral-600 dark:text-neutral-400">queue, monitor, notification-service</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={exportToWhiteboard}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                >
                  Open in Whiteboard →
                </button>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                Trade-offs & Analysis
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400">
                Analyze key architectural decisions and their implications
              </p>
            </div>

            <div className="space-y-6">
              {session.tradeoffs.map((tradeoff, index) => (
                <div key={index} className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-6">
                  <h4 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">
                    {tradeoff.decision}
                  </h4>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="font-medium text-green-700 dark:text-green-400 mb-2">Pros</h5>
                      <ul className="space-y-1">
                        {tradeoff.pros.map((pro, i) => (
                          <li key={i} className="text-sm text-green-600 dark:text-green-300 flex items-start gap-2">
                            <span className="text-green-500 mt-1">+</span>
                            {pro}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h5 className="font-medium text-red-700 dark:text-red-400 mb-2">Cons</h5>
                      <ul className="space-y-1">
                        {tradeoff.cons.map((con, i) => (
                          <li key={i} className="text-sm text-red-600 dark:text-red-300 flex items-start gap-2">
                            <span className="text-red-500 mt-1">-</span>
                            {con}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}

              <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-6">
                <h4 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">
                  Key Design Decisions for {session.problem}
                </h4>
                
                <div className="space-y-4">
                  {selectedProblem === 'chat-system' && (
                    <>
                      <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                        <h5 className="font-medium mb-2">WebSocket vs Polling for Real-time Messages</h5>
                        <div className="text-sm text-neutral-600 dark:text-neutral-400">
                          <strong>Decision:</strong> WebSocket for persistent connections
                          <br /><strong>Why:</strong> Lower latency, reduced server load, true real-time experience
                          <br /><strong>Trade-off:</strong> More complex connection management vs simpler HTTP polling
                        </div>
                      </div>
                      
                      <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                        <h5 className="font-medium mb-2">Message Storage: SQL vs NoSQL</h5>
                        <div className="text-sm text-neutral-600 dark:text-neutral-400">
                          <strong>Decision:</strong> Hybrid approach - SQL for metadata, NoSQL for message content
                          <br /><strong>Why:</strong> SQL for relationships, NoSQL for horizontal scaling of message volume
                          <br /><strong>Trade-off:</strong> System complexity vs optimal performance for each data type
                        </div>
                      </div>
                    </>
                  )}

                  {selectedProblem === 'url-shortener' && (
                    <>
                      <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                        <h5 className="font-medium mb-2">Short Code Generation: Random vs Sequential</h5>
                        <div className="text-sm text-neutral-600 dark:text-neutral-400">
                          <strong>Decision:</strong> Base62 encoding of incremental ID
                          <br /><strong>Why:</strong> Predictable length, no collisions, good distribution
                          <br /><strong>Trade-off:</strong> Slightly predictable vs completely random but collision-prone
                        </div>
                      </div>
                      
                      <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                        <h5 className="font-medium mb-2">Caching Strategy for Redirects</h5>
                        <div className="text-sm text-neutral-600 dark:text-neutral-400">
                          <strong>Decision:</strong> Multi-layer cache (Redis + CDN)
                          <br /><strong>Why:</strong> 100:1 read/write ratio justifies aggressive caching
                          <br /><strong>Trade-off:</strong> Cache invalidation complexity vs redirect performance
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="text-center">
                <div className="inline-flex gap-4">
                  <button
                    onClick={exportToWhiteboard}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                  >
                    Visualize Design
                  </button>
                  <Link
                    href="/tools"
                    className="px-6 py-3 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 font-medium"
                  >
                    Validate with Tools
                  </Link>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <main className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <Link href="/workshop" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
          ← Back to Design Workshop
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
          System Design Workshop
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400">
          Complete guided process from requirements to architecture with real system design problems.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4 overflow-x-auto">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`flex items-center ${index < steps.length - 1 ? 'flex-1' : ''} min-w-0`}
            >
              <div className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-medium ${
                index <= currentStep
                  ? 'bg-indigo-600 text-white'
                  : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400'
              }`}>
                {index < currentStep ? '✓' : step.icon}
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
            {steps[currentStep]?.title}
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
          disabled={currentStep === steps.length - 1 || (currentStep === 0 && !selectedProblem)}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {currentStep === steps.length - 1 ? 'Complete' : 'Next'}
        </button>
      </div>
    </main>
  );
}