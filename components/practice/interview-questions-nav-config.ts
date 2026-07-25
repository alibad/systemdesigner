/**
 * Interview Questions Navigation Configuration
 * Generated from content registry
 */

import { generatePracticeNavConfig } from '@/lib/nav-generators';

export interface InterviewQuestionNavItem {
  label: string;
  href: string;
}

export interface InterviewQuestionNavGroup {
  title: string;
  items: InterviewQuestionNavItem[];
}

// Generate navigation from content registry
const interviewQuestionItems = generatePracticeNavConfig();

// Group by category using metadata from content registry
import { getContentById } from '@/lib/content-registry';

const getItemCategory = (href: string): string => {
  const id = href.replace('/practice/', 'practice-');
  const content = getContentById(id);
  return content?.category || 'Other';
};

// Create groups based on actual content categories
const categoryMap = new Map<string, InterviewQuestionNavItem[]>();

interviewQuestionItems.forEach(item => {
  const category = getItemCategory(item.href);

  // Map categories to user-friendly group names
  let groupName = 'Other Problems';
  if (category.includes('ML') || category.includes('machine-learning') ||
             ['recommendation-system', 'fraud-detection', 'ad-targeting', 'search-ranking',
              'computer-vision', 'feature-store', 'ml-duplicate-detection'].some(pattern => item.href.includes(pattern))) {
    groupName = 'ML System Problems';
  } else if (category.includes('GenAI') || category.includes('AI') || category.includes('generative') ||
             ['rag-system', 'ai-code-assistant', 'conversational-ai', 'content-moderation',
              'gmail-smart-compose', 'google-translate', 'image-captioning', 'face-generation',
              'image-synthesis', 'text-to-image', 'headshot-generation', 'text-to-video'].some(pattern => item.href.includes(pattern))) {
    groupName = 'GenAI System Problems';
  } else if (category.includes('Product') || item.href.includes('dataset-diversity-dashboard')) {
    groupName = 'Product Design Problems';
  }

  if (!categoryMap.has(groupName)) {
    categoryMap.set(groupName, []);
  }
  categoryMap.get(groupName)!.push(item);
});

// Convert to groups array
const interviewQuestionGroups: InterviewQuestionNavGroup[] = Array.from(categoryMap.entries()).map(([title, items]) => ({
  title,
  items
}));

// Export the interview questions navigation
export const INTERVIEW_QUESTIONS_NAV: InterviewQuestionNavGroup[] = interviewQuestionGroups.filter(group => group.items.length > 0);