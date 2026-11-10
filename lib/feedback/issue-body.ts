/**
 * Builds the Markdown body of a feedback GitHub issue.
 *
 * The issue lands in alibad/systemdesigner, which is a PUBLIC repository, so
 * the body must never carry the reporter's email address. When someone asks
 * to be told when their report is resolved, the widget stores the address in
 * the team-only Firestore `feedback` record (read by admins only, see
 * firestore.rules), and the admin "resolve" flow emails them from there. The
 * issue only says that a reply was requested.
 */

export interface FeedbackCapture {
  elementInfo?: string;
  position?: { x: number; y: number };
  screenshotUrl?: string;
}

export interface FeedbackAttachment {
  name: string;
  url: string;
  type?: string;
  size?: number;
}

export interface FeedbackDiagnostics {
  metadata?: Record<string, unknown>;
  consoleUrl?: string;
  networkUrl?: string;
  htmlUrl?: string;
}

export interface FeedbackPayload {
  title: string;
  description?: string;
  category?: string;
  captures?: FeedbackCapture[];
  videoUrl?: string;
  audioUrl?: string;
  attachments?: FeedbackAttachment[];
  diagnostics?: FeedbackDiagnostics;
  pagePath?: string;
  currentUrl?: string;
  userAgent?: string;
  /** True when the reporter asked to be emailed once the report is resolved. */
  wantsReply?: boolean;
  /**
   * Older widget builds still send the address itself. It is accepted and
   * ignored: it must never reach the public issue.
   */
  email?: string;
}

export function buildIssueBody(data: FeedbackPayload, pageName: string): string {
  const {
    description,
    category,
    captures = [],
    videoUrl,
    audioUrl,
    attachments = [],
    diagnostics,
    currentUrl,
    userAgent,
  } = data;
  const wantsReply = Boolean(data.wantsReply || data.email?.trim());

  const parts: string[] = [];

  parts.push(`**Page:** ${pageName}`);
  if (currentUrl) parts.push(`**URL:** ${currentUrl}`);
  parts.push('');

  parts.push('## Description');
  parts.push(description?.trim() || '_No description provided._');
  parts.push('');

  if (category) {
    parts.push(`**Category:** ${category}`);
    parts.push('');
  }

  const withContent = captures.filter((c) => c.elementInfo || c.screenshotUrl);
  if (withContent.length > 0) {
    parts.push('## Selections & Screenshots');
    withContent.forEach((c, i) => {
      parts.push(`### Selection ${i + 1}`);
      if (c.elementInfo) parts.push(`**Element:** \`${c.elementInfo}\``);
      if (c.position) parts.push(`**Position:** (${c.position.x}, ${c.position.y})`);
      if (c.screenshotUrl) parts.push(`[Open capture ${i + 1} (team sign-in)](${c.screenshotUrl})`);
      parts.push('');
    });
  }

  if (videoUrl) {
    parts.push('## Screen Recording');
    parts.push(`[View recording](${videoUrl})`);
    parts.push('');
  }

  if (audioUrl) {
    parts.push('## Voice Note');
    parts.push(`[Listen to voice note](${audioUrl})`);
    parts.push('');
  }

  if (attachments.length > 0) {
    parts.push('## Attachments');
    for (const a of attachments) {
      parts.push(`- [${a.name}](${a.url})`);
    }
    parts.push('');
  }

  parts.push('## Environment');
  const meta = diagnostics?.metadata as
    | Record<string, string | number | boolean | undefined>
    | undefined;
  if (meta) {
    if (meta.viewport) parts.push(`- **Viewport:** ${meta.viewport}`);
    if (meta.screen) parts.push(`- **Screen:** ${meta.screen}`);
    if (meta.language) parts.push(`- **Language:** ${meta.language}`);
    if (meta.platform) parts.push(`- **Platform:** ${meta.platform}`);
    if (typeof meta.onLine !== 'undefined') parts.push(`- **Online:** ${meta.onLine}`);
    if (meta.connection) parts.push(`- **Connection:** ${meta.connection}`);
  }
  if (userAgent) parts.push(`- **User Agent:** ${userAgent}`);
  parts.push(`- **Timestamp:** ${new Date().toISOString()}`);
  parts.push('');

  const debugLinks: string[] = [];
  if (diagnostics?.consoleUrl) debugLinks.push(`- [Console logs](${diagnostics.consoleUrl})`);
  if (diagnostics?.networkUrl) debugLinks.push(`- [Network requests](${diagnostics.networkUrl})`);
  if (diagnostics?.htmlUrl) debugLinks.push(`- [Page HTML snapshot](${diagnostics.htmlUrl})`);
  if (debugLinks.length > 0) {
    parts.push('## Debug Logs');
    parts.push(...debugLinks);
    parts.push('');
  }

  if (wantsReply) {
    parts.push('---');
    parts.push(
      '- **Reporter asked to be told when this is resolved.** Their address is in the admin feedback list (/admin/feedback), not here: this repository is public.'
    );
  }

  return parts.join('\n');
}
