/**
 * SITE / FORK CONFIGURATION — single source of truth for deployment-specific values.
 *
 * SystemDesigner is open source (https://github.com/alibad/systemdesigner). Everything that is
 * specific to a particular deployment — the Firebase project, the admin allow-list, the GitHub repo
 * used for "Edit this page" links — is read from environment variables here.
 *
 * Forking? Override these via a `.env.local` file — see `.env.example` and `docs/DEVELOPMENT.md`.
 *
 * NOTE: `NEXT_PUBLIC_*` values are embedded in the client bundle. That is expected and safe here:
 * Firebase web API keys are public identifiers, not secrets — access is controlled by Firestore /
 * Storage security rules, not by key secrecy.
 */

// ---------------------------------------------------------------------------
// Firebase web config (public by design)
// ---------------------------------------------------------------------------
const firebaseEnv = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
};

export const isFirebaseConfigured = Boolean(
  firebaseEnv.apiKey &&
    firebaseEnv.authDomain &&
    firebaseEnv.projectId &&
    firebaseEnv.storageBucket &&
    firebaseEnv.messagingSenderId &&
    firebaseEnv.appId
);

export const firebaseConfig = isFirebaseConfigured
  ? firebaseEnv
  : {
      apiKey: 'local-disabled',
      authDomain: 'localhost',
      projectId: 'systemdesigner-local-disabled',
      storageBucket: 'systemdesigner-local-disabled.appspot.com',
      messagingSenderId: '0',
      appId: '1:0:web:local-disabled',
      measurementId: '',
    };

// ---------------------------------------------------------------------------
// Admin allow-list (comma-separated emails, e.g. "you@example.com,teammate@example.com")
// ---------------------------------------------------------------------------
export const ADMIN_EMAILS: string[] = (
  process.env.NEXT_PUBLIC_ADMIN_EMAILS || ''
)
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

// ---------------------------------------------------------------------------
// GitHub repo — powers in-app "Edit this page" / "Suggest an improvement" links
// and the feedback → Issues bridge. Format: "owner/repo".
// ---------------------------------------------------------------------------
export const GITHUB_REPO =
  process.env.NEXT_PUBLIC_GITHUB_REPO || 'alibad/systemdesigner';

export const GITHUB_BRANCH =
  process.env.NEXT_PUBLIC_GITHUB_BRANCH || 'main';

export const GITHUB_REPO_URL = `https://github.com/${GITHUB_REPO}`;

// ---------------------------------------------------------------------------
// Public app URL (used for absolute links, SEO, emails)
// ---------------------------------------------------------------------------
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://systemdesigner.net';

/**
 * Build the GitHub web-editor URL for a content body given its public route.
 * e.g. "/fundamentals/scalability-basics" ->
 * .../edit/main/content/entries/fundamentals/scalability-basics/index.mdoc
 */
export function githubEditUrl(pathname: string): string {
  const clean = pathname.replace(/\/+$/, ''); // strip trailing slash
  return `${GITHUB_REPO_URL}/edit/${GITHUB_BRANCH}/content/entries${clean}/index.mdoc`;
}

/**
 * Build a prefilled "Content improvement" GitHub issue URL for a given page.
 */
export function githubSuggestUrl(pathname: string, title?: string): string {
  const pageTitle = title ? `${title}` : pathname;
  const params = new URLSearchParams({
    template: 'content_improvement.yml',
    title: `[Content] ${pageTitle}`,
    // 'page-url' matches the field id in .github/ISSUE_TEMPLATE/content_improvement.yml,
    // so the live URL is prefilled into the form.
    'page-url': `${APP_URL}${pathname}`,
  });
  return `${GITHUB_REPO_URL}/issues/new?${params.toString()}`;
}
