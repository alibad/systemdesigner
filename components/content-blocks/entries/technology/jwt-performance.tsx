'use client';

import JwtSessionArchitectureLab from './jwt-session-architecture-lab';
import JwtTokenValidationLab from './jwt-token-validation-lab';

const VALIDATION_DATA_FILE =
  '/api/content/technology/jwt/data/token-validation-trust-boundary.json';
const SESSION_DATA_FILE =
  '/api/content/technology/jwt/data/session-rotation-revocation-architecture.json';

export default function JwtLearningLab({
  dataFile = VALIDATION_DATA_FILE,
}: {
  dataFile?: string;
}) {
  if (dataFile === SESSION_DATA_FILE) {
    return <JwtSessionArchitectureLab dataFile={dataFile} />;
  }

  return <JwtTokenValidationLab dataFile={dataFile} />;
}
