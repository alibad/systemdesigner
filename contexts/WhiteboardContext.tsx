'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getUserWhiteboards, WhiteboardMetadata } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';

interface WhiteboardContextType {
  whiteboards: WhiteboardMetadata[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const WhiteboardContext = createContext<WhiteboardContextType | undefined>(undefined);

export function WhiteboardProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [whiteboards, setWhiteboards] = useState<WhiteboardMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWhiteboards = useCallback(async () => {
    if (!user || user.isAnonymous) {
      setWhiteboards([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log('[WhiteboardContext] Loading whiteboards...');
      const whiteboards = await getUserWhiteboards();
      console.log('[WhiteboardContext] Loaded whiteboards:', whiteboards.length);
      setWhiteboards(whiteboards);
    } catch (err) {
      console.error('Failed to load whiteboards:', err);
      setError('Failed to load whiteboards');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadWhiteboards();
  }, [loadWhiteboards]);

  return (
    <WhiteboardContext.Provider value={{
      whiteboards,
      loading,
      error,
      reload: loadWhiteboards
    }}>
      {children}
    </WhiteboardContext.Provider>
  );
}

export function useWhiteboards() {
  const context = useContext(WhiteboardContext);
  if (context === undefined) {
    throw new Error('useWhiteboards must be used within a WhiteboardProvider');
  }
  return context;
}
