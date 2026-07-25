import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

type PendingAuthorization = {
  state: string;
  verifier: string;
  redirectUri: string;
};

type PendingStore = {
  put(sessionId: string, pending: PendingAuthorization): Promise<void>;
  take(sessionId: string): Promise<PendingAuthorization | null>;
};

const base64url = (value: Buffer) => value.toString('base64url');

function equalSecret(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function beginAuthorization(
  sessionId: string,
  store: PendingStore,
): Promise<string> {
  const state = base64url(randomBytes(32));
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  const redirectUri = 'https://client.example.com/oauth/callback';

  await store.put(sessionId, { state, verifier, redirectUri });

  const request = new URL('https://issuer.example.com/authorize');
  request.search = new URLSearchParams({
    response_type: 'code',
    client_id: 'orders-web',
    redirect_uri: redirectUri,
    scope: 'orders.read',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  return request.toString();
}

export async function completeAuthorization(
  callback: URL,
  sessionId: string,
  store: PendingStore,
): Promise<unknown> {
  // take() makes the transaction one-time even if the callback is replayed.
  const pending = await store.take(sessionId);
  const code = callback.searchParams.get('code');
  const returnedState = callback.searchParams.get('state');

  if (!pending || !code || !returnedState) throw new Error('Invalid OAuth response');
  if (!equalSecret(pending.state, returnedState)) throw new Error('State mismatch');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: 'orders-web',
    code,
    redirect_uri: pending.redirectUri,
    code_verifier: pending.verifier,
  });

  const response = await fetch('https://issuer.example.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      // This credential exists only on the confidential client's backend.
      Authorization: `Basic ${process.env.OAUTH_CLIENT_BASIC}`,
    },
    body,
  });
  if (!response.ok) throw new Error(`Token exchange failed: ${response.status}`);
  return response.json();
}
