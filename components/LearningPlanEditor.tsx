"use client";

import { useState } from 'react';
import { FirebaseLearningPlan, getTopicContent } from '@/lib/firebase-learning-plans';
import { CONTENT_REGISTRY } from '@/lib/content-registry';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface LearningPlanEditorProps {
  plan: FirebaseLearningPlan;
  onSave: (updatedPlan: FirebaseLearningPlan) => void;
  onCancel: () => void;
}

export default function LearningPlanEditor({ plan, onSave, onCancel }: LearningPlanEditorProps) {
  const [editedPlan, setEditedPlan] = useState<FirebaseLearningPlan>({ ...plan });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const { addToast } = useToast();

  // Get available content that's not already in the plan
  const availableContent = CONTENT_REGISTRY.filter(content => 
    content.status === 'active' && 
    !editedPlan.topics.includes(content.id)
  );

  // Filter content based on search and section
  const filteredContent = availableContent.filter(content => {
    const matchesSearch = searchQuery === '' || 
      content.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      content.seo.metaDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
      content.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesSection = selectedSection === 'all' || content.section === selectedSection;
    
    return matchesSearch && matchesSection;
  });

  const sections = Array.from(new Set(CONTENT_REGISTRY.map(c => c.section)));

  const addTopic = (contentNode: typeof CONTENT_REGISTRY[0]) => {
    setEditedPlan(prev => ({
      ...prev,
      topics: [...prev.topics, contentNode.id]
    }));
  };

  const removeTopic = (contentId: string) => {
    setEditedPlan(prev => ({
      ...prev,
      topics: prev.topics.filter(topicId => topicId !== contentId)
    }));
  };

  const reorderTopic = (fromIndex: number, toIndex: number) => {
    const newTopics = [...editedPlan.topics];
    const [movedTopic] = newTopics.splice(fromIndex, 1);
    newTopics.splice(toIndex, 0, movedTopic);
    
    setEditedPlan(prev => ({
      ...prev,
      topics: newTopics
    }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      onSave(editedPlan);
      addToast({
        title: "Learning plan saved!",
        description: "Your changes have been successfully saved.",
        variant: "success",
        duration: 3000
      });
    } catch (error) {
      console.error('Error saving plan:', error);
      addToast({
        title: "Failed to save changes",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
        duration: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getSectionColor = (section: string) => {
    const colors = {
      fundamentals: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      genai: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'ml-systems': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      technology: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'case-studies': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
      practice: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      reference: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
      tools: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    };
    return colors[section as keyof typeof colors] || colors.fundamentals;
  };

  return (
    <div className="pb-8">
      {/* Content Container */}
      <div className="container mx-auto px-6">
        {/* Header Card */}
        <div className="sticky top-4 z-10 mb-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm shadow-lg p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Edit Learning Plan</h1>
              <p className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300">
                Customize your learning path by adding or removing topics
              </p>
            </div>
            <div className="flex gap-2 md:gap-3">
              <Button
                variant="outline"
                onClick={onCancel}
                className="flex-1 md:flex-none text-sm md:text-base"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isLoading}
                className="flex-1 md:flex-none text-sm md:text-base"
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>

          {/* Compact Plan Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plan-title" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Plan Title</Label>
              <Input
                id="plan-title"
                type="text"
                value={editedPlan.title}
                onChange={(e) => setEditedPlan(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter plan title..."
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan-description" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Description</Label>
              <Input
                id="plan-description"
                type="text"
                value={editedPlan.description}
                onChange={(e) => setEditedPlan(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your learning plan..."
                className="h-9 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-[450px_1fr] gap-4 md:gap-6">
          {/* Current Topics */}
          <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 flex flex-col max-h-[calc(100vh-200px)]">
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h3 className="text-lg font-semibold">
                  Current Topics ({editedPlan.topics.length})
                </h3>
                {editedPlan.topics.length > 0 && (
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    {Math.round(editedPlan.topics.reduce((acc, topicId) => {
                      const content = getTopicContent(topicId);
                      return acc + (content ? parseInt(content.duration) || 0 : 0);
                    }, 0) / 60)} hours total
                  </span>
                )}
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto pr-2 -mr-2 scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-700 scrollbar-track-transparent">
                {editedPlan.topics.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <svg className="w-16 h-16 text-neutral-300 dark:text-neutral-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">No topics yet</p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">Add topics from the right panel to build your plan</p>
                  </div>
                ) : (
                  editedPlan.topics.map((topicId, index) => {
              const content = getTopicContent(topicId);
              if (!content) return null;
              
              return (
                <div key={`${topicId}-${index}`} className="group flex items-start gap-3 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/50 hover:bg-neutral-100/50 dark:hover:bg-neutral-700/50 transition-colors">
                  <div className="flex flex-col gap-1 pt-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => index > 0 && reorderTopic(index, index - 1)}
                      disabled={index === 0}
                      className="w-7 h-7 hover:bg-neutral-200 dark:hover:bg-neutral-600"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                      </svg>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => index < editedPlan.topics.length - 1 && reorderTopic(index, index + 1)}
                      disabled={index === editedPlan.topics.length - 1}
                      className="w-7 h-7 hover:bg-neutral-200 dark:hover:bg-neutral-600"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </Button>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <h4 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 leading-tight">
                        {index + 1}. {content.title}
                      </h4>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTopic(topicId)}
                        className="w-7 h-7 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${getSectionColor(content.section)}`}>
                        {content.section}
                      </span>
                      <span className="text-xs text-neutral-500 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {content.duration}
                      </span>
                      <span className="text-xs text-neutral-500 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {content.level}
                      </span>
                      {content.hasQuiz && (
                        <span className="text-xs text-neutral-500 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Quiz
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Available Topics */}
            <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 flex flex-col max-h-[calc(100vh-200px)]">
              <div className="flex-shrink-0 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Add Topics</h3>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    {filteredContent.length} available
                  </span>
                </div>

                {/* Search and Filter - More compact */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="search-topics" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Search Topics</Label>
                    <Input
                      id="search-topics"
                      type="text"
                      placeholder="Search by title, tag, or description..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="filter-section" className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Filter by Section</Label>
                    <Select value={selectedSection} onValueChange={setSelectedSection}>
                      <SelectTrigger id="filter-section" className="h-9 text-sm">
                        <SelectValue placeholder="Select a section" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sections</SelectItem>
                        {sections.map(section => (
                          <SelectItem key={section} value={section}>
                            {section.charAt(0).toUpperCase() + section.slice(1).replace('-', ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Available Topics List */}
              <div className="flex-1 overflow-y-auto pr-2 -mr-2 scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-700 scrollbar-track-transparent">
                {filteredContent.length === 0 ? (
                  <p className="text-sm text-neutral-500 text-center py-4">
                    {searchQuery || selectedSection !== 'all' ? 'No topics match your search' : 'All topics are already in your plan'}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3">
                    {filteredContent.map((content) => (
                      <div key={content.id} className="group flex items-start gap-3 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600 transition-all hover:shadow-sm">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 leading-tight">
                            {content.title}
                          </h4>
                          <Button
                            size="icon"
                            onClick={() => addTopic(content)}
                            className="w-8 h-8 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-all hover:scale-105"
                            title="Add to plan"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                          </Button>
                        </div>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                          {content.seo.metaDescription}
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getSectionColor(content.section)}`}>
                            {content.section}
                          </span>
                          <span className="text-xs text-neutral-500 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {content.duration}
                          </span>
                          <span className="text-xs text-neutral-500 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {content.level}
                          </span>
                          {content.hasQuiz && (
                            <span className="text-xs text-neutral-500 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Quiz
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
