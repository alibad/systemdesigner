import { useEffect, useCallback } from 'react';

interface UseKeyboardNavigationProps {
  isOpen: boolean;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onSelect?: () => void;
  trapFocus?: boolean;
  autoFocus?: boolean;
}

export function useKeyboardNavigation({
  isOpen,
  onClose,
  onNext,
  onPrevious,
  onSelect,
  trapFocus = false,
  autoFocus = false
}: UseKeyboardNavigationProps) {
  
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isOpen) return;

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        onClose();
        break;
      case 'ArrowDown':
        if (onNext) {
          event.preventDefault();
          onNext();
        }
        break;
      case 'ArrowUp':
        if (onPrevious) {
          event.preventDefault();
          onPrevious();
        }
        break;
      case 'Enter':
      case ' ':
        if (onSelect && event.target !== document.body) {
          event.preventDefault();
          onSelect();
        }
        break;
      case 'Home':
        if (onPrevious) {
          event.preventDefault();
          // Move to first item - implementation depends on component
        }
        break;
      case 'End':
        if (onNext) {
          event.preventDefault();
          // Move to last item - implementation depends on component
        }
        break;
    }
  }, [isOpen, onClose, onNext, onPrevious, onSelect]);

  // Focus trap implementation
  const trapFocusInside = useCallback((containerElement: HTMLElement) => {
    const focusableElements = containerElement.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    containerElement.addEventListener('keydown', handleTabKey);
    return () => containerElement.removeEventListener('keydown', handleTabKey);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  return {
    trapFocusInside,
    handleKeyDown
  };
}