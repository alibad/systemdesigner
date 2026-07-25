/**
 * Fundamentals Navigation Configuration
 * Dynamically generated from content registry
 */

import { generateFundamentalsSidebarNav } from '@/lib/nav-generators';

export type FundamentalsNavItem = {
  label: string;
  href: string;
};

export type FundamentalsNavGroup = {
  title: string;
  items: FundamentalsNavItem[];
};

// Generate navigation from content registry (single source of truth)
export const FUNDAMENTALS_NAV: ReadonlyArray<FundamentalsNavGroup> = generateFundamentalsSidebarNav();