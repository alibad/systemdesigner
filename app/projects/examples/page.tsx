'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, Filter, BookOpen, Clock, BarChart3 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ExampleMetadata {
  id: string;
  title: string;
  description: string;
  templateType: 'system_design' | 'ml_design' | 'genai_design';
  category: string;
  complexity: 'simple' | 'medium' | 'complex';
  estimatedDuration: string;
  tags: string[];
  author: string;
  version: string;
}

interface ExampleData {
  metadata: ExampleMetadata;
  // Full project data loaded on preview
}

export default function ExamplesGalleryPage() {
  const [examples, setExamples] = useState<ExampleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('all');
  const [selectedComplexity, setSelectedComplexity] = useState<string>('all');

  useEffect(() => {
    loadExamples();
  }, []);

  const loadExamples = async () => {
    try {
      // Load all example JSON files
      const exampleFiles = [
        // System Design (3)
        '/examples/system-design/instagram.json',
        '/examples/system-design/uber.json',
        '/examples/system-design/url-shortener.json',
        // ML Design (1)
        '/examples/ml-design/recommendation-engine.json',
        // GenAI Design (2)
        '/examples/genai-design/rag-chatbot.json',
        '/examples/genai-design/code-assistant.json',
      ];

      const loadedExamples = await Promise.all(
        exampleFiles.map(async (file) => {
          const response = await fetch(file);
          if (!response.ok) return null;
          return response.json();
        })
      );

      setExamples(loadedExamples.filter(Boolean));
    } catch (error) {
      console.error('Failed to load examples:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredExamples = examples.filter((example) => {
    const matchesSearch =
      example.metadata.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      example.metadata.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      example.metadata.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTemplate =
      selectedTemplate === 'all' || example.metadata.templateType === selectedTemplate;

    const matchesComplexity =
      selectedComplexity === 'all' || example.metadata.complexity === selectedComplexity;

    return matchesSearch && matchesTemplate && matchesComplexity;
  });

  const templateTypes = [
    { id: 'all', name: 'All Templates', color: 'neutral' },
    { id: 'system_design', name: 'System Design', color: 'blue' },
    { id: 'ml_design', name: 'ML Systems', color: 'purple' },
    { id: 'genai_design', name: 'GenAI Systems', color: 'green' },
  ];

  const complexityLevels = [
    { id: 'all', name: 'All Levels' },
    { id: 'simple', name: 'Simple', color: 'green' },
    { id: 'medium', name: 'Medium', color: 'yellow' },
    { id: 'complex', name: 'Complex', color: 'red' },
  ];

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'simple':
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'complex':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800';
    }
  };

  const getTemplateColor = (templateType: string) => {
    switch (templateType) {
      case 'system_design':
        return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
      case 'ml_design':
        return 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20';
      case 'genai_design':
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href="/projects"
                className="inline-flex items-center text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mb-2"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to Projects
              </Link>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Example Library
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Explore pre-built system design examples. Preview them read-only or clone to your projects to customize.
              </p>
            </div>
            <BookOpen className="w-12 h-12 text-indigo-600 dark:text-indigo-400" />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Search className="w-4 h-4 inline mr-2" />
                Search Examples
              </label>
              <input
                type="text"
                placeholder="Search by title, description, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            {/* Template Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Filter className="w-4 h-4 inline mr-2" />
                Template Type
              </label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Templates" />
                </SelectTrigger>
                <SelectContent>
                  {templateTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Complexity Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <BarChart3 className="w-4 h-4 inline mr-2" />
                Complexity
              </label>
              <Select value={selectedComplexity} onValueChange={setSelectedComplexity}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Levels" />
                </SelectTrigger>
                <SelectContent>
                  {complexityLevels.map((level) => (
                    <SelectItem key={level.id} value={level.id}>
                      {level.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Results Count */}
            <div className="flex items-end">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing <span className="font-semibold">{filteredExamples.length}</span> of{' '}
                <span className="font-semibold">{examples.length}</span> examples
              </p>
            </div>
          </div>
        </div>

        {/* Examples Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : filteredExamples.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No examples found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Try adjusting your filters or search query
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExamples.map((example) => (
              <Link
                key={example.metadata.id}
                href={`/projects/examples/${example.metadata.id}`}
                className="group bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-600 transition-all duration-200"
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {example.metadata.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {example.metadata.category}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">
                    {example.metadata.description}
                  </p>

                  {/* Metadata */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400 flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {example.metadata.estimatedDuration}
                      </span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium border ${getComplexityColor(
                          example.metadata.complexity
                        )}`}
                      >
                        {example.metadata.complexity.charAt(0).toUpperCase() +
                          example.metadata.complexity.slice(1)}
                      </span>
                    </div>
                  </div>

                  {/* Template Type Badge */}
                  <div className="mb-4">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getTemplateColor(
                        example.metadata.templateType
                      )}`}
                    >
                      {templateTypes.find((t) => t.id === example.metadata.templateType)?.name}
                    </span>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2">
                    {example.metadata.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded"
                      >
                        {tag}
                      </span>
                    ))}
                    {example.metadata.tags.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded">
                        +{example.metadata.tags.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600 rounded-b-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      by {example.metadata.author}
                    </span>
                    <span className="text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 font-medium">
                      View Example →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
