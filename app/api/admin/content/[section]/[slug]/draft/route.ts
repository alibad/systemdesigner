import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminApiErrorResponse } from '@/lib/admin-api-response';
import {
  discardContentDraft,
  rebaseContentDraft,
  saveContentDraft,
} from '@/lib/admin-content';
import { requireAdmin } from '@/lib/server-admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SaveDraftSchema = z.object({
  source: z.string(),
  baseVersion: z.string().min(1),
  expectedVersion: z.string().min(1).nullable(),
});

const DiscardDraftSchema = z.object({
  expectedVersion: z.string().min(1).nullable(),
});

interface RouteContext {
  params: Promise<{ section: string; slug: string }>;
}

export async function PUT(request: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    const actor = await requireAdmin(request);
    const payload = SaveDraftSchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json(
        { error: 'Draft source, base version, and current draft version are required.' },
        { status: 400 },
      );
    }

    const saved = await saveContentDraft(
      params.section,
      params.slug,
      payload.data.source,
      payload.data.baseVersion,
      actor,
      payload.data.expectedVersion,
    );
    return NextResponse.json(saved);
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    await requireAdmin(request);
    const payload = DiscardDraftSchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json({ error: 'The current draft version is required.' }, { status: 400 });
    }

    await discardContentDraft(params.section, params.slug, payload.data.expectedVersion);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    const actor = await requireAdmin(request);
    const payload = z
      .object({ expectedVersion: z.string().min(1) })
      .safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json({ error: 'The current draft version is required.' }, { status: 400 });
    }

    return NextResponse.json(
      await rebaseContentDraft(
        params.section,
        params.slug,
        payload.data.expectedVersion,
        actor,
      ),
    );
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
