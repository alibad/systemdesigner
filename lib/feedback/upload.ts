'use client';

/**
 * Client-side media upload for the feedback widget.
 *
 * The project already initializes the Firebase web SDK in `lib/firebase.ts`
 * (which exports a ready `storage` instance). We upload screenshots / recordings
 * / voice notes / attachments / debug logs straight to Firebase Storage from the
 * browser and send only team-only links to the API route. This keeps the API
 * route free of base64 payloads (GitHub issue bodies cap at 65,536 chars) and
 * avoids adding `firebase-admin`.
 *
 * The files are private (see lib/feedback/private-files.ts): this repository's
 * issues are public, so we never publish download URLs. Storage rules require an
 * authenticated Firebase session for writes; the helper below signs in
 * anonymously first so public feedback still works without a full account.
 */

import { assertFirebaseConfigured, signInAnonymouslyIfNeeded, storage } from '@/lib/firebase';
import { ref, uploadBytes, uploadString } from 'firebase/storage';
import { feedbackObjectPath, teamFeedbackFileLink } from './private-files';

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.{2,}/g, '_').slice(0, 150);
}

function fileName(name: string): string {
  return `${Date.now()}-${sanitize(name)}`;
}

async function ensureFeedbackUploadsReady(): Promise<void> {
  assertFirebaseConfigured('Feedback media uploads');
  await signInAnonymouslyIfNeeded();
}

/** Upload a Blob (video/audio/file) and return its team-only link. */
export async function uploadFeedbackBlob(
  blob: Blob,
  name: string,
  contentType?: string
): Promise<string> {
  await ensureFeedbackUploadsReady();
  const file = fileName(name);
  await uploadBytes(ref(storage, feedbackObjectPath(file)), blob, contentType ? { contentType } : undefined);
  return teamFeedbackFileLink(file);
}

/** Upload a base64 data URL (screenshot) and return its team-only link. */
export async function uploadFeedbackDataUrl(
  dataUrl: string,
  name: string
): Promise<string> {
  await ensureFeedbackUploadsReady();
  const file = fileName(name);
  await uploadString(ref(storage, feedbackObjectPath(file)), dataUrl, 'data_url');
  return teamFeedbackFileLink(file);
}

/**
 * Upload plain text (console logs, network logs, HTML snapshot) and return its team-only link.
 * Always uploaded as text/plain — never .html — to avoid GCS render/auth issues.
 */
export async function uploadFeedbackText(
  text: string,
  name: string,
  contentType = 'text/plain'
): Promise<string> {
  await ensureFeedbackUploadsReady();
  const file = fileName(name);
  await uploadString(ref(storage, feedbackObjectPath(file)), text, 'raw', { contentType });
  return teamFeedbackFileLink(file);
}
