import { createRemoteJWKSet, jwtVerify } from 'jose';

const ISSUER = 'https://issuer.example';
const AUDIENCE = 'https://orders.example/api';
const JWKS_URI = 'https://issuer.example/oauth2/jwks';
const ALGORITHMS = ['RS256'];

const trustedKeys = createRemoteJWKSet(new URL(JWKS_URI));

export async function verifyAccessToken(token) {
  const { payload, protectedHeader } = await jwtVerify(token, trustedKeys, {
    algorithms: ALGORITHMS,
    issuer: ISSUER,
    audience: AUDIENCE,
    clockTolerance: 30,
    requiredClaims: ['sub', 'exp', 'iat', 'jti', 'client_id'],
  });

  if (protectedHeader.typ?.toLowerCase() !== 'at+jwt') {
    throw new Error('Unexpected JWT type');
  }

  const scopes = new Set(
    typeof payload.scope === 'string'
      ? payload.scope.split(' ').filter(Boolean)
      : [],
  );

  return Object.freeze({
    subject: payload.sub,
    clientId: payload.client_id,
    scopes,
  });
}
