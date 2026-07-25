'use client';

import { useState, useEffect } from 'react';
import { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } from '@/lib/firebase';
import { detectWebView, getWebViewAuthMessage } from '@/lib/webview-detector';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthMode = 'signin' | 'signup' | 'reset';

export default function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showEmailAuth, setShowEmailAuth] = useState(false);
  const [webViewInfo, setWebViewInfo] = useState<ReturnType<typeof detectWebView> | null>(null);
  const [showWebViewWarning, setShowWebViewWarning] = useState(false);

  useEffect(() => {
    const detection = detectWebView();
    setWebViewInfo(detection);
  }, []);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setAuthMode('signin');
      setEmail('');
      setPassword('');
      setDisplayName('');
      setError('');
      setResetSent(false);
      setShowEmailAuth(false);
      setShowWebViewWarning(false);
    }
  }, [isOpen]);

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleGoogleSignIn = async () => {
    if (webViewInfo?.isWebView) {
      setShowWebViewWarning(true);
      return;
    }

    try {
      setLoading(true);
      setError('');
      await signInWithGoogle();
      onClose();
    } catch (error: any) {
      console.error('Google sign in failed:', error);
      if (error.code === 'auth/popup-blocked') {
        setError('Pop-up blocked. Please allow pop-ups for this site.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        setError('Sign-in cancelled.');
      } else {
        setError('Google sign-in failed. Please try email/password instead.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResetSent(false);

    try {
      if (authMode === 'reset') {
        await resetPassword(email);
        setResetSent(true);
        setLoading(false);
        return;
      }

      if (authMode === 'signup') {
        await signUpWithEmail(email, password, displayName);
      } else {
        await signInWithEmail(email, password);
      }
      onClose();
    } catch (error: any) {
      setError(error.message || 'Authentication failed. Please try again.');
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // WebView warning dialog
  if (showWebViewWarning && webViewInfo) {
    const message = getWebViewAuthMessage(webViewInfo);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-2xl shadow-xl p-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-3 text-center">
            {message.title}
          </h2>

          <p className="text-neutral-600 dark:text-neutral-400 mb-4 text-center">
            {message.message}
          </p>

          {message.instructions && (
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm text-amber-800 dark:text-amber-200 font-medium mb-2">
                How to fix this:
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300 whitespace-pre-line">
                {message.instructions}
              </p>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={() => {
                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  navigator.clipboard.writeText(window.location.href);
                }
              }}
              className="w-full bg-amber-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-amber-700 transition-colors"
            >
              Copy URL to Clipboard
            </button>

            <button
              onClick={() => {
                setShowWebViewWarning(false);
                setShowEmailAuth(true);
              }}
              className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              Try Email/Password Instead
            </button>

            <button
              onClick={onClose}
              className="w-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 px-6 py-3 rounded-lg font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-2xl shadow-xl p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {showEmailAuth
              ? authMode === 'signin'
                ? 'Sign In'
                : authMode === 'signup'
                ? 'Create Account'
                : 'Reset Password'
              : 'Welcome Back'}
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!showEmailAuth ? (
          <>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              Sign in to save your progress and access your work from any device.
            </p>

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 px-6 py-3 rounded-lg font-medium hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                  Signing In...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-300 dark:border-neutral-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400">
                  Or continue with email
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowEmailAuth(true)}
              className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              Sign In with Email
            </button>
          </>
        ) : (
          <>
            <form
              onSubmit={handleEmailAuth}
              className="space-y-4"
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.stopPropagation()}
            >
              {error && (
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}

              {resetSent && (
                <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-700 dark:text-green-300">
                  Password reset email sent! Check your inbox.
                </div>
              )}

              {authMode === 'signup' && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    onFocus={(e) => e.stopPropagation()}
                    className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-neutral-800 dark:text-neutral-100"
                    placeholder="Your name"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={(e) => e.stopPropagation()}
                  required
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-neutral-800 dark:text-neutral-100"
                  placeholder="you@example.com"
                />
              </div>

              {authMode !== 'reset' && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={(e) => e.stopPropagation()}
                    required
                    className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-neutral-800 dark:text-neutral-100"
                    placeholder="••••••••"
                    minLength={6}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? 'Please wait...'
                  : authMode === 'signin'
                  ? 'Sign In'
                  : authMode === 'signup'
                  ? 'Create Account'
                  : 'Send Reset Link'}
              </button>
            </form>

            <div className="mt-4 text-sm text-neutral-600 dark:text-neutral-400 text-center">
              {authMode === 'signin' && (
                <>
                  <button
                    onClick={() => setAuthMode('signup')}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Create an account
                  </button>
                  {' • '}
                  <button
                    onClick={() => setAuthMode('reset')}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Forgot password?
                  </button>
                </>
              )}
              {authMode === 'signup' && (
                <button
                  onClick={() => setAuthMode('signin')}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Already have an account? Sign in
                </button>
              )}
              {authMode === 'reset' && (
                <button
                  onClick={() => setAuthMode('signin')}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Back to sign in
                </button>
              )}
            </div>

            <div className="mt-4 text-center">
              <button
                onClick={() => setShowEmailAuth(false)}
                className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                ← Back to all options
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
