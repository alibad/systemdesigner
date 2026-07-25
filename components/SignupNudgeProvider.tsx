'use client';

import { useEffect } from 'react';
import SignupNudgeModal from './SignupNudgeModal';
import { useSignupNudge } from '@/hooks/useSignupNudge';

export default function SignupNudgeProvider() {
  const { 
    shouldShowNudge, 
    hasCompletedFirstQuiz, 
    currentMilestone,
    dismissNudge, 
    dismissCurrentMilestone,
    hideNudge,
    checkSignupNudgeEligibility
  } = useSignupNudge();

  // Re-check eligibility when component mounts
  useEffect(() => {
    checkSignupNudgeEligibility();
  }, [checkSignupNudgeEligibility]);



  return (
    <SignupNudgeModal
      isOpen={shouldShowNudge}
      onClose={hideNudge}
      onDismiss={dismissNudge}
      onDismissCurrentMilestone={dismissCurrentMilestone}
      completedActivities={currentMilestone}
      currentMilestone={currentMilestone}
    />
  );
}