/**
 * Reference Navigation Configuration
 * 
 * This config is now generated from the content registry.
 * Kept for backward compatibility.
 */

import { 
  generateReferenceNavConfig, 
  generateReferenceNavigation,
  generateReferenceTopics,
  generateReferenceCategories
} from '@/lib/nav-generators';

// Legacy format for compatibility
export const REFERENCE_NAVIGATION = generateReferenceNavigation();
export const REFERENCE_TOPICS = generateReferenceTopics();
export const REFERENCE_CATEGORIES = generateReferenceCategories();

// Also export modern format
export const REFERENCE_NAV = generateReferenceNavConfig();