import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { readFileSync } from 'node:fs';

export const GITHUB_OWNER = process.env.GITHUB_REPO_OWNER || 'alibad';
export const GITHUB_REPO = process.env.GITHUB_REPO_NAME || 'systemdesigner';

export function isGitHubAppConfigured(): boolean {
  return Boolean(
    process.env.GITHUB_APP_ID &&
      process.env.GITHUB_APP_INSTALLATION_ID &&
      (process.env.GITHUB_APP_PRIVATE_KEY_PATH ||
        process.env.GITHUB_APP_PRIVATE_KEY)
  );
}

/**
 * Resolve the GitHub App private key from one of three formats:
 *  - a file path (local dev): GITHUB_APP_PRIVATE_KEY_PATH
 *  - a raw PEM string:        GITHUB_APP_PRIVATE_KEY (starts with "-----")
 *  - a base64-encoded PEM:    GITHUB_APP_PRIVATE_KEY (for hosting env vars)
 */
function resolvePrivateKey(): string {
  const keyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
  if (keyPath) {
    return readFileSync(keyPath, 'utf8');
  }
  const raw = process.env.GITHUB_APP_PRIVATE_KEY || '';
  if (raw.startsWith('-----')) return raw;
  return Buffer.from(raw, 'base64').toString('utf8');
}

/**
 * Returns an Octokit client authenticated as the GitHub App installation.
 * Installation tokens are auto-managed by @octokit/auth-app (no manual refresh).
 *
 * Throws if the App credentials are not configured — callers should catch and
 * surface a clear "feedback not configured" error.
 */
export function getOctokit(): Octokit {
  const appId = process.env.GITHUB_APP_ID;
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;

  if (!isGitHubAppConfigured()) {
    throw new Error(
      'GitHub App auth not configured. Set GITHUB_APP_ID, GITHUB_APP_INSTALLATION_ID, and either GITHUB_APP_PRIVATE_KEY_PATH or GITHUB_APP_PRIVATE_KEY.'
    );
  }

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey: resolvePrivateKey(),
      installationId: Number(installationId),
    },
  });
}
