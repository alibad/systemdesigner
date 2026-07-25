'use client';

import { useState } from 'react';
import { X, BookOpen, Trophy, BarChart3, Shield } from 'lucide-react';
import { signInWithGoogle, linkAnonymousAccountWithGoogle } from '@/lib/firebase';

interface SignupNudgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDismiss: () => void;
  onDismissCurrentMilestone: () => void;
  completedActivities?: number;
  currentMilestone?: number;
}

export default function SignupNudgeModal({ 
  isOpen, 
  onClose, 
  onDismiss, 
  onDismissCurrentMilestone,
  completedActivities = 1,
  currentMilestone = 1 
}: SignupNudgeModalProps) {
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Find the next milestone for the dismiss button
  const nudgeMilestones = [1, 3, 5, 10, 20];
  const nextMilestone = nudgeMilestones.find(m => m > currentMilestone) || 20;



  if (!isOpen) return null;

  const handleGoogleSignup = async () => {
    try {
      setIsSigningUp(true);
      setError(null);
      
      // Link anonymous account with Google
      await linkAnonymousAccountWithGoogle();
      
      // Close modal on success
      onClose();
      
      // Show success message (you could add a toast here)
      console.log('Successfully signed up and preserved progress!');
      
    } catch (error) {
      console.error('Signup failed:', error);
      setError('Failed to sign up. Please try again.');
    } finally {
      setIsSigningUp(false);
    }
  };

  const benefits = [
    {
      icon: Shield,
      title: 'Never Lose Progress',
      description: 'Your learning progress is safely stored across all devices'
    },
    {
      icon: BarChart3,
      title: 'Track Your Growth',
      description: 'See detailed analytics of your learning journey'
    },
    {
      icon: Trophy,
      title: 'Unlock Achievements',
      description: 'Earn badges and celebrate your milestones'
    },
    {
      icon: BookOpen,
      title: 'Personalized Learning',
      description: 'Get customized recommendations based on your progress'
    }
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="relative p-6 text-center border-b border-neutral-200 dark:border-neutral-800">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                {currentMilestone >= 10 ? 'Amazing Progress!' : currentMilestone >= 5 ? 'Great Progress!' : 'Nice Start!'} 🎉
              </h2>
              <p className="text-neutral-600 dark:text-neutral-400">
                You've completed {completedActivities} learning activit{completedActivities === 1 ? 'y' : 'ies'}! 
                {currentMilestone >= 10 && " You're becoming a system design expert. "}
                {currentMilestone >= 5 && currentMilestone < 10 && " You're building real expertise. "}
                Sign up to save your progress and unlock more features.
              </p>
            </div>
          </div>

          {/* Benefits */}
          <div className="p-6">
            <div className="space-y-4 mb-6">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                    <benefit.icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                      {benefit.title}
                    </h3>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleGoogleSignup}
                disabled={isSigningUp}
                className="w-full flex items-center justify-center gap-3 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg px-4 py-3 text-neutral-900 dark:text-neutral-100 font-medium hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSigningUp ? (
                  <div className="w-5 h-5 border-2 border-neutral-300 dark:border-neutral-600 border-t-neutral-900 dark:border-t-neutral-100 rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                {isSigningUp ? 'Signing up...' : 'Continue with Google'}
              </button>

              <div className="flex flex-col gap-2 text-center">
                <button
                  onClick={onDismissCurrentMilestone}
                  className="px-4 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
                >
                  Not now
                </button>
                <div className="flex gap-1 text-xs">
                  <button
                    onClick={onDismissCurrentMilestone}
                    className="flex-1 px-2 py-1 text-neutral-500 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                  >
                    Ask me at {nextMilestone} activities
                  </button>
                  <span className="text-neutral-300 dark:text-neutral-700">|</span>
                  <button
                    onClick={onDismiss}
                    className="flex-1 px-2 py-1 text-neutral-500 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                  >
                    Don't ask again
                  </button>
                </div>
              </div>
            </div>

            {/* Privacy Note */}
            <p className="text-xs text-neutral-500 dark:text-neutral-500 text-center mt-4">
              We respect your privacy. Your learning data stays secure and is never shared.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}