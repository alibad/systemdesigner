'use client';

import React, { useState } from 'react';
import { ExportData, integrationActions, trackProgress } from '@/lib/integrations';

interface IntegrationActionsProps {
  data: ExportData;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  showAll?: boolean;
  onAction?: (action: string) => void;
}

export default function IntegrationActions({ 
  data, 
  variant = 'primary', 
  size = 'md', 
  showAll = true,
  onAction 
}: IntegrationActionsProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleAction = async (actionKey: string, actionFn: (data: ExportData) => void) => {
    setIsLoading(actionKey);
    onAction?.(actionKey);
    
    try {
      await actionFn(data);
      
      // Track usage for analytics
      trackProgress({
        section: 'integrations',
        item: `${data.source}_${actionKey}`,
        completed: true
      });
    } catch (error) {
      console.error(`Failed to execute ${actionKey}:`, error);
    } finally {
      setIsLoading(null);
    }
  };

  const baseClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  const variantClasses = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    secondary: 'border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
  };

  const buttonClass = `${baseClasses[size]} ${variantClasses[variant]} rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed`;

  if (!showAll) {
    // Show only primary action (whiteboard)
    const primaryAction = integrationActions[0];
    return (
      <button
        onClick={() => handleAction(primaryAction.key, primaryAction.action)}
        disabled={isLoading === primaryAction.key}
        className={buttonClass}
      >
        {isLoading === primaryAction.key ? 'Exporting...' : primaryAction.label}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {integrationActions.map((action) => (
        <button
          key={action.key}
          onClick={() => handleAction(action.key, action.action)}
          disabled={isLoading === action.key}
          className={buttonClass}
        >
          {isLoading === action.key ? 'Loading...' : action.label}
        </button>
      ))}
    </div>
  );
}

// Quick export button for common use case
interface QuickExportProps {
  data: ExportData;
  label?: string;
  className?: string;
}

export function QuickExportButton({ data, label = "Open in Whiteboard", className = "" }: QuickExportProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async () => {
    setIsLoading(true);
    try {
      const { exportToWhiteboard } = await import('@/lib/integrations');
      exportToWhiteboard(data);
      
      trackProgress({
        section: 'integrations',
        item: `${data.source}_quick_export`,
        completed: true
      });
    } catch (error) {
      console.error('Quick export failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isLoading}
      className={`inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 ${className}`}
    >
      {isLoading ? (
        <>
          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
          Exporting...
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}

// Progress indicator component
interface ProgressIndicatorProps {
  section: string;
  item: string;
  onComplete?: () => void;
}

export function ProgressIndicator({ section, item, onComplete }: ProgressIndicatorProps) {
  const [isCompleted, setIsCompleted] = useState(false);

  const handleComplete = () => {
    trackProgress({
      section,
      item,
      completed: true
    });
    setIsCompleted(true);
    onComplete?.();
  };

  if (isCompleted) {
    return (
      <div className="inline-flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Completed
      </div>
    );
  }

  return (
    <button
      onClick={handleComplete}
      className="inline-flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-green-600 dark:hover:text-green-400 text-sm transition-colors"
    >
      <div className="w-4 h-4 border-2 border-current rounded"></div>
      Mark as Complete
    </button>
  );
}

// Recommendation component
interface RecommendationCardProps {
  title: string;
  description: string;
  href: string;
  reason: string;
  onClick?: () => void;
}

export function RecommendationCard({ title, description, href, reason, onClick }: RecommendationCardProps) {
  return (
    <div 
      onClick={() => {
        onClick?.();
        window.location.href = href;
      }}
      className="p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-indigo-300 dark:hover:border-indigo-700 cursor-pointer transition-all hover:shadow-md"
    >
      <h4 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">{title}</h4>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">{description}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded">
          {reason}
        </span>
        <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}