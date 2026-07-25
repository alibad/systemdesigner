import { NextRequest, NextResponse } from 'next/server';
import {
  getOctokit,
  GITHUB_OWNER,
  GITHUB_REPO,
  isGitHubAppConfigured,
} from '@/lib/github';
import { getContentByPath } from '@/lib/content-registry';

export const runtime = 'nodejs';

const CATEGORY_LABELS: Record<string, string[]> = {
  bug: ['bug', 'feedback'],
  feature: ['enhancement', 'feedback'],
  ui: ['ui/ux', 'feedback'],
  content: ['content', 'feedback'],
  general: ['feedback'],
};

const ISSUES_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/issues/new/choose`;

interface Capture {
  elementInfo?: string;
  position?: { x: number; y: number };
  screenshotUrl?: string;
}

interface Attachment {
  name: string;
  url: string;
  type?: string;
  size?: number;
}

interface Diagnostics {
  metadata?: Record<string, unknown>;
  consoleUrl?: string;
  networkUrl?: string;
  htmlUrl?: string;
}

interface FeedbackPayload {
  title: string;
  description?: string;
  category?: string;
  captures?: Capture[];
  videoUrl?: string;
  audioUrl?: string;
  attachments?: Attachment[];
  diagnostics?: Diagnostics;
  pagePath?: string;
  currentUrl?: string;
  userAgent?: string;
  email?: string;
}

function resolvePageName(pagePath?: string, currentUrl?: string): string {
  if (pagePath) {
    const node = getContentByPath(pagePath);
    if (node?.title) return node.title;
    if (pagePath === '/' || pagePath === '') return 'Home';
    return pagePath;
  }
  if (currentUrl) {
    try {
      return new URL(currentUrl).pathname || 'Home';
    } catch {
      return currentUrl;
    }
  }
  return 'Home';
}

function buildIssueBody(data: FeedbackPayload, pageName: string): string {
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
    email,
  } = data;

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
      if (c.screenshotUrl) parts.push(`![Capture ${i + 1}](${c.screenshotUrl})`);
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

  if (email) {
    parts.push('---');
    parts.push(`- **Email for follow-up:** ${email}`);
    parts.push('');
    parts.push(`<!-- notify-email: ${email} -->`);
  }

  return parts.join('\n');
}

export async function GET() {
  return NextResponse.json({
    configured: isGitHubAppConfigured(),
    issuesUrl: ISSUES_URL,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as FeedbackPayload;
    const { title, category } = body;

    if (!title?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      );
    }

    if (!isGitHubAppConfigured()) {
      return NextResponse.json(
        {
          success: false,
          code: 'setup_required',
          error: 'In-app feedback is not configured in this environment.',
          issuesUrl: ISSUES_URL,
        },
        { status: 503 }
      );
    }

    let octokit;
    try {
      octokit = getOctokit();
    } catch (err) {
      console.error('Feedback: GitHub App initialization failed', err);
      return NextResponse.json(
        {
          success: false,
          error: 'Feedback delivery is temporarily unavailable.',
        },
        { status: 500 }
      );
    }

    const pageName = resolvePageName(body.pagePath, body.currentUrl);
    const issueBody = buildIssueBody(body, pageName);
    const cat = (category || 'general').toLowerCase();
    const CATEGORY_DISPLAY: Record<string, string> = {
      bug: 'Bug',
      feature: 'Feature',
      ui: 'UI/UX',
      content: 'Content',
      general: 'General',
    };
    const displayCat =
      CATEGORY_DISPLAY[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
    const issueTitle = `[${displayCat}] ${title} — ${pageName}`;
    const labels = CATEGORY_LABELS[cat] || ['feedback'];

    let issue;
    try {
      const res = await octokit.issues.create({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        title: issueTitle,
        body: issueBody,
        labels,
      });
      issue = res.data;
    } catch (err: unknown) {
      // Labels may not exist yet (422) — retry without them.
      const status = (err as { status?: number })?.status;
      if (status === 422) {
        const res = await octokit.issues.create({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          title: issueTitle,
          body: issueBody,
        });
        issue = res.data;
      } else {
        throw err;
      }
    }

    return NextResponse.json({
      success: true,
      issueUrl: issue.html_url,
      issueNumber: issue.number,
    });
  } catch (error) {
    console.error('Feedback API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
