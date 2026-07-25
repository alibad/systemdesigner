import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const originalAdminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS;

describe('server admin authentication', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-api-key';
    process.env.NEXT_PUBLIC_ADMIN_EMAILS = 'admin@example.com';
    vi.resetModules();
  });

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    else process.env.NEXT_PUBLIC_FIREBASE_API_KEY = originalApiKey;

    if (originalAdminEmails === undefined) delete process.env.NEXT_PUBLIC_ADMIN_EMAILS;
    else process.env.NEXT_PUBLIC_ADMIN_EMAILS = originalAdminEmails;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('accepts a verified Firebase account in the admin allow-list', async () => {
    const { verifyFirebaseAdminToken } = await import('./server-admin-auth');
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          users: [
            {
              localId: 'admin-uid',
              email: 'Admin@Example.com',
              emailVerified: true,
            },
          ],
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    await expect(verifyFirebaseAdminToken('valid-token', fetchImpl)).resolves.toEqual({
      uid: 'admin-uid',
      email: 'admin@example.com',
    });
  });

  it('rejects a valid Firebase account outside the admin allow-list', async () => {
    const { AdminAuthenticationError, verifyFirebaseAdminToken } = await import(
      './server-admin-auth'
    );
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          users: [
            {
              localId: 'member-uid',
              email: 'member@example.com',
              emailVerified: true,
            },
          ],
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const result = verifyFirebaseAdminToken('valid-token', fetchImpl);
    await expect(result).rejects.toBeInstanceOf(AdminAuthenticationError);
    await expect(result).rejects.toMatchObject({ status: 403 });
  });

  it('rejects unverified admin email addresses', async () => {
    const { verifyFirebaseAdminToken } = await import('./server-admin-auth');
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          users: [
            {
              localId: 'admin-uid',
              email: 'admin@example.com',
              emailVerified: false,
            },
          ],
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    await expect(verifyFirebaseAdminToken('valid-token', fetchImpl)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('rejects an invalid Firebase ID token', async () => {
    const { verifyFirebaseAdminToken } = await import('./server-admin-auth');
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 400 })) as unknown as typeof fetch;

    await expect(verifyFirebaseAdminToken('invalid-token', fetchImpl)).rejects.toMatchObject({
      status: 401,
    });
  });
});
