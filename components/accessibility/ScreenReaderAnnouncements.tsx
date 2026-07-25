'use client';

import { createContext, useContext, useCallback, ReactNode } from 'react';
import { useEffect, useRef } from 'react';

interface ScreenReaderContextType {
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
}

const ScreenReaderContext = createContext<ScreenReaderContextType | null>(null);

interface ScreenReaderProviderProps {
  children: ReactNode;
}

export function ScreenReaderProvider({ children }: ScreenReaderProviderProps) {
  const politeRef = useRef<HTMLDivElement>(null);
  const assertiveRef = useRef<HTMLDivElement>(null);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const targetRef = priority === 'assertive' ? assertiveRef : politeRef;
    
    if (targetRef.current) {
      // Clear the region first to ensure the announcement is read
      targetRef.current.textContent = '';
      
      // Set the message after a brief delay
      setTimeout(() => {
        if (targetRef.current) {
          targetRef.current.textContent = message;
        }
      }, 100);

      // Clear the message after it's been announced
      setTimeout(() => {
        if (targetRef.current) {
          targetRef.current.textContent = '';
        }
      }, 5000);
    }
  }, []);

  return (
    <ScreenReaderContext.Provider value={{ announce }}>
      {children}
      
      {/* Screen reader announcement regions */}
      <div
        ref={politeRef}
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      />
      <div
        ref={assertiveRef}
        className="sr-only"
        aria-live="assertive"
        aria-atomic="true"
      />
    </ScreenReaderContext.Provider>
  );
}

export function useScreenReader() {
  const context = useContext(ScreenReaderContext);
  if (!context) {
    throw new Error('useScreenReader must be used within ScreenReaderProvider');
  }
  return context;
}

// Hook for automatic announcements on route changes
export function useRouteAnnouncements() {
  const { announce } = useScreenReader();

  useEffect(() => {
    // Announce page load
    const title = document.title;
    if (title) {
      announce(`Page loaded: ${title}`, 'polite');
    }
  }, [announce]);

  const announceNavigation = useCallback((pageName: string) => {
    announce(`Navigating to ${pageName}`, 'polite');
  }, [announce]);

  const announceError = useCallback((errorMessage: string) => {
    announce(`Error: ${errorMessage}`, 'assertive');
  }, [announce]);

  const announceSuccess = useCallback((successMessage: string) => {
    announce(`Success: ${successMessage}`, 'polite');
  }, [announce]);

  return {
    announceNavigation,
    announceError,
    announceSuccess
  };
}