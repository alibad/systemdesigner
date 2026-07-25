// Admin security utilities
//
// The admin allow-list is configured via NEXT_PUBLIC_ADMIN_EMAILS (comma-separated) and
// centralized in lib/site-config.ts so forks can set their own admins without editing code.

import { ADMIN_EMAILS } from './site-config';

export function isEmailAdmin(email: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export function isUserAdmin(user: any): boolean {
  if (!user || user.isAnonymous) return false;
  return isEmailAdmin(user.email);
}

// For additional security, you could also check Firebase custom claims
// This would require setting up Firebase Admin SDK on the server side
export async function verifyAdminClaim(idToken: string): Promise<boolean> {
  // This would require Firebase Admin SDK to verify custom claims
  // For now, we rely on client-side email checking
  return true;
}