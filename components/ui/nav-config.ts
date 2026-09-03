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

// Keep the navigation identical during server rendering and browser hydration.
// NODE_ENV is replaced consistently in both bundles; hostname checks are not.
const DEBUG_UI = process.env.NODE_ENV !== 'production';

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
      { label: 'Daily Learning Path', href: '/learn', icon: Target },
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


