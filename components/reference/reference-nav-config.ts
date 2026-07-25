/**
 * Reference Navigation Configuration
 * Dynamically generated from content registry
 */

import { generateReferenceNavConfig } from '@/lib/nav-generators';

export type ReferenceNavItem = {
  label: string;
  href: string;
};

export type ReferenceNavGroup = {
  title: string;
  items: ReferenceNavItem[];
};

// Generate navigation from content registry (single source of truth)
export const REFERENCE_NAV: ReadonlyArray<ReferenceNavGroup> = generateReferenceNavConfig();