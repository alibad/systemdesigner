/**
 * ML Systems Navigation Configuration
 * Dynamically generated from content registry
 */

import { generateMLSystemsSidebarNav } from '@/lib/nav-generators';

export type MLSystemsNavItem = {
  label: string;
  href: string;
};

export type MLSystemsNavGroup = {
  title: string;
  items: MLSystemsNavItem[];
};

// Generate navigation from content registry (single source of truth)
export const ML_SYSTEMS_NAV: ReadonlyArray<MLSystemsNavGroup> = generateMLSystemsSidebarNav();