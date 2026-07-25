"use client";

import { useState, useEffect } from 'react';
import { FirebaseLearningPlan } from '@/lib/firebase-learning-plans';
import { useAuth } from '@/hooks/useAuth';
import { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } from '@/lib/firebase';
import { detectWebView, getWebViewAuthMessage } from '@/lib/webview-detector';

interface SimpleLearningPlanInputProps {
  onPlanGenerated: (plan: FirebaseLearningPlan) => void;
}

type AuthMode = 'signin' | 'signup' | 'reset';

export default function SimpleLearningPlanInput({ onPlanGenerated }: SimpleLearningPlanInputProps) {
  const { user, loading: authLoading } = useAuth();
  const [userGoal, setUserGoal] = useState('');
  // Remove skill level and time commitment - AI will infer from user goal
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Email/Password auth states
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [showEmailAuth, setShowEmailAuth] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [webViewInfo, setWebViewInfo] = useState<ReturnType<typeof detectWebView> | null>(null);
  const [showWebViewWarning, setShowWebViewWarning] = useState(false);

  // AI magic messages that rotate during generation
  const magicMessages = [
    "Analyzing your learning goals...",
    "Scanning our content library...",
    "Mapping knowledge pathways...",
    "Crafting your personalized journey...",
    "Optimizing learning sequence...",
    "Selecting the perfect topics...",
    "Calculating time estimates...",
    "Building your roadmap...",
    "Tailoring difficulty levels...",
    "Connecting related concepts...",
    "Designing milestone checkpoints...",
    "Weaving learning threads...",
    "Orchestrating your curriculum...",
    "Fine-tuning recommendations...",
    "Almost ready to launch..."
  ];

  // Rotate messages every 2 seconds during generation for better UX
  useEffect(() => {
    if (!isGenerating) return;

    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % magicMessages.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [isGenerating, magicMessages.length]);

  // Focus the user goal input when the form becomes available after sign-in
  useEffect(() => {
    if (user && !user.isAnonymous && !authLoading) {
      // Small delay to ensure the form is rendered
      setTimeout(() => {
        const userGoalInput = document.querySelector('textarea[placeholder*="learn"]') as HTMLTextAreaElement;
        if (userGoalInput) {
          userGoalInput.focus();
        }
      }, 100);
    }
  }, [user, authLoading]);

  // Detect webview on mount
  useEffect(() => {
    const detection = detectWebView();
    setWebViewInfo(detection);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userGoal.trim()) return;

    // Check if user is authenticated
    if (!user || user.isAnonymous) {
      setError('Please sign in to create a personalized learning plan. Your progress will be saved and accessible across all your devices.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setCurrentMessageIndex(0); // Start from the first message

    try {
      const response = await fetch('/api/learning-plan/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userGoal: userGoal.trim(),
          userId: user?.uid,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate learning plan');
      }

      if (data.success && data.plan) {
        onPlanGenerated(data.plan);
        setUserGoal(''); // Clear input after success
      } else {
        throw new Error('Invalid response from server');
      }

    } catch (error) {
      console.error('Error generating learning plan:', error);
      setError(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const exampleGoals = [
    "I want to learn how to design scalable web applications",
    "Help me understand machine learning systems for production",
    "I need to prepare for system design interviews",
    "Teach me about building AI applications with LLMs",
    "I want to learn database design and optimization",
  ];

  const handleExampleClick = (example: string) => {
    setUserGoal(example);
  };

  const handleSignIn = async () => {
    // Check for webview and show warning
    if (webViewInfo?.isWebView) {
      setShowWebViewWarning(true);
      return;
    }

    setIsSigningIn(true);
    setError(null);

    try {
      // Use direct Firebase sign-in to avoid UserMenu focus management conflicts
      await signInWithGoogle();
      // User will be automatically redirected to the form once signed in
      // Focus will naturally go to the form when it appears
    } catch (error: any) {
      console.error('Sign in failed:', error);
      if (error.code === 'auth/cancelled-popup-request' ||
          error.code === 'auth/popup-closed-by-user') {
        setError('Sign-in was cancelled. Please try again to create your learning plan.');
      } else if (error.code === 'auth/popup-blocked') {
        setError('Pop-up blocked. Please allow pop-ups or use email/password sign-in.');
      } else {
        setError('Google sign-in failed. Please try email/password instead.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSigningIn(true);
    setError(null);
    setResetSent(false);

    try {
      if (authMode === 'reset') {
        await resetPassword(email);
        setResetSent(true);
        setIsSigningIn(false);
        return;
      }

      if (authMode === 'signup') {
        await signUpWithEmail(email, password, displayName);
      } else {
        await signInWithEmail(email, password);
      }
      // User will be redirected automatically after successful auth
    } catch (error: any) {
      setError(error.message || 'Authentication failed. Please try again.');
      setIsSigningIn(false);
    }
  };

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4"></div>
          <div className="h-32 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
          <div className="h-12 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
        </div>
      </div>
    );
  }

  // WebView warning dialog
  if (showWebViewWarning && webViewInfo) {
    const message = getWebViewAuthMessage(webViewInfo);

    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center p-8 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
            {message.title}
          </h2>

          <p className="text-neutral-600 dark:text-neutral-400 mb-4">
            {message.message}
          </p>

          {message.instructions && (
            <div className="bg-amber-100 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg p-4 mb-6 text-left">
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
          </div>
        </div>
      </div>
    );
  }

  // Show sign-in prompt for anonymous users
  if (!user || user.isAnonymous) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="p-8 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/50 dark:to-violet-950/50 border border-indigo-200 dark:border-indigo-800">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
              <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
              Sign In to Create Your Learning Plan
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6 max-w-md mx-auto">
              Create a personalized AI-powered learning plan that saves your progress and adapts to your goals.
              Access it from any device, anytime.
            </p>
          </div>

          {!showEmailAuth ? (
            <>
              {/* Google Sign-In Button */}
              <button
                onClick={handleSignIn}
                disabled={isSigningIn}
                className="w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 px-6 py-3 rounded-lg font-medium hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
              >
                {isSigningIn ? (
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

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-indigo-200 dark:border-indigo-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/50 dark:to-violet-950/50 text-neutral-500 dark:text-neutral-400">
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
              {/* Email/Password Form */}
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
                  disabled={isSigningIn}
                  className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSigningIn
                    ? 'Please wait...'
                    : authMode === 'signin'
                    ? 'Sign In'
                    : authMode === 'signup'
                    ? 'Create Account'
                    : 'Send Reset Link'}
                </button>
              </form>

              {/* Mode Switcher */}
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
                  ← Back to Google Sign-In
                </button>
              </div>
            </>
          )}

          <div className="mt-6 pt-6 border-t border-indigo-200 dark:border-indigo-800">
            <p className="text-sm text-neutral-500 dark:text-neutral-500 text-center">
              ✨ <strong>Why sign in?</strong> Your learning plans will be saved, progress tracked across devices, and AI recommendations will improve over time.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        
        <h2 className="text-3xl font-bold mb-3">What do you want to learn?</h2>
        <p className="text-neutral-600 dark:text-neutral-300 text-lg">
          Tell us your goal and we'll create a personalized learning path from our content library.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Main Input */}
        <div className="relative">
          <textarea
            value={userGoal}
            onChange={(e) => setUserGoal(e.target.value)}
            placeholder="I want to learn..."
            className="w-full px-6 py-4 text-lg rounded-2xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition-all"
            rows={3}
            required
            disabled={isGenerating}
          />
          
          {/* Character count */}
          <div className="absolute bottom-3 right-3 text-xs text-neutral-400">
            {userGoal.length}/500
          </div>
        </div>

        {/* Simplified - AI will infer level and pacing from the goal */}

        {/* Error Message */}
        {error && (
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Magical Status Display */}
        {isGenerating && (
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/50 dark:to-violet-950/50 border border-indigo-200 dark:border-indigo-800">
              <div className="relative">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <div className="absolute inset-0 w-6 h-6 border-2 border-violet-400 border-b-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
              </div>
              <span className="text-indigo-700 dark:text-indigo-300 font-medium animate-pulse">
                {magicMessages[currentMessageIndex]}
              </span>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="text-center">
          <button
            type="submit"
            disabled={isGenerating || !userGoal.trim()}
            className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                <span className="opacity-75">Creating...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Create Learning Plan
              </>
            )}
          </button>
        </div>
      </form>

      {/* Examples */}
      {!isGenerating && (
        <div className="mt-8 text-center">
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">Or try one of these examples:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {exampleGoals.map((example, index) => (
              <button
                key={index}
                onClick={() => handleExampleClick(example)}
                className="text-sm px-4 py-2 rounded-full border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all"
              >
                {example.length > 45 ? example.substring(0, 45) + '...' : example}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AI Powered Badge */}
      <div className="mt-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Powered by AI • Personalized for you
        </div>
      </div>
    </div>
  );
}
