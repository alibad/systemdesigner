'use client';

/**
 * Client-side media upload for the feedback widget.
 *
 * The project already initializes the Firebase web SDK in `lib/firebase.ts`
 * (which exports a ready `storage` instance). We upload screenshots / recordings
 * / voice notes / attachments / debug logs straight to Firebase Storage from the
 * browser and send only the resulting public download URLs to the API route.
 * This keeps the API route free of base64 payloads (GitHub issue bodies cap at
 * 65,536 chars) and avoids adding `firebase-admin`.
 *
 * Storage rules require an authenticated Firebase session for writes. The helper
 * below signs in anonymously first so public feedback still works without a
 * full user account on deployments that configure Firebase.
 */

import { assertFirebaseConfigured, signInAnonymouslyIfNeeded, storage } from '@/lib/firebase';
import { ref, uploadBytes, uploadString, getDownloadURL } from 'firebase/storage';

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function path(name: string): string {
  return `feedback/${Date.now()}-${sanitize(name)}`;
}

async function ensureFeedbackUploadsReady(): Promise<void> {
  assertFirebaseConfigured('Feedback media uploads');
  await signInAnonymouslyIfNeeded();
}

/** Upload a Blob (video/audio/file) and return its public download URL. */
export async function uploadFeedbackBlob(
  blob: Blob,
  name: string,
  contentType?: string
): Promise<string> {
  await ensureFeedbackUploadsReady();
  const r = ref(storage, path(name));
  await uploadBytes(r, blob, contentType ? { contentType } : undefined);
  return getDownloadURL(r);
}

/** Upload a base64 data URL (screenshot) and return its public download URL. */
export async function uploadFeedbackDataUrl(
  dataUrl: string,
  name: string
): Promise<string> {
  await ensureFeedbackUploadsReady();
  const r = ref(storage, path(name));
  await uploadString(r, dataUrl, 'data_url');
  return getDownloadURL(r);
}

/**
 * Upload plain text (console logs, network logs, HTML snapshot) and return its URL.
 * Always uploaded as text/plain — never .html — to avoid GCS render/auth issues.
 */
export async function uploadFeedbackText(
  text: string,
  name: string,
  contentType = 'text/plain'
): Promise<string> {
  await ensureFeedbackUploadsReady();
  const r = ref(storage, path(name));
  await uploadString(r, text, 'raw', { contentType });
  return getDownloadURL(r);
}
