import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminApiErrorResponse } from '@/lib/admin-api-response';
import { restoreContentRevisionToDraft } from '@/lib/admin-content';
import { requireAdmin } from '@/lib/server-admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RestoreSchema = z.object({
  expectedDraftVersion: z.string().min(1).nullable(),
});

interface RouteContext {
  params: Promise<{ section: string; slug: string; revisionId: string }>;
}

export async function POST(request: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    const actor = await requireAdmin(request);
    const payload = RestoreSchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json(
        { error: 'The current draft version is required before restoring.' },
        { status: 400 },
      );
    }

    return NextResponse.json(
      await restoreContentRevisionToDraft(
        params.section,
        params.slug,
        params.revisionId,
        payload.data.expectedDraftVersion,
        actor,
      ),
    );
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
