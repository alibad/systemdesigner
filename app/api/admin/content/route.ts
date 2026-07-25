import { NextRequest, NextResponse } from 'next/server';
import { adminApiErrorResponse } from '@/lib/admin-api-response';
import {
  getCmsDraftBranch,
  getContentPersistenceMode,
  listContentDraftCoordinates,
  listEditableContent,
} from '@/lib/admin-content';
import { requireAdmin } from '@/lib/server-admin-auth';
import { GITHUB_BRANCH } from '@/lib/site-config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const persistence = getContentPersistenceMode();
    const draftCoordinates = await listContentDraftCoordinates();

    return NextResponse.json(
      {
        entries: listEditableContent(draftCoordinates),
        persistence,
        branch: persistence === 'github' ? GITHUB_BRANCH : undefined,
        draftBranch: persistence === 'github' ? getCmsDraftBranch() : undefined,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
