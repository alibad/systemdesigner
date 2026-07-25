import { createRemoteJWKSet, jwtVerify } from 'jose';

const issuer = 'https://id.example.com/realms/commerce';
const audience = 'orders-api';
const jwks = createRemoteJWKSet(
  new URL(`${issuer}/protocol/openid-connect/certs`),
  {
    cooldownDuration: 30_000,
    timeoutDuration: 3_000,
  },
);

type AccessDecision =
  | { allowed: true; subject: string; scopes: Set<string> }
  | { allowed: false; reason: string };

export async function verifyOrdersAccess(
  authorizationHeader: string | undefined,
): Promise<AccessDecision> {
  const match = authorizationHeader?.match(/^Bearer ([^\s]+)$/);
  if (!match) {
    return { allowed: false, reason: 'missing_bearer_token' };
  }

  try {
    const { payload, protectedHeader } = await jwtVerify(match[1], jwks, {
      issuer,
      audience,
      algorithms: ['RS256'],
      clockTolerance: 5,
    });

    if (protectedHeader.typ && protectedHeader.typ !== 'JWT') {
      return { allowed: false, reason: 'unexpected_token_type' };
    }

    if (typeof payload.sub !== 'string') {
      return { allowed: false, reason: 'missing_subject' };
    }

    const scopes = new Set(
      typeof payload.scope === 'string'
        ? payload.scope.split(' ').filter(Boolean)
        : [],
    );

    if (!scopes.has('orders:read')) {
      return { allowed: false, reason: 'missing_orders_read_scope' };
    }

    return { allowed: true, subject: payload.sub, scopes };
  } catch {
    return { allowed: false, reason: 'invalid_access_token' };
  }
}
