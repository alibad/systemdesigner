'use client';

import { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, signInAnonymouslyIfNeeded } from '@/lib/firebase';

export function useFirebaseAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInAnonymously = async () => {
    try {
      setError(null);
      setLoading(true);
      const user = await signInAnonymouslyIfNeeded();
      setUser(user);
    } catch (error: any) {
      setError(error.message);
      console.error('Anonymous sign in failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const ensureAuthenticated = async (): Promise<User | null> => {
    if (user) return user;
    
    try {
      await signInAnonymously();
      return auth.currentUser;
    } catch (error) {
      console.error('Failed to ensure authentication:', error);
      return null;
    }
  };

  return {
    user,
    loading,
    error,
    signInAnonymously,
    ensureAuthenticated,
    isAnonymous: user?.isAnonymous ?? false
  };
}