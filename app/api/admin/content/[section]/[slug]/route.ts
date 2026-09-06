import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminApiErrorResponse } from '@/lib/admin-api-response';
import {
  findEditableContent,
  getContentStudioDocument,
  validateEditableContentSource,
} from '@/lib/admin-content';
import { requireAdmin } from '@/lib/server-admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ValidatePayloadSchema = z.object({
  source: z.string(),
});

interface RouteContext {
  params: Promise<{ section: string; slug: string }>;
}

export async function GET(request: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    await requireAdmin(request);
    return NextResponse.json(await getContentStudioDocument(params.section, params.slug), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}

export async function POST(request: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    await requireAdmin(request);
    const payload = ValidatePayloadSchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json({ error: 'A lesson source string is required.' }, { status: 400 });
    }

    const entry = findEditableContent(params.section, params.slug);
    const parsed = validateEditableContentSource(entry, payload.data.source);

    return NextResponse.json({ valid: true, derived: parsed.derived, tree: parsed.tree });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
