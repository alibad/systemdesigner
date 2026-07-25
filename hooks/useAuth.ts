'use client';

import { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, signOutAndReturnToAnonymous, signInWithGoogle, createOrUpdateUserDocument, getUserDocument, UserDocument } from '@/lib/firebase';

interface AuthState {
  user: User | null;
  userDoc: UserDocument | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  isAdmin: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    userDoc: null,
    loading: true,
    // Always start with safe defaults for SSR
    isAuthenticated: false,
    isAnonymous: true,
    isAdmin: false,
  });

  const [hasHydrated, setHasHydrated] = useState(false);

  const handleUserStateChange = async (user: User) => {
    try {
      // Check if we have cached user doc to avoid unnecessary Firestore calls
      const cachedUserDocKey = `userDoc_${user.uid}`;
      let userDoc: UserDocument | null = null;

      // Try to get cached user doc first (only for authenticated users)
      if (!user.isAnonymous && typeof window !== 'undefined') {
        const cached = localStorage.getItem(cachedUserDocKey);
        if (cached) {
          try {
            userDoc = JSON.parse(cached);
          } catch (e) {
            // Invalid cache, will fetch fresh
          }
        }
      }

      // If no cache or cache is invalid, fetch from Firestore
      if (!userDoc) {
        userDoc = await createOrUpdateUserDocument(user);

        // Cache the user doc for next time (only for authenticated users)
        if (!user.isAnonymous && typeof window !== 'undefined') {
          localStorage.setItem(cachedUserDocKey, JSON.stringify(userDoc));
        }
      }

      setAuthState({
        user,
        userDoc,
        loading: false,
        isAuthenticated: !user.isAnonymous,
        isAnonymous: user.isAnonymous,
        isAdmin: userDoc?.isAdmin || false,
      });

      // Track if user was ever authenticated (not anonymous)
      if (!user.isAnonymous) {
        localStorage.setItem('was-previously-authenticated', 'true');
      }
    } catch (error) {
      console.error('Error handling user document:', error);
      // Fallback without user doc
      setAuthState({
        user,
        userDoc: null,
        loading: false,
        isAuthenticated: !user.isAnonymous,
        isAnonymous: user.isAnonymous,
        isAdmin: false,
      });
    }
  };

  useEffect(() => {
    // Mark as hydrated after first mount
    setHasHydrated(true);

    // Check if user was previously authenticated (only after hydration)
    const wasPreviouslyAuthenticated = typeof window !== 'undefined'
      ? localStorage.getItem('was-previously-authenticated') === 'true'
      : false;

    // Check current user immediately on mount (for faster initial state)
    const currentUser = auth.currentUser;
    if (currentUser && wasPreviouslyAuthenticated) {
      // User is already available, update state immediately
      handleUserStateChange(currentUser);
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await handleUserStateChange(user);
      } else {
        // No user signed in, clear authentication state
        setAuthState({
          user: null,
          userDoc: null,
          loading: false,
          isAuthenticated: false,
          isAnonymous: true,
          isAdmin: false,
        });
        // Clear the previously authenticated flag and user doc cache
        if (typeof window !== 'undefined') {
          localStorage.removeItem('was-previously-authenticated');
          // Clear all user doc caches (they start with 'userDoc_')
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('userDoc_')) {
              localStorage.removeItem(key);
            }
          });
        }
      }
    });

    return unsubscribe;
  }, []);

  const signIn = async () => {
    try {
      return await signInWithGoogle();
    } catch (error: any) {
      console.error('Sign in failed:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      return await signOutAndReturnToAnonymous();
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  };

  const refreshUserDoc = async () => {
    if (authState.user) {
      try {
        const userDoc = await getUserDocument(authState.user.uid);
        setAuthState(prev => ({
          ...prev,
          userDoc,
          isAdmin: userDoc?.isAdmin || false,
        }));
      } catch (error) {
        console.error('Error refreshing user document:', error);
      }
    }
  };

  return {
    ...authState,
    signIn,
    signOut,
    refreshUserDoc,
  };
}