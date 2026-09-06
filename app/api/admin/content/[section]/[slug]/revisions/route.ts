import { NextRequest, NextResponse } from 'next/server';
import { adminApiErrorResponse } from '@/lib/admin-api-response';
import { listContentRevisions } from '@/lib/admin-content';
import { requireAdmin } from '@/lib/server-admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ section: string; slug: string }>;
}

export async function GET(request: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    await requireAdmin(request);
    return NextResponse.json({
      revisions: await listContentRevisions(params.section, params.slug),
    });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
