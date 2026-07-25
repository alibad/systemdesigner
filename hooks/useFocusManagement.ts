import { useEffect, useRef, useCallback } from 'react';

export function useFocusManagement() {
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  const saveFocus = useCallback(() => {
    previousActiveElement.current = document.activeElement as HTMLElement;
  }, []);

  const restoreFocus = useCallback(() => {
    if (previousActiveElement.current) {
      // Small delay to ensure the element is available
      setTimeout(() => {
        previousActiveElement.current?.focus();
      }, 0);
    }
  }, []);

  const focusFirst = useCallback((container?: HTMLElement) => {
    const element = container || containerRef.current;
    if (!element) return;

    const focusableElements = element.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    firstElement?.focus();
  }, []);

  const focusLast = useCallback((container?: HTMLElement) => {
    const element = container || containerRef.current;
    if (!element) return;

    const focusableElements = element.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
    );
    
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
    lastElement?.focus();
  }, []);

  const trapFocus = useCallback((container: HTMLElement) => {
    const focusableElements = container.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
    );
    
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);
    
    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }, []);

  return {
    containerRef,
    saveFocus,
    restoreFocus,
    focusFirst,
    focusLast,
    trapFocus
  };
}