'use client';

import { useState, useEffect } from 'react';
import {
  PageSection,
  QAPairsContent,
  BulletListContent,
  QAPairsSettings,
  BulletListSettings,
  BulletListTypeOption
} from '@/lib/project-data-model';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Icons
import {
  Plus, Trash2, MessageSquare, List, FileText, Code, CheckSquare,
  Calendar, BarChart, Link, Layers, Settings as SettingsIcon,
  Star, Heart, Zap, Target, Lightbulb, Flag, Database, Users,
  Globe, Shield, Lock, Cpu, Cloud, Box, Package, Briefcase,
  BookOpen, ClipboardList, Workflow, GitBranch, Activity, Bell,
  AlertCircle, Info, CheckCircle, XCircle, TrendingUp, PieChart,
  Filter, Search, Eye, Edit, Download, Upload, RefreshCw, Archive
} from 'lucide-react';

interface SectionSettingsDialogProps {
  section: PageSection;
  onUpdate: (updates: Partial<PageSection>) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Available icons for sections - organized by category
const SECTION_ICONS = [
  // Communication & Content
  { key: 'MessageSquare', label: 'Q&A', component: MessageSquare },
  { key: 'FileText', label: 'Text', component: FileText },
  { key: 'BookOpen', label: 'Book', component: BookOpen },
  { key: 'List', label: 'List', component: List },
  { key: 'ClipboardList', label: 'Clipboard', component: ClipboardList },

  // Technical
  { key: 'Code', label: 'Code', component: Code },
  { key: 'Database', label: 'Database', component: Database },
  { key: 'Cpu', label: 'CPU', component: Cpu },
  { key: 'Cloud', label: 'Cloud', component: Cloud },
  { key: 'Globe', label: 'Globe', component: Globe },
  { key: 'GitBranch', label: 'Git', component: GitBranch },
  { key: 'Workflow', label: 'Workflow', component: Workflow },

  // Organization
  { key: 'Layers', label: 'Architecture', component: Layers },
  { key: 'Box', label: 'Box', component: Box },
  { key: 'Package', label: 'Package', component: Package },
  { key: 'Archive', label: 'Archive', component: Archive },

  // Status & Actions
  { key: 'CheckSquare', label: 'Checklist', component: CheckSquare },
  { key: 'CheckCircle', label: 'Check', component: CheckCircle },
  { key: 'XCircle', label: 'Cancel', component: XCircle },
  { key: 'AlertCircle', label: 'Alert', component: AlertCircle },
  { key: 'Info', label: 'Info', component: Info },
  { key: 'Bell', label: 'Notification', component: Bell },

  // Analytics & Metrics
  { key: 'BarChart', label: 'Bar Chart', component: BarChart },
  { key: 'PieChart', label: 'Pie Chart', component: PieChart },
  { key: 'TrendingUp', label: 'Trending', component: TrendingUp },
  { key: 'Activity', label: 'Activity', component: Activity },

  // Special Purpose
  { key: 'Star', label: 'Important', component: Star },
  { key: 'Heart', label: 'Favorite', component: Heart },
  { key: 'Zap', label: 'Quick', component: Zap },
  { key: 'Target', label: 'Goal', component: Target },
  { key: 'Lightbulb', label: 'Ideas', component: Lightbulb },
  { key: 'Flag', label: 'Flag', component: Flag },

  // People & Security
  { key: 'Users', label: 'Users', component: Users },
  { key: 'Briefcase', label: 'Business', component: Briefcase },
  { key: 'Shield', label: 'Security', component: Shield },
  { key: 'Lock', label: 'Lock', component: Lock },

  // Tools & Actions
  { key: 'Calendar', label: 'Timeline', component: Calendar },
  { key: 'Link', label: 'Links', component: Link },
  { key: 'SettingsIcon', label: 'Settings', component: SettingsIcon },
  { key: 'Filter', label: 'Filter', component: Filter },
  { key: 'Search', label: 'Search', component: Search },
  { key: 'Eye', label: 'View', component: Eye },
  { key: 'Edit', label: 'Edit', component: Edit },
  { key: 'Download', label: 'Download', component: Download },
  { key: 'Upload', label: 'Upload', component: Upload },
  { key: 'RefreshCw', label: 'Refresh', component: RefreshCw },
];

export function SectionSettingsDialog({
  section,
  onUpdate,
  open,
  onOpenChange
}: SectionSettingsDialogProps) {
  const [formData, setFormData] = useState<any>({});

  // Initialize form data when dialog opens
  useEffect(() => {
    if (open) {
      // Common section settings
      const commonSettings = {
        sectionTitle: section.title,
        customIcon: section.settings.customIcon || '',
      };

      if (section.content.type === 'qa-pairs') {
        const content = section.content as QAPairsContent;
        setFormData({
          ...commonSettings,
          sectionDescription: content.settings.sectionDescription || '',
          questionLabel: content.settings.questionLabel,
          answerLabel: content.settings.answerLabel,
          maxPairs: content.settings.maxPairs || 20
        });
      } else if (section.content.type === 'bullet-list') {
        const content = section.content as BulletListContent;
        setFormData({
          ...commonSettings,
          sectionDescription: content.settings.sectionDescription || '',
          typeOptions: [...content.settings.typeOptions],
          allowQuickAdd: content.settings.allowQuickAdd,
          showDescriptions: content.settings.showDescriptions
        });
      }
    }
  }, [open, section]);

  const handleSave = () => {
    // Common section updates
    const sectionUpdates = {
      title: formData.sectionTitle,
      settings: {
        ...section.settings,
        customIcon: formData.customIcon
      }
    };

    if (section.content.type === 'qa-pairs') {
      const content = section.content as QAPairsContent;
      const updatedContent: QAPairsContent = {
        ...content,
        settings: {
          ...content.settings,
          sectionTitle: formData.sectionTitle,
          sectionDescription: formData.sectionDescription,
          questionLabel: formData.questionLabel,
          answerLabel: formData.answerLabel,
          maxPairs: formData.maxPairs
        }
      };
      onUpdate({ ...sectionUpdates, content: updatedContent });
    } else if (section.content.type === 'bullet-list') {
      const content = section.content as BulletListContent;
      const updatedContent: BulletListContent = {
        ...content,
        settings: {
          ...content.settings,
          sectionTitle: formData.sectionTitle,
          sectionDescription: formData.sectionDescription,
          typeOptions: formData.typeOptions,
          allowQuickAdd: formData.allowQuickAdd,
          showDescriptions: formData.showDescriptions
        }
      };
      onUpdate({ ...sectionUpdates, content: updatedContent });
    }
    onOpenChange(false);
  };

  const addTypeOption = () => {
    if (section.content.type === 'bullet-list') {
      const newOption: BulletListTypeOption = {
        key: `category${formData.typeOptions.length + 1}`,
        label: `Category ${formData.typeOptions.length + 1}`,
        color: 'blue',
        description: ''
      };
      setFormData({
        ...formData,
        typeOptions: [...formData.typeOptions, newOption]
      });
    }
  };

  const updateTypeOption = (index: number, updates: Partial<BulletListTypeOption>) => {
    const updatedOptions = [...formData.typeOptions];
    updatedOptions[index] = { ...updatedOptions[index], ...updates };
    setFormData({ ...formData, typeOptions: updatedOptions });
  };

  const removeTypeOption = (index: number) => {
    const updatedOptions = formData.typeOptions.filter((_: any, i: number) => i !== index);
    setFormData({ ...formData, typeOptions: updatedOptions });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Section Settings</DialogTitle>
          <DialogDescription>
            Configure the labels, categories, and behavior for this section.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Common Settings */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="section-title">Section Title</Label>
              <Input
                id="section-title"
                value={formData.sectionTitle || ''}
                onChange={(e) => setFormData({ ...formData, sectionTitle: e.target.value })}
                placeholder="Enter section title..."
              />
            </div>

            <div>
              <Label htmlFor="section-icon">Section Icon</Label>
              <div className="grid grid-cols-10 gap-2 p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-900/50 max-h-[300px] overflow-y-auto">
                {SECTION_ICONS.map((icon) => {
                  const IconComponent = icon.component;
                  const isSelected = formData.customIcon === icon.key;
                  return (
                    <button
                      key={icon.key}
                      type="button"
                      onClick={() => setFormData({ ...formData, customIcon: icon.key })}
                      className={`p-3 rounded-lg border-2 transition-all hover:scale-105 ${
                        isSelected
                          ? 'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-500 text-indigo-700 dark:text-indigo-400 shadow-md'
                          : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
                      }`}
                      title={icon.label}
                    >
                      <IconComponent className="w-5 h-5 mx-auto" />
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, customIcon: '' })}
                  className={`p-3 rounded-lg border-2 transition-all hover:scale-105 ${
                    !formData.customIcon
                      ? 'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-500 text-indigo-700 dark:text-indigo-400 shadow-md'
                      : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
                  }`}
                  title="No Icon"
                >
                  <span className="text-xs font-medium">None</span>
                </button>
              </div>
              {formData.customIcon && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                  Selected: {SECTION_ICONS.find(i => i.key === formData.customIcon)?.label}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="section-description">Section Description</Label>
              <Textarea
                id="section-description"
                value={formData.sectionDescription || ''}
                onChange={(e) => setFormData({ ...formData, sectionDescription: e.target.value })}
                placeholder="Enter section description..."
                rows={2}
              />
            </div>
          </div>

          {/* Q&A Pairs Settings */}
          {section.content.type === 'qa-pairs' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Q&A Configuration</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="question-label">Question Label</Label>
                  <Input
                    id="question-label"
                    value={formData.questionLabel || ''}
                    onChange={(e) => setFormData({ ...formData, questionLabel: e.target.value })}
                    placeholder="e.g., Candidate Question"
                  />
                </div>
                <div>
                  <Label htmlFor="answer-label">Answer Label</Label>
                  <Input
                    id="answer-label"
                    value={formData.answerLabel || ''}
                    onChange={(e) => setFormData({ ...formData, answerLabel: e.target.value })}
                    placeholder="e.g., Interviewer Answer"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="max-pairs">Maximum Number of Pairs</Label>
                <Input
                  id="max-pairs"
                  type="number"
                  value={formData.maxPairs || 20}
                  onChange={(e) => setFormData({ ...formData, maxPairs: parseInt(e.target.value) })}
                  min="1"
                  max="50"
                />
              </div>
            </div>
          )}

          {/* Bullet List Settings */}
          {section.content.type === 'bullet-list' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Category Configuration</h3>
              <div className="space-y-3">
                {formData.typeOptions?.map((option: BulletListTypeOption, index: number) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Category {index + 1}</h4>
                      {formData.typeOptions.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTypeOption(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label>Key</Label>
                        <Input
                          value={option.key}
                          onChange={(e) => updateTypeOption(index, { key: e.target.value })}
                          placeholder="category-key"
                        />
                      </div>
                      <div>
                        <Label>Label</Label>
                        <Input
                          value={option.label}
                          onChange={(e) => updateTypeOption(index, { label: e.target.value })}
                          placeholder="Category Label"
                        />
                      </div>
                      <div>
                        <Label>Color</Label>
                        <select
                          value={option.color}
                          onChange={(e) => updateTypeOption(index, { color: e.target.value })}
                          className="w-full p-2 border border-gray-300 rounded-md"
                        >
                          <option value="blue">Blue</option>
                          <option value="green">Green</option>
                          <option value="red">Red</option>
                          <option value="orange">Orange</option>
                          <option value="purple">Purple</option>
                          <option value="gray">Gray</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
                <Button onClick={addTypeOption} variant="outline" className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Category
                </Button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="allow-quick-add"
                    checked={formData.allowQuickAdd}
                    onCheckedChange={(checked) => setFormData({ ...formData, allowQuickAdd: checked })}
                  />
                  <Label htmlFor="allow-quick-add">Allow quick adding of items</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="show-descriptions"
                    checked={formData.showDescriptions}
                    onCheckedChange={(checked) => setFormData({ ...formData, showDescriptions: checked })}
                  />
                  <Label htmlFor="show-descriptions">Show item descriptions</Label>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}