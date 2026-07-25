'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { CONTENT_REGISTRY } from '@/lib/content-registry';

/**
 * Simple client-side keyword processor that directly manipulates the DOM
 * This avoids the complex React component recursion issues
 */
export function ClientSideKeywordProcessor() {
  const pathname = usePathname();

  useEffect(() => {
    // Only process on lesson pages
    const wrapper = document.querySelector('[data-enable-linking="true"]');
    if (!wrapper) return;

    console.log('Processing keywords on client side...');

    // Generate mappings from content registry (much cleaner!)
    const techMappings: Record<string, string> = {};

    CONTENT_REGISTRY
      .filter(content => content.section === 'technology' && content.status === 'active')
      .forEach(content => {
        // Add the main title
        const cleanTitle = content.title.replace(/^(Apache|Amazon|Google|Microsoft|Facebook|Meta)\s+/i, '');
        techMappings[cleanTitle] = content.path;

        // Add first tag if different
        if (content.tags[0] && content.tags[0] !== cleanTitle) {
          techMappings[content.tags[0]] = content.path;
        }
      });

    console.log('Generated tech mappings:', Object.keys(techMappings).length, 'technologies');

    // Process text nodes in list items specifically
    const listItems = wrapper.querySelectorAll('li');

    listItems.forEach(li => {
      // Skip if already processed or contains links
      if (li.querySelector('a') || li.hasAttribute('data-processed')) return;

      let text = li.textContent || '';
      let html = li.innerHTML;
      let modified = false;

      Object.entries(techMappings).forEach(([tech, url]) => {
        if (text.includes(tech)) {
          const regex = new RegExp(`\\b${tech}\\b`, 'g');
          html = html.replace(regex,
            `<a href="${url}" class="bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:hover:bg-orange-900/30 px-1.5 py-0.5 rounded-md transition-colors">${tech}</a>`
          );
          modified = true;
        }
      });

      if (modified) {
        li.innerHTML = html;
        li.setAttribute('data-processed', 'true');
        console.log(`Linked technology names in: ${text}`);
      }
    });

  }, [pathname]);

  return null; // This component doesn't render anything
}