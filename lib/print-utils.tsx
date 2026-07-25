/**
 * Print Utilities for All Content Types
 *
 * This module provides utilities to make any interactive content print-friendly:
 * - Tabbed interfaces
 * - Collapsible sections (accordions, toggles)
 * - Hidden/conditional content
 * - Code blocks and interactive elements
 *
 * AUTOMATIC PRINT HANDLING:
 * The global print styles in globals.css automatically handle most print scenarios:
 * - Expands all collapsed sections
 * - Hides toggle buttons and chevrons
 * - Shows hidden content
 * - Optimizes layout and spacing
 *
 * MANUAL USAGE (when needed):
 * Use the utilities in this file for custom components that need special print handling.
 */

import React from 'react';

/**
 * Hook to detect if content is being printed
 * Useful for conditional rendering of print-specific layouts
 */
export function usePrintDetection() {
  if (typeof window === 'undefined') return false;

  // Use CSS media query to detect print mode
  return window.matchMedia && window.matchMedia('print').matches;
}

/**
 * Generic component wrapper for print-friendly tabs
 *
 * Usage:
 * <PrintFriendlyTabs
 *   items={tabItems}
 *   activeIndex={selectedTab}
 *   renderTabContent={(item, index) => <div>Tab content</div>}
 *   renderPrintContent={(item, index) => <div>Print-optimized content</div>}
 * />
 */
interface PrintFriendlyTabsProps<T> {
  items: T[];
  activeIndex: number;
  renderTabContent: (item: T, index: number) => React.ReactNode;
  renderPrintContent: (item: T, index: number) => React.ReactNode;
  className?: string;
  printClassName?: string;
}

export function PrintFriendlyTabs<T>({
  items,
  activeIndex,
  renderTabContent,
  renderPrintContent,
  className = "",
  printClassName = "space-y-6"
}: PrintFriendlyTabsProps<T>) {
  return (
    <>
      {/* Interactive version for screen */}
      <div className={`print:hidden ${className}`}>
        {renderTabContent(items[activeIndex], activeIndex)}
      </div>

      {/* Print version - show all items expanded */}
      <div className={`hidden print:block ${printClassName}`}>
        {items.map((item, index) => (
          <div
            key={index}
            className="border-t border-gray-300 pt-4 first:border-t-0 first:pt-0 page-break-inside-avoid"
          >
            {renderPrintContent(item, index)}
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * CSS classes for common print optimizations
 */
export const printClasses = {
  // Hide element on print
  hideOnPrint: 'print:hidden',

  // Show element only on print
  showOnPrint: 'hidden print:block',

  // Avoid page breaks inside element
  keepTogether: 'page-break-inside-avoid break-inside-avoid',

  // Force page break before element
  pageBreakBefore: 'page-break-before-always break-before-page',

  // Print-optimized colors (black text, light backgrounds)
  printColors: 'print:text-black print:bg-white',

  // Print-optimized spacing
  printSpacing: 'print:space-y-4',

  // Print section separator
  printSeparator: 'print:border-t print:border-gray-300 print:pt-4 first:print:border-t-0 first:print:pt-0',

  // Force expand collapsed/hidden content on print
  expandOnPrint: 'print:!block print:!visible print:!opacity-100 print:!max-h-none',

  // Hide toggle buttons on print
  hideToggleOnPrint: 'print:!hidden',

  // Print-friendly section styling
  printSection: 'print:mb-6 print:border-b print:border-gray-300 print:pb-4 last:print:border-b-0'
} as const;

/**
 * Apply print-friendly styles to any element
 */
export function withPrintStyles(
  element: React.ReactElement,
  printOverrides?: Record<string, string>
): React.ReactElement {
  const defaultPrintStyles = {
    color: 'black',
    backgroundColor: 'white',
    border: '1px solid #ddd',
    ...printOverrides
  };

  return React.cloneElement(element, {
    style: {
      ...element.props.style,
      '@media print': defaultPrintStyles
    }
  });
}
