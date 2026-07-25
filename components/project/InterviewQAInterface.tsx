'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, MessageCircle, CheckCircle, Trash2, Edit3 } from 'lucide-react';

interface QAPair {
  id: string;
  question: string;
  answer: string;
  order: number;
}

interface Requirement {
  id: string;
  title: string;
  type: 'functional' | 'non-functional' | 'out-of-scope';
  description: string;
}

interface InterviewQAInterfaceProps {
  initialQAPairs?: QAPair[];
  initialRequirements?: Requirement[];
  onUpdate?: (data: { qaPairs: QAPair[]; requirements: Requirement[] }) => void;
  isEditable?: boolean;
}

export function InterviewQAInterface({
  initialQAPairs = [],
  initialRequirements = [],
  onUpdate,
  isEditable = true
}: InterviewQAInterfaceProps) {
  const [qaPairs, setQAPairs] = useState<QAPair[]>(initialQAPairs);
  const [requirements, setRequirements] = useState<Requirement[]>(initialRequirements);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newRequirement, setNewRequirement] = useState<{
    title: string;
    type: 'functional' | 'non-functional' | 'out-of-scope';
    description: string;
  }>({
    title: '',
    type: 'functional',
    description: ''
  });
  const [editingQA, setEditingQA] = useState<string | null>(null);
  const [editingReq, setEditingReq] = useState<string | null>(null);

  const addQAPair = () => {
    if (!newQuestion.trim() || !newAnswer.trim()) return;

    const newPair: QAPair = {
      id: `qa_${Date.now()}`,
      question: newQuestion.trim(),
      answer: newAnswer.trim(),
      order: qaPairs.length + 1
    };

    const updated = [...qaPairs, newPair];
    setQAPairs(updated);
    setNewQuestion('');
    setNewAnswer('');

    onUpdate?.({ qaPairs: updated, requirements });
  };

  const deleteQAPair = (id: string) => {
    const updated = qaPairs.filter(pair => pair.id !== id);
    setQAPairs(updated);
    onUpdate?.({ qaPairs: updated, requirements });
  };

  const updateQAPair = (id: string, updates: Partial<QAPair>) => {
    const updated = qaPairs.map(pair =>
      pair.id === id ? { ...pair, ...updates } : pair
    );
    setQAPairs(updated);
    onUpdate?.({ qaPairs: updated, requirements });
    setEditingQA(null);
  };

  const addRequirement = () => {
    if (!newRequirement.title.trim() || !newRequirement.description.trim()) return;

    const requirement: Requirement = {
      id: `req_${Date.now()}`,
      title: newRequirement.title.trim(),
      type: newRequirement.type,
      description: newRequirement.description.trim()
    };

    const updated = [...requirements, requirement];
    setRequirements(updated);
    setNewRequirement({ title: '', type: 'functional', description: '' });

    onUpdate?.({ qaPairs, requirements: updated });
  };

  const deleteRequirement = (id: string) => {
    const updated = requirements.filter(req => req.id !== id);
    setRequirements(updated);
    onUpdate?.({ qaPairs, requirements: updated });
  };

  const updateRequirement = (id: string, updates: Partial<Requirement>) => {
    const updated = requirements.map(req =>
      req.id === id ? { ...req, ...updates } : req
    );
    setRequirements(updated);
    onUpdate?.({ qaPairs, requirements: updated });
    setEditingReq(null);
  };

  const getRequirementsByType = (type: string) => {
    return requirements.filter(req => req.type === type);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'functional': return 'text-green-600 dark:text-green-400';
      case 'non-functional': return 'text-blue-600 dark:text-blue-400';
      case 'out-of-scope': return 'text-gray-600 dark:text-gray-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="space-y-8">
      {/* Interview Dialogue Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-blue-600" />
              Interview Dialogue
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
              Capture the conversation between interviewer and candidate
            </p>
          </div>
        </div>

        {/* Q&A Pairs */}
        <div className="space-y-4 mb-6">
          {qaPairs.map((pair, index) => (
            <div key={pair.id} className="space-y-3">
              {editingQA === pair.id ? (
                <div className="space-y-3 p-4 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <Input
                    value={pair.question}
                    onChange={(e) => updateQAPair(pair.id, { question: e.target.value })}
                    placeholder="Question..."
                  />
                  <Textarea
                    value={pair.answer}
                    onChange={(e) => updateQAPair(pair.id, { answer: e.target.value })}
                    placeholder="Answer..."
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setEditingQA(null)}>
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingQA(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Question */}
                  <div className="pl-4 border-l-4 border-blue-500 dark:border-blue-400 group relative">
                    <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">Candidate:</p>
                    <p className="text-gray-900 dark:text-gray-100">{pair.question}</p>
                    {isEditable && (
                      <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingQA(pair.id)}
                          className="h-6 w-6 p-0"
                        >
                          <Edit3 className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteQAPair(pair.id)}
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Answer */}
                  <div className="pl-4 border-l-4 border-green-500 dark:border-green-400">
                    <p className="font-medium text-green-700 dark:text-green-300 mb-1">Interviewer:</p>
                    <p className="text-gray-900 dark:text-gray-100">{pair.answer}</p>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add New Q&A */}
        {isEditable && (
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-white">Add New Q&A</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                  Candidate Question:
                </label>
                <Input
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="What is the expected throughput for this system?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-green-700 dark:text-green-300 mb-1">
                  Interviewer Answer:
                </label>
                <Textarea
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  placeholder="We expect about 10,000 requests per second during peak hours..."
                  rows={3}
                />
              </div>
              <Button onClick={addQAPair} disabled={!newQuestion.trim() || !newAnswer.trim()}>
                <Plus className="w-4 h-4 mr-2" />
                Add Q&A Pair
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Requirements Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Finalized Requirements
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
              Requirements derived from the interview dialogue
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Functional Requirements */}
          <div>
            <h4 className="font-medium mb-3 text-green-600 dark:text-green-400">Functional Requirements</h4>
            <div className="space-y-2">
              {getRequirementsByType('functional').map((req) => (
                <div key={req.id} className="group relative">
                  {editingReq === req.id ? (
                    <div className="space-y-2 p-3 border border-green-200 dark:border-green-800 rounded">
                      <Input
                        value={req.title}
                        onChange={(e) => updateRequirement(req.id, { title: e.target.value })}
                        placeholder="Requirement title..."
                      />
                      <Textarea
                        value={req.description}
                        onChange={(e) => updateRequirement(req.id, { description: e.target.value })}
                        placeholder="Requirement description..."
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => setEditingReq(null)}>Save</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingReq(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <span className="text-green-500 mr-2 mt-0.5">✓</span>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{req.title}</div>
                        {req.description && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{req.description}</div>
                        )}
                      </div>
                      {isEditable && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingReq(req.id)}
                            className="h-6 w-6 p-0"
                          >
                            <Edit3 className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteRequirement(req.id)}
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Non-Functional Requirements */}
          <div>
            <h4 className="font-medium mb-3 text-blue-600 dark:text-blue-400">Non-Functional Requirements</h4>
            <div className="space-y-2">
              {getRequirementsByType('non-functional').map((req) => (
                <div key={req.id} className="group relative">
                  {editingReq === req.id ? (
                    <div className="space-y-2 p-3 border border-blue-200 dark:border-blue-800 rounded">
                      <Input
                        value={req.title}
                        onChange={(e) => updateRequirement(req.id, { title: e.target.value })}
                        placeholder="Requirement title..."
                      />
                      <Textarea
                        value={req.description}
                        onChange={(e) => updateRequirement(req.id, { description: e.target.value })}
                        placeholder="Requirement description..."
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => setEditingReq(null)}>Save</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingReq(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <span className="text-blue-500 mr-2 mt-0.5">✓</span>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{req.title}</div>
                        {req.description && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{req.description}</div>
                        )}
                      </div>
                      {isEditable && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingReq(req.id)}
                            className="h-6 w-6 p-0"
                          >
                            <Edit3 className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteRequirement(req.id)}
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Out of Scope */}
        {getRequirementsByType('out-of-scope').length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 mb-6">
            <h4 className="font-medium mb-2 text-gray-700 dark:text-gray-300">Out of Scope</h4>
            <div className="space-y-1">
              {getRequirementsByType('out-of-scope').map((req) => (
                <div key={req.id} className="group relative flex items-start">
                  <span className="text-gray-400 mr-2">•</span>
                  <div className="flex-1">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{req.title}</span>
                    {req.description && (
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">{req.description}</div>
                    )}
                  </div>
                  {isEditable && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingReq(req.id)}
                        className="h-6 w-6 p-0"
                      >
                        <Edit3 className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteRequirement(req.id)}
                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add New Requirement */}
        {isEditable && (
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-white">Add New Requirement</h4>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Type:
                </label>
                <Select
                  value={newRequirement.type}
                  onValueChange={(value: 'functional' | 'non-functional' | 'out-of-scope') =>
                    setNewRequirement({ ...newRequirement, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select requirement type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="functional">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                        Functional
                      </div>
                    </SelectItem>
                    <SelectItem value="non-functional">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                        Non-Functional
                      </div>
                    </SelectItem>
                    <SelectItem value="out-of-scope">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-gray-500 rounded-full"></span>
                        Out of Scope
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title:
                </label>
                <Input
                  value={newRequirement.title}
                  onChange={(e) => setNewRequirement({ ...newRequirement, title: e.target.value })}
                  placeholder="Response time &lt; 1 second"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description:
                </label>
                <Input
                  value={newRequirement.description}
                  onChange={(e) => setNewRequirement({ ...newRequirement, description: e.target.value })}
                  placeholder="95th percentile latency"
                />
              </div>
            </div>
            <Button
              onClick={addRequirement}
              disabled={!newRequirement.title.trim() || !newRequirement.description.trim()}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Requirement
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}