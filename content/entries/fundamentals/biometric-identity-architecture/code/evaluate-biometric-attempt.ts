type TrustedBiometricEvidence = {
  physicalAuthenticatorBound: boolean;
  alternativeFactorAvailable: boolean;
  modality: 'face' | 'fingerprint' | 'iris' | 'voice';
  matched: boolean;
  padConformant: boolean;
  consecutiveFailures: number;
};

type AttemptDecision =
  | { action: 'accept'; reason: string }
  | { action: 'reject'; reason: string }
  | { action: 'delay'; delaySeconds: 30; reason: string }
  | { action: 'disable-biometric'; reason: string };

export function evaluateBiometricAttempt(
  evidence: TrustedBiometricEvidence,
): AttemptDecision {
  if (!evidence.physicalAuthenticatorBound) {
    return {
      action: 'reject',
      reason: 'Biometrics cannot be the only authentication factor in this policy.',
    };
  }

  if (!evidence.alternativeFactorAvailable) {
    return {
      action: 'reject',
      reason: 'A non-biometric alternative must be configured before enabling biometrics.',
    };
  }

  // NIST SP 800-63B-4 prohibits voice comparison for this authentication profile.
  if (evidence.modality === 'voice') {
    return {
      action: 'reject',
      reason: 'Voice biometric comparison is not allowed by the selected policy profile.',
    };
  }

  if (evidence.matched) {
    return {
      action: 'accept',
      reason: 'The trusted subsystem matched the sample and the physical factor is present.',
    };
  }

  const burstLimit = evidence.padConformant ? 10 : 5;
  const overallLimit = evidence.padConformant ? 100 : 50;

  if (evidence.consecutiveFailures >= overallLimit) {
    return {
      action: 'disable-biometric',
      reason: 'The overall failure ceiling is reached; use an already-bound alternative factor.',
    };
  }

  if (evidence.consecutiveFailures >= burstLimit) {
    return {
      action: 'delay',
      delaySeconds: 30,
      reason: 'The consecutive-failure ceiling is reached; delay every subsequent attempt.',
    };
  }

  return {
    action: 'reject',
    reason: `No match. ${burstLimit - evidence.consecutiveFailures} attempt(s) remain before delay.`,
  };
}
