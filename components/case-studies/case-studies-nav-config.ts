/**
 * Case Studies Navigation Configuration
 * Generated from content registry
 */

import { generateCaseStudiesNavConfig } from '@/lib/nav-generators';

export interface CaseStudyNavItem {
  label: string;
  href: string;
}

export interface CaseStudyNavGroup {
  title: string;
  items: CaseStudyNavItem[];
}

// Generate navigation from content registry
const caseStudyItems = generateCaseStudiesNavConfig();

// Group by category for organization
const caseStudyGroups: CaseStudyNavGroup[] = [
  {
    title: 'GenAI Applications',
    items: caseStudyItems.filter(item =>
      item.href.includes('/gmail-smart-compose') ||
      item.href.includes('/openai-chatgpt') ||
      item.href.includes('/anthropic-constitutional-ai')
    )
  },
  {
    title: 'ML & AI Systems',
    items: caseStudyItems.filter(item =>
      item.href.includes('/spotify-recommendations') ||
      item.href.includes('/meta-feed-ranking') ||
      item.href.includes('/netflix-streaming') ||
      item.href.includes('/tesla-autopilot') ||
      item.href.includes('/mlops-production-pipeline') ||
      item.href.includes('/edge-ai-deployment')
    )
  },
  {
    title: 'Social & Messaging',
    items: caseStudyItems.filter(item =>
      item.href.includes('/instagram-photos') ||
      item.href.includes('/whatsapp-messaging') ||
      item.href.includes('/discord-communication') ||
      item.href.includes('/tiktok-video-platform')
    )
  },
  {
    title: 'Platform & Infrastructure',
    items: caseStudyItems.filter(item =>
      item.href.includes('/airbnb-search') ||
      item.href.includes('/uber-ridesharing') ||
      item.href.includes('/github-collaboration') ||
      item.href.includes('/zoom-video')
    )
  },
  {
    title: 'System Design Patterns',
    items: caseStudyItems.filter(item =>
      item.href.includes('/key-value-store') ||
      item.href.includes('/unique-id-generator') ||
      item.href.includes('/web-crawler')
    )
  }
];

// Export the case studies navigation
export const CASE_STUDIES_NAV: CaseStudyNavGroup[] = caseStudyGroups.filter(group => group.items.length > 0);