import { NextRequest, NextResponse } from 'next/server';
import {
  getOctokit,
  GITHUB_OWNER,
  GITHUB_REPO,
  isGitHubAppConfigured,
} from '@/lib/github';
import { getContentByPath } from '@/lib/content-registry';
import { buildIssueBody, type FeedbackPayload } from '@/lib/feedback/issue-body';

export const runtime = 'nodejs';

const CATEGORY_LABELS: Record<string, string[]> = {
  bug: ['bug', 'feedback'],
  feature: ['enhancement', 'feedback'],
  ui: ['ui/ux', 'feedback'],
  content: ['content', 'feedback'],
  general: ['feedback'],
};

const ISSUES_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/issues/new/choose`;

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
