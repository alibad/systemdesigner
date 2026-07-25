/**
 * Technology Navigation Configuration
 * 
 * This config is now generated from the content registry.
 * The types are kept for compatibility, but the data comes from nav-generators.
 */

import { generateTechnologyNavConfig, type TechnologyNavItem, type TechnologyNavGroup } from '@/lib/nav-generators';

// Re-export types for compatibility
export type { TechnologyNavItem, TechnologyNavGroup };

// Generate navigation from content registry
export const TECHNOLOGY_NAV: ReadonlyArray<TechnologyNavGroup> = generateTechnologyNavConfig();