import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { adminApiErrorResponse } from '@/lib/admin-api-response';
import { findEditableContent, publishContentDraft } from '@/lib/admin-content';
import { requireAdmin } from '@/lib/server-admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PublishSchema = z.object({
  draftVersion: z.string().min(1),
  publishedVersion: z.string().min(1),
  message: z.string().max(160).optional(),
});

interface RouteContext {
  params: { section: string; slug: string };
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const actor = await requireAdmin(request);
    const payload = PublishSchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json(
        { error: 'Draft version and published version are required.' },
        { status: 400 },
      );
    }

    const entry = findEditableContent(params.section, params.slug);
    const published = await publishContentDraft(
      params.section,
      params.slug,
      payload.data.draftVersion,
      payload.data.publishedVersion,
      actor,
      payload.data.message,
    );
    revalidatePath(entry.path);
    return NextResponse.json(published);
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
