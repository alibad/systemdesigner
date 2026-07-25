'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface FeedbackContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <FeedbackContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (context === undefined) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }
  return context;
}