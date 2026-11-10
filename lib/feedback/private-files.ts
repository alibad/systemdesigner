/**
 * Feedback uploads (screenshots, recordings, voice notes, attachments, console
 * and network logs, page HTML) are PRIVATE files under `feedback/` in Firebase
 * Storage. This repository and its GitHub issues are public, so an issue must
 * never carry a download URL: those URLs embed a token that works for anyone.
 *
 * Issues link to /admin/feedback/file?name=<file> instead. That page needs the
 * maintainer's sign-in, and storage.rules only lets the maintainer read
 * `feedback/`.
 */

import { APP_URL } from '@/lib/site-config';

export const FEEDBACK_STORAGE_PREFIX = 'feedback/';

const SAFE_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

/** True for the flat file names the widget writes (no paths, no `..`). */
export function isSafeFeedbackFileName(name: unknown): name is string {
  return typeof name === 'string' && SAFE_FILE_NAME.test(name) && !name.includes('..');
}

export function feedbackObjectPath(name: string): string {
  if (!isSafeFeedbackFileName(name)) {
    throw new Error('Invalid feedback file name');
  }
  return `${FEEDBACK_STORAGE_PREFIX}${name}`;
}

/** Team-only link to a private feedback file (maintainer sign-in required). */
export function teamFeedbackFileLink(name: string, siteUrl: string = APP_URL): string {
  feedbackObjectPath(name);
  return `${siteUrl.replace(/\/+$/, '')}/admin/feedback/file?name=${encodeURIComponent(name)}`;
}
