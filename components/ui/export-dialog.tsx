'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, FileText, FileCode, File } from 'lucide-react';
import { Project as FlexibleProject, ProjectPage } from '@/lib/project-data-model';

interface ExportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle: string;
  project: FlexibleProject;
  pages: ProjectPage[];
}

type ExportFormat = 'markdown' | 'pdf' | 'google-docs';

export function ExportDialog({
  isOpen,
  onOpenChange,
  projectId,
  projectTitle,
  project,
  pages
}: ExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('markdown');
  const [isExporting, setIsExporting] = useState(false);

  const exportOptions = [
    {
      id: 'markdown',
      name: 'Markdown',
      description: 'Export as .md file for GitHub, Notion, or Confluence',
      icon: FileCode,
      available: true,
      features: [
        'Plain text formatting',
        'Universal compatibility',
        'Easy to edit and version control',
        'Perfect for documentation'
      ]
    },
    {
      id: 'pdf',
      name: 'PDF',
      description: 'Export as PDF for printing or formal documentation',
      icon: File,
      available: true, // ✅ Available!
      features: [
        'Professional formatting',
        'Print-ready document',
        'Locked formatting',
        'Universal viewing'
      ]
    }
  ];

  const handleExport = async () => {
    setIsExporting(true);

    try {
      // Load all pages with their sections from Firestore
      const { db } = await import('@/lib/firebase');
      const { collection, doc, getDocs } = await import('firebase/firestore');

      const pagesRef = collection(db, 'projects', projectId, 'pages');
      const pagesSnapshot = await getDocs(pagesRef);

      const allPages: ProjectPage[] = pagesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ProjectPage));

      const response = await fetch(`/api/projects/${projectId}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format: selectedFormat,
          project,
          pages: allPages
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Export failed');
      }

      // Get the filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');

      // Determine extension based on format
      let extension = 'md';
      if (selectedFormat === 'pdf') extension = 'pdf';

      let filename = `${projectTitle.toLowerCase().replace(/\s+/g, '-')}.${extension}`;

      if (contentDisposition) {
        // Parse: attachment; filename="project-name.md"
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, ''); // Remove quotes
        }
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Close dialog after successful export
      setTimeout(() => {
        onOpenChange(false);
        setIsExporting(false);
      }, 500);

    } catch (error: any) {
      console.error('Export error:', error);
      alert(`Export failed: ${error.message}`);
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Export Project</DialogTitle>
          <DialogDescription>
            Choose a format to export "{projectTitle}" and use it in your workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {exportOptions.map((option) => {
            const Icon = option.icon;
            return (
              <div
                key={option.id}
                onClick={() => option.available && setSelectedFormat(option.id as ExportFormat)}
                className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  selectedFormat === option.id
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : option.available
                    ? 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                    : 'border-neutral-200 dark:border-neutral-700 opacity-50 cursor-not-allowed'
                }`}
              >
                {!option.available && (
                  <div className="absolute top-2 right-2 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs px-2 py-1 rounded">
                    Coming Soon
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    selectedFormat === option.id
                      ? 'bg-indigo-100 dark:bg-indigo-900/40'
                      : 'bg-neutral-100 dark:bg-neutral-800'
                  }`}>
                    <Icon className={`w-5 h-5 ${
                      selectedFormat === option.id
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-neutral-600 dark:text-neutral-400'
                    }`} />
                  </div>

                  <div className="flex-1">
                    <div className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
                      {option.name}
                    </div>
                    <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                      {option.description}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {option.features.map((feature, index) => (
                        <span
                          key={index}
                          className="text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 px-2 py-1 rounded"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || !exportOptions.find(o => o.id === selectedFormat)?.available}
          >
            {isExporting ? (
              <>
                <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export {exportOptions.find(o => o.id === selectedFormat)?.name}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
