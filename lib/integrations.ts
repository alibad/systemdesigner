// Cross-feature integration utilities
import { useRouter } from 'next/navigation';

export interface ExportData {
  source: string;
  title: string;
  components?: string[];
  data?: any;
  note?: string;
}

// Export to whiteboard with standardized format
export function exportToWhiteboard(data: ExportData): void {
  try {
    const payload = {
      components: data.components || [],
      note: `${data.title} - Generated from ${data.source}`,
      metadata: {
        source: data.source,
        title: data.title,
        exportedAt: new Date().toISOString(),
        ...data.data
      }
    };
    
    localStorage.setItem('architecture-guide-components', JSON.stringify(payload));
    
    // Open whiteboard in new tab to preserve current context
    window.open('/whiteboard', '_blank');
  } catch (error) {
    console.error('Failed to export to whiteboard:', error);
    alert('Failed to export to whiteboard. Please try again.');
  }
}

// Export to projects with standardized format
export function exportToProject(data: ExportData): void {
  try {
    const projectData = {
      title: data.title,
      description: `Generated from ${data.source}`,
      type: 'distributed-system' as const,
      expectedUsers: '1M-10M' as const,
      components: data.components || [],
      notes: data.note || '',
      source: data.source,
      sourceData: data.data,
      createdAt: new Date().toISOString()
    };
    
    localStorage.setItem('project-import-data', JSON.stringify(projectData));
    
    // Open projects creation page
    window.open('/projects/create?import=true', '_blank');
  } catch (error) {
    console.error('Failed to export to project:', error);
    alert('Failed to export to project. Please try again.');
  }
}

// Save to browser for later access
export function saveForLater(data: ExportData): void {
  try {
    const saved = JSON.parse(localStorage.getItem('saved-designs') || '[]');
    const newSave = {
      id: `saved_${Date.now()}`,
      ...data,
      savedAt: new Date().toISOString()
    };
    
    saved.push(newSave);
    localStorage.setItem('saved-designs', JSON.stringify(saved));
    
    alert('Design saved! You can find it in your saved designs.');
  } catch (error) {
    console.error('Failed to save design:', error);
    alert('Failed to save design. Please try again.');
  }
}

// Get saved designs
export function getSavedDesigns(): (ExportData & { id: string; savedAt: string })[] {
  try {
    return JSON.parse(localStorage.getItem('saved-designs') || '[]');
  } catch (error) {
    console.error('Failed to load saved designs:', error);
    return [];
  }
}

// Share design (generate shareable link)
export function shareDesign(data: ExportData): string {
  try {
    const shareId = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const shareData = {
      id: shareId,
      ...data,
      sharedAt: new Date().toISOString()
    };
    
    localStorage.setItem(`share-${shareId}`, JSON.stringify(shareData));
    
    const shareUrl = `${window.location.origin}/share/${shareId}`;
    
    // Copy to clipboard if available
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        alert('Share link copied to clipboard!');
      });
    } else {
      prompt('Copy this link to share your design:', shareUrl);
    }
    
    return shareUrl;
  } catch (error) {
    console.error('Failed to generate share link:', error);
    alert('Failed to generate share link. Please try again.');
    return '';
  }
}

// Progress tracking utilities
// Re-export types from unified storage for compatibility
export type { ProgressData } from './unified-storage';
import { userStorage } from './unified-storage';

// Wrapper functions for backward compatibility
export async function trackProgress(progress: { section: string; item: string; completed: boolean; score?: number; timeSpent?: number }): Promise<void> {
  await userStorage.setProgress(progress.section, progress.item, {
    completed: progress.completed,
    score: progress.score,
    timeSpent: progress.timeSpent,
  });
}

export async function getProgress(section?: string): Promise<Record<string, any>> {
  return await userStorage.getProgress(section);
}

export function getOverallProgress(): {
  completed: number;
  total: number;
  bySection: Record<string, { completed: number; total: number }>;
} {
  try {
    const allProgress = getProgress();
    let totalCompleted = 0;
    let totalItems = 0;
    const bySection: Record<string, { completed: number; total: number }> = {};
    
    Object.entries(allProgress).forEach(([section, items]) => {
      const sectionItems = Object.values(items as any);
      const sectionCompleted = sectionItems.filter((item: any) => item.completed).length;
      
      bySection[section] = {
        completed: sectionCompleted,
        total: sectionItems.length
      };
      
      totalCompleted += sectionCompleted;
      totalItems += sectionItems.length;
    });
    
    return {
      completed: totalCompleted,
      total: totalItems,
      bySection
    };
  } catch (error) {
    console.error('Failed to calculate overall progress:', error);
    return { completed: 0, total: 0, bySection: {} };
  }
}

// Cross-feature recommendations
export function getRecommendedNextSteps(currentSection: string, completedItems: string[]): {
  title: string;
  description: string;
  href: string;
  reason: string;
}[] {
  const recommendations = [];
  
  // Logic for personalized recommendations based on current context
  if (currentSection === 'fundamentals' && completedItems.includes('scalability-basics')) {
    recommendations.push({
      title: 'Try the Load Testing Predictor',
      description: 'Apply your scalability knowledge with real calculations',
      href: '/tools/load-predictor',
      reason: 'Practice scalability concepts with interactive tools'
    });
  }
  
  if (currentSection === 'tools' && completedItems.length >= 2) {
    recommendations.push({
      title: 'Start a Design Workshop',
      description: 'Use your calculation skills in guided system design',
      href: '/workshop/architecture-decisions',
      reason: 'Combine tool insights with architectural decisions'
    });
  }
  
  if (currentSection === 'workshop' && completedItems.includes('architecture-decisions')) {
    recommendations.push({
      title: 'Practice with Interview Gym',
      description: 'Test your decision-making skills under time pressure',
      href: '/gym',
      reason: 'Apply workshop learnings in interview scenarios'
    });
  }
  
  if (currentSection === 'gym' && completedItems.length >= 1) {
    recommendations.push({
      title: 'Review Technology Comparisons',
      description: 'Deepen your knowledge of architectural trade-offs',
      href: '/reference',
      reason: 'Strengthen foundation for better interview performance'
    });
  }
  
  // Always suggest whiteboard for design work
  if (!recommendations.some(r => r.href.includes('whiteboard'))) {
    recommendations.push({
      title: 'Design on Whiteboard',
      description: 'Visualize your architectural ideas',
      href: '/whiteboard',
      reason: 'Practice visual system design communication'
    });
  }
  
  return recommendations.slice(0, 3); // Return top 3 recommendations
}

// Component export/integration buttons
export interface IntegrationButtonProps {
  data: ExportData;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  showAll?: boolean;
}

export const integrationActions = [
  { key: 'whiteboard', label: '→ Whiteboard', action: exportToWhiteboard },
  { key: 'project', label: '→ Project', action: exportToProject },
  { key: 'save', label: 'Save', action: saveForLater },
  { key: 'share', label: 'Share', action: shareDesign }
] as const;