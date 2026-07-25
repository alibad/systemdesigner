import type { NextRequest } from 'next/server';
import { isEmailAdmin } from '@/lib/admin-security';

interface FirebaseAccount {
  localId?: string;
  email?: string;
  emailVerified?: boolean;
  disabled?: boolean;
}

interface FirebaseAccountLookupResponse {
  users?: FirebaseAccount[];
}

export interface VerifiedAdmin {
  uid: string;
  email: string;
}

export class AdminAuthenticationError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403 | 503,
  ) {
    super(message);
    this.name = 'AdminAuthenticationError';
  }
}

function readBearerToken(request: NextRequest): string {
  const authorization = request.headers.get('authorization');
  const [scheme, token] = authorization?.split(' ') ?? [];

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new AdminAuthenticationError('A Firebase ID token is required.', 401);
  }

  return token;
}

export async function verifyFirebaseAdminToken(
  idToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<VerifiedAdmin> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new AdminAuthenticationError(
      'Firebase authentication is not configured for admin mutations.',
      503,
    );
  }

  const response = await fetchImpl(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    throw new AdminAuthenticationError('Your admin session is invalid or has expired.', 401);
  }

  const payload = (await response.json()) as FirebaseAccountLookupResponse;
  const account = payload.users?.[0];
  const email = account?.email?.trim().toLowerCase();

  if (!account?.localId || !email || account.disabled) {
    throw new AdminAuthenticationError('Your admin session is invalid or disabled.', 401);
  }

  if (account.emailVerified !== true) {
    throw new AdminAuthenticationError('Admin accounts must have a verified email address.', 403);
  }

  if (!isEmailAdmin(email)) {
    throw new AdminAuthenticationError('You do not have permission to edit content.', 403);
  }

  return { uid: account.localId, email };
}

export async function requireAdmin(request: NextRequest): Promise<VerifiedAdmin> {
  return verifyFirebaseAdminToken(readBearerToken(request));
}
