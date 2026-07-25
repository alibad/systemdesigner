'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebaseProjects } from '@/hooks/useFirebaseProjects';
import { ProjectTemplate } from '@/lib/project-data-model';

export default function CreateProjectPage() {
  const router = useRouter();
  const { createProject } = useFirebaseProjects();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [projectData, setProjectData] = useState({
    title: '',
    description: '',
    templateType: '' as ProjectTemplate,
    generateWithAI: true // Default to true for better UX
  });

  const projectTemplates = [
    {
      id: 'system_design',
      label: 'System Design',
      description: 'Traditional distributed systems (web apps, APIs, microservices)',
      icon: '🏗️',
      examples: 'URL shortener, chat systems, social media platforms'
    },
    {
      id: 'ml_design',
      label: 'ML System Design',
      description: 'Machine learning and data systems (recommendation, analytics)',
      icon: '🤖',
      examples: 'Recommendation engines, fraud detection, data pipelines'
    },
    {
      id: 'genai_design',
      label: 'GenAI System Design',
      description: 'Generative AI systems (RAG, chatbots, content generation)',
      icon: '✨',
      examples: 'ChatGPT-like systems, RAG applications, AI assistants'
    },
    {
      id: 'product_design',
      label: 'Product Design',
      description: 'End-to-end product development and design strategy',
      icon: '🎯',
      examples: 'Feature development, user experience design, product strategy'
    },
    {
      id: 'research',
      label: 'Research Project',
      description: 'Research and analysis projects with structured methodology',
      icon: '🔬',
      examples: 'Market research, technical analysis, feasibility studies'
    },
    {
      id: 'custom',
      label: 'Custom Project',
      description: 'Start with a blank slate for unique requirements',
      icon: '🛠️',
      examples: 'Flexible structure for any type of project'
    }
  ];


  const handleNext = () => {
    setStep(prev => prev + 1);
  };

  const handleBack = () => {
    setStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    if (!projectData.title || !projectData.description || !projectData.templateType) {
      alert('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    try {
      const newProject = await createProject(
        projectData.title,
        projectData.description,
        projectData.templateType,
        { generateWithAI: projectData.generateWithAI } // Pass AI generation flag
      );

      router.push(`/projects/${newProject.id}`);
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Failed to create project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-[1200px] mx-auto px-4 md:px-6 py-6">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/projects"
          className="inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mb-4"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Projects
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
              Create New Project
            </h1>
            <p className="text-lg text-neutral-600 dark:text-neutral-400">
              Describe your system idea and we'll guide you through architecting it step by step.
            </p>
          </div>
          <Link
            href="/projects/examples"
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Browse Examples
          </Link>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Step {step} of 2
          </span>
          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            {step === 1 ? 'Project Details' : 'Review & Create'}
          </span>
        </div>
        <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-2">
          <div
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(step / 2) * 100}%` }}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-8">
        {/* Step 1: Project Details */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={projectData.title}
                onChange={(e) => setProjectData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Video Streaming Platform, AI Chatbot System..."
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                Brief Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={projectData.description}
                onChange={(e) => setProjectData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what your system does and the problem it solves..."
                rows={3}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-3">
                Project Template <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {projectTemplates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => setProjectData(prev => ({ ...prev, templateType: template.id as ProjectTemplate }))}
                    className={`border-2 rounded-lg p-5 cursor-pointer transition-all ${
                      projectData.templateType === template.id
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{template.icon}</span>
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {template.label}
                      </div>
                    </div>
                    <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                      {template.description}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-500">
                      Examples: {template.examples}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Generation Toggle */}
            <div className="border-2 border-purple-200 dark:border-purple-800 rounded-lg p-6 bg-purple-50/50 dark:bg-purple-900/10">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/40 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">
                      Generate with AI
                    </h4>
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      Automatically populate your project with AI-generated content based on your description. Sections will be pre-filled with relevant requirements, architecture diagrams, and design considerations.
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={projectData.generateWithAI}
                    onChange={(e) => setProjectData(prev => ({ ...prev, generateWithAI: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-purple-600"></div>
                </label>
              </div>
            </div>

          </div>
        )}

        {/* Step 2: Review */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
                Project Summary
              </h3>

              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Project Name</div>
                  <div className="text-neutral-900 dark:text-neutral-100 font-medium">{projectData.title}</div>
                </div>

                <div>
                  <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Description</div>
                  <div className="text-neutral-900 dark:text-neutral-100">{projectData.description}</div>
                </div>

                <div>
                  <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Template</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">
                      {projectTemplates.find(t => t.id === projectData.templateType)?.icon}
                    </span>
                    <div className="text-neutral-900 dark:text-neutral-100">
                      {projectTemplates.find(t => t.id === projectData.templateType)?.label}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">AI Generation</div>
                  <div className="flex items-center gap-2">
                    {projectData.generateWithAI ? (
                      <>
                        <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span className="text-neutral-900 dark:text-neutral-100">Enabled - Content will be auto-generated</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="text-neutral-900 dark:text-neutral-100">Disabled - Start with blank sections</span>
                      </>
                    )}
                  </div>
                </div>

              </div>
            </div>

            <div className="border-2 border-dashed border-indigo-300 dark:border-indigo-700 rounded-lg p-6 bg-indigo-50/50 dark:bg-indigo-900/10">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/40 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-semibold text-indigo-900 dark:text-indigo-100 mb-2">
                    What's Next?
                  </h4>
                  <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-3">
                    Your project will be created with a structured template including organized pages and sections. You'll be able to:
                  </p>
                  <ul className="text-sm text-indigo-700 dark:text-indigo-300 space-y-1">
                    <li>• Work through pre-structured pages relevant to your template</li>
                    <li>• Add, remove, or customize sections with rich content editors</li>
                    <li>• Use whiteboards, code editors, checklists, and calculation tools</li>
                    <li>• Track progress on individual sections and overall completion</li>
                    <li>• Collaborate with team members and share your work</li>
                    <li>• Export your designs and documentation</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-800">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              step === 1
                ? 'text-neutral-400 cursor-not-allowed'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          {step < 2 ? (
            <button
              onClick={handleNext}
              disabled={!projectData.title || !projectData.description || !projectData.templateType}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Review Project
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-neutral-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  Create Project
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}