import type { ComponentType } from 'react';
import { BookOpen, Bot, BarChart3, Cpu, FileText, Target, Wrench, FolderOpen, PencilRuler } from 'lucide-react';

export type NavSubItem = {
  label: string;
  href: string;
};

export type NavItem = {
  label: string;
  href: string;
  subItems?: NavSubItem[];
  icon?: ComponentType<{ className?: string }>; // optional icon for top-level items
};

export type NavGroup = {
  label: string;
  items: ReadonlyArray<NavItem>;
};

// Debug flag to show in-progress sections when running locally
// We treat any non-production host (localhost or 127.0.0.1) as debug.
// This runs client and server side safely.
const isLocalHost = () => {
  if (typeof window !== 'undefined') {
    try {
      const h = window.location.hostname;
      return h === 'localhost' || h === '127.0.0.1';
    } catch {}
  }
  // On server, check common env markers
  const nodeEnv = process.env.NODE_ENV;
  const vercelEnv = process.env.VERCEL_ENV;
  return nodeEnv !== 'production' && vercelEnv !== 'production';
};
const DEBUG_UI = isLocalHost();

// Dynamic whiteboard navigation - returns sub-items for SideNav
export const getWhiteboardNavItems = (whiteboards: any[]): NavSubItem[] => {
  if (whiteboards.length === 0) {
    return [];
  }

  return whiteboards.slice(0, 5).map(wb => ({
    label: wb.title,
    href: `/whiteboard?id=${wb.id}`
  }));
};

// Build Do items according to requested IA
const DO_ITEMS: Array<NavItem> = [
  // Top priority: Whiteboard (will be replaced dynamically)
  { label: 'Whiteboard', href: '/whiteboard/manage', icon: PencilRuler },
  // Core experiences
  { label: 'Projects', href: '/projects', icon: FolderOpen },
  { label: 'Knowledge Quizzes', href: '/quiz', icon: BookOpen }
];

// Gate the experimental Design area (and Interview Gym) behind DEBUG_UI
if (DEBUG_UI) {
  DO_ITEMS.push({
    label: 'Design',
    href: '/tools',
    icon: Wrench,
    subItems: [
      { label: 'Interactive Tools', href: '/tools' },
      { label: 'Interview Gym', href: '/gym' },
      { label: 'Workshops', href: '/workshop' },
      { label: 'Patterns & Templates', href: '/patterns' }
    ]
  });
}

export const NAV_GROUPS: ReadonlyArray<NavGroup> = [
  {
    label: 'Learn',
    items: [
      { label: 'Fundamentals', href: '/fundamentals', icon: BookOpen },
      { label: 'GenAI Systems', href: '/genai', icon: Bot },
      { label: 'ML Systems', href: '/ml-systems', icon: BarChart3 },
      { label: 'Technology', href: '/technology', icon: Cpu },
      { label: 'Interview Questions', href: '/practice', icon: Target },
      { label: 'Case Studies', href: '/case-studies', icon: FileText },
      { label: 'Reference', href: '/reference', icon: FileText }
    ]
  },
  {
    label: 'Do',
    items: DO_ITEMS
  }
] as const;

// Backward compatibility - flatten groups into single array
export const NAV_ITEMS: ReadonlyArray<NavItem> = NAV_GROUPS.flatMap(group => group.items);


