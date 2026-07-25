/**
 * SMART AUTHENTICATION SYSTEM
 *
 * Prevents anonymous user spam by:
 * 1. Reusing existing anonymous sessions from localStorage
 * 2. Tracking auth state to avoid unnecessary signInAnonymously calls
 * 3. Only creating new anonymous users when absolutely necessary
 */

import {
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  User,
  Auth
} from 'firebase/auth';

const STORAGE_KEYS = {
  ANONYMOUS_UID: 'sd_anonymous_uid',
  AUTH_STATE: 'sd_auth_state',
  LAST_ANONYMOUS_SIGNIN: 'sd_last_anon_signin'
} as const;

type AuthState = {
  isAuthenticated: boolean;
  isAnonymous: boolean;
  uid: string | null;
  lastCheck: number;
};

export class SmartAuth {
  private static instance: SmartAuth;
  private auth: Auth;

  private constructor() {
    // CRITICAL: DO NOT listen to auth state changes here
    // The auth state listener is managed by useAuth hook to prevent conflicts
    // We just need access to the auth instance, not our own listener
    const { auth: sharedAuth } = require('./firebase');
    this.auth = sharedAuth;
  }

  static getInstance(): SmartAuth {
    if (!SmartAuth.instance) {
      SmartAuth.instance = new SmartAuth();
    }
    return SmartAuth.instance;
  }

  /**
   * Get current user - directly from auth.currentUser
   * This prevents race conditions with useAuth hook
   */
  async getCurrentUser(): Promise<User | null> {
    // Use the single source of truth: auth.currentUser
    // This is managed by Firebase SDK and the useAuth hook
    return this.auth.currentUser;
  }

  /**
   * Ensure user is authenticated (anonymous or real)
   * Reuses existing anonymous sessions to prevent spam
   */
  async ensureAuthenticated(): Promise<User> {
    const currentUser = await this.getCurrentUser();

    if (currentUser) {
      // User is already authenticated (real or anonymous)
      return currentUser;
    }

    // Check if we should reuse an existing anonymous session
    const shouldReuseAnonymous = this.shouldReuseAnonymousSession();

    if (shouldReuseAnonymous) {
      console.log('⚡ Reusing existing anonymous session from localStorage');
      // User will be restored automatically by Firebase persistence
      // Wait a bit for Firebase to restore the session
      await new Promise(resolve => setTimeout(resolve, 1000));

      const restoredUser = await this.getCurrentUser();
      if (restoredUser) {
        return restoredUser;
      }
    }

    // Only create new anonymous user if absolutely necessary
    console.log('🆕 Creating new anonymous user (no existing session found)');
    const anonymousUser = await this.createNewAnonymousUser();

    return anonymousUser;
  }

  /**
   * Create a new anonymous user and track it
   */
  private async createNewAnonymousUser(): Promise<User> {
    try {
      const result = await signInAnonymously(this.auth);
      const user = result.user;

      // Store the anonymous user info for reuse
      this.storeAnonymousSession(user);

      // Track when we created this anonymous user
      this.updateLastAnonymousSignin();

      console.log('✅ New anonymous user created:', user.uid);
      return user;

    } catch (error) {
      console.error('❌ Error creating anonymous user:', error);
      throw error;
    }
  }

  /**
   * Check if we should reuse an existing anonymous session
   */
  private shouldReuseAnonymousSession(): boolean {
    const storedAuthState = this.getStoredAuthState();
    const storedAnonymousUid = localStorage.getItem(STORAGE_KEYS.ANONYMOUS_UID);
    const lastAnonymousSignin = localStorage.getItem(STORAGE_KEYS.LAST_ANONYMOUS_SIGNIN);

    // No stored anonymous session
    if (!storedAnonymousUid || !storedAuthState) {
      return false;
    }

    // Check if the stored session is recent (less than 30 days old)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    if (lastAnonymousSignin && parseInt(lastAnonymousSignin) < thirtyDaysAgo) {
      console.log('🗑️ Anonymous session too old, will create new one');
      this.clearStoredAnonymousSession();
      return false;
    }

    // Check if stored state indicates anonymous user
    if (storedAuthState.isAnonymous && storedAuthState.uid === storedAnonymousUid) {
      console.log('♻️ Found valid anonymous session to reuse');
      return true;
    }

    return false;
  }

  /**
   * Store anonymous session info for reuse
   */
  private storeAnonymousSession(user: User): void {
    if (user.isAnonymous) {
      localStorage.setItem(STORAGE_KEYS.ANONYMOUS_UID, user.uid);
      this.updateLastAnonymousSignin();
    }
  }

  /**
   * Update stored auth state
   */
  private updateStoredAuthState(user: User | null): void {
    if (user) {
      const authState: AuthState = {
        isAuthenticated: true,
        isAnonymous: user.isAnonymous,
        uid: user.uid,
        lastCheck: Date.now()
      };
      localStorage.setItem(STORAGE_KEYS.AUTH_STATE, JSON.stringify(authState));
    } else {
      localStorage.removeItem(STORAGE_KEYS.AUTH_STATE);
    }
  }

  /**
   * Get stored auth state
   */
  private getStoredAuthState(): AuthState | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.AUTH_STATE);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  /**
   * Update last anonymous signin timestamp
   */
  private updateLastAnonymousSignin(): void {
    localStorage.setItem(STORAGE_KEYS.LAST_ANONYMOUS_SIGNIN, Date.now().toString());
  }

  /**
   * Clear stored anonymous session
   */
  private clearStoredAnonymousSession(): void {
    localStorage.removeItem(STORAGE_KEYS.ANONYMOUS_UID);
    localStorage.removeItem(STORAGE_KEYS.LAST_ANONYMOUS_SIGNIN);
  }

  /**
   * Sign out and clear all stored data
   */
  async signOut(): Promise<void> {
    await signOut(this.auth);

    // Clear all stored auth data
    localStorage.removeItem(STORAGE_KEYS.AUTH_STATE);
    localStorage.removeItem(STORAGE_KEYS.ANONYMOUS_UID);
    localStorage.removeItem(STORAGE_KEYS.LAST_ANONYMOUS_SIGNIN);
  }

  /**
   * Check if user is anonymous
   */
  isAnonymous(): boolean {
    return this.auth.currentUser?.isAnonymous ?? false;
  }

  /**
   * Get debug info about current auth state
   */
  getDebugInfo(): Record<string, any> {
    const storedAuthState = this.getStoredAuthState();
    const storedAnonymousUid = localStorage.getItem(STORAGE_KEYS.ANONYMOUS_UID);
    const lastAnonymousSignin = localStorage.getItem(STORAGE_KEYS.LAST_ANONYMOUS_SIGNIN);

    return {
      currentUser: {
        uid: this.auth.currentUser?.uid,
        isAnonymous: this.auth.currentUser?.isAnonymous,
        email: this.auth.currentUser?.email
      },
      storedAuthState,
      storedAnonymousUid,
      lastAnonymousSignin: lastAnonymousSignin ? new Date(parseInt(lastAnonymousSignin)).toISOString() : null,
      shouldReuseAnonymous: this.shouldReuseAnonymousSession()
    };
  }
}

// Export singleton instance
export const smartAuth = SmartAuth.getInstance();