'use client';

import React, { createContext, useContext, useEffect } from 'react';
import { userStorage } from '@/lib/unified-storage';
import { useAuth } from '@/hooks/useAuth';

interface StorageContextType {
  storage: typeof userStorage;
}

const StorageContext = createContext<StorageContextType | undefined>(undefined);

export const StorageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  useEffect(() => {
    // Initialize storage with current user (can be null for anonymous users)
    console.log('StorageProvider: Setting user:', user ? (user.isAnonymous ? 'Anonymous user' : 'Authenticated user') : 'No user (null)');
    userStorage.setUser(user);
  }, [user]);

  return (
    <StorageContext.Provider value={{ storage: userStorage }}>
      {children}
    </StorageContext.Provider>
  );
};

export const useStorage = () => {
  const context = useContext(StorageContext);
  if (context === undefined) {
    throw new Error('useStorage must be used within a StorageProvider');
  }
  return context.storage;
};