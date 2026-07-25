// Utility functions for accessibility improvements

/**
 * Focus management utilities
 */
export const focusUtils = {
  /**
   * Get all focusable elements within a container
   */
  getFocusableElements: (container: HTMLElement): HTMLElement[] => {
    const focusableSelectors = [
      'a[href]:not([disabled])',
      'button:not([disabled])', 
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"]):not([disabled])',
      '[contenteditable]:not([contenteditable="false"])'
    ].join(', ');

    return Array.from(container.querySelectorAll(focusableSelectors));
  },

  /**
   * Check if an element is currently visible and not disabled
   */
  isElementFocusable: (element: HTMLElement): boolean => {
    if (element.hasAttribute('disabled') || element.getAttribute('tabindex') === '-1') {
      return false;
    }

    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0';
  },

  /**
   * Trap focus within a container
   */
  trapFocus: (container: HTMLElement, initialFocus?: HTMLElement): (() => void) => {
    const focusableElements = focusUtils.getFocusableElements(container)
      .filter(focusUtils.isElementFocusable);
    
    if (focusableElements.length === 0) return () => {};

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus the initial element or the first focusable element
    (initialFocus || firstElement).focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const activeElement = document.activeElement as HTMLElement;

      if (e.shiftKey) {
        // Shift + Tab: moving backwards
        if (activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: moving forwards
        if (activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  },

  /**
   * Save and restore focus for modals/overlays
   */
  createFocusManager: () => {
    let previousActiveElement: HTMLElement | null = null;

    return {
      save: () => {
        previousActiveElement = document.activeElement as HTMLElement;
      },
      restore: () => {
        if (previousActiveElement && document.contains(previousActiveElement)) {
          previousActiveElement.focus();
        }
      }
    };
  }
};

/**
 * ARIA utilities
 */
export const ariaUtils = {
  /**
   * Generate a unique ID for ARIA relationships
   */
  generateId: (prefix: string = 'aria'): string => {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Set ARIA expanded state
   */
  setExpanded: (trigger: HTMLElement, target: HTMLElement, expanded: boolean) => {
    trigger.setAttribute('aria-expanded', expanded.toString());
    target.setAttribute('aria-hidden', (!expanded).toString());
    
    if (expanded) {
      target.removeAttribute('inert');
    } else {
      target.setAttribute('inert', '');
    }
  },

  /**
   * Announce to screen readers
   */
  announce: (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', priority);
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only';
    announcer.textContent = message;
    
    document.body.appendChild(announcer);
    
    // Clean up after announcement
    setTimeout(() => {
      if (document.body.contains(announcer)) {
        document.body.removeChild(announcer);
      }
    }, 1000);
  }
};

/**
 * Color contrast utilities
 */
export const colorUtils = {
  /**
   * Calculate relative luminance of a color
   */
  getLuminance: (r: number, g: number, b: number): number => {
    const [rs, gs, bs] = [r, g, b].map(c => {
      const sRGB = c / 255;
      return sRGB <= 0.03928 
        ? sRGB / 12.92 
        : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  },

  /**
   * Calculate contrast ratio between two colors
   */
  getContrastRatio: (color1: [number, number, number], color2: [number, number, number]): number => {
    const lum1 = colorUtils.getLuminance(...color1);
    const lum2 = colorUtils.getLuminance(...color2);
    
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    
    return (brightest + 0.05) / (darkest + 0.05);
  },

  /**
   * Check if contrast ratio meets WCAG standards
   */
  meetsContrastStandard: (
    color1: [number, number, number], 
    color2: [number, number, number],
    level: 'AA' | 'AAA' = 'AA',
    isLargeText: boolean = false
  ): boolean => {
    const ratio = colorUtils.getContrastRatio(color1, color2);
    
    if (level === 'AAA') {
      return ratio >= (isLargeText ? 4.5 : 7);
    } else {
      return ratio >= (isLargeText ? 3 : 4.5);
    }
  }
};

/**
 * Keyboard navigation utilities
 */
export const keyboardUtils = {
  /**
   * Handle arrow key navigation in lists/menus
   */
  createArrowKeyHandler: (
    items: HTMLElement[],
    currentIndex: number,
    onChange: (newIndex: number) => void,
    options: {
      loop?: boolean;
      horizontal?: boolean;
      onEnter?: () => void;
      onEscape?: () => void;
    } = {}
  ) => {
    const { loop = true, horizontal = false, onEnter, onEscape } = options;

    return (e: KeyboardEvent) => {
      let newIndex = currentIndex;

      const nextKey = horizontal ? 'ArrowRight' : 'ArrowDown';
      const prevKey = horizontal ? 'ArrowLeft' : 'ArrowUp';

      switch (e.key) {
        case nextKey:
          e.preventDefault();
          newIndex = loop 
            ? (currentIndex + 1) % items.length
            : Math.min(currentIndex + 1, items.length - 1);
          break;
        
        case prevKey:
          e.preventDefault();
          newIndex = loop
            ? (currentIndex - 1 + items.length) % items.length
            : Math.max(currentIndex - 1, 0);
          break;
        
        case 'Home':
          e.preventDefault();
          newIndex = 0;
          break;
        
        case 'End':
          e.preventDefault();
          newIndex = items.length - 1;
          break;
        
        case 'Enter':
        case ' ':
          if (onEnter) {
            e.preventDefault();
            onEnter();
          }
          break;
        
        case 'Escape':
          if (onEscape) {
            e.preventDefault();
            onEscape();
          }
          break;
        
        default:
          return;
      }

      if (newIndex !== currentIndex) {
        onChange(newIndex);
        items[newIndex]?.focus();
      }
    };
  }
};

/**
 * Media query utilities for reduced motion and other preferences
 */
export const preferenceUtils = {
  /**
   * Check if user prefers reduced motion
   */
  prefersReducedMotion: (): boolean => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },

  /**
   * Check if user prefers high contrast
   */
  prefersHighContrast: (): boolean => {
    return window.matchMedia('(prefers-contrast: high)').matches;
  },

  /**
   * Check if user prefers dark color scheme
   */
  prefersDarkScheme: (): boolean => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  },

  /**
   * Listen for preference changes
   */
  onPreferenceChange: (
    preference: 'reduced-motion' | 'high-contrast' | 'color-scheme',
    callback: (matches: boolean) => void
  ): (() => void) => {
    const queries = {
      'reduced-motion': '(prefers-reduced-motion: reduce)',
      'high-contrast': '(prefers-contrast: high)',
      'color-scheme': '(prefers-color-scheme: dark)'
    };

    const mediaQuery = window.matchMedia(queries[preference]);
    const handler = (e: MediaQueryListEvent) => callback(e.matches);
    
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }
};